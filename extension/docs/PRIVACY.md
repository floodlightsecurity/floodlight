# Floodlight Extension — Privacy

This document maps every byte the Floodlight browser extension touches and explains what does (and does not) leave your machine. If anything in this document is contradicted by the code, **the code is wrong** — please open an issue.

## TL;DR

- Floodlight watches **only** the AI tool domains listed in [`manifest.json`](../manifest.json). It cannot see, log, or transmit anything from any other website.
- When you paste content into a prompt field on one of those domains, Floodlight runs a **local classifier** to detect categories of sensitive content (emails, API keys, code, etc.).
- Only **category labels and counts** leave your browser. The actual pasted text never does.
- The full source code is in this repository. You can verify every claim below.

## What gets recorded

When you visit one of the AI tools listed in `manifest.json`, the extension records a **navigation event** containing:

| Field | Example | Why |
|---|---|---|
| `event_id` | `f47ac10b-58cc-…` | Random UUID for deduplication |
| `timestamp` | `2026-05-02T13:14:15.000Z` | When the event happened |
| `event_type` | `navigation` | What kind of event this is |
| `tool.name` | `ChatGPT` | Which AI tool (from our taxonomy) |
| `tool.category` | `LLM_CHAT` | Tool category for reporting |
| `tool.risk_score` | `7` | Numeric risk score (1–10) |
| `tool.risk_band` | `HIGH` | Risk band for at-a-glance reporting |
| `context.url_origin` | `https://chatgpt.com` | Origin only — **no path, no query string** |
| `context.page_title_hash` | `a3f5e9…` (SHA-256) | Hash, not the title text |
| `context.browser` | `Chrome` | Browser family — for compatibility metrics |
| `context.extension_version` | `0.1.0` | Self-version |

When you **paste** content into a prompt field on one of those tools, a **paste event** is recorded with the navigation fields above plus:

| Field | Example | Why |
|---|---|---|
| `content_classification.byte_count` | `342` | Size of pasted content |
| `content_classification.char_count` | `342` | Character count |
| `content_classification.categories` | `["email", "api_key_openai"]` | Which sensitive categories were detected |
| `content_classification.category_counts` | `{ "email": 1, "api_key_openai": 1 }` | How many of each |
| `content_classification.contains_code` | `true` | Whether code-like content was detected |

That is the complete schema. There is no "snippet", "sample", "context window", "first N characters", or any other field that could carry the pasted text. You can grep the codebase for `pastedText` and verify it never appears in any object literal that gets transmitted or stored long-term.

## What does NOT get recorded

- **The text you paste** — classified locally, then garbage-collected when the function returns
- **The text you type** — there is no keystroke listener anywhere in the extension
- **The model's response** — the extension does not read assistant output
- **DOM contents** — no `innerText`, `innerHTML`, or `textContent` capture
- **Files you upload** — no FileReader, no drag-and-drop interception
- **The full URL** — only `location.origin` is captured (e.g. `https://chatgpt.com`, never `https://chatgpt.com/c/abc123-with-session-id`)
- **The page title** — only its SHA-256 hash, which cannot be reversed
- **Browser fingerprinting data** — no canvas reads, font enumeration, hardware probes, screen size, timezone, or installed-extension lists
- **Cookies, localStorage, sessionStorage** of the host page — the extension never accesses host page storage
- **Anything from any non-AI website** — the extension's `host_permissions` and `content_scripts.matches` lists are explicit and limited

## Permissions explained

The extension requests three Chrome permissions:

| Permission | Why |
|---|---|
| `storage` | To save your settings and the local event log to the browser's extension storage. Nothing is written to disk outside the browser. |
| `activeTab` | So the popup can read the URL of the active tab — to tell you whether the page you're looking at is an AI tool. Granted only when you click the icon. |
| `alarms` | To run a periodic flush of the event queue every 30 seconds. Service workers in Manifest V3 can be killed by Chrome at any time, so `setInterval` is unreliable; `chrome.alarms` survives. |

It also requests **explicit host permissions** for each AI domain it monitors. There is no `<all_urls>` or `*://*/*` permission. The list is in `manifest.json` and you can read it before installing.

## Where the data lives

In **local-only mode** (default for self-installs):

- Events are stored in `chrome.storage.local` on your device only.
- Nothing is transmitted to any server.
- The options page lets you inspect, export (JSON), or clear the log at any time.

In **organisation mode** (when an admin configures a backend URL and tenant ID):

- Events are batched (default: every 30 seconds, or when 50 events accumulate) and POSTed to the configured backend.
- Each event carries the tenant ID and a per-install pseudonym (a random UUID generated on first run, stored locally — it identifies the install, not the human).
- If the backend is unreachable, events are re-queued locally for retry.
- An admin can enable **anonymous mode**, which replaces the pseudonym with the literal string `anonymous`. In this mode, the dashboard shows aggregate stats only.

## Verification — how to audit this yourself

The privacy claims above are checkable in code:

1. **The classifier never returns matched strings.** Read [`src/classifier.js`](../src/classifier.js). The `classify()` function returns an object with `byte_count`, `char_count`, `categories`, `category_counts`, and `contains_code`. There is no field that carries text. Run the test suite to confirm.

2. **The content script never sends raw text.** Read [`src/content.js`](../src/content.js). Search for `pastedText`. It appears exactly twice: once when read from the clipboard event, once when passed to `classify()`. The result of `classify()` is what gets included in the message envelope, not the input.

3. **The background worker sanitises every event by allow-list.** Read [`src/background.js`](../src/background.js). The `sanitise()` function explicitly picks only known-safe fields. Any extra fields a content script might attempt to attach are dropped before storage or dispatch.

4. **The manifest's host permissions are limited.** Read [`manifest.json`](../manifest.json). The `host_permissions` and `content_scripts.matches` lists name every AI domain monitored. There is no wildcard match for general browsing.

## Reporting a privacy concern

If you find a behaviour that contradicts this document — open an issue, or email security@floodlightsecurity.co (coming soon). We will treat any data-leak finding as a critical bug.
