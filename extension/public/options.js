/**
 * Floodlight — Options page script
 *
 * Settings management + event log inspector. All read/write to local storage;
 * no network calls happen from this page.
 */

import { getSettings, setSettings } from '../src/storage.js';
import { describe, isHighConcern } from '../src/classifier.js';

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

async function loadSettings() {
  const settings = await getSettings();
  $('enabled').checked = settings.enabled;
  $('anonymousMode').checked = settings.anonymousMode;
  $('debugLogging').checked = settings.debugLogging;
  $('backendUrl').value = settings.backendUrl || '';
  $('tenantId').value = settings.tenantId || '';
}

async function saveSettings() {
  await setSettings({
    enabled: $('enabled').checked,
    anonymousMode: $('anonymousMode').checked,
    debugLogging: $('debugLogging').checked,
    backendUrl: $('backendUrl').value.trim(),
    tenantId: $('tenantId').value.trim()
  });
  const s = $('save-status');
  s.classList.add('visible');
  setTimeout(() => s.classList.remove('visible'), 1500);
}

async function renderEvents() {
  const tbody = $('events-tbody');
  const { eventQueue = [], recentEvents = [] } = await chrome.storage.local.get([
    'eventQueue', 'recentEvents'
  ]);
  const all = [...recentEvents, ...eventQueue].slice(-200).reverse();

  if (all.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No events yet. Visit an AI tool to record activity.</td></tr>';
    return;
  }

  tbody.innerHTML = all.map((ev) => {
    const time = new Date(ev.timestamp).toLocaleString();
    const tool = ev.tool?.name || 'Unknown';
    const band = ev.tool?.risk_band || '';
    const cats = ev.content_classification?.categories || [];
    const concern = isHighConcern(cats);
    const catText = cats.length === 0
      ? '<span style="color: var(--text-muted);">none</span>'
      : cats.map(escapeHtml).join(', ');
    const concernIcon = concern ? '<span style="color: var(--red); font-weight: 600;">⚠ </span>' : '';

    return `
      <tr>
        <td style="white-space: nowrap; color: var(--text-muted);">${escapeHtml(time)}</td>
        <td><strong>${escapeHtml(tool)}</strong></td>
        <td>${escapeHtml(ev.event_type || '')}</td>
        <td><span class="risk-badge" style="font-size: 10px;">${escapeHtml(band)}</span></td>
        <td>${concernIcon}${catText}</td>
      </tr>
    `;
  }).join('');
}

async function exportJson() {
  const { eventQueue = [], recentEvents = [] } = await chrome.storage.local.get([
    'eventQueue', 'recentEvents'
  ]);
  const all = [...recentEvents, ...eventQueue];
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `floodlight-events-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function clearLog() {
  if (!confirm('Clear all locally-stored events? This cannot be undone.')) return;
  await chrome.storage.local.set({ eventQueue: [], recentEvents: [] });
  renderEvents();
}

$('btn-save').addEventListener('click', saveSettings);
$('btn-export').addEventListener('click', exportJson);
$('btn-clear').addEventListener('click', clearLog);

loadSettings();
renderEvents();

// Live-refresh the event log every few seconds while the page is open
setInterval(renderEvents, 3000);
