/**
 * Keyword matching for detecting events and announcements in content.
 */

// Default keyword categories
const DEFAULT_KEYWORDS = {
  concerts: [
    'tour', 'tickets', 'concert', 'live show', 'on sale', 'presale',
    'pre-sale', 'tour dates', 'world tour', 'festival', 'headline',
    'opening act', 'sold out', 'vip', 'meet and greet'
  ],
  meetups: [
    'meet & greet', 'meet and greet', 'meetup', 'meet-up', 'fan event',
    'signing', 'autograph', 'fan meet', 'convention', 'vidcon', 'creator summit'
  ],
  deals: [
    'sale', 'discount', 'giveaway', 'free', 'limited time', 'coupon',
    'promo code', 'deal', 'offer', 'save', '% off', 'merch drop',
    'merchandise', 'shop now', 'link in bio', 'affiliate'
  ],
  streams: [
    'going live', 'live stream', 'livestream', 'premiere', 'watch party',
    'streaming now', 'live now', 'join us live', 'tune in', 'broadcast'
  ],
  announcements: [
    'announcement', 'big news', 'exciting news', 'reveal', 'announcing',
    'finally', 'introducing', 'new video', 'dropping', 'out now',
    'just released', 'breaking', 'important update', 'major announcement'
  ],
  releases: [
    'album', 'single', 'ep', 'new song', 'new music', 'music video',
    'out now', 'available now', 'dropping', 'release date', 'pre-order',
    'preorder', 'pre order'
  ]
};

/**
 * Normalize text for matching (lowercase, remove extra whitespace)
 */
function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Check if text contains any keywords from a category
 */
function matchCategory(text, keywords) {
  const normalizedText = normalizeText(text);
  const matches = [];

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedText.includes(normalizedKeyword)) {
      matches.push(keyword);
    }
  }

  return matches;
}

/**
 * Match content against all keyword categories
 * @param {string} text - Text to search
 * @param {Object} customKeywords - Optional custom keywords to merge with defaults
 * @returns {Object} Matches by category
 */
export function matchKeywords(text, customKeywords = {}) {
  const keywords = { ...DEFAULT_KEYWORDS, ...customKeywords };
  const results = {
    hasMatches: false,
    categories: {},
    allMatches: []
  };

  for (const [category, categoryKeywords] of Object.entries(keywords)) {
    const matches = matchCategory(text, categoryKeywords);
    if (matches.length > 0) {
      results.hasMatches = true;
      results.categories[category] = matches;
      results.allMatches.push(...matches);
    }
  }

  return results;
}

/**
 * Score content for event relevance (higher = more likely an event/announcement)
 */
export function scoreEventRelevance(item) {
  let score = 0;
  const textToSearch = [];

  // Gather all text from the item
  if (item.title) textToSearch.push(item.title);
  if (item.content) textToSearch.push(item.content);
  if (item.description) textToSearch.push(item.description);

  const fullText = textToSearch.join(' ');
  const matches = matchKeywords(fullText);

  // Base score from keyword matches
  score += matches.allMatches.length * 10;

  // Bonus for specific high-value categories
  if (matches.categories.concerts) score += 25;
  if (matches.categories.streams) score += 20;
  if (matches.categories.announcements) score += 15;

  // Bonus for upcoming/live content
  if (item.isUpcoming) score += 30;
  if (item.isLive) score += 25;
  if (item.scheduledStartTime) score += 20;

  // Bonus for polls (often used for announcements)
  if (item.poll) score += 10;

  // Bonus for high engagement (if available)
  const voteCount = parseInt(item.voteCount) || 0;
  if (voteCount > 10000) score += 15;
  else if (voteCount > 1000) score += 10;
  else if (voteCount > 100) score += 5;

  return {
    score,
    matches,
    isEvent: score >= 20
  };
}

/**
 * Filter and rank items by event relevance
 */
export function filterEvents(items, minScore = 20) {
  return items
    .map(item => ({
      ...item,
      relevance: scoreEventRelevance(item)
    }))
    .filter(item => item.relevance.score >= minScore)
    .sort((a, b) => b.relevance.score - a.relevance.score);
}

/**
 * Get default keywords (for settings UI)
 */
export function getDefaultKeywords() {
  return { ...DEFAULT_KEYWORDS };
}

/**
 * Validate custom keywords object
 */
export function validateKeywords(keywords) {
  if (!keywords || typeof keywords !== 'object') return false;

  for (const [category, words] of Object.entries(keywords)) {
    if (!Array.isArray(words)) return false;
    if (!words.every(w => typeof w === 'string')) return false;
  }

  return true;
}
