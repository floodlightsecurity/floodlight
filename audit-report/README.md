# Floodlight Audit Report Generator

Generates branded shadow AI audit reports from Floodlight extension event data. Three scripts, but you usually only need one.

## What it produces

A 10–12 page A4 report (HTML + PDF) with:

- **Cover** — customer name, audit period, report ID, jurisdiction, prepared-by
- **§1 Executive summary** — headline narrative, four hero stats, risk distribution bar, top three actions
- **§2 Tool inventory** — every observed AI tool ranked by risk, with category / events / users / training behaviour / notes
- **§3 Sensitive content events** — categories the local classifier flagged + chronological table of high-concern events (credentials, regulated identifiers)
- **§4 Regulatory mapping** — specific obligations under EU AI Act, UK GDPR, FCA SYSC, ISO/IEC 42001
- **§5 Recommendations** — eight ranked recommendations split into "this week / this month / quarterly"
- **§6 Methodology & disclosure** — how the audit was conducted, the privacy contract, limitations, "what this report is not"

## Setup (one time)

```bash
cd audit-report
pip install jinja2 playwright
playwright install chromium
```

## Generating a real audit (the common case)

After a customer runs the Floodlight extension and sends you their exported JSON:

```bash
python scripts/audit.py customer-export.json \
    --customer "Acme Capital Ltd" \
    --period 2026-04-26..2026-05-02 \
    --headcount 47/52 \
    --industry "Financial Services (FCA-regulated)"
```

That single command does the whole pipeline. It writes three files to `output/`:

- `<customer>-audit-data.json` — the structured audit data (intermediate, useful for spot-checking)
- `<customer>-audit.html` — the browser-viewable version (refresh-friendly while iterating)
- `<customer>-audit.pdf` — the customer deliverable

Required arguments:

| Flag | Format | Example |
|---|---|---|
| `--customer` | Free text | `"Acme Capital Ltd"` |
| `--period` | `YYYY-MM-DD..YYYY-MM-DD` | `2026-04-26..2026-05-02` |
| `--headcount` | `audited/total` | `47/52` |

Optional:

| Flag | Default |
|---|---|
| `--jurisdiction` | `United Kingdom` |
| `--industry` | (empty) |
| `--out` | auto from customer slug |
| `--no-pdf` | render HTML only (faster while iterating on the template) |

## Architecture — three scripts, separated for a reason

| Script | What it does | When you run it directly |
|---|---|---|
| `scripts/audit.py` | One-shot wrapper — the common case | Every real audit |
| `scripts/transform.py` | Raw events → aggregated audit data | Debugging counts that look wrong |
| `scripts/generate_report.py` | Audit data → HTML + PDF | Iterating on the template design |

The split is deliberate. `transform.py` does pure computation (counting, grouping, summarising) and produces structured data. `generate_report.py` does pure rendering (Jinja2 → HTML → headless Chromium → PDF) and assumes its input is already aggregated. Keeping them separate means:

- You can spot-check the numbers (`python scripts/transform.py raw.json --customer X --period Y --headcount Z --out data.json`) without spending the seconds it takes to render the PDF
- You can iterate on the template at full speed (`python scripts/generate_report.py output/X-audit-data.json` — no `--pdf`, instant rebuild)
- When we add a web dashboard or Excel export later, they'll reuse `transform.py` unchanged

The wrapper exists so you don't have to think about that split day-to-day.

## Workflow examples

**Routine audit delivery:**
```bash
python scripts/audit.py raw-export.json \
    --customer "BigBank PLC" --period 2026-05-01..2026-05-07 --headcount 184/210
# Result: output/bigbank-plc-audit.pdf — email this
```

**Iterating on the template design:**
```bash
# Use a known-good audit-data file, skip the transform, render HTML only
python scripts/generate_report.py output/acme-real-data.json
# Open output/...html in browser, refresh after each template change
```

**Debugging "the credit card count looks wrong":**
```bash
# Run just the transform, inspect the JSON output
python scripts/transform.py raw-export.json \
    --customer X --period Y --headcount Z --out check.json
# Open check.json — find the sensitive_events_summary section, look for credit_card
```

## Input data shape

The wrapper expects the raw export the Floodlight browser extension produces when a user clicks "Export JSON" in its options page. That file is a flat array of events — `navigation` and `paste` events mixed in chronological order. See `sample/sample-extension-export.json` for an example with 1,847 events shaped exactly as the extension would produce them.

If you want to skip the transform and feed pre-shaped audit data straight to the report, see `sample/sample-audit-data.json` for the post-aggregation shape, and run `generate_report.py` directly.

## Customising the template

The HTML template lives at `templates/audit-report.html.j2`. Tweaks worth knowing:

- **Brand colour** is `--amber: #BA7517` — search the CSS to change everywhere
- **Page-level CSS** is at the top of `<style>` — `@page` margins control the printed page
- **Risk-band colours** are CSS vars `--risk-low` / `--risk-med` / `--risk-high` / `--risk-crit` and their `-bg` variants
- **Footer text** is set in `@page { @bottom-left / @bottom-right }`

After changing the template, regenerate. The HTML opens in any browser; the PDF requires re-running with `--pdf`.

## Files in this folder

```
audit-report/
├── README.md                              you are here
├── scripts/
│   ├── audit.py                           ⭐ the wrapper — what you'll run
│   ├── transform.py                       raw events → audit data
│   ├── generate_report.py                 audit data → HTML + PDF
│   └── _make_sample_extension_export.py   internal — generates the sample for testing
├── templates/
│   └── audit-report.html.j2               the Jinja2 template
├── sample/
│   ├── sample-extension-export.json       1,847 raw events (mirrors a real extension export)
│   └── sample-audit-data.json             pre-aggregated audit data (post-transform shape)
└── output/                                generated files end up here
```
