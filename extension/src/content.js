/**
 * Floodlight — Content script (self-contained)
 *
 * Chrome Manifest V3 content scripts run as classic scripts, NOT modules,
 * so we cannot use ES `import` here. This file inlines a minimal subset of
 * the taxonomy lookup and the classifier instead. The canonical versions
 * still live in src/taxonomy.js and src/classifier.js — used by the popup,
 * options page, and (in future) any bundled build.
 *
 * SECURITY CONTRACT (NON-NEGOTIABLE):
 * Pasted content is classified locally and IMMEDIATELY discarded.
 * Only category labels and counts ever leave this function's scope.
 * The original `pastedText` variable is never written to storage,
 * never put into a message envelope, and never logged.
 */

(() => {
  'use strict';

  const EXTENSION_VERSION = chrome.runtime.getManifest().version;

  // ─────────────────────────────────────────────────────────────────────
  // INLINED TAXONOMY (subset of src/taxonomy.js — keep in sync)
  // ─────────────────────────────────────────────────────────────────────
  const TAXONOMY = [
    { hostnames: ['chatgpt.com'], name: 'ChatGPT', category: 'LLM_CHAT', risk_score: 7, risk_band: 'HIGH', trains_on_input: 'yes' },
    { hostnames: ['claude.ai'], name: 'Claude', category: 'LLM_CHAT', risk_score: 3, risk_band: 'LOW', trains_on_input: 'no' },
    { hostnames: ['gemini.google.com'], name: 'Google Gemini', category: 'LLM_CHAT', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['aistudio.google.com'], name: 'Google AI Studio', category: 'LLM_CHAT', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },
    { hostnames: ['copilot.microsoft.com', 'copilot.cloud.microsoft'], name: 'Microsoft Copilot', category: 'LLM_CHAT', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['perplexity.ai'], name: 'Perplexity AI', category: 'SEARCH', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['pi.ai'], name: 'Pi.ai', category: 'LLM_CHAT', risk_score: 7, risk_band: 'HIGH', trains_on_input: 'yes' },
    { hostnames: ['character.ai'], name: 'Character.AI', category: 'LLM_CHAT', risk_score: 9, risk_band: 'CRITICAL', trains_on_input: 'yes' },
    { hostnames: ['huggingface.co'], name: 'HuggingChat', category: 'LLM_CHAT', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable', path_match: '/chat' },
    { hostnames: ['chat.mistral.ai'], name: 'Mistral Le Chat', category: 'LLM_CHAT', risk_score: 3, risk_band: 'LOW', trains_on_input: 'no' },
    { hostnames: ['chat.deepseek.com'], name: 'DeepSeek', category: 'LLM_CHAT', risk_score: 9, risk_band: 'CRITICAL', trains_on_input: 'yes' },
    { hostnames: ['chat.qwen.ai'], name: 'Qwen / Tongyi', category: 'LLM_CHAT', risk_score: 9, risk_band: 'CRITICAL', trains_on_input: 'yes' },
    { hostnames: ['kimi.moonshot.cn'], name: 'Kimi (Moonshot)', category: 'LLM_CHAT', risk_score: 9, risk_band: 'CRITICAL', trains_on_input: 'yes' },
    { hostnames: ['groq.com'], name: 'Groq Playground', category: 'LLM_CHAT', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable', path_match: '/playground' },
    { hostnames: ['poe.com'], name: 'Poe', category: 'LLM_CHAT', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },
    { hostnames: ['openai.com'], name: 'OpenAI Platform', category: 'LLM_CHAT', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['cursor.com'], name: 'Cursor', category: 'CODE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['codeium.com', 'windsurf.com'], name: 'Codeium / Windsurf', category: 'CODE', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
    { hostnames: ['tabnine.com'], name: 'Tabnine', category: 'CODE', risk_score: 2, risk_band: 'LOW', trains_on_input: 'no' },
    { hostnames: ['replit.com'], name: 'Replit AI', category: 'CODE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['bolt.new'], name: 'Bolt.new', category: 'CODE', risk_score: 7, risk_band: 'HIGH', trains_on_input: 'yes' },
    { hostnames: ['v0.dev'], name: 'v0 by Vercel', category: 'CODE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['lovable.dev'], name: 'Lovable', category: 'CODE', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },
    { hostnames: ['phind.com'], name: 'Phind', category: 'CODE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['midjourney.com'], name: 'Midjourney', category: 'IMAGE', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },
    { hostnames: ['stability.ai'], name: 'Stability AI', category: 'IMAGE', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
    { hostnames: ['firefly.adobe.com'], name: 'Adobe Firefly', category: 'IMAGE', risk_score: 2, risk_band: 'LOW', trains_on_input: 'no' },
    { hostnames: ['leonardo.ai'], name: 'Leonardo.ai', category: 'IMAGE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['ideogram.ai'], name: 'Ideogram', category: 'IMAGE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'yes' },
    { hostnames: ['recraft.ai'], name: 'Recraft', category: 'IMAGE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'yes' },
    { hostnames: ['krea.ai'], name: 'Krea', category: 'IMAGE', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },
    { hostnames: ['runwayml.com'], name: 'Runway', category: 'VIDEO', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['pika.art'], name: 'Pika', category: 'VIDEO', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },
    { hostnames: ['lumalabs.ai'], name: 'Luma Dream Machine', category: 'VIDEO', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['klingai.com'], name: 'Kling AI', category: 'VIDEO', risk_score: 9, risk_band: 'CRITICAL', trains_on_input: 'yes' },
    { hostnames: ['heygen.com'], name: 'HeyGen', category: 'VIDEO', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'no' },
    { hostnames: ['synthesia.io'], name: 'Synthesia', category: 'VIDEO', risk_score: 3, risk_band: 'LOW', trains_on_input: 'no' },
    { hostnames: ['elevenlabs.io'], name: 'ElevenLabs', category: 'AUDIO', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['suno.com'], name: 'Suno', category: 'AUDIO', risk_score: 7, risk_band: 'HIGH', trains_on_input: 'yes' },
    { hostnames: ['udio.com'], name: 'Udio', category: 'AUDIO', risk_score: 7, risk_band: 'HIGH', trains_on_input: 'yes' },
    { hostnames: ['murf.ai'], name: 'Murf', category: 'AUDIO', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
    { hostnames: ['descript.com'], name: 'Descript', category: 'AUDIO', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
    { hostnames: ['jasper.ai'], name: 'Jasper', category: 'WRITING', risk_score: 3, risk_band: 'LOW', trains_on_input: 'no' },
    { hostnames: ['copy.ai'], name: 'Copy.ai', category: 'WRITING', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
    { hostnames: ['writer.com'], name: 'Writer', category: 'WRITING', risk_score: 2, risk_band: 'LOW', trains_on_input: 'no' },
    { hostnames: ['app.grammarly.com'], name: 'Grammarly', category: 'WRITING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'yes' },
    { hostnames: ['quillbot.com'], name: 'QuillBot', category: 'WRITING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'yes' },
    { hostnames: ['wordtune.com'], name: 'Wordtune', category: 'WRITING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['you.com'], name: 'You.com', category: 'SEARCH', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['genspark.ai'], name: 'Genspark', category: 'SEARCH', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },
    { hostnames: ['otter.ai'], name: 'Otter.ai', category: 'MEETING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'no' },
    { hostnames: ['fireflies.ai'], name: 'Fireflies.ai', category: 'MEETING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'no' },
    { hostnames: ['fathom.video'], name: 'Fathom', category: 'MEETING', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
    { hostnames: ['granola.ai'], name: 'Granola', category: 'MEETING', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
    { hostnames: ['tldv.io'], name: 'tl;dv', category: 'MEETING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['read.ai'], name: 'Read AI', category: 'MEETING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'no' },
    { hostnames: ['notion.so'], name: 'Notion AI', category: 'NOTE', risk_score: 3, risk_band: 'LOW', trains_on_input: 'no' },
    { hostnames: ['mem.ai'], name: 'Mem', category: 'NOTE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
    { hostnames: ['deepl.com'], name: 'DeepL', category: 'TRANSLATE', risk_score: 3, risk_band: 'LOW', trains_on_input: 'no' },
    { hostnames: ['devin.ai'], name: 'Devin', category: 'AGENT', risk_score: 7, risk_band: 'HIGH', trains_on_input: 'yes' },
    { hostnames: ['replika.com'], name: 'Replika', category: 'RISKY', risk_score: 9, risk_band: 'CRITICAL', trains_on_input: 'yes' },
    { hostnames: ['janitorai.com'], name: 'Janitor AI', category: 'RISKY', risk_score: 10, risk_band: 'CRITICAL', trains_on_input: 'yes' }
  ];

  function lookupTool(hostname, pathname) {
    const normalized = (hostname || '').toLowerCase();
    pathname = pathname || '/';
    for (const tool of TAXONOMY) {
      for (const h of tool.hostnames) {
        if (normalized === h || normalized.endsWith('.' + h)) {
          if (tool.path_match && !pathname.startsWith(tool.path_match)) continue;
          return tool;
        }
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────
  // INLINED CLASSIFIER (mirror of src/classifier.js — keep in sync)
  // ─────────────────────────────────────────────────────────────────────
  const PATTERNS = {
    email: { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    phone_uk: { pattern: /(?<!\d)(?:\+44\s?|0)\d{2,4}[\s.-]\d{3,4}[\s.-]?\d{3,4}(?!\d)/g },
    phone_us: { pattern: /(?<!\d)(?:\+1[\s.-]?)?(?:\(\d{3}\)\s*|\d{3}[\s.-])\d{3}[\s.-]?\d{4}(?!\d)/g },
    credit_card: { pattern: /(?<!\d)(?:\d{4}[\s-]?){3}\d{4}(?!\d)/g },
    api_key_openai: { pattern: /sk-(?:proj-|svcacct-|admin-)?[a-zA-Z0-9_-]{40,}/g },
    api_key_anthropic: { pattern: /sk-ant-[a-zA-Z0-9_-]{40,}/g },
    api_key_github: { pattern: /gh[pousr]_[a-zA-Z0-9]{30,}/g },
    api_key_aws: { pattern: /AKIA[0-9A-Z]{16}/g },
    api_key_slack: { pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/g },
    api_key_stripe: { pattern: /(?:sk|pk|rk)_(?:test|live)_[a-zA-Z0-9]{20,}/g },
    jwt: { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g },
    uk_ni: { pattern: /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g },
    us_ssn: { pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
    ip_address: { pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },
    iban: { pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,16}\b/g },
    uuid: { pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi }
  };

  const CODE_TOKENS = [
    'function ', 'const ', 'let ', 'var ', 'import ', 'export ',
    'def ', 'class ', 'return ', '=>', 'public ', 'private ', 'protected ',
    '#include', 'package ', 'namespace ', 'interface ',
    'SELECT ', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'CREATE TABLE',
    'async ', 'await ', 'try {', 'catch ', '} catch',
    'console.log', 'print(', 'printf(', 'System.out',
    'function(', 'def __', 'class __'
  ];
  const MIN_CODE_TOKENS_FOR_DETECTION = 3;
  const BASE64_BLOB = /\b[A-Za-z0-9+/]{60,}={0,2}\b/g;

  function classify(text) {
    if (typeof text !== 'string') text = String(text == null ? '' : text);
    const result = {
      byte_count: new Blob([text]).size,
      char_count: text.length,
      categories: [],
      category_counts: {},
      contains_code: false
    };

    for (const [name, { pattern }] of Object.entries(PATTERNS)) {
      pattern.lastIndex = 0;
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        result.categories.push(name);
        result.category_counts[name] = matches.length;
      }
    }

    let codeTokenHits = 0;
    for (const token of CODE_TOKENS) {
      if (text.includes(token)) {
        codeTokenHits++;
        if (codeTokenHits >= MIN_CODE_TOKENS_FOR_DETECTION) {
          result.contains_code = true;
          result.categories.push('source_code');
          result.category_counts.source_code = codeTokenHits;
          break;
        }
      }
    }

    BASE64_BLOB.lastIndex = 0;
    const base64Matches = text.match(BASE64_BLOB);
    if (base64Matches && base64Matches.length > 0) {
      result.categories.push('base64_blob');
      result.category_counts.base64_blob = base64Matches.length;
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────
  // EVENT CAPTURE
  // ─────────────────────────────────────────────────────────────────────

  function isPromptField(element) {
    if (!element || !(element instanceof Element)) return false;
    const tag = element.tagName ? element.tagName.toLowerCase() : '';
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = (element.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'search', 'url', 'email', ''].includes(type);
    }
    if (element.isContentEditable) return true;
    if (element.getAttribute && element.getAttribute('role') === 'textbox') return true;
    return false;
  }

  function detectBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('OPR/')) return 'Opera';
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Chrome/')) return 'Chrome';
    return 'Other';
  }

  async function sha256Hex(str) {
    const buf = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function buildEnvelope(tool) {
    return {
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      tool: {
        name: tool.name,
        hostnames: tool.hostnames,
        category: tool.category,
        risk_score: tool.risk_score,
        risk_band: tool.risk_band,
        trains_on_input: tool.trains_on_input
      },
      context: {
        url_origin: location.origin,
        page_title_hash: null,
        browser: detectBrowser(),
        extension_version: EXTENSION_VERSION
      }
    };
  }

  function emit(event) {
    try {
      chrome.runtime.sendMessage({ type: 'floodlight_event', event }, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      // extension context invalidated (e.g. on update) — silent fail
    }
  }

  async function init() {
    const tool = lookupTool(location.hostname, location.pathname);
    if (!tool) return;

    const envelope = buildEnvelope(tool);
    envelope.context.page_title_hash = await sha256Hex(document.title || '');

    emit({ ...envelope, event_type: 'navigation' });

    document.addEventListener('paste', async (e) => {
      if (!isPromptField(e.target)) return;
      const pastedText = (e.clipboardData && e.clipboardData.getData('text')) || '';
      if (!pastedText) return;

      // Classify locally. Only the result object is retained.
      const classification = classify(pastedText);
      // pastedText is now eligible for garbage collection.

      const pasteEnvelope = buildEnvelope(tool);
      pasteEnvelope.context.page_title_hash = await sha256Hex(document.title || '');

      emit({
        ...pasteEnvelope,
        event_type: 'paste',
        content_classification: classification
      });
    }, true);
  }

  try {
    init();
  } catch (err) {
    console.warn('[Floodlight] init failed:', err);
  }
})();
