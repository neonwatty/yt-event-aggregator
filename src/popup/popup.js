/**
 * Popup UI for YouTube Event Aggregator
 */

import {
  getAllEvents,
  getDetectedEvents,
  getUpcomingStreams,
  getEventsByType,
  getStats,
  clearAll
} from '../lib/storage.js';

// DOM elements
const elements = {
  stats: {
    events: document.getElementById('stat-events'),
    streams: document.getElementById('stat-streams')
  },
  tabs: document.querySelectorAll('.tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  lists: {
    events: document.getElementById('event-list'),
    upcoming: document.getElementById('upcoming-list'),
    posts: document.getElementById('posts-list')
  },
  openYoutube: document.getElementById('open-youtube'),
  clearData: document.getElementById('clear-data')
};

/**
 * Format relative time
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';

  const now = Date.now();
  const date = new Date(timestamp);
  const diff = now - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

/**
 * Format scheduled time
 */
function formatScheduledTime(isoString) {
  if (!isoString) return '';

  const date = new Date(isoString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return 'Started';

  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (hours < 1) return 'Starting soon';
  if (hours < 24) return `In ${hours}h`;
  if (days < 7) return `In ${days}d`;

  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Create badge HTML
 */
function createBadge(type, text) {
  return `<span class="event-badge ${type}">${text}</span>`;
}

/**
 * Create event item HTML
 */
function createEventItem(event) {
  const isHighRelevance = event.relevanceScore >= 30;
  const thumbnail = event.channelThumbnail || event.thumbnail || '';
  const isVideo = event.type === 'video';

  let badges = '';
  if (event.isLive) badges += createBadge('live', 'Live');
  if (event.isUpcoming) badges += createBadge('upcoming', 'Upcoming');
  if (event.matchedCategories?.includes('concerts')) badges += createBadge('concert', 'Concert');
  if (event.matchedCategories?.includes('deals')) badges += createBadge('deal', 'Deal');
  if (event.matchedCategories?.includes('announcements')) badges += createBadge('announcement', 'News');

  let scheduledHtml = '';
  if (event.scheduledStartTime) {
    scheduledHtml = `<div class="scheduled-time">${formatScheduledTime(event.scheduledStartTime)}</div>`;
  }

  let keywordsHtml = '';
  if (event.matchedKeywords?.length > 0) {
    keywordsHtml = `
      <div class="event-keywords">
        ${event.matchedKeywords.slice(0, 3).map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
      </div>
    `;
  }

  const content = event.content || event.description || '';
  const title = event.title || content.substring(0, 100);

  return `
    <div class="event-item ${isHighRelevance ? 'high-relevance' : ''}" data-id="${event.id}">
      <div class="event-header">
        ${thumbnail ? `<img class="event-thumbnail ${isVideo ? 'video' : ''}" src="${thumbnail}" alt="">` : ''}
        <div class="event-info">
          <div class="event-channel">${event.channelName || 'Unknown channel'}</div>
          <div class="event-title">${escapeHtml(title)}</div>
        </div>
      </div>
      ${content && event.type === 'community_post' ? `<div class="event-content">${escapeHtml(content)}</div>` : ''}
      <div class="event-meta">
        ${badges}
        ${scheduledHtml}
        <span class="event-time">${formatRelativeTime(event.extractedAt)}</span>
      </div>
      ${keywordsHtml}
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render event list
 */
function renderEvents(container, events, emptyMessage = 'No items found.') {
  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${emptyMessage}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = events.map(createEventItem).join('');

  // Add click handlers
  container.querySelectorAll('.event-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const event = events.find(e => e.id === id);
      if (event) {
        openEvent(event);
      }
    });
  });
}

/**
 * Open event in YouTube
 */
function openEvent(event) {
  let url;
  if (event.type === 'video') {
    url = `https://www.youtube.com/watch?v=${event.id}`;
  } else if (event.type === 'community_post') {
    url = `https://www.youtube.com/channel/${event.channelId}/community?lb=${event.id}`;
  }

  if (url) {
    chrome.tabs.create({ url });
  }
}

/**
 * Update stats display
 */
function updateStats(stats) {
  elements.stats.events.textContent = `${stats.detectedEvents} events`;
  elements.stats.streams.textContent = `${stats.upcomingStreams} upcoming`;
}

/**
 * Load and display data
 */
async function loadData() {
  try {
    // Get stats
    const stats = await getStats();
    updateStats(stats);

    // Get events for each tab
    const detectedEvents = await getDetectedEvents();
    const upcomingStreams = await getUpcomingStreams();
    const communityPosts = await getEventsByType('community_post');

    // Sort by relevance/time
    detectedEvents.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    communityPosts.sort((a, b) => b.extractedAt - a.extractedAt);

    // Render each list
    renderEvents(
      elements.lists.events,
      detectedEvents,
      'No events detected yet. Browse YouTube to start collecting.'
    );

    renderEvents(
      elements.lists.upcoming,
      upcomingStreams,
      'No upcoming streams found.'
    );

    renderEvents(
      elements.lists.posts,
      communityPosts.slice(0, 50), // Limit to recent 50
      'No community posts collected yet.'
    );

    // Clear badge
    chrome.runtime.sendMessage({ action: 'CLEAR_BADGE' });

  } catch (error) {
    console.error('Error loading data:', error);
  }
}

/**
 * Switch tabs
 */
function switchTab(tabName) {
  elements.tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  elements.tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

/**
 * Initialize popup
 */
function init() {
  // Tab switching
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // Open YouTube
  elements.openYoutube.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://www.youtube.com/feed/subscriptions' });
  });

  // Clear data
  elements.clearData.addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('Clear all collected data?')) {
      await clearAll();
      loadData();
    }
  });

  // Load initial data
  loadData();
}

// Start
document.addEventListener('DOMContentLoaded', init);
