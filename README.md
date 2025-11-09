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
