# Floodlight — Working Context

This file gives Claude (and any future contributor) the context needed to work on Floodlight without re-deriving it from scratch each session. Read it first; come back to it when decisions feel ambiguous.

Last revised: 2026-05-04

---

## Guardrails (read every time)

These are the rules that override convenience, speed, or cleverness. If a proposed change touches one of these, stop and surface the conflict to the user before proceeding.

### Privacy contract — non-negotiable
- Pasted content (prompt text) **never leaves the user's endpoint**.
- The browser extension classifies pasted content **locally** in the browser.
- Only category labels and counts are emitted in events — never the raw text, never a hash that could be inverted, never a sample.
- This is the *brand* of the product. Any change that weakens this — even temporarily, even for "debugging," even with consent — must be flagged loudly and require explicit user sign-off.
- The privacy contract is documented at `extension/docs/PRIVACY.md` and referenced from the public landing page. Both must stay in sync with the implementation.

### No fabricated data in marketing or reports
- LinkedIn posts, blog content, cold emails, and the landing page must not invent metrics, customer names, conversation counts, or testimonials.
- If a draft says "I've spoken to six fintech CISOs," it must reflect six real conversations. If unsure, soften to "I've spent X weeks researching how UK firms are responding."
- Audit reports must cite **real data from the audit period only**. The Acme Capital sample data (`audit-report/sample/sample-audit-data.json` and `sample-extension-export.json`) is synthetic and is for demos and template iteration only — it must never be used to populate a real customer's report.
- The first time a real customer audit runs, this rule must be enforced explicitly: a script that confirms `audit_metadata.customer_name` matches the input data, and that fails if synthetic markers (e.g. customer name "Acme Capital Ltd") leak into a real report.

### Secrets stay out of the repo
- `RESEND_API_KEY`, future Stripe keys, customer data, real audit JSONs — none of it goes in git.
- `.gitignore` must continue to cover `.dev.vars`, `.env*`, `*.local`, and `audit-report/output/*` (with the Acme demo as the only committed exception).
- If a secret is accidentally committed, rotate it before scrubbing — git history is recoverable but a leaked key is not.

---

## What Floodlight is

- Open-source shadow AI discovery for mid-market regulated companies (initially UK fintech, 50–500 staff).
- Three-layer product:
  1. **Discovery** — browser extension that monitors AI tool usage on the endpoint.
  2. **Classification** — local PII/credential/code classifier on pasted content; risk-scored taxonomy of ~86 AI tools.
  3. **Governance** — branded audit PDF mapped to EU AI Act Article 4, UK GDPR, FCA SYSC, ISO 42001.
- Wedge: free 7-day audit → day-7 PDF → conversion to paid ongoing monitoring.
- Pricing target: ~£5/employee/month. Not yet validated with real customers.

### What it isn't (yet)
- Not a hosted dashboard. Audits today are run manually by the founder.
- Not a policy enforcement tool. The extension observes; it doesn't intervene. "Educate mode" (in-page warning before high-concern paste) is on the roadmap.
- Not cross-platform. Chrome/Edge only. No Safari/Firefox, no mobile, no native desktop apps.
- Not a DLP replacement. It complements existing DLP/CASB; it doesn't replace them.

---

## Repository layout

```
floodlight/
├── README.md
├── LICENSE                          MIT
├── claude.md                        this file
├── .gitignore
├── data/
│   ├── ai-tools-taxonomy.csv        86 tools, 14 categories, risk-scored
│   └── RISK_METHODOLOGY.md          public risk-scoring rules
├── extension/                       browser extension (Manifest V3)
│   ├── manifest.json                Chrome/Edge MV3, ~60 AI domains
│   ├── src/
│   │   ├── taxonomy.js              canonical 62-tool lookup
│   │   ├── classifier.js            regex-based PII/credential/code detection
│   │   ├── content.js               self-contained IIFE; MV3 doesn't allow ES imports in content scripts
│   │   ├── background.js            service worker, sanitises events, batches via chrome.alarms
│   │   └── storage.js
│   ├── public/                      popup.html, options.html, icons
│   └── docs/PRIVACY.md              byte-by-byte privacy disclosure
├── audit-report/                    audit pipeline
│   ├── README.md
│   ├── scripts/
│   │   ├── audit.py                 one-shot wrapper — what users normally run
│   │   ├── transform.py             raw events → audit-data JSON
│   │   ├── generate_report.py       audit-data → HTML + PDF (Playwright/Chromium)
│   │   └── _make_sample_extension_export.py    internal, generates sample data
│   ├── templates/audit-report.html.j2
│   ├── sample/
│   │   ├── sample-extension-export.json    synthetic 1,847 events
│   │   └── sample-audit-data.json          post-aggregation shape
│   └── output/                      generated artifacts; mostly gitignored
└── landing/                         marketing site
    ├── public/
    │   ├── index.html               single-file landing page
    │   └── _headers                 Cloudflare security headers
    ├── functions/api/lead.js        Cloudflare Pages Function (form handler)
    └── README.md                    deployment instructions
```

