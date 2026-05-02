/**
 * Floodlight — Storage helpers
 *
 * Wraps chrome.storage.local with a promise-based API and a single
 * source-of-truth for default settings.
 *
 * All persistent state lives here:
 *   - settings:    user/admin configuration
 *   - eventQueue:  metadata events pending dispatch (offline queue)
 *   - tenantId:    organisation identifier provided by admin
 */

export const DEFAULT_SETTINGS = {
  // Master switch. Disables all monitoring when false.
  enabled: true,

  // When true, no per-user attribution is sent. The user_pseudonym field
  // is set to a fixed string ("anonymous") rather than a hashed identifier.
  anonymousMode: false,

  // Backend ingestion endpoint. Empty string = local-only mode (events
  // stored in extension storage, never dispatched). This is the default
  // for sideload installs.
  backendUrl: '',

  // Tenant identifier (provided by org admin during deployment).
  tenantId: '',

  // Batch dispatch settings.
  batchInterval: 30_000,   // ms — flush queue every 30s
  batchMaxSize: 50,        // events — flush sooner if queue reaches this

  // Verbose logging to the extension's service-worker console.
  // Useful during sideload testing; should be off in production deployments.
  debugLogging: true
};

/**
 * Read settings, merging stored values over defaults.
 * @returns {Promise<object>}
 */
export async function getSettings() {
  const stored = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

/**
 * Persist settings (merged with existing values).
 * @param {object} partial
 */
export async function setSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ settings: next });
  return next;
}

/**
 * Append an event to the local queue.
 * @param {object} event - metadata-only event payload
 */
export async function enqueueEvent(event) {
  const { eventQueue = [] } = await chrome.storage.local.get('eventQueue');
  eventQueue.push(event);
  // Hard cap on queue size to prevent unbounded growth in offline mode
  const trimmed = eventQueue.slice(-1000);
  await chrome.storage.local.set({ eventQueue: trimmed });
  return trimmed.length;
}

/**
 * Drain the queue: returns all events and clears storage atomically.
 * @returns {Promise<Array>}
 */
export async function drainEventQueue() {
  const { eventQueue = [] } = await chrome.storage.local.get('eventQueue');
  await chrome.storage.local.set({ eventQueue: [] });
  return eventQueue;
}

/**
 * Get the current queue without draining (for the popup/options UIs).
 */
export async function peekEventQueue() {
  const { eventQueue = [] } = await chrome.storage.local.get('eventQueue');
  return eventQueue;
}

/**
 * Get or create a stable per-install pseudonym.
 * Used as user_pseudonym when anonymousMode is false.
 *
 * The value is a random UUID stored in extension storage. It does NOT
 * identify the human — only this install of this extension on this device.
 */
export async function getOrCreatePseudonym() {
  const { pseudonym } = await chrome.storage.local.get('pseudonym');
  if (pseudonym) return pseudonym;
  const fresh = crypto.randomUUID();
  await chrome.storage.local.set({ pseudonym: fresh });
  return fresh;
}
