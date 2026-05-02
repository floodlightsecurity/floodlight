# Risk Methodology

This document explains how risk scores in `ai-tools-taxonomy.csv` are assigned. The methodology is intentionally simple, transparent, and conservative — when in doubt, the higher score is chosen.

## Risk score (1–10)

Each tool gets a single numeric score driven by four factors:

| Factor | Weight | Detail |
|---|---|---|
| **Trains on user input by default** | Heaviest | A tool that uses prompts to train models is fundamentally different from one that does not. This single factor moves a tool 3+ points. |
| **Hosting jurisdiction & data sovereignty** | Heavy | EU-hosted with GDPR-native posture is lowest risk; US-hosted with strong DPAs is low; jurisdictions with state data-access laws (PRC) are critical regardless of vendor intent. |
| **Compliance certifications** | Medium | SOC 2 Type II, ISO 27001, HIPAA-eligibility, GDPR alignment all reduce score. "Trust me" reduces nothing. |
| **Data retention defaults** | Medium | Indefinite retention on free-tier consumer products is materially worse than configurable retention on enterprise tiers. |

## Risk bands

Scores collapse into four bands for at-a-glance reporting:

| Band | Score | Meaning | Default policy recommendation |
|---|---|---|---|
| **LOW** | 1–3 | Enterprise-grade, no training on inputs, certified | Allow |
| **MEDIUM** | 4–6 | Configurable; depends on tier and settings | Allow with education + monitoring |
| **HIGH** | 7–8 | Trains by default, weak controls, or significant concerns | Educate (popup) or block |
| **CRITICAL** | 9–10 | Designed for unsanctioned use, hosted in concerning jurisdictions, or known to retain sensitive data indefinitely | Block |

## Why per-tier scoring matters

Several tools appear multiple times in the taxonomy (ChatGPT, GitHub Copilot, Grammarly). This is deliberate. The free/consumer tier and the enterprise tier of the same product can differ by 4+ points on the risk scale. Reporting "an employee used ChatGPT" without distinguishing tier is meaningless. The detection layer should infer tier where possible (workspace SSO domain, plan badge, API usage pattern) and fall back to the most-conservative tier for the same tool when unknown.

## What this is not

This is **not** a legal opinion on whether a tool is GDPR-compliant in your specific use case. That depends on your data, your DPA with the vendor, your legal basis under Article 6, and whether you've completed a DPIA. The taxonomy gives you a starting point for a conversation with your DPO — not a substitute for one.

## Maintenance

The AI vendor landscape changes weekly. Certifications expire and renew. Data policies change with new tiers. Companies are acquired. **This taxonomy is a living document.** It should be reviewed at least quarterly against vendor trust pages, and corrections from the community are welcome via pull request.

When updating an entry, please:
1. Cite the source (vendor trust page, sub-processor list, certification registry, official blog post).
2. Note the date of verification in the commit message.
3. Update both the score and the band if the score crosses a boundary.

## Sources Floodlight checks for each entry

- Vendor trust portal (e.g. `trust.<vendor>.com`)
- Vendor sub-processor list and DPA
- SOC 2 / ISO 27001 / HIPAA / FedRAMP registries
- EU AI Act provider declarations (where applicable)
- Vendor terms of service — specifically the "training on inputs" clause
- Publicly disclosed incidents

If a vendor publishes none of the above, the entry defaults to MEDIUM at minimum and notes "none-public" under certifications.
