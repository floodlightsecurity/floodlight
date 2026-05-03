#!/usr/bin/env python3
"""
Floodlight — Transform script

Reads the raw event log exported by the Floodlight browser extension and
computes the pre-aggregated `audit data` shape that generate_report.py
consumes.

The extension's exported JSON is a flat array of every navigation and paste
event recorded during the audit period. This script:

  1. Groups events by tool, counting events and distinct user pseudonyms.
  2. Tallies sensitive content categories detected across all paste events.
  3. Filters the chronological list of high-concern events (credentials,
     regulated identifiers, financial account numbers).
  4. Computes the headline summary stats.
  5. Combines the above with the audit metadata (customer name, period,
     headcount, jurisdiction) supplied via command-line arguments.

The output JSON file is what generate_report.py reads to render the report.

Usage:
  python transform.py raw-export.json \
      --customer "Acme Capital Ltd" \
      --period 2026-04-26..2026-05-02 \
      --headcount 47/52 \
      --jurisdiction "United Kingdom" \
      --industry "Financial Services (FCA-regulated)" \
      --out audit-data.json
"""
import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Categories the report treats as "high concern" — credentials, regulated
# identifiers, and financial account numbers. Keep this in sync with the
# `isHighConcern` allow-list in extension/src/classifier.js.
HIGH_CONCERN_CATEGORIES = {
    "credit_card",
    "api_key_openai",
    "api_key_anthropic",
    "api_key_github",
    "api_key_aws",
    "api_key_slack",
    "api_key_stripe",
    "jwt",
    "uk_ni",
    "us_ssn",
    "iban",
}

# Human-readable labels for each detection category. Used in the
# `sensitive_events_summary` section of the report.
CATEGORY_LABELS = {
    "email": "Email address",
    "phone_uk": "UK phone number",
    "phone_us": "US phone number",
    "credit_card": "Credit card number (16-digit pattern)",
    "api_key_openai": "OpenAI API key",
    "api_key_anthropic": "Anthropic API key",
    "api_key_github": "GitHub token",
    "api_key_aws": "AWS access key",
    "api_key_slack": "Slack API token",
    "api_key_stripe": "Stripe API key",
    "jwt": "JSON Web Token",
    "uk_ni": "UK National Insurance number",
    "us_ssn": "US Social Security number",
    "ip_address": "IPv4 address",
    "iban": "IBAN (international bank account)",
    "uuid": "UUID (likely a database identifier)",
    "source_code": "Source code",
    "base64_blob": "Long base64 blob",
}


def load_extension_export(path: Path) -> list[dict[str, Any]]:
    """
    The extension's Export JSON button writes either a bare array of events
    or — in some future versions — an envelope object with the events under
    an "events" key. Accept both.
    """
    with path.open() as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("events"), list):
        return data["events"]
    raise ValueError(
        f"Unexpected JSON shape in {path}. Expected an array of events or "
        f"an object with an 'events' array. Got: {type(data).__name__}"
    )


