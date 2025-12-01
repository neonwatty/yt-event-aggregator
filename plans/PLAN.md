# YouTube Subscription Event Aggregator - Chrome Extension

## Problem Statement
YouTube users miss announcements for live shows, events, deals, and activities from channels they subscribe to. YouTube's algorithm-driven home feed deprioritizes subscription content, and there's no built-in way to aggregate "event-like" content across subscriptions.

## Goal
Build a Chrome extension that intercepts YouTube's internal API responses to aggregate event/announcement content - including **community posts** which are inaccessible via the official API.

---

## Why Chrome Extension > CLI Tool

| Capability | CLI (Official API) | Chrome Extension |
|------------|-------------------|------------------|
| Community Posts | No | **Yes** |
| Upcoming Streams | Yes | Yes |
| Subscription Feed | Yes (quota limited) | **Yes** (no quota) |
| User Authentication | OAuth required | **Already logged in** |
| Real-time Updates | Polling | **Passive interception** |
| API Quota | 10,000 units/day | **Unlimited** |

---

## Data We Can Capture

### 1. Community Posts (via `backstagePostRenderer`)
| Field | Description |
|-------|-------------|
| `postId` | Unique identifier |
| `contentText` | Full post text (with linked mentions) |
| `images` | Up to 10 images with thumbnails |
| `poll` | Poll options, vote counts, results |
| `videoAttachment` | Embedded video reference |
| `publishedTimeText` | Relative timestamp ("2 days ago") |
| `voteCount` | Like count |
| `replyCount` | Comment count |
| `authorText` | Channel name |
| `authorChannelId` | Channel ID |

### 2. Videos (via `videoRenderer`, `richItemRenderer`)
| Field | Description |
|-------|-------------|
| `videoId` | Unique identifier |
| `title` | Video title |
| `descriptionSnippet` | First ~100 chars of description |
| `lengthText` | Duration |
| `viewCountText` | View count |
| `publishedTimeText` | Upload date |
| `ownerText` | Channel name |
| `thumbnail` | Video thumbnail URLs |
| `badges` | "LIVE", "PREMIERE", "NEW" indicators |
| `upcomingEventData` | Scheduled start time for premieres/streams |

### 3. Live Streams & Premieres (via `liveStreamingDetails`)
| Field | Description |
|-------|-------------|
| `scheduledStartTime` | ISO 8601 datetime |
| `actualStartTime` | When it actually started |
| `concurrentViewers` | Live viewer count |
| `liveBroadcastContent` | "upcoming", "live", "none" |

### 4. User's Subscription List
| Field | Description |
|-------|-------------|
| All subscribed channels | Channel IDs and names |
| Recent uploads per channel | Latest videos from each |
| Upload frequency patterns | Derived from timestamps |

---

## Potential Insights & Aggregations

### For Individual Users

| Insight | How We Generate It |
|---------|-------------------|
| **Upcoming Events Calendar** | Aggregate all `scheduledStartTime` from premieres/streams |
| **Event Alerts by Category** | Keyword match on "tour", "tickets", "giveaway", etc. |
| **Announcement Digest** | Aggregate community posts with announcement keywords |
| **"You Might Miss" Feed** | Content from low-activity channels (often buried by algorithm) |
| **Live Stream Schedule** | All upcoming streams sorted by time |
| **Channel Activity Heatmap** | When each channel typically posts |

### Vertical-Specific Insights

**Music Channels:**
- Tour date aggregation (cross-reference with Bandsintown)
- Ticket on-sale alerts
- New album/single drop dates

**Gaming Channels:**
- Stream schedules
- Tournament announcements

**Educational/Tech:**
- Course launches, webinar schedules
- Product announcements

---

## UI Features This Enables

1. **Smart Notifications**: "3 channels going live in 24 hours"
2. **Calendar Integration**: Export to Google Calendar / iCal
3. **Digest Modes**: Daily/weekly summary
4. **Priority Filtering**: Mark channels as "high priority"
5. **Historical Tracking**: "You missed 5 announcements"

---

## What We Cannot Capture

| Limitation | Reason |
|------------|--------|
| Full video descriptions | Only snippet in feed; need video page visit |
| Private/unlisted content | Not in API responses |
| Member-only posts | Requires membership auth |
| Deleted posts | Gone from API |

---

## Market Research

### Competition Analysis

| Tool | Users | What It Does | Gap |
|------|-------|--------------|-----|
| PocketTube | 300K+ | Group/organize subscriptions, filter by topic | **No community post aggregation** |
| Better Subscriptions | ~10K | Hide watched videos | **No event detection** |
| Manage YT Subscriptions | Small | Import/export subscription lists | **No aggregation** |

