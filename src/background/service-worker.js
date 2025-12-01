/**
 * Service worker for YouTube Event Aggregator.
 * Handles data processing, storage, and badge updates.
 */

import { parseYouTubeResponse, getBrowseContext } from '../lib/event-parser.js';
import { scoreEventRelevance, matchKeywords } from '../lib/keyword-matcher.js';
import {
  saveEvents,
  saveSubscriptions,
  getDetectedEvents,
  getUpcomingStreams,
  getStats,
  deleteOldEvents,
  saveSetting,
  getSetting
} from '../lib/storage.js';

// Track processed items to avoid duplicates within a session
const processedIds = new Set();

/**
 * Process YouTube API data from content script
 */
async function processYouTubeData(message) {
  const { endpointType, data, pageUrl, timestamp } = message;

  if (!data) return;

  try {
    // Parse the response
    const parsed = parseYouTubeResponse(data, endpointType);
    const context = getBrowseContext(data);

    console.debug('[YT Event Aggregator] Parsed response:', {
      endpointType,
      communityPosts: parsed.communityPosts.length,
      videos: parsed.videos.length,
      upcomingStreams: parsed.upcomingStreams.length,
      subscriptions: parsed.subscriptions.length,
      context
    });

    // Process and score community posts
    const processedPosts = parsed.communityPosts
      .filter(post => post.id && !processedIds.has(post.id))
      .map(post => {
        processedIds.add(post.id);
        const relevance = scoreEventRelevance(post);
        return {
          ...post,
          isEvent: relevance.isEvent,
          relevanceScore: relevance.score,
          matchedKeywords: relevance.matches.allMatches,
          matchedCategories: Object.keys(relevance.matches.categories)
        };
      });

    // Process and score videos
    const processedVideos = parsed.videos
      .filter(video => video.id && !processedIds.has(video.id))
      .map(video => {
        processedIds.add(video.id);
        const relevance = scoreEventRelevance(video);
        return {
          ...video,
          isEvent: relevance.isEvent,
          relevanceScore: relevance.score,
          matchedKeywords: relevance.matches.allMatches,
          matchedCategories: Object.keys(relevance.matches.categories)
        };
      });

    // Save to storage
    const allItems = [...processedPosts, ...processedVideos];
    if (allItems.length > 0) {
      await saveEvents(allItems);
      console.debug(`[YT Event Aggregator] Saved ${allItems.length} items`);
    }

    // Save subscriptions if found
    if (parsed.subscriptions.length > 0) {
      await saveSubscriptions(parsed.subscriptions);
      console.debug(`[YT Event Aggregator] Saved ${parsed.subscriptions.length} subscriptions`);
    }

    // Update badge
    await updateBadge();

    // Log detected events
    const detectedEvents = allItems.filter(item => item.isEvent);
    if (detectedEvents.length > 0) {
      console.log('[YT Event Aggregator] Detected events:', detectedEvents.map(e => ({
        type: e.type,
        title: e.title || e.content?.substring(0, 50),
        channel: e.channelName,
        keywords: e.matchedKeywords
      })));
    }

  } catch (error) {
    console.error('[YT Event Aggregator] Error processing data:', error);
  }
}

/**
 * Update the extension badge with event count
 */
async function updateBadge() {
  try {
    const detectedEvents = await getDetectedEvents();
    const upcomingStreams = await getUpcomingStreams();

    // Count unread/new events (simplified - in production you'd track read status)
    const eventCount = detectedEvents.length;
    const streamCount = upcomingStreams.length;
    const total = eventCount + streamCount;

    if (total > 0) {
      const badgeText = total > 99 ? '99+' : total.toString();
      await chrome.action.setBadgeText({ text: badgeText });
      await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('[YT Event Aggregator] Error updating badge:', error);
  }
}

/**
 * Handle messages from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PROCESS_YT_DATA') {
    processYouTubeData(message)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (message.action === 'PAGE_NAVIGATED') {
    console.debug('[YT Event Aggregator] Page navigated:', message.url);
    return false;
  }

  if (message.action === 'GET_STATS') {
    getStats()
      .then(stats => sendResponse(stats))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === 'GET_EVENTS') {
    getDetectedEvents()
      .then(events => sendResponse(events))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === 'GET_UPCOMING') {
    getUpcomingStreams()
      .then(streams => sendResponse(streams))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === 'CLEAR_BADGE') {
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ success: true });
    return false;
  }

  return false;
});

/**
 * Cleanup old data periodically
 */
async function performCleanup() {
  try {
    await deleteOldEvents(30); // Delete events older than 30 days
    processedIds.clear(); // Clear session cache
    console.debug('[YT Event Aggregator] Cleanup completed');
  } catch (error) {
    console.error('[YT Event Aggregator] Cleanup error:', error);
  }
}

// Set up periodic cleanup using alarms
chrome.alarms.create('cleanup', { periodInMinutes: 60 * 24 }); // Daily

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    performCleanup();
  }
});

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[YT Event Aggregator] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // Set default settings
    await saveSetting('minRelevanceScore', 20);
    await saveSetting('showNotifications', true);
    await saveSetting('retentionDays', 30);
  }

  // Initial badge update
  await updateBadge();
});

// Also update badge when service worker starts
updateBadge();

console.log('[YT Event Aggregator] Service worker started');
