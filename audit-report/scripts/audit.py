#!/usr/bin/env python3
"""
Floodlight — One-shot audit wrapper

For routine audit delivery, you don't need to think about the two-stage
pipeline. Just run:

    python audit.py raw-export.json \\
        --customer "Acme Capital Ltd" \\
        --period 2026-04-26..2026-05-02 \\
        --headcount 47/52

It will:
  1. Run transform.py on the raw extension export → audit-data.json
  2. Run generate_report.py on the audit data → HTML + PDF
  3. Print the path to the PDF.

Intermediate files are written to output/ so you can inspect them if
the report doesn't look right (start by opening the audit-data.json
to verify the counts, then re-run with --no-pdf to iterate on the
template faster).

For one-off debugging or template iteration, run the underlying
scripts directly — they're documented in their own --help text.
"""
import argparse
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
TRANSFORM = SCRIPT_DIR / "transform.py"
GENERATE = SCRIPT_DIR / "generate_report.py"
DEFAULT_OUTPUT_DIR = SCRIPT_DIR.parent / "output"


def run(cmd: list[str]) -> int:
    """Run a subprocess, streaming output. Returns exit code."""
    print(f"  $ {' '.join(cmd)}")
    return subprocess.call(cmd)


def slugify(s: str) -> str:
    return (
        s.lower().replace(" ", "-").replace(".", "")
        .replace(",", "").replace("/", "-")
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the full Floodlight audit pipeline (transform + report).",
    )
    parser.add_argument("input", help="Raw extension export JSON")
    parser.add_argument("--customer", required=True, help="Customer organisation name")
    parser.add_argument("--period", required=True,
                        help="Audit period in the form YYYY-MM-DD..YYYY-MM-DD")
    parser.add_argument("--headcount", required=True,
                        help="Headcount in the form AUDITED/TOTAL, e.g. 47/52")
    parser.add_argument("--jurisdiction", default="United Kingdom",
                        help="Primary jurisdiction (default: United Kingdom)")
    parser.add_argument("--industry", default="",
                        help='Industry, e.g. "Financial Services (FCA-regulated)"')
    parser.add_argument("--out", help="Output basename (without extension)")
    parser.add_argument("--no-pdf", action="store_true",
                        help="Skip the PDF render (HTML only — faster while iterating)")
    args = parser.parse_args()

    DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Pick output basename
    if args.out:
        out_base = Path(args.out)
        out_base.parent.mkdir(parents=True, exist_ok=True)
    else:
        slug = slugify(args.customer)[:24]
        out_base = DEFAULT_OUTPUT_DIR / f"{slug}-audit"
    audit_data_path = out_base.with_name(out_base.name + "-data").with_suffix(".json")

    print(f"\n[1/2] Transforming raw events → audit data")
    rc = run([
        sys.executable, str(TRANSFORM), args.input,
        "--customer", args.customer,
        "--period", args.period,
        "--headcount", args.headcount,
        "--jurisdiction", args.jurisdiction,
        "--industry", args.industry,
        "--out", str(audit_data_path),
    ])
    if rc != 0:
        print("Transform failed.", file=sys.stderr)
        return rc

    print(f"\n[2/2] Generating report")
    gen_cmd = [
        sys.executable, str(GENERATE), str(audit_data_path),
        "--out", str(out_base),
    ]
    if not args.no_pdf:
        gen_cmd.append("--pdf")
    rc = run(gen_cmd)
    if rc != 0:
        print("Report generation failed.", file=sys.stderr)
        return rc

    print(f"\n✓ Done.")
    if not args.no_pdf:
        print(f"  PDF:  {out_base.with_suffix('.pdf')}")
    print(f"  HTML: {out_base.with_suffix('.html')}")
    print(f"  Data: {audit_data_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
