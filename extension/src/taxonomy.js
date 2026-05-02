/**
 * Floodlight — AI tool taxonomy
 *
 * Maps hostnames to tool metadata used by the content script and popup.
 * Derived from /data/ai-tools-taxonomy.csv (the canonical source).
 *
 * IMPORTANT: When a domain has multiple tiers (e.g. ChatGPT Free vs Enterprise),
 * we default to the most-conservative (highest-risk) interpretation here,
 * because the extension cannot reliably distinguish tiers from the URL alone.
 * Admin policies in the dashboard can override on a per-user/per-org basis.
 *
 * To regenerate: see /scripts/generate-taxonomy.js (coming in build pipeline).
 */

export const TAXONOMY = [
  // General-purpose LLM chat
  { hostnames: ['chatgpt.com'], name: 'ChatGPT', category: 'LLM_CHAT', risk_score: 7, risk_band: 'HIGH', trains_on_input: 'yes', notes: 'Defaulting to Free/Plus tier; Team and Enterprise have lower risk' },
  { hostnames: ['claude.ai'], name: 'Claude', category: 'LLM_CHAT', risk_score: 3, risk_band: 'LOW', trains_on_input: 'no' },
  { hostnames: ['gemini.google.com'], name: 'Google Gemini', category: 'LLM_CHAT', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'configurable', notes: 'Workspace tier is lower risk' },
  { hostnames: ['aistudio.google.com'], name: 'Google AI Studio', category: 'LLM_CHAT', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },
  { hostnames: ['copilot.microsoft.com', 'copilot.cloud.microsoft'], name: 'Microsoft Copilot', category: 'LLM_CHAT', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'configurable', notes: 'Consumer tier; M365 Copilot has lower risk' },
  { hostnames: ['perplexity.ai'], name: 'Perplexity AI', category: 'SEARCH', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
  { hostnames: ['pi.ai'], name: 'Pi.ai', category: 'LLM_CHAT', risk_score: 7, risk_band: 'HIGH', trains_on_input: 'yes' },
  { hostnames: ['character.ai'], name: 'Character.AI', category: 'LLM_CHAT', risk_score: 9, risk_band: 'CRITICAL', trains_on_input: 'yes', notes: 'High PII risk; persona chats often contain personal content' },
  { hostnames: ['huggingface.co'], name: 'HuggingChat', category: 'LLM_CHAT', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable', path_match: '/chat' },
  { hostnames: ['chat.mistral.ai'], name: 'Mistral Le Chat', category: 'LLM_CHAT', risk_score: 3, risk_band: 'LOW', trains_on_input: 'no' },
  { hostnames: ['chat.deepseek.com'], name: 'DeepSeek', category: 'LLM_CHAT', risk_score: 9, risk_band: 'CRITICAL', trains_on_input: 'yes', notes: 'Hosted in China; subject to PRC data laws' },
  { hostnames: ['chat.qwen.ai'], name: 'Qwen / Tongyi', category: 'LLM_CHAT', risk_score: 9, risk_band: 'CRITICAL', trains_on_input: 'yes', notes: 'Hosted in China' },
  { hostnames: ['kimi.moonshot.cn'], name: 'Kimi (Moonshot)', category: 'LLM_CHAT', risk_score: 9, risk_band: 'CRITICAL', trains_on_input: 'yes', notes: 'Hosted in China' },
  { hostnames: ['groq.com'], name: 'Groq Playground', category: 'LLM_CHAT', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable', path_match: '/playground' },
  { hostnames: ['poe.com'], name: 'Poe', category: 'LLM_CHAT', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },
  { hostnames: ['openai.com'], name: 'OpenAI Platform', category: 'LLM_CHAT', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },

  // Code assistants (browser-accessible)
  { hostnames: ['cursor.com'], name: 'Cursor', category: 'CODE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
  { hostnames: ['codeium.com', 'windsurf.com'], name: 'Codeium / Windsurf', category: 'CODE', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
  { hostnames: ['tabnine.com'], name: 'Tabnine', category: 'CODE', risk_score: 2, risk_band: 'LOW', trains_on_input: 'no' },
  { hostnames: ['replit.com'], name: 'Replit AI', category: 'CODE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
  { hostnames: ['bolt.new'], name: 'Bolt.new', category: 'CODE', risk_score: 7, risk_band: 'HIGH', trains_on_input: 'yes' },
  { hostnames: ['v0.dev'], name: 'v0 by Vercel', category: 'CODE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
  { hostnames: ['lovable.dev'], name: 'Lovable', category: 'CODE', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },
  { hostnames: ['phind.com'], name: 'Phind', category: 'CODE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },

  // Image generation
  { hostnames: ['midjourney.com'], name: 'Midjourney', category: 'IMAGE', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },
  { hostnames: ['stability.ai'], name: 'Stability AI', category: 'IMAGE', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
  { hostnames: ['firefly.adobe.com'], name: 'Adobe Firefly', category: 'IMAGE', risk_score: 2, risk_band: 'LOW', trains_on_input: 'no' },
  { hostnames: ['leonardo.ai'], name: 'Leonardo.ai', category: 'IMAGE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
  { hostnames: ['ideogram.ai'], name: 'Ideogram', category: 'IMAGE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'yes' },
  { hostnames: ['recraft.ai'], name: 'Recraft', category: 'IMAGE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'yes' },
  { hostnames: ['krea.ai'], name: 'Krea', category: 'IMAGE', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },

  // Video
  { hostnames: ['runwayml.com'], name: 'Runway', category: 'VIDEO', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
  { hostnames: ['pika.art'], name: 'Pika', category: 'VIDEO', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },
  { hostnames: ['lumalabs.ai'], name: 'Luma Dream Machine', category: 'VIDEO', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
  { hostnames: ['klingai.com'], name: 'Kling AI', category: 'VIDEO', risk_score: 9, risk_band: 'CRITICAL', trains_on_input: 'yes', notes: 'Hosted in China' },
  { hostnames: ['heygen.com'], name: 'HeyGen', category: 'VIDEO', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'no' },
  { hostnames: ['synthesia.io'], name: 'Synthesia', category: 'VIDEO', risk_score: 3, risk_band: 'LOW', trains_on_input: 'no' },

  // Audio
  { hostnames: ['elevenlabs.io'], name: 'ElevenLabs', category: 'AUDIO', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
  { hostnames: ['suno.com'], name: 'Suno', category: 'AUDIO', risk_score: 7, risk_band: 'HIGH', trains_on_input: 'yes' },
  { hostnames: ['udio.com'], name: 'Udio', category: 'AUDIO', risk_score: 7, risk_band: 'HIGH', trains_on_input: 'yes' },
  { hostnames: ['murf.ai'], name: 'Murf', category: 'AUDIO', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
  { hostnames: ['descript.com'], name: 'Descript', category: 'AUDIO', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },

  // Writing
  { hostnames: ['jasper.ai'], name: 'Jasper', category: 'WRITING', risk_score: 3, risk_band: 'LOW', trains_on_input: 'no' },
  { hostnames: ['copy.ai'], name: 'Copy.ai', category: 'WRITING', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
  { hostnames: ['writer.com'], name: 'Writer', category: 'WRITING', risk_score: 2, risk_band: 'LOW', trains_on_input: 'no' },
  { hostnames: ['app.grammarly.com'], name: 'Grammarly', category: 'WRITING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'yes', notes: 'Defaulting to Free/Premium; Business tier is lower risk' },
  { hostnames: ['quillbot.com'], name: 'QuillBot', category: 'WRITING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'yes' },
  { hostnames: ['wordtune.com'], name: 'Wordtune', category: 'WRITING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },

  // Search
  { hostnames: ['you.com'], name: 'You.com', category: 'SEARCH', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
  { hostnames: ['genspark.ai'], name: 'Genspark', category: 'SEARCH', risk_score: 6, risk_band: 'MEDIUM', trains_on_input: 'yes' },

  // Meeting/transcription
  { hostnames: ['otter.ai'], name: 'Otter.ai', category: 'MEETING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'no' },
  { hostnames: ['fireflies.ai'], name: 'Fireflies.ai', category: 'MEETING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'no' },
  { hostnames: ['fathom.video'], name: 'Fathom', category: 'MEETING', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
  { hostnames: ['granola.ai'], name: 'Granola', category: 'MEETING', risk_score: 4, risk_band: 'MEDIUM', trains_on_input: 'no' },
  { hostnames: ['tldv.io'], name: 'tl;dv', category: 'MEETING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },
  { hostnames: ['read.ai'], name: 'Read AI', category: 'MEETING', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'no' },

  // Note-taking
  { hostnames: ['notion.so'], name: 'Notion AI', category: 'NOTE', risk_score: 3, risk_band: 'LOW', trains_on_input: 'no' },
  { hostnames: ['mem.ai'], name: 'Mem', category: 'NOTE', risk_score: 5, risk_band: 'MEDIUM', trains_on_input: 'configurable' },

  // Translation
  { hostnames: ['deepl.com'], name: 'DeepL', category: 'TRANSLATE', risk_score: 3, risk_band: 'LOW', trains_on_input: 'no' },

  // Agents
  { hostnames: ['devin.ai'], name: 'Devin', category: 'AGENT', risk_score: 7, risk_band: 'HIGH', trains_on_input: 'yes' },

  // Risky/concerning
  { hostnames: ['replika.com'], name: 'Replika', category: 'RISKY', risk_score: 9, risk_band: 'CRITICAL', trains_on_input: 'yes', notes: 'Companion AI; intimate personal content commonly shared' },
  { hostnames: ['janitorai.com'], name: 'Janitor AI', category: 'RISKY', risk_score: 10, risk_band: 'CRITICAL', trains_on_input: 'yes', notes: 'Adult roleplay; explicit content; high data risk' }
];

/**
 * Look up a tool by hostname.
 * @param {string} hostname - e.g. "chatgpt.com" or "www.chatgpt.com"
 * @param {string} pathname - e.g. "/chat" (used for path-scoped tools like HuggingChat)
 * @returns {object|null} Tool metadata or null if not in taxonomy
 */
export function lookupTool(hostname, pathname = '/') {
  const normalized = (hostname || '').toLowerCase();
  for (const tool of TAXONOMY) {
    for (const h of tool.hostnames) {
      if (normalized === h || normalized.endsWith('.' + h)) {
        // If path-scoped, the path must also match
        if (tool.path_match && !pathname.startsWith(tool.path_match)) {
          continue;
        }
        return tool;
      }
    }
  }
  return null;
}

/**
 * Get all unique categories represented in the taxonomy.
 * @returns {string[]}
 */
export function categories() {
  return [...new Set(TAXONOMY.map(t => t.category))].sort();
}

/**
 * Total tool count.
 * @returns {number}
 */
export function size() {
  return TAXONOMY.length;
}
