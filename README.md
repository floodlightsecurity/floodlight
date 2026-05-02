# Floodlight

**See, classify, and govern every AI tool your employees use — without slowing anyone down.**

Floodlight is an open-source shadow AI discovery and governance platform for mid-market companies (50–500 employees). It produces a single concrete deliverable on day seven: a ranked report of every AI tool your employees touched, mapped to data-leak risk and compliance obligations under the EU AI Act, ISO 42001, and GDPR.

🌐 [floodlightsecurity.co](https://floodlightsecurity.co) *(coming soon)*

---

## Why Floodlight exists

Most companies have **no idea** which AI tools their employees are actually using. Browser-based ChatGPT, personal Claude accounts, free GPT clones, AI girlfriend apps installed on a corporate laptop — IT can't govern what they can't see.

Existing DLP and CASB tools weren't built for the modern AI taxonomy. They flag "ChatGPT" as one thing, when in reality there are five distinct ChatGPT tiers with different data policies, and the difference between them is the difference between a SOC 2-covered Enterprise contract and pasting customer PII into a free account that trains on it. Floodlight is built for this distinction from day one.

---

## How it works

Three layers, each independently shippable:

### Discovery
- Open-source browser extension (Chrome, Edge, Firefox)
- DNS log analysis (Cloudflare Gateway, NextDNS, syslog from corporate firewall)
- SaaS audit log integration (Microsoft 365, Google Workspace, Okta)

### Classification
- Continuously updated taxonomy of AI tools — see [`data/ai-tools-taxonomy.csv`](./data/ai-tools-taxonomy.csv)
- Local PII / source-code / sensitive-content detection (only metadata leaves the endpoint)
- Per-event risk scoring based on tool × content × user role

### Governance
- Dashboard for IT and security teams
- Auto-generated compliance reports (EU AI Act Article 4, ISO 42001, GDPR)
- Policy modes: `block`, `allow`, `educate` (popup explaining the risk before the user proceeds)

---

## Privacy commitment

**The browser extension is open-source by design.** Only metadata — domain, timestamp, content classification, byte-count — leaves the endpoint. **Prompt content never does.** This is non-negotiable and the source code is here for anyone to verify.

Anonymous mode is available: the dashboard can show aggregate stats only, with no per-user attribution, unless explicitly enabled by the customer's admin.

---

## Repository layout

```
floodlight/
├── README.md              you are here
├── LICENSE                MIT
├── .gitignore
├── data/
│   ├── ai-tools-taxonomy.csv     86 AI tools with risk scoring
│   └── RISK_METHODOLOGY.md       how scores are assigned
├── extension/             browser extension (next)
├── backend/               FastAPI service (coming)
├── dashboard/             Next.js console (coming)
└── docs/
    ├── PRIVACY.md         (coming)
    └── SECURITY.md        responsible disclosure (coming)
```

---

## Status

**Pre-alpha. Building in public.**

The AI tool taxonomy in [`data/`](./data/) is the first artifact and is independently useful — feel free to use it for any internal AI governance project, with attribution.

Roadmap:
- [x] AI tool taxonomy (86 tools, 14 categories)
- [x] Risk methodology
- [ ] Browser extension (week 2)
- [ ] Free Audit landing page (week 3)
- [ ] Backend API and dashboard (week 4)
- [ ] PDF audit report generator (week 5)
- [ ] First design partner pilot (week 6)

---

## Contributing

The fastest way to help right now is to expand and correct the taxonomy. The AI vendor landscape changes weekly — new tools launch, certifications expire, data policies change with new tiers. Pull requests welcome. New tools, updated certifications, regional notes — open an issue or send a PR.

When updating an entry, please cite the source (vendor trust page, sub-processor list, certification registry, official blog post) and note the date of verification in the commit message.

---

## License

MIT — see [LICENSE](./LICENSE). Use it for your internal governance work freely. Attribution appreciated.