**Key Finding:** No existing tool aggregates community posts or detects events/announcements. This is a clear market gap.

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Rate limiting | Medium | Keep fetch intervals >30min, randomize timing |
| IP blocking | Low | Extension runs as user, not bot |
| CAPTCHAs | Low | User is authenticated, normal browsing |
| API structure changes | High | Monitor community parsers, build abstraction layer |

Chrome extensions using user's session are lower risk than server-side scrapers because requests come from user's IP with user's cookies.

### Monetization Strategy

**Recommended: Freemium with subscription**

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Passive collection, basic keywords, last 7 days |
| Pro | $5/mo | Active fetching, custom keywords, calendar export, unlimited history |
| Team | $15/mo | Multiple accounts, analytics, API access |

**Revenue Benchmarks:**
- Average successful extension: $72.8K/year
- YouTube tools specifically: $200K-$500K/year range
- Profit margins: ~83%

Payment via ExtensionPay or Stripe (Google killed Chrome Web Store payments in 2021).

### User Demand Evidence

| Source | Evidence |
|--------|----------|
| Reddit/Twitter | "thousands of posts from frustrated YouTube users" |
| April 2024 Outage | Widespread complaints when subscriptions broke |
| November 2025 | Users frustrated by disappearing Subscriptions tab |
| YouTube Community Forum | Active threads on "Subscription Feed Broken" |

YouTube has acknowledged that "subscriptions don't matter as much anymore" - they're pushing algorithmic discovery over chronological feeds. This creates ongoing user frustration.

### Viability Assessment

| Factor | Assessment |
|--------|------------|
| Competition | Low - no one does community post aggregation |
| Technical Risk | Medium - API changes are main concern |
| Monetization | Strong - freemium model proven |
| User Demand | High - documented, ongoing frustration |
| Market Size | Large - YouTube 2B+ users, power users are target |

