/**
 * IndexedDB storage wrapper for persisting events and settings.
 */

const DB_NAME = 'YTEventAggregator';
const DB_VERSION = 1;

// Store names
const STORES = {
  EVENTS: 'events',
  SUBSCRIPTIONS: 'subscriptions',
  SETTINGS: 'settings'
};

let dbPromise = null;

/**
 * Initialize the database
 */
function initDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Events store - community posts, videos, streams
      if (!db.objectStoreNames.contains(STORES.EVENTS)) {
        const eventStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'id' });
        eventStore.createIndex('type', 'type', { unique: false });
        eventStore.createIndex('channelId', 'channelId', { unique: false });
        eventStore.createIndex('extractedAt', 'extractedAt', { unique: false });
        eventStore.createIndex('scheduledStartTime', 'scheduledStartTime', { unique: false });
        eventStore.createIndex('isEvent', 'isEvent', { unique: false });
      }

      // Subscriptions store
      if (!db.objectStoreNames.contains(STORES.SUBSCRIPTIONS)) {
        const subStore = db.createObjectStore(STORES.SUBSCRIPTIONS, { keyPath: 'channelId' });
        subStore.createIndex('channelName', 'channelName', { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };
  });

  return dbPromise;
}

/**
 * Get a transaction and store
 */
async function getStore(storeName, mode = 'readonly') {
  const db = await initDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

/**
 * Promisify an IDB request
 */
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== Events ====================

/**
 * Save an event (upsert)
 */
export async function saveEvent(event) {
  const store = await getStore(STORES.EVENTS, 'readwrite');
  return promisifyRequest(store.put(event));
}

/**
 * Save multiple events
 */
export async function saveEvents(events) {
  const db = await initDB();
  const tx = db.transaction(STORES.EVENTS, 'readwrite');
  const store = tx.objectStore(STORES.EVENTS);

  for (const event of events) {
    store.put(event);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get an event by ID
 */
export async function getEvent(id) {
  const store = await getStore(STORES.EVENTS);
  return promisifyRequest(store.get(id));
}

/**
 * Get all events
 */
export async function getAllEvents() {
  const store = await getStore(STORES.EVENTS);
  return promisifyRequest(store.getAll());
}

/**
 * Get events by type (community_post, video, etc.)
 */
export async function getEventsByType(type) {
  const store = await getStore(STORES.EVENTS);
  const index = store.index('type');
  return promisifyRequest(index.getAll(type));
}

/**
 * Get events by channel
 */
export async function getEventsByChannel(channelId) {
  const store = await getStore(STORES.EVENTS);
  const index = store.index('channelId');
  return promisifyRequest(index.getAll(channelId));
}

/**
 * Get events that are flagged as events (high relevance)
 */
export async function getDetectedEvents() {
  const store = await getStore(STORES.EVENTS);
  const index = store.index('isEvent');
  return promisifyRequest(index.getAll(true));
}

/**
 * Get upcoming streams (sorted by scheduled time)
 */
export async function getUpcomingStreams() {
  const events = await getAllEvents();
  const now = Date.now();

  return events
    .filter(e => e.scheduledStartTime && new Date(e.scheduledStartTime).getTime() > now)
    .sort((a, b) => new Date(a.scheduledStartTime) - new Date(b.scheduledStartTime));
}

/**
 * Get recent events (within last N days)
 */
export async function getRecentEvents(days = 7) {
  const events = await getAllEvents();
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

  return events
    .filter(e => e.extractedAt > cutoff)
    .sort((a, b) => b.extractedAt - a.extractedAt);
}

/**
 * Delete old events (cleanup)
 */
export async function deleteOldEvents(maxAgeDays = 30) {
  const db = await initDB();
  const tx = db.transaction(STORES.EVENTS, 'readwrite');
  const store = tx.objectStore(STORES.EVENTS);
  const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

  const request = store.openCursor();
  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      if (cursor.value.extractedAt < cutoff) {
        cursor.delete();
      }
      cursor.continue();
    }
  };

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==================== Subscriptions ====================

/**
 * Save a subscription
 */
export async function saveSubscription(subscription) {
  const store = await getStore(STORES.SUBSCRIPTIONS, 'readwrite');
  return promisifyRequest(store.put(subscription));
}

/**
 * Save multiple subscriptions
 */
export async function saveSubscriptions(subscriptions) {
  const db = await initDB();
  const tx = db.transaction(STORES.SUBSCRIPTIONS, 'readwrite');
  const store = tx.objectStore(STORES.SUBSCRIPTIONS);

  for (const sub of subscriptions) {
    store.put(sub);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all subscriptions
 */
export async function getAllSubscriptions() {
  const store = await getStore(STORES.SUBSCRIPTIONS);
  return promisifyRequest(store.getAll());
}

// ==================== Settings ====================

/**
 * Save a setting
 */
export async function saveSetting(key, value) {
  const store = await getStore(STORES.SETTINGS, 'readwrite');
  return promisifyRequest(store.put({ key, value }));
}

/**
 * Get a setting
 */
export async function getSetting(key, defaultValue = null) {
  const store = await getStore(STORES.SETTINGS);
  const result = await promisifyRequest(store.get(key));
  return result ? result.value : defaultValue;
}

/**
 * Get all settings
 */
export async function getAllSettings() {
  const store = await getStore(STORES.SETTINGS);
  const results = await promisifyRequest(store.getAll());
  return results.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
}

// ==================== Stats ====================

/**
 * Get storage statistics
 */
export async function getStats() {
  const events = await getAllEvents();
  const subscriptions = await getAllSubscriptions();

  const byType = {};
  const byChannel = {};
  let detectedEvents = 0;
  let upcomingStreams = 0;

  for (const event of events) {
    byType[event.type] = (byType[event.type] || 0) + 1;
    byChannel[event.channelId] = (byChannel[event.channelId] || 0) + 1;
    if (event.isEvent) detectedEvents++;
    if (event.scheduledStartTime && new Date(event.scheduledStartTime) > new Date()) {
      upcomingStreams++;
    }
  }

  return {
    totalEvents: events.length,
    totalSubscriptions: subscriptions.length,
    byType,
    byChannel,
    detectedEvents,
    upcomingStreams
  };
}

// ==================== Utility ====================

/**
 * Clear all data (for debugging/reset)
 */
export async function clearAll() {
  const db = await initDB();

  const tx = db.transaction([STORES.EVENTS, STORES.SUBSCRIPTIONS, STORES.SETTINGS], 'readwrite');
  tx.objectStore(STORES.EVENTS).clear();
  tx.objectStore(STORES.SUBSCRIPTIONS).clear();
  tx.objectStore(STORES.SETTINGS).clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Initialize on import
initDB().catch(console.error);
