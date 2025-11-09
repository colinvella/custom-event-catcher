# CustomEvent Catcher

Chrome extension (TypeScript) that captures CustomEvent dispatches on pages and logs them.

What it does
- Injects a small script into each page which monkey-patches EventTarget.prototype.dispatchEvent.
- When a CustomEvent is dispatched, the page script logs to the page console and posts a message.
- The content script receives that message and logs it in the content-script console and forwards it to the background service worker.

Build & install
1. Install dependencies (you need Node.js/npm installed):

```powershell
npm install
```

2. Build TypeScript to `dist/`:

```powershell
npm run build
```

3. Load the extension in Chrome:
- Open chrome://extensions
- Turn on Developer mode
- Click "Load unpacked" and select this project folder (the folder that contains `manifest.json`).

Testing
1. Open DevTools for any page (e.g., example.com).
2. In the Console, dispatch a CustomEvent:

```js
window.dispatchEvent(new CustomEvent('my-event', { detail: { foo: 'bar' } }));
```

You should see a console log from the page (the injected script). You should also see logs from the content script in the extension's content-script console.

To view the background/service worker logs: open chrome://extensions, find the extension, click "Service worker" (Inspect) to open its console.

Notes and next steps
- This is a minimal prototype. You can extend it to filter specific event types, forward events to a remote server, or show a popup UI.
- If you plan to publish, add appropriate permissions and privacy considerations for data you collect.

## Privacy & Data Usage

CustomEvent Catcher does **not** collect, transmit, or persist any personal data.

What is processed:
- Only `CustomEvent` payloads dispatched in the active tab context while the extension is installed.
- Data stays entirely in the browser memory (buffer limited to recent events) and is visible only in the DevTools panel.

What is **not** done:
- No network requests are made on your behalf.
- No analytics, tracking, or fingerprinting.
- No storage of event data beyond the in-memory buffer (cleared on reload or when the extension is disabled).

Permissions explanation:
- `activeTab` / `tabs`: Used to scope events per tab and show a per‑tab badge count.
- `clipboardWrite`: Only used when you click the Copy button to place a `window.dispatchEvent(...)` snippet on your clipboard.

If you fork and add remote logging or persistence, update this section and provide a privacy policy URL in the Chrome Web Store listing.

## Chrome Web Store Screenshot Guidance

Capture at 1280×800 (or 640×400) PNG:
1. DevTools Panel Overview – Show multiple events in the table (Time, Type, Detail, Actions).
	*Caption:* "Live CustomEvent stream with replay & copy actions."
2. Replay Action – Hover or just after clicking Replay showing the event redispatched.
	*Caption:* "Replay events instantly to reproduce behaviors."
3. Copy Action – Clipboard confirmation (if visible) after copying the dispatch snippet.
	*Caption:* "Copy a ready-to-run window.dispatchEvent command."
4. Instruction Popup – Extension action popup with steps and captured count.
	*Caption:* "Quick guide to locate the DevTools panel."
5. Badge Counter – Browser toolbar icon displaying per‑tab event count (use a page firing several events).
	*Caption:* "Red badge shows per‑tab event volume in real time."

Optional promo tile (440×280) suggestion:
 - Stylized screenshot of the panel with a highlighted row.

Marquee (1400×560, optional):
 - Side-by-side: Panel on left, short feature bullets on right.

## Feature Bullets (for listing)
- DevTools panel for real‑time CustomEvent monitoring
- Per‑tab capture with badge counter
- Replay events into the page context
- One‑click copy of a full dispatch command
- Zero data collection / privacy friendly
- Lightweight injection, CSP‑safe

## Support
Source & issues: https://github.com/colinvella/custom-event-catcher
Open an issue for feature requests or bug reports.
