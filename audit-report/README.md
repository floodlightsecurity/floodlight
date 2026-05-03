# Floodlight Audit Report Generator

Generates branded shadow AI audit reports from Floodlight extension event data. Same Jinja2 template renders to both HTML (for browser preview / iteration) and PDF (for customer delivery).

## What it produces

A 10–12 page A4 report with:

- **Cover** — customer name, audit period, report ID, jurisdiction, prepared-by
- **§1 Executive summary** — headline narrative, four hero stats, risk distribution bar, top three actions
- **§2 Tool inventory** — every observed AI tool ranked by risk, with category / events / users / training behaviour / notes
- **§3 Sensitive content events** — categories the local classifier flagged + a chronological table of high-concern events (credentials, regulated identifiers)
- **§4 Regulatory mapping** — specific obligations under EU AI Act, UK GDPR, FCA SYSC, ISO/IEC 42001
- **§5 Recommendations** — eight ranked recommendations split into "this week / this month / quarterly"
- **§6 Methodology & disclosure** — how the audit was conducted, the privacy contract, limitations, "what this report is not"

## Setup (one time)

```bash
cd audit-report
pip install jinja2 playwright
playwright install chromium
```

## Generating a report

```bash
# HTML only (fast — useful while iterating on the template)
python scripts/generate_report.py sample/sample-audit-data.json

# HTML + PDF
python scripts/generate_report.py sample/sample-audit-data.json --pdf

# Custom output filename
python scripts/generate_report.py data/customer-acme.json --pdf --out output/Acme-Audit-2026-Q2
```

Output goes to `output/` by default, named `<customer-slug>-<report-id>.{html,pdf}`.

## Input data shape

The generator expects a JSON file with these top-level keys (see `sample/sample-audit-data.json` for a complete example):

- `audit_metadata` — customer name, audit period, headcount, jurisdiction, industry, etc.
- `summary_stats` — total events, paste events, distinct tools, distinct users, high-risk count, etc.
- `tools_used` — array of every observed AI tool with risk band, event count, distinct users, notes
- `sensitive_events_summary` — counts per detected category
- `high_concern_events` — chronological list of pastes containing credentials or regulated identifiers

In production, this data is built by the Floodlight backend from extension events. For the free-audit sales motion, you can ask a prospect to run the extension for 7 days, click "Export JSON" in the options page, send you the file, and you transform it into the report shape above using a small Python script (TODO — coming as `scripts/transform_extension_export.py`).

## Customising the template

The HTML template lives at `templates/audit-report.html.j2`. Tweaks worth knowing:

- **Brand colour** is `--amber: #BA7517` — search the CSS to change everywhere
- **Page-level CSS** is at the top of `<style>` — `@page` margins control the printed page
- **Risk-band colours** are CSS vars `--risk-low` / `--risk-med` / `--risk-high` / `--risk-crit` and their corresponding `-bg` variants
- **Footer left/right text** is set in `@page { @bottom-left / @bottom-right }`

After changing the template, regenerate. The HTML opens in any browser; the PDF requires re-running with `--pdf`.

## Iteration workflow

While designing, work in HTML — much faster than waiting for headless Chromium each time:

```bash
# In one terminal
python scripts/generate_report.py sample/sample-audit-data.json
# Open output/...html in your browser, refresh after each change

# When the design is right, render the PDF
python scripts/generate_report.py sample/sample-audit-data.json --pdf
```
