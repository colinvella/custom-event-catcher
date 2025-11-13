// Content script: injects the page script and listens for window messages
import { MESSAGE, MessageType } from './types';

let captureEnabled = true;

// Load capture state from storage
chrome.storage.local.get(["captureEnabled"], (result) => {
  captureEnabled = result.captureEnabled !== false; // default to true
});

function injectScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL("inject.js");
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
  chrome.runtime.sendMessage({ type: MESSAGE.CEC_CUSTOM_EVENT, payload }, () => {
        // swallow runtime.lastError when no listener exists
        if (chrome.runtime.lastError) {
          // no-op
        }
      });
    } catch (err) {
      console.debug("Failed to forward event to background", err);
    }
  }
});

// Listen for replay requests from the DevTools panel
chrome.runtime.onMessage.addListener((message: { type: MessageType; payload?: any; enabled?: boolean }, sender, sendResponse) => {
  if (message?.type === MESSAGE.SET_CAPTURE_ENABLED) {
    captureEnabled = message.enabled !== false; // default to true when undefined
    return;
  }
  
  if (message?.type === MESSAGE.REPLAY_EVENT) {
    try {
      // Use window.postMessage to communicate with the injected script
      window.postMessage({
        __CEC_REPLAY_EVENT: true,
        payload: message.payload
      }, "*");
      sendResponse({ success: true });
    } catch (err) {
      console.error("Replay failed:", err);
      sendResponse({ success: false, error: String(err) });
    }
    return true; // keep channel open for async response
  }
  
  if (message?.type === MESSAGE.COPY_TO_CLIPBOARD) {
    try {
      // Use execCommand which works reliably in content scripts
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
