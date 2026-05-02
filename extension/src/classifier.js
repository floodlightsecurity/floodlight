/**
 * Floodlight — Local content classifier
 *
 * SECURITY CONTRACT (NON-NEGOTIABLE):
 * This module receives raw user content as input.
 * It MUST return only category labels and match counts.
 * It MUST NEVER return matched strings, samples, snippets, or any portion
 * of the original content.
 *
 * If you find yourself wanting to add a `samples` or `matches` field to
 * the return value, stop. That's a privacy regression. Don't do it.
 *
 * The classifier runs entirely in the browser. No network calls.
 * No external dependencies. Auditable in under 200 lines.
 */

/**
 * Sensitive content patterns. Each entry has:
 *   - pattern: a global RegExp
 *   - description: one-line human-readable explanation (used in audit reports)
 *
 * Patterns are deliberately tuned to err on the side of false positives
 * rather than false negatives — over-detection produces a useful "this prompt
 * had something that looked sensitive" signal, while under-detection produces
 * silence (which is worse for a security product).
 */
const PATTERNS = {
  email: {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    description: 'Email address'
  },
  phone_uk: {
    pattern: /(?<!\d)(?:\+44\s?|0)\d{2,4}[\s.-]\d{3,4}[\s.-]?\d{3,4}(?!\d)/g,
    description: 'UK phone number'
  },
  phone_us: {
    pattern: /(?<!\d)(?:\+1[\s.-]?)?(?:\(\d{3}\)\s*|\d{3}[\s.-])\d{3}[\s.-]?\d{4}(?!\d)/g,
    description: 'US phone number'
  },
  credit_card: {
    pattern: /(?<!\d)(?:\d{4}[\s-]?){3}\d{4}(?!\d)/g,
    description: 'Credit card number (16-digit pattern)'
  },
  api_key_openai: {
    pattern: /sk-(?:proj-|svcacct-|admin-)?[a-zA-Z0-9_-]{40,}/g,
    description: 'OpenAI API key'
  },
  api_key_anthropic: {
    pattern: /sk-ant-[a-zA-Z0-9_-]{40,}/g,
    description: 'Anthropic API key'
  },
  api_key_github: {
    pattern: /gh[pousr]_[a-zA-Z0-9]{30,}/g,
    description: 'GitHub token (PAT, OAuth, server-to-server, user-to-server, refresh)'
  },
  api_key_aws: {
    pattern: /AKIA[0-9A-Z]{16}/g,
    description: 'AWS access key ID'
  },
  api_key_slack: {
    pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/g,
    description: 'Slack API token'
  },
  api_key_stripe: {
    pattern: /(?:sk|pk|rk)_(?:test|live)_[a-zA-Z0-9]{20,}/g,
    description: 'Stripe API key'
  },
  jwt: {
    pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
    description: 'JSON Web Token'
  },
  uk_ni: {
    pattern: /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g,
    description: 'UK National Insurance number'
  },
  us_ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    description: 'US Social Security number'
  },
  ip_address: {
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    description: 'IPv4 address'
  },
  iban: {
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,16}\b/g,
    description: 'IBAN (international bank account number)'
  },
  uuid: {
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    description: 'UUID (often a database record identifier)'
  }
};

/**
 * Code keyword detection.
 * Heuristic: if multiple of these tokens appear, the content likely contains source code.
 * We don't look for any single keyword — too noisy. We require 3+ distinct keywords.
 */
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

/**
 * Long base64 blob — often indicates secrets, certificates, encoded data.
 * Threshold is intentionally high (60 chars) to avoid matching ordinary words.
 */
const BASE64_BLOB = /\b[A-Za-z0-9+/]{60,}={0,2}\b/g;

/**
 * Classify content. Returns category labels and counts only.
 *
 * @param {string} text - Raw content to classify (will not be retained)
 * @returns {{
 *   byte_count: number,
 *   char_count: number,
 *   categories: string[],
 *   category_counts: Object<string, number>,
 *   contains_code: boolean
 * }}
 */
export function classify(text) {
  if (typeof text !== 'string') {
    text = String(text ?? '');
  }

  const result = {
    byte_count: new Blob([text]).size,
    char_count: text.length,
    categories: [],
    category_counts: {},
    contains_code: false
  };

  // Run each named pattern. Count matches; never store them.
  for (const [name, { pattern }] of Object.entries(PATTERNS)) {
    // Reset regex state (global regexes are stateful across exec calls)
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      result.categories.push(name);
      result.category_counts[name] = matches.length;
    }
  }

  // Code detection: count distinct keyword tokens
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

  // Long base64 blobs (potential keys, certs, encoded payloads)
  BASE64_BLOB.lastIndex = 0;
  const base64Matches = text.match(BASE64_BLOB);
  if (base64Matches && base64Matches.length > 0) {
    result.categories.push('base64_blob');
    result.category_counts.base64_blob = base64Matches.length;
  }

  return result;
}

/**
 * Returns the human-readable description for a category.
 * Used by the popup and audit reports.
 */
export function describe(category) {
  if (PATTERNS[category]) return PATTERNS[category].description;
  if (category === 'source_code') return 'Source code (3+ language keywords)';
  if (category === 'base64_blob') return 'Long base64 blob (potential key or encoded payload)';
  return category;
}

/**
 * Returns true if any of the categories indicate "high concern" content
 * (credentials, regulated identifiers, etc.). Used to surface warnings in the popup.
 */
export function isHighConcern(categories) {
  const HIGH_CONCERN = new Set([
    'credit_card',
    'api_key_openai', 'api_key_anthropic', 'api_key_github',
    'api_key_aws', 'api_key_slack', 'api_key_stripe',
    'jwt', 'uk_ni', 'us_ssn', 'iban'
  ]);
  return categories.some(c => HIGH_CONCERN.has(c));
}