---

## Architecture decisions worth knowing

### Extension
- **Manifest V3.** No background pages, only service workers. Content scripts cannot use ES `import` — `content.js` is a self-contained IIFE with inlined taxonomy/classifier copies.
- **Local-first classification.** `classifier.js` runs in the content script before any event is emitted. Categories are tagged; the original text is discarded immediately.
- **Pseudonymous events.** Each install gets a UUID stored only on the device. The pseudonym identifies a *device*, not a human; mapping to employees requires a separate manual step by the customer's IT.
- **Known duplication.** The taxonomy is duplicated between `extension/src/taxonomy.js` and an inlined copy in `content.js`. Sync by hand for now. Build pipeline is future work.

### Audit pipeline
- **Three scripts, deliberately separate**: `transform.py` (compute), `generate_report.py` (render), `audit.py` (wrapper). Don't merge them. Reasons: independent debuggability, fast template iteration, and `transform.py` is reusable when we add a hosted dashboard or Excel export later.
- **PDF via headless Chromium**, not reportlab. Higher visual quality, real CSS, easier to iterate. Costs ~150MB Chromium install but the trade is worth it for a £2k/month deliverable.
- **Single Jinja2 template** drives both HTML and PDF. The HTML is for browser preview / iteration; the PDF is the customer deliverable.
- **Tool notes in `transform.py` are static.** Keyed by tool name, fall back to a generic note based on `trains_on_input`. Move this into the canonical taxonomy CSV when convenient.

### Landing page
- **Cloudflare Pages**, not Vercel. Vercel Hobby tier prohibits commercial use; Cloudflare Pages free tier permits it. Don't migrate back to Vercel without a deliberate cost decision.
- **Single static HTML file** (`landing/public/index.html`), no framework. Easier to host, easier to audit, faster TTFB.
- **Form handler** is a Cloudflare Pages Function at `functions/api/lead.js`. File-routed: the path *is* the route. Receives form POST, validates, sends via Resend.
- **Resend for transactional email.** Domain `floodlightsecurity.co` is verified (DKIM, SPF, return-path). DMARC is `p=none` for now — escalate to `p=quarantine` after ~60 days of clean sending history. API key is scoped to the one domain (not "all domains").

### Hosting & infra
- **Domain registrar:** Cloudflare. DNS, hosting, SSL, the form handler — all on one Cloudflare account, intentional.
- **Repo:** `github.com/floodlightsecurity/floodlight`, public, MIT licensed.
- **Email:** transactional from `leads@floodlightsecurity.co`. Don't use this address for cold outreach — it's transactional only, mixing the two poisons reputation. Cold email should come from a real personal address (`david@floodlightsecurity.co` once configured).

---

## Current state (as of last revision)

### Shipped & working
- Browser extension (sideloaded, working on Chrome).
- Risk-scored taxonomy (86 tools, public).
- Audit pipeline end-to-end: `python scripts/audit.py raw-export.json --customer "X" --period Y --headcount Z` produces a real PDF.
- Landing page live at `https://floodlightsecurity.co`.
- Lead-capture form delivers to inbox via Resend.

### Working but scrappy
- Self-audit. Founder has run the extension on own browser; the export is currently sparse (~1 event). Will be more useful after a week of normal use.
- Resend domain reputation. Brand-new sender; first transactional email landed in Gmail spam (expected). Reputation builds with delivery + engagement over time. Don't escalate DMARC yet.

### Not built yet (roadmap, in rough priority order)
1. **Educate mode** — in-page warning before high-concern paste lands. Converts product from one-time audit to ongoing prevention. Likely v0.2.
2. **Hosted dashboard** — for org-mode customers to see live activity instead of waiting for the next audit. Requires backend (FastAPI + Postgres on Fly.io has been discussed).
3. **DNS-level monitoring** — extends discovery beyond browser-only to catch native desktop AI apps and mobile.
4. **ML-based classifier upgrade** — current regex classifier produces false positives. Architecture supports the upgrade without breaking the privacy contract (must still run locally).
5. **Multi-browser** — Safari, Firefox, Arc.

---

## Strategy & current direction (revisitable)

These reflect the current bet, not eternal truth. Each is tagged with what would cause us to revisit it.

- **Target buyer: UK fintech CISOs / Heads of Security at firms with 50–500 staff, FCA-regulated.**
  *Revisit if:* three weeks of outreach produce more healthtech or consultancy interest than fintech.
- **Wedge: free 7-day audit → day-7 PDF.**
  *Revisit if:* prospects routinely want a longer or shorter window, or a different deliverable than a PDF.
- **Open-source as core trust pillar.**
  *Revisit if:* prospects routinely don't care about the open-source claim or actively prefer closed-source for legal-defensibility reasons.
- **Pricing target: ~£5/employee/month.**
  *Revisit:* always. This is a guess, not a price. First three real conversations will start to validate or invalidate it.
