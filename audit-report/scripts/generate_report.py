#!/usr/bin/env python3
"""
Floodlight — Audit report generator

Reads a Floodlight audit data JSON file and produces:
  - An HTML report (always)
  - A PDF report (if --pdf is passed and Playwright is available)

The same Jinja2 template renders both outputs. The HTML can be opened in a
browser for preview/iteration; the PDF is what gets emailed to a customer.

Usage:
  python generate_report.py sample/sample-audit-data.json
  python generate_report.py sample/sample-audit-data.json --pdf
  python generate_report.py data.json --pdf --out output/Acme-Audit.pdf
"""
import argparse
import json
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape


def render_html(data: dict, template_dir: Path, template_name: str) -> str:
    env = Environment(
        loader=FileSystemLoader(str(template_dir)),
        autoescape=select_autoescape(['html', 'xml']),
        trim_blocks=False,
        lstrip_blocks=False,
    )
    template = env.get_template(template_name)
    return template.render(**data)


def html_to_pdf(html_path: Path, pdf_path: Path) -> None:
    """Render HTML to PDF via headless Chromium (Playwright)."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Playwright is required for PDF output.\n"
            "Install with:\n"
            "  pip install playwright\n"
            "  playwright install chromium",
            file=sys.stderr,
        )
        sys.exit(2)

    file_url = f"file://{html_path.resolve()}"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(file_url, wait_until="networkidle")
        page.pdf(
            path=str(pdf_path),
            format="A4",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
            prefer_css_page_size=True,
        )
        browser.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a Floodlight audit report.")
    parser.add_argument("data", help="Path to audit data JSON file")
    parser.add_argument("--pdf", action="store_true", help="Also render PDF (requires Playwright)")
    parser.add_argument("--out", help="Output basename (without extension). Defaults to output/<customer-slug>")
    parser.add_argument(
        "--template-dir",
        default=str(Path(__file__).parent.parent / "templates"),
        help="Directory containing audit-report.html.j2",
    )
    parser.add_argument("--template", default="audit-report.html.j2", help="Template filename")
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"Audit data file not found: {data_path}", file=sys.stderr)
        return 1

    with data_path.open() as f:
        data = json.load(f)

    if args.out:
        out_base = Path(args.out)
    else:
        customer_slug = (
            data.get("audit_metadata", {})
            .get("customer_name", "audit")
            .lower()
            .replace(" ", "-")
            .replace(".", "")
            .replace(",", "")
        )
        report_id = data.get("audit_metadata", {}).get("report_id", "report")
        out_base = Path(__file__).parent.parent / "output" / f"{customer_slug}-{report_id}"

    out_base.parent.mkdir(parents=True, exist_ok=True)

    html_path = out_base.with_suffix(".html")
    rendered = render_html(data, Path(args.template_dir), args.template)
    html_path.write_text(rendered, encoding="utf-8")
    print(f"HTML written: {html_path}")

    if args.pdf:
        pdf_path = out_base.with_suffix(".pdf")
        html_to_pdf(html_path, pdf_path)
        print(f"PDF written:  {pdf_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
