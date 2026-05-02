/**
 * Floodlight — Background service worker
 *
 * Receives metadata events from content scripts, batches them, and either
 * dispatches to a configured backend OR stores them locally for inspection
 * via the options page.
 *
 * Sideload installs ship with backendUrl=''. In this state the extension
 * functions purely as a local audit log, which is the right default for
 * users testing it on their own machines.
 *
 * Security posture:
 *   - We only accept messages of type 'floodlight_event' from our own
 *     extension's content scripts (sender.id === chrome.runtime.id).
 *   - Event payloads are sanitised before storage — we strictly pick
 *     known-safe fields rather than trusting the shape of the input.
 */

import {
  getSettings,
  enqueueEvent,
  drainEventQueue,
  getOrCreatePseudonym,
  peekEventQueue
} from './storage.js';

const SCHEMA_VERSION = '1.0.0';

/**
 * Sanitise an inbound event by allow-listing fields. This prevents a compromised
 * content script (or a hostile page that found a way to send messages) from
 * smuggling unbounded data into our queue.
 */
function sanitise(event) {
  if (!event || typeof event !== 'object') return null;

  const safeTool = event.tool && typeof event.tool === 'object' ? {
    name: String(event.tool.name || '').slice(0, 200),
    hostnames: Array.isArray(event.tool.hostnames)
      ? event.tool.hostnames.slice(0, 10).map(h => String(h).slice(0, 256))
      : [],
    category: String(event.tool.category || '').slice(0, 50),
    risk_score: Number.isFinite(event.tool.risk_score) ? event.tool.risk_score : null,
    risk_band: String(event.tool.risk_band || '').slice(0, 20),
    trains_on_input: String(event.tool.trains_on_input || '').slice(0, 20)
  } : null;

  const safeContext = event.context && typeof event.context === 'object' ? {
    url_origin: String(event.context.url_origin || '').slice(0, 512),
    page_title_hash: String(event.context.page_title_hash || '').slice(0, 64),
    browser: String(event.context.browser || '').slice(0, 30),
    extension_version: String(event.context.extension_version || '').slice(0, 20)
  } : null;

  let safeClassification = null;
  if (event.content_classification && typeof event.content_classification === 'object') {
    const c = event.content_classification;
    safeClassification = {
      byte_count: Number.isFinite(c.byte_count) ? c.byte_count : 0,
      char_count: Number.isFinite(c.char_count) ? c.char_count : 0,
      categories: Array.isArray(c.categories)
        ? c.categories.slice(0, 30).map(s => String(s).slice(0, 50))
        : [],
      category_counts: (c.category_counts && typeof c.category_counts === 'object')
        ? Object.fromEntries(
            Object.entries(c.category_counts)
              .slice(0, 30)
              .map(([k, v]) => [String(k).slice(0, 50), Number.isFinite(v) ? v : 0])
          )
        : {},
      contains_code: Boolean(c.contains_code)
    };
  }

  return {
    schema_version: SCHEMA_VERSION,
    event_id: String(event.event_id || '').slice(0, 64),
    timestamp: String(event.timestamp || new Date().toISOString()).slice(0, 30),
    event_type: ['navigation', 'paste'].includes(event.event_type) ? event.event_type : 'unknown',
    tool: safeTool,
    context: safeContext,
    content_classification: safeClassification
  };
}

/**
 * Receive metadata events from content scripts.
 * Validate origin, sanitise, persist for batched dispatch.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only accept messages from this extension's own content scripts.
  if (sender.id !== chrome.runtime.id) {
    return; // foreign sender — ignore silently
  }

  if (message?.type !== 'floodlight_event') return;

  (async () => {
    try {
      const settings = await getSettings();
      if (!settings.enabled) return;

      const sanitised = sanitise(message.event);
      if (!sanitised) return;

      // Attach tenant + pseudonym at ingestion time (not in content script).
      const pseudonym = settings.anonymousMode
        ? 'anonymous'
        : await getOrCreatePseudonym();

      const enriched = {
        ...sanitised,
        tenant_id: settings.tenantId || null,
        user_pseudonym: pseudonym
      };

      const queueLen = await enqueueEvent(enriched);

      if (settings.debugLogging) {
        console.log('[Floodlight]', enriched.event_type, enriched.tool?.name,
          enriched.content_classification?.categories || '',
          `(queue: ${queueLen})`);
      }

      // Eager flush if queue exceeds threshold
      if (queueLen >= settings.batchMaxSize) {
        await flush();
      }
    } catch (err) {
      console.warn('[Floodlight] event handling error:', err);
    }
  })();

  // Acknowledge receipt (allows content script to await if needed in future)
  sendResponse?.({ ok: true });
  return false; // synchronous response only
});

/**
 * Flush the queue: either POST to backend or leave in storage.
 * Local-only mode (empty backendUrl) keeps events in storage for the options
 * page to display — useful for sideload testing.
 */
async function flush() {
  const settings = await getSettings();
  const events = await drainEventQueue();
  if (events.length === 0) return;

  if (!settings.backendUrl) {
    // Local-only mode: re-queue the events back so the options page can show them.
    // We cap at 500 most-recent for inspection.
    const recent = events.slice(-500);
    await chrome.storage.local.set({ recentEvents: recent });
    if (settings.debugLogging) {
      console.log('[Floodlight] local-only mode: stored', recent.length, 'events for inspection');
    }
    return;
  }

  // Backend dispatch
  try {
    const res = await fetch(settings.backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schema_version: SCHEMA_VERSION,
        tenant_id: settings.tenantId || null,
        events
      })
    });
    if (!res.ok) {
      // Re-queue on failure (will retry on next interval)
      for (const e of events) await enqueueEvent(e);
      console.warn('[Floodlight] backend rejected batch:', res.status);
    } else if (settings.debugLogging) {
      console.log('[Floodlight] dispatched', events.length, 'events');
    }
  } catch (err) {
    // Network error — re-queue
    for (const e of events) await enqueueEvent(e);
    console.warn('[Floodlight] backend unreachable:', err.message);
  }
}

/**
 * Periodic flush. Service workers are killed and revived by Chrome, so we
 * use chrome.alarms (persistent) rather than setInterval (dies with worker).
 */
chrome.alarms.create('floodlight_flush', { periodInMinutes: 0.5 }); // every 30s
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'floodlight_flush') flush().catch(err =>
    console.warn('[Floodlight] flush error:', err));
});

// Surface install/update logs for troubleshooting during sideload
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Floodlight] installed/updated:', details.reason, 'v' + chrome.runtime.getManifest().version);
});
