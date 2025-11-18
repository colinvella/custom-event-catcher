// Content script: injects the page script and listens for window messages
// Bundling approach: Authored as an ES module; esbuild bundles `src/content-script.ts` into
// a single classic script (`dist/content-script.js`) because MV3 content scripts cannot be modules.
// This preserves a single source of truth for shared constants/types while keeping runtime compatibility.
import { MessageType } from "../types";

let captureEnabled = true;

// Load capture state from storage
chrome.storage.local.get(["captureEnabled"], (result) => {
  captureEnabled = result.captureEnabled !== false; // default to true
});

function injectScript() {
  try {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("inject/inject.js");
    script.type = "text/javascript";
    script.async = false;
    (document.head || document.documentElement).prepend(script);
    // Remove the script element after it loads to keep DOM clean
    script.onload = () => script.remove();
  } catch (err) {
    console.error("CEC: failed to inject script", err);
  }
}

injectScript();

window.addEventListener("message", (event) => {
  // Only accept messages from the same frame
  if (event.source !== window) return;
  const data = event.data;
  if (data && data.__CEC_CUSTOM_EVENT) {
    // Check if capture is enabled before forwarding
    if (!captureEnabled) return;
    const payload = data.payload;
    // Forward event to background (background will broadcast to DevTools panel)
    try {
      chrome.runtime.sendMessage({ type: MessageType.TRACK_EVENT, payload }, () => {
        if (chrome.runtime.lastError) {
          // no-op
        }
      });
    } catch (err) {
      console.debug("Failed to forward event to background", err);
    }
  }
});

// Listen for replay and copy requests from the DevTools panel
chrome.runtime.onMessage.addListener((message: { type: MessageType; payload?: any; enabled?: boolean }, sender, sendResponse) => {
  if (message?.type === MessageType.CAPTURE_TOGGLE) {
    captureEnabled = message.enabled !== false; // default to true when undefined
    return;
  }

  if (message?.type === MessageType.REPLAY_CUSTOM_EVENT) {
    try {
      window.postMessage({ __CEC_REPLAY_EVENT: true, payload: message.payload }, "*");
      sendResponse({ success: true });
    } catch (err) {
      console.error("Replay failed:", err);
      sendResponse({ success: false, error: String(err) });
    }
    return true; // keep channel open for async response
  }

  if (message?.type === MessageType.COPY_TO_CLIPBOARD) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = message.payload;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      sendResponse({ success });
    } catch (err) {
      console.error("Copy failed:", err);
      sendResponse({ success: false, error: String(err) });
    }
    return true; // keep channel open for async response
  }
});