**Verdict: Strong opportunity.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      youtube.com                            │
│                                                             │
│  ┌──────────────────┐      ┌────────────────────────────┐  │
│  │  Injected Script │      │  Content Script            │  │
│  │  (page context)  │─────▶│  (isolated, bridge)        │  │
│  │                  │      └─────────────┬──────────────┘  │
│  │  • Wraps fetch   │                    │                 │
│  │  • Intercepts    │                    │ chrome.runtime  │
│  │    youtubei/v1/* │                    │ .sendMessage    │
│  │  • Posts to      │                    ▼                 │
│  │    contentScript │      ┌────────────────────────────┐  │
│  └──────────────────┘      │  Service Worker            │  │
│                            │  (background)              │  │
│                            │                            │  │
│                            │  • IndexedDB storage       │  │
│                            │  • Event deduplication     │  │
│                            │  • Keyword matching        │  │
│                            │  • Badge updates           │  │
│                            └─────────────┬──────────────┘  │
└──────────────────────────────────────────┼─────────────────┘
                                           │
                                           ▼
                             ┌────────────────────────────┐
                             │  Extension Popup UI        │
                             │                            │
                             │  📅 Upcoming Events        │
                             │  💬 Community Announcements│
                             │  🎫 Keyword Matches        │
                             │                            │
                             │  [Filter] [Settings]       │
                             └────────────────────────────┘
```

---

## How Request Interception Works

### 1. Inject Script at Document Start
The extension injects a script into YouTube pages **before** any JavaScript runs. This script wraps the native `fetch` function:

```javascript
// Simplified concept
const originalFetch = window.fetch;
window.fetch = async function(url, options) {
  const response = await originalFetch(url, options);

  if (url.includes('/youtubei/v1/browse') ||
      url.includes('/youtubei/v1/next')) {
    const clone = response.clone();
    const data = await clone.json();
    // Extract events, community posts, etc.
    window.postMessage({ type: 'YT_EVENT_DATA', payload: data }, '*');
  }

  return response;
};
```

### 2. Data We Can Extract

**From `/youtubei/v1/browse` (community tab, subscription feed):**
- `backstagePostRenderer` - Community posts with text, images, polls
- `videoRenderer` - Videos with `upcomingEventData` for scheduled streams
- `richItemRenderer` - Feed items with metadata

**From `/youtubei/v1/next` (video page):**
- `liveBroadcastDetails` - Live stream scheduled time
- `description` - Full video description for keyword scanning

### 3. Message Flow
```
Injected Script ──postMessage──▶ Content Script ──chrome.runtime──▶ Service Worker
                                                                           │
                                                                           ▼
                                                                     IndexedDB
```

---

## Implementation Plan

### Phase 1: Manifest & Basic Structure
- Create Manifest V3 extension
- Set up content script injection at `document_start`
- Implement message passing between contexts

### Phase 2: Request Interception
- Inject fetch wrapper script
- Filter for relevant YouTube API endpoints
- Parse response JSON for event data

### Phase 3: Event Extraction
- Parse community posts (`backstagePostRenderer`)
- Parse upcoming streams (`upcomingEventData`)
- Parse video metadata for keyword matching

### Phase 4: Storage & Deduplication
- Store events in IndexedDB
- Deduplicate by video/post ID
- Track "seen" status

### Phase 5: UI
- Build popup with event list
- Add filtering (by type, channel, keyword category)
- Settings page for keyword customization

### Phase 6: Notifications (Optional)
- Badge count for new events
- Optional browser notifications for high-priority matches

---

## File Structure

```
yt-event-aggregator/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.js    # Event storage, processing
│   ├── content/
│   │   ├── content-script.js    # Message bridge
│   │   └── inject.js            # Fetch interceptor (injected)
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── lib/
│   │   ├── event-parser.js      # Extract events from API responses
│   │   ├── keyword-matcher.js   # Detect event keywords
│   │   └── storage.js           # IndexedDB wrapper
│   └── options/
│       ├── options.html         # Settings page
│       └── options.js
└── icons/
    └── ...
```

---

## Keyword Categories (Configurable)

```javascript
const KEYWORD_CATEGORIES = {
  concerts: ['tour', 'tickets', 'concert', 'live show', 'on sale', 'presale'],
  meetups: ['meet & greet', 'meetup', 'fan event', 'signing'],
  deals: ['sale', 'discount', 'giveaway', 'free', 'limited time', 'coupon'],
  streams: ['going live', 'live stream', 'premiere', 'watch party'],
  announcements: ['announcement', 'big news', 'exciting news', 'reveal']
};
```

---

## Technical Challenges & Solutions

### Challenge 1: YouTube is a SPA
- **Problem**: Page doesn't fully reload when navigating
- **Solution**: Use MutationObserver or listen for `yt-navigate-finish` event

### Challenge 2: Manifest V3 Restrictions
- **Problem**: No persistent background pages
- **Solution**: Use service worker + IndexedDB for persistence

### Challenge 3: Isolated World
- **Problem**: Content scripts can't access page's JavaScript context
- **Solution**: Inject script via `<script>` tag at `document_start`, use `postMessage` to communicate

### Challenge 4: Rate of Data
- **Problem**: User might browse many pages, generating lots of data
- **Solution**: Debounce processing, only store event-relevant items

---

## Two Collection Modes

### Mode 1: Passive Interception (Always On)
- Intercepts API responses as user browses YouTube
- Zero additional network requests
- Captures everything the user sees

### Mode 2: Active Background Fetching (Periodic)
The extension can also proactively fetch updates using the user's session:

```javascript
// Service worker can make authenticated requests
const response = await fetch('https://www.youtube.com/youtubei/v1/browse', {
  method: 'POST',
  credentials: 'include',  // Use user's cookies
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    context: { client: { clientName: 'WEB', clientVersion: '2.x' } },
    browseId: 'FEsubscriptions'  // Subscription feed
  })
});
```

**Requirements for active fetching:**
- `host_permissions: ["*://www.youtube.com/*"]` in manifest
- May need `cookies` permission to ensure session is used
- Use Chrome's `alarms` API for periodic checks (e.g., every 30 min)

**What we can actively fetch:**
- Subscription feed (all recent videos)
- Community posts from specific channels
- Upcoming live streams

---

## Known Limitations

1. **YouTube API Changes**: Internal API structure may change
   - Need to monitor for breaking changes
   - Community-maintained parsers exist for reference (e.g., youtube-operational-api)

2. **Chrome Only (Initially)**: Manifest V3 is Chrome-specific
   - Firefox uses different extension APIs
   - Can port later if successful

3. **Rate Limiting**: Aggressive background fetching could trigger YouTube's anti-bot measures
   - Keep fetch intervals reasonable (30+ min)
   - Randomize timing slightly

---

## Proof of Concept Scope

**Phase 1 (Passive):**
1. Intercept `/youtubei/v1/browse` for community posts
2. Extract text content and check for keywords
3. Display matches in a simple popup list

**Phase 2 (Active):**
4. Add background fetching of subscription feed
5. Fetch community posts from subscribed channels
6. Periodic refresh with user-configurable interval

This validates both techniques before building full UI/features.
