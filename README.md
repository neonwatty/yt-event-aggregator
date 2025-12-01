# YouTube Event Aggregator

A Chrome extension that aggregates events, announcements, and community posts from your YouTube subscriptions.

## Features

- **Passive Collection**: Intercepts YouTube's internal API as you browse
- **Community Posts**: Captures posts that aren't available via the official API
- **Event Detection**: Uses keyword matching to identify concerts, deals, announcements
- **Upcoming Streams**: Tracks scheduled live streams and premieres
- **Clean UI**: Simple popup to view detected events

## Installation (Development)

1. **Generate icons** (required):
   ```bash
   # Convert SVG to PNG using ImageMagick or similar
   # Or use any 16x16, 48x48, and 128x128 PNG images
   # Name them: icon16.png, icon48.png, icon128.png
   # Place in the icons/ directory
   ```

2. **Load the extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `yt-event-aggregator` directory

3. **Test it**:
   - Go to YouTube and browse your subscriptions
   - Click the extension icon to see detected events

## Project Structure

```
yt-event-aggregator/
├── manifest.json           # Extension configuration
├── src/
│   ├── background/
│   │   └── service-worker.js   # Background processing
│   ├── content/
│   │   ├── content-script.js   # Message bridge
│   │   └── inject.js           # Fetch interceptor
│   ├── lib/
│   │   ├── event-parser.js     # YouTube response parser
│   │   ├── keyword-matcher.js  # Event detection
│   │   └── storage.js          # IndexedDB wrapper
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── options/                # Settings (TODO)
├── icons/
│   └── *.png                   # Extension icons
└── plans/
    └── PLAN.md                 # Project plan
```

## How It Works

1. **Fetch Interception**: The extension injects a script that wraps `window.fetch` to intercept YouTube's internal API calls (`/youtubei/v1/browse`, etc.)

2. **Data Extraction**: Responses are parsed to extract:
   - Community posts (`backstagePostRenderer`)
   - Videos and their metadata (`videoRenderer`)
   - Upcoming streams (`upcomingEventData`)
   - Subscription info (`guideEntryRenderer`)

3. **Event Detection**: Content is scored for relevance using keyword matching across categories (concerts, deals, announcements, etc.)

4. **Storage**: Detected events are stored in IndexedDB for persistence

5. **Display**: The popup shows events sorted by relevance

## Keyword Categories

- **Concerts**: tour, tickets, concert, live show, presale
- **Meetups**: meet & greet, fan event, signing
- **Deals**: sale, discount, giveaway, limited time
- **Streams**: going live, premiere, watch party
- **Announcements**: big news, reveal, introducing

## Known Limitations

- Only captures data from pages you visit (passive mode)
- YouTube's internal API may change without notice
- Chrome only (Manifest V3)

## Development

### Debug

Open Chrome DevTools on the extension:
- Service Worker: `chrome://extensions/` → Find extension → "Service worker" link
- Popup: Right-click extension icon → "Inspect popup"
- Content Script: DevTools on any YouTube page → Console

### Storage

View IndexedDB data:
- Open DevTools on extension popup
- Application tab → IndexedDB → YTEventAggregator

## License

MIT
