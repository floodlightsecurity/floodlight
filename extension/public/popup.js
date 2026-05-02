/**
 * Floodlight — Popup script
 *
 * Renders the currently-active tab's tool classification (if any) and
 * a feed of recent events from local storage. Read-only — no network,
 * no event ingestion. Just inspection.
 */

import { lookupTool } from '../src/taxonomy.js';
import { describe, isHighConcern } from '../src/classifier.js';

const $ = (id) => document.getElementById(id);

/**
 * Show the current page's tool classification.
 */
async function renderCurrentTool() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    $('current-tool').textContent = 'No active tab';
    return;
  }

  let url;
  try {
    url = new URL(tab.url);
  } catch {
    $('current-tool').textContent = 'Not a web page';
    return;
  }

  const tool = lookupTool(url.hostname, url.pathname);
  if (!tool) {
    $('current-tool').innerHTML = `Not a tracked AI tool <span style="color: var(--text-muted)">— ${escapeHtml(url.hostname)}</span>`;
    return;
  }

  $('current-tool').innerHTML = `
    ${escapeHtml(tool.name)}
    <span class="risk-badge risk-${tool.risk_band}">${tool.risk_band}</span>
  `;
}

/**
 * Render the recent events feed from local storage.
 */
async function renderEvents() {
  const list = $('events');
  list.innerHTML = '';

  // Read both the live queue and the most-recent stored batch
  const { eventQueue = [], recentEvents = [] } = await chrome.storage.local.get([
    'eventQueue', 'recentEvents'
  ]);
  const all = [...recentEvents, ...eventQueue].slice(-50).reverse();

  if (all.length === 0) {
    list.innerHTML = '<li class="empty">No events yet. Visit an AI tool to see activity.</li>';
    return;
  }

  for (const ev of all) {
    const li = document.createElement('li');
    li.className = 'event';
    const time = new Date(ev.timestamp).toLocaleTimeString();
    const tool = ev.tool?.name || 'Unknown';
    const cats = ev.content_classification?.categories || [];

    let warning = '';
    if (isHighConcern(cats)) {
      warning = `<span style="color: var(--red); font-weight: 500;"> ⚠ high-concern</span>`;
    }

    let detail = ev.event_type;
    if (ev.event_type === 'paste' && cats.length > 0) {
      const friendlyCats = cats.map(describe).slice(0, 3).join(', ');
      const more = cats.length > 3 ? ` +${cats.length - 3} more` : '';
      detail = `paste — ${friendlyCats}${more}`;
    } else if (ev.event_type === 'paste') {
      const bytes = ev.content_classification?.byte_count || 0;
      detail = `paste — ${bytes} bytes, no sensitive patterns`;
    }

    li.innerHTML = `
      <div><strong>${escapeHtml(tool)}</strong>${warning}</div>
      <div class="event-meta">${time} — ${escapeHtml(detail)}</div>
    `;
    list.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Wire up footer buttons
$('btn-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

$('btn-clear').addEventListener('click', async () => {
  await chrome.storage.local.set({ eventQueue: [], recentEvents: [] });
  renderEvents();
});

// Render on open
renderCurrentTool();
renderEvents();
