# Floodlight Browser Extension

The discovery layer of [Floodlight](../README.md) — an open-source browser extension that detects which AI tools you (or your employees) actually use, classifies pasted content for sensitive data, and produces a local event log you can audit at any time.

**Privacy contract: prompt content never leaves your browser.** See [`docs/PRIVACY.md`](./docs/PRIVACY.md) for the byte-by-byte breakdown.

## Status

Pre-alpha. Manifest V3, framework-free vanilla JS. No build step required to sideload — load it straight into Chrome from this folder.

## Installing for testing (sideload)

1. Open Chrome and go to `chrome://extensions`
2. Toggle **Developer mode** on (top right)
3. Click **Load unpacked**
4. Select this `extension/` folder
5. The Floodlight icon (amber "F") appears in your toolbar — pin it for visibility

To verify it works, visit any AI tool listed in the taxonomy (e.g. `chatgpt.com`, `claude.ai`) and click the extension icon. The popup should show the tool name and risk band.

To see content classification: paste text into a prompt field. The popup and options page will show the categories detected (e.g. "email", "api_key_openai"). The pasted text itself is **never** logged.

## File map

```
extension/
├── manifest.json              Manifest V3 — permissions, content scripts, popup wiring
├── src/
│   ├── taxonomy.js            Hostname → tool metadata lookup
│   ├── classifier.js          Local PII / code / secret detection (regex-based)
│   ├── content.js             Injected into AI tool pages — captures paste events
│   ├── background.js          Service worker — batches events, dispatches to backend
│   └── storage.js             chrome.storage.local wrapper, default settings
├── public/
│   ├── popup.html             Toolbar popup UI
│   ├── popup.js               Popup logic — current tool, recent events
│   ├── options.html           Settings page UI
│   ├── options.js             Settings logic + event log inspector
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
└── docs/
    └── PRIVACY.md             Comprehensive byte-by-byte privacy disclosure
```

## How it works (one paragraph)

When you visit a domain in the taxonomy, the content script (`content.js`) emits a navigation event. When you paste into a prompt-like field, it pulls the pasted text from the clipboard event, runs it through the local classifier (`classifier.js`), and emits a paste event containing only category labels and counts — **never the text itself**. The background service worker (`background.js`) sanitises the event, attaches a tenant ID and per-install pseudonym (or the literal `"anonymous"` if anonymous mode is on), and either dispatches to a backend (org mode) or stores it locally (sideload mode). The popup and options page read from local storage to show you what's been recorded.

## Verifying the privacy claims

The classifier has unit tests that include a privacy-regression check:

```bash
node --input-type=module -e '
  import { classify } from "./src/classifier.js";
  const r = classify("Email me at private@example.com, key sk-proj-abc123...");
  const dump = JSON.stringify(r);
  console.assert(!dump.includes("private"), "must not leak email user");
  console.assert(!dump.includes("example.com"), "must not leak domain");
  console.assert(!dump.includes("abc123"), "must not leak key chars");
  console.log("Privacy contract verified.");
'
```

Read [`docs/PRIVACY.md`](./docs/PRIVACY.md) for the comprehensive disclosure, including which fields are recorded, which are not, and how to audit the code yourself.

## License

MIT — see the repository [`LICENSE`](../LICENSE).