- **Channel mix for next 4 weeks: Show HN + cold email primary, LinkedIn secondary.**
  *Revisit if:* one channel produces conversations and another produces silence, double down on what's working.

---

## Conventions

### Code style
- Python 3.11+. Type hints where they aid clarity, not as ceremony.
- Standard library first. Third-party deps require justification (current deps: Jinja2, Playwright, that's it on the audit-report side).
- One file per script unless there's a real reason. The three audit scripts are separate because they have distinct responsibilities, not because we like splitting things.

### Commit messages
- Conventional commits: `feat(area):`, `fix(area):`, `chore(area):`, `docs(area):`. Areas in use: `extension`, `audit-report`, `landing`, `data`.
- Body explains *why*, not *what*. The diff shows what.
- No co-author lines or AI signatures in commit messages.

### Don't do these things
- Don't add new top-level dependencies without flagging it. Each dep is a future maintenance burden.
- Don't reformat unrelated files in a feature commit. Keep diffs focused.
- Don't write commit messages that promise more than the code delivers ("complete overhaul" for a small refactor, etc.).
- Don't generate or use placeholder customer data in places it could leak into a real report. The Acme demo is fine in samples; treat real customer slugs as taint.

---

## How Claude should behave in this repo

When working on Floodlight via Claude Code or chat:

- **Read this file first** before suggesting changes. If a request seems to conflict with a guardrail, surface it.
- **Search before assuming.** If something exists in the repo (a script, a function, a pattern), find it before writing a new one.
- **Prefer surgical changes.** Smaller diffs, faster review, easier to revert.
- **Be direct about trade-offs.** If a proposed approach has a real downside, say so. The user prefers honest pushback over agreeable execution of bad ideas. Several decisions in this repo (the three-script split, the Cloudflare-not-Vercel call) came from Claude pushing back on the user's first instinct.
- **Don't fabricate.** If you're unsure of a regulation, a library API, or a deployment detail, say so and offer to verify rather than confidently making it up. Particularly important for: regulatory citations, library version constraints, and anything that goes in customer-facing copy.
- **Stop before destructive operations.** Deleting files, force-pushing, dropping data, rotating secrets — confirm with the user first. The user has been deliberate about reviewing `git status` before commits; preserve that pattern.
- **Use real data only when explicitly real.** If generating sample data, mark it clearly. If the user asks for "an audit," ask whether they mean a demo against synthetic data or a real audit against actual customer events.

---

## Useful commands (cheat sheet)

```bash
# Run the full audit pipeline (one-shot)
cd audit-report
python scripts/audit.py path/to/extension-export.json \
    --customer "Customer Name" \
    --period 2026-MM-DD..2026-MM-DD \
    --headcount audited/total

# Iterate on the report template (HTML only, fast)
python scripts/generate_report.py output/customer-audit-data.json

# Rebuild the synthetic sample export (rarely needed)
python scripts/_make_sample_extension_export.py

# Local landing page preview (no form)
cd landing/public && python3 -m http.server 8080

# Local landing page with form (requires .dev.vars)
cd landing && wrangler pages dev public --compatibility-date=2024-01-01
```

---

## Decisions log (append, don't edit)

A short ledger of decisions that took real thought. New entries go at the bottom; don't rewrite history.

- **2026-04-26** — Named the company Floodlight (rejected: TwilightMap, Lumen, Penumbra, Beacon). Domain `floodlightsecurity.co`, brand colour amber `#BA7517`.
- **2026-04-28** — Three-script audit pipeline (`transform.py` + `generate_report.py` + `audit.py` wrapper) over a single combined script. Split is for debuggability, iteration speed, and reuse when a non-PDF output is needed.
- **2026-04-30** — PDF rendered via headless Chromium (Playwright), not reportlab. Higher visual quality justifies the dependency.
- **2026-05-02** — Landing page on Cloudflare Pages, not Vercel. Vercel Hobby prohibits commercial use; Pages free tier permits it.
- **2026-05-03** — Resend for transactional email. API key scoped to one domain. DMARC `p=none` for first 60 days.
- **2026-05-04** — Channel strategy for first 4 weeks: Show HN + cold email primary, LinkedIn secondary. LinkedIn posted under real name with calibrated framing (curiosity, not founder mode) to avoid premature conflict-of-interest signal at current employer.

---

## Open questions to resolve as conversations land

These are the questions the next 3-5 real prospect conversations should answer. Update this list as data comes in.

- Is £5/employee/month right? Too high? Too low? Per-seat or flat?
- Is a 7-day audit window the right length or do prospects want longer (30-day) for a more representative sample?
- Do prospects care more about the regulatory mapping (EU AI Act / FCA / ISO 42001) or the credential leakage detection? Both are in the report; one will land harder than the other.
- Is "educate mode" what prospects actually want next, or is it the hosted dashboard? Ask explicitly in early calls.
- How many employees does a typical interested prospect have on their primary work browser vs. on mobile / native AI apps? Affects how much our coverage gap matters.