def aggregate_tools(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group events by tool. Compute per-tool event count, distinct users,
    first/last seen timestamps. Preserves the tool's risk metadata from the
    first event we see for that tool."""
    grouped: dict[str, dict[str, Any]] = {}
    for ev in events:
        tool_meta = ev.get("tool")
        if not tool_meta or not tool_meta.get("name"):
            continue
        name = tool_meta["name"]

        if name not in grouped:
            grouped[name] = {
                "name": name,
                "category": tool_meta.get("category", ""),
                "risk_band": tool_meta.get("risk_band", ""),
                "risk_score": tool_meta.get("risk_score", 0),
                "trains_on_input": tool_meta.get("trains_on_input", ""),
                "events": 0,
                "_users": set(),
                "first_seen": ev.get("timestamp", ""),
                "last_seen": ev.get("timestamp", ""),
                "notes": tool_note_for(name, tool_meta),
            }
        bucket = grouped[name]
        bucket["events"] += 1
        if ev.get("user_pseudonym"):
            bucket["_users"].add(ev["user_pseudonym"])
        ts = ev.get("timestamp", "")
        if ts and ts < bucket["first_seen"]:
            bucket["first_seen"] = ts
        if ts and ts > bucket["last_seen"]:
            bucket["last_seen"] = ts

    # Materialise: convert _users sets to counts, drop them, sort by risk
    result = []
    for bucket in grouped.values():
        bucket["distinct_users"] = len(bucket["_users"])
        del bucket["_users"]
        result.append(bucket)
    result.sort(key=lambda t: t["risk_score"], reverse=True)
    return result


def tool_note_for(name: str, tool_meta: dict[str, Any]) -> str:
    """A short human-readable note that goes in the tool inventory's Notes
    column. The note explains why the tool got the risk band it did. We
    derive this from a small static map keyed by tool name; tools not on
    the map get a generic note based on their training behaviour."""
    static_notes = {
        "ChatGPT": "Free/Plus tier detected — trains on inputs unless opted out",
        "Claude": "Does not train on user inputs by default",
        "GitHub Copilot": "Individual tier may use prompts for training",
        "Perplexity AI": "Consumer tier retains queries for service improvement",
        "Google Gemini": "Consumer tier may use conversations for product improvement",
        "Cursor": "Privacy Mode available but not enforced by default",
        "Microsoft Copilot": "Consumer version detected — different policy from M365 Copilot",
        "DeepSeek": "Hosted in China; subject to PRC data laws; corporate use strongly discouraged in regulated sectors",
        "Qwen / Tongyi": "Hosted in China; same data sovereignty concerns",
        "Kimi (Moonshot)": "Hosted in China",
        "Kling AI": "Hosted in China; same data sovereignty concerns",
        "Grammarly": "Free/Premium tier retains content for up to 36 months",
        "Otter.ai": "Auto-joining meetings; transcripts often shared widely",
        "Character.AI": "Persona chat platform; high PII risk",
        "Replika": "Companion AI; intimate personal content commonly shared",
        "Bolt.new": "Generates whole apps; prompts and code may be used for improvement",
        "Suno": "Music generation; free tier outputs public",
        "Udio": "Music generation; free tier outputs public",
        "Notion AI": "Bound to workspace DPA; does not train on customer data",
        "DeepL": "GDPR-native; Pro plan does not store text",
        "Midjourney": "Default plans show outputs publicly",
        "Adobe Firefly": "Trained on licensed/public-domain content; commercial-safe",
        "v0 by Vercel": "Generates UI; team plans available",
    }
    if name in static_notes:
        return static_notes[name]
    trains = tool_meta.get("trains_on_input", "")
    if trains == "yes":
        return "Trains on user inputs by default"
    if trains == "no":
        return "Does not train on user inputs"
    if trains == "configurable":
        return "Training behaviour depends on tier and settings"
    return ""


def aggregate_sensitive_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Tally each detection category across all paste events. For each
    category, also list the distinct tool names where it was observed."""
    by_category: dict[str, dict[str, Any]] = {}
    for ev in events:
        if ev.get("event_type") != "paste":
            continue
        cls = ev.get("content_classification") or {}
        cats = cls.get("categories") or []
        tool_name = (ev.get("tool") or {}).get("name", "")
        for cat in cats:
            if cat not in by_category:
                by_category[cat] = {
                    "category": cat,
                    "label": CATEGORY_LABELS.get(cat, cat),
                    "count": 0,
                    "_tools": set(),
                }
            by_category[cat]["count"] += 1
            if tool_name:
                by_category[cat]["_tools"].add(tool_name)

    result = []
    for entry in by_category.values():
        entry["tools_seen_in"] = sorted(entry["_tools"])
        del entry["_tools"]
        result.append(entry)
    result.sort(key=lambda e: e["count"], reverse=True)
    return result


def filter_high_concern_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pull out paste events whose categories include any high-concern
    category. Keep just the fields the report needs and shorten the
    pseudonym to the form `user-XXXX` for readability."""
    out = []
    for ev in events:
        if ev.get("event_type") != "paste":
            continue
        cls = ev.get("content_classification") or {}
        cats = cls.get("categories") or []
        if not any(c in HIGH_CONCERN_CATEGORIES for c in cats):
            continue
        pseudonym = ev.get("user_pseudonym") or "anonymous"
        short = f"user-{pseudonym.split('-')[0][:4]}" if pseudonym != "anonymous" else "anonymous"
        out.append({
            "timestamp": ev.get("timestamp", ""),
            "tool": (ev.get("tool") or {}).get("name", ""),
            "categories": cats,
            "byte_count": cls.get("byte_count", 0),
            "user_pseudonym_short": short,
        })
    out.sort(key=lambda e: e["timestamp"])
    return out


def compute_summary_stats(
    events: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    sensitive: list[dict[str, Any]],
    high_concern: list[dict[str, Any]],
) -> dict[str, Any]:
    nav = sum(1 for e in events if e.get("event_type") == "navigation")
    paste = sum(1 for e in events if e.get("event_type") == "paste")
    high_risk = sum(1 for e in events if (e.get("tool") or {}).get("risk_band") == "HIGH")
    crit_risk = sum(1 for e in events if (e.get("tool") or {}).get("risk_band") == "CRITICAL")
    distinct_users = len({
        e.get("user_pseudonym") for e in events
        if e.get("user_pseudonym")
    })
    pastes_with_content = sum(
        1 for e in events
        if e.get("event_type") == "paste"
        and (e.get("content_classification") or {}).get("categories")
    )
    code_pastes = sum(
        s["count"] for s in sensitive if s["category"] == "source_code"
    )
    cred_pastes = sum(
        s["count"] for s in sensitive
        if s["category"] in HIGH_CONCERN_CATEGORIES
    )
    return {
        "total_events": len(events),
        "navigation_events": nav,
        "paste_events": paste,
        "distinct_tools_used": len(tools),
        "distinct_users_active": distinct_users,
        "high_risk_events": high_risk,
        "critical_risk_events": crit_risk,
        "events_with_sensitive_content": pastes_with_content,
        "code_paste_events": code_pastes,
        "credential_paste_events": cred_pastes,
    }


def parse_period(s: str) -> tuple[str, str]:
    """Parse `YYYY-MM-DD..YYYY-MM-DD` into (start, end)."""
    if ".." not in s:
        raise argparse.ArgumentTypeError(
            "Period must be in the form YYYY-MM-DD..YYYY-MM-DD"
        )
    start, end = s.split("..", 1)
    # Validate
    for d in (start, end):
        try:
            datetime.strptime(d, "%Y-%m-%d")
        except ValueError as e:
            raise argparse.ArgumentTypeError(f"Invalid date '{d}': {e}")
    return start, end


def parse_headcount(s: str) -> tuple[int, int]:
    """Parse `audited/total`, e.g. `47/52`."""
    if "/" not in s:
        raise argparse.ArgumentTypeError(
            "Headcount must be in the form AUDITED/TOTAL, e.g. 47/52"
        )
    a, t = s.split("/", 1)
    try:
        return int(a), int(t)
    except ValueError as e:
        raise argparse.ArgumentTypeError(f"Invalid headcount: {e}")


def slugify(s: str) -> str:
    return (
        s.lower()
        .replace(" ", "-")
        .replace(".", "")
        .replace(",", "")
        .replace("/", "-")
    )


def build_audit_data(
    events: list[dict[str, Any]],
    customer: str,
    period_start: str,
    period_end: str,
    headcount_audited: int,
    headcount_total: int,
    jurisdiction: str,
    industry: str,
) -> dict[str, Any]:
    tools = aggregate_tools(events)
    sensitive = aggregate_sensitive_events(events)
    high_concern = filter_high_concern_events(events)
    summary = compute_summary_stats(events, tools, sensitive, high_concern)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return {
        "audit_metadata": {
            "customer_name": customer,
            "audit_period_start": period_start,
            "audit_period_end": period_end,
            "headcount_audited": headcount_audited,
            "headcount_total": headcount_total,
            "report_generated_at": datetime.now(timezone.utc).isoformat(),
            "report_id": f"FL-{today}-{slugify(customer)[:12]}",
            "auditor": "Floodlight Security",
            "industry": industry,
            "primary_jurisdiction": jurisdiction,
        },
        "summary_stats": summary,
        "tools_used": tools,
        "sensitive_events_summary": sensitive,
        "high_concern_events": high_concern,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Transform raw Floodlight extension events into audit-data JSON.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("Usage:", 1)[1] if "Usage:" in __doc__ else "",
    )
    parser.add_argument("input", help="Path to the extension's raw event JSON")
    parser.add_argument("--customer", required=True, help="Customer organisation name")
    parser.add_argument(
        "--period", required=True, type=parse_period,
        help="Audit period in the form YYYY-MM-DD..YYYY-MM-DD",
    )
    parser.add_argument(
        "--headcount", required=True, type=parse_headcount,
        help="Headcount in the form AUDITED/TOTAL, e.g. 47/52",
    )
    parser.add_argument(
        "--jurisdiction", default="United Kingdom",
        help="Primary jurisdiction (default: United Kingdom)",
    )
    parser.add_argument(
        "--industry", default="",
        help="Industry, e.g. \"Financial Services (FCA-regulated)\"",
    )
    parser.add_argument(
        "--out", help="Output path for the audit-data JSON (default: stdout)",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        return 1

    try:
        events = load_extension_export(input_path)
    except (ValueError, json.JSONDecodeError) as e:
        print(f"Failed to read events from {input_path}: {e}", file=sys.stderr)
        return 1

    if not events:
        print(f"Warning: no events found in {input_path}", file=sys.stderr)

    audit_data = build_audit_data(
        events=events,
        customer=args.customer,
        period_start=args.period[0],
        period_end=args.period[1],
        headcount_audited=args.headcount[0],
        headcount_total=args.headcount[1],
        jurisdiction=args.jurisdiction,
        industry=args.industry,
    )

    out_json = json.dumps(audit_data, indent=2, ensure_ascii=False)
    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(out_json, encoding="utf-8")
        print(f"Audit data written: {out_path}")
        # Also print a quick summary so the user sees something happened
        s = audit_data["summary_stats"]
        print(
            f"  {s['total_events']} events ({s['paste_events']} paste, "
            f"{s['navigation_events']} navigation) across "
            f"{s['distinct_tools_used']} tools and "
            f"{s['distinct_users_active']} users."
        )
        if s["credential_paste_events"]:
            print(
                f"  ⚠  {s['credential_paste_events']} credential pastes flagged."
            )
    else:
        print(out_json)
    return 0


if __name__ == "__main__":
    sys.exit(main())
