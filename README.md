# CustomEvent Catcher

Chrome extension (TypeScript) that captures CustomEvent dispatches on pages and displays them in a dedicated DevTools panel with advanced debugging features.

## Features

- **DevTools Panel** - Dedicated panel showing all CustomEvents in real-time with filtering capabilities
- **Initiator Tracking** - Click links to jump to the exact source code location that dispatched each event (with full source map support)
- **Event Filtering** - Filter events by Type or Detail with case-insensitive substring matching
- **Capture Control** - Toggle switch to pause/resume event capturing with visual feedback
- **Visual Status Indicators**:
  - Extension icon changes to grayscale when capturing is paused
  - Badge counter turns grey when capturing is disabled
  - Panel shows capture status ("● Capturing" or "○ Paused")
- **Per-Tab Badge Counter** - Shows number of captured events for the active tab
- **Event Actions**:
  - **Replay (↻)** - Dispatch the event again in the page context
  - **Copy (⎘)** - Copy a ready-to-paste `window.dispatchEvent()` command to clipboard
- **Export Options**:
  - Export All - Download all captured events as JSON
  - Export Filtered - Download only events matching current filters
- **Console Integration** - Events are logged to the page console with initiator links for quick debugging

## How It Works

- Injects a small script into each page which monkey-patches `EventTarget.prototype.dispatchEvent`
- When a CustomEvent is dispatched, captures the stack trace to identify the initiator
- Logs events to the page console and forwards them to the DevTools panel
- Content script receives messages and forwards them to the background service worker
- Background manages the event buffer and updates badge counters per tab
- State (capture enabled/disabled) persists across sessions via `chrome.storage.local`

## Build & Install

1. Install dependencies (you need Node.js/npm installed):

```powershell
npm install
```

2. Build TypeScript to `dist/`:

```powershell
npm run build
```

3. Load the extension in Chrome:
- Open `chrome://extensions`
- Turn on **Developer mode**
- Click **Load unpacked** and select the `dist/` folder (not the project root)

## Testing

1. Open DevTools for any page (e.g., example.com)
2. Click the **Custom Events** tab in DevTools
3. In the Console, dispatch a CustomEvent:

```js
window.dispatchEvent(new CustomEvent('my-event', { detail: { foo: 'bar' } }));
```

You should see:
- The event appear in the Custom Events panel with an initiator link
- A console log in the page console with the event details
- The badge counter increment on the extension icon
- The ability to click the initiator link to jump to the source location

## Usage Guide

### Capture Control
- Click the extension icon in the toolbar to open the popup
- Use the toggle switch to enable/disable event capturing
- When paused:
  - Extension icon turns grayscale
  - Badge counter turns grey
  - Panel shows "○ Paused" status

### Filtering Events
- Enter text in the **Type** or **Detail** filter boxes at the top of the table
- Filtering is case-insensitive and searches for substring matches
- Use **Export Filtered** to download only the events matching your filters

### Event Actions
- **Click initiator link** - Opens the source file at the exact line in DevTools
- **Click ↻** - Replays the event in the page context
- **Click ⎘** - Copies the dispatch command to clipboard

### Exporting Data
- **Export All** - Downloads all captured events as JSON
- **Export Filtered** - Downloads only events matching current filters (enabled only when filters are active)

## Notes and Next Steps

- Event buffer is limited to 500 most recent events per session
- All data stays in browser memory - nothing is transmitted or persisted to disk
- Source map support is automatic - initiator links will resolve to original TypeScript/JSX files when source maps are available

## Privacy & Data Usage

CustomEvent Catcher does **not** collect, transmit, or persist any personal data.

**What is processed:**
- Only `CustomEvent` payloads dispatched in the active tab context while the extension is installed
- Stack traces to identify event initiators (source file locations)
- Data stays entirely in browser memory (buffer limited to 500 most recent events)
- Data is visible only in the DevTools panel and cleared on page reload

**What is NOT done:**
- No network requests are made on your behalf
- No analytics, tracking, or fingerprinting
- No storage of event data beyond the in-memory buffer
- No data persists after closing the browser (except capture toggle state preference)

**Permissions explanation:**
- `activeTab` / `tabs`: Scope events per tab and show per-tab badge count
- `clipboardWrite`: Only used when you click the Copy button to place a dispatch snippet on your clipboard
- `storage`: Only stores the capture toggle state (enabled/disabled) as a user preference
- `<all_urls>`: Required to inject the event capturing script into all pages you visit

If you fork and add remote logging or persistence, update this section and provide a privacy policy URL in the Chrome Web Store listing.

## Chrome Web Store Screenshot Guidance

Capture at 1280×800 (or 640×400) PNG:

1. **DevTools Panel Overview** – Show multiple events in the table with Type, Detail, Initiator, and Actions columns visible
   - *Caption:* "Live CustomEvent stream with initiator tracking, filtering, replay & copy actions"

2. **Initiator Link in Action** – Show cursor hovering over an initiator link with the full path visible in the tooltip
   - *Caption:* "Click initiator links to jump directly to source code (supports source maps)"

3. **Filtering Demo** – Show filter inputs filled with text and Export Filtered button enabled
   - *Caption:* "Filter events by type or detail and export filtered results"

4. **Capture Toggle** – Extension popup showing the toggle switch and event count
   - *Caption:* "Pause/resume capturing with visual feedback on icon and badge"

5. **Badge Counter & Icon States** – Browser toolbar showing both enabled (colored icon, red badge) and disabled (grey icon, grey badge) states
   - *Caption:* "Per-tab event counter with visual capture status indicators"

6. **Console Integration** – Page console showing CustomEvent log with initiator link
   - *Caption:* "Events logged to console with clickable source locations"

Optional promo tile (440×280):
- Split view showing panel on one side and source code with highlighted line on the other

Marquee (1400×560, optional):
- Main panel view with feature callouts: "Initiator Tracking", "Live Filtering", "Replay Events", "Export Data"

## Feature Bullets (for Chrome Web Store listing)

- **Dedicated DevTools panel** for real-time CustomEvent monitoring
- **Initiator tracking** with clickable source links (supports source maps)
- **Live filtering** by event type or detail with substring matching
- **Capture control** - pause/resume with visual status indicators
- **Per-tab badge counter** showing event volume in real time
- **Replay events** instantly to reproduce behaviors
- **One-click copy** of ready-to-run dispatch commands
- **Export options** - download all or filtered events as JSON
- **Console integration** - events logged with initiator links
- **Zero data collection** - completely privacy friendly
- **Lightweight injection** - CSP-safe implementation
- **Source map support** - links resolve to original TypeScript/JSX files

## Support
Source & issues: https://github.com/colinvella/custom-event-catcher
Open an issue for feature requests or bug reports.
