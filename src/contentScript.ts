// Content script: injects the page script and listens for window messages

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
      chrome.runtime.sendMessage({ type: "cec_custom_event", payload }, () => {
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
chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  if (message?.type === "set_capture_enabled") {
    captureEnabled = message.enabled;
    return;
  }
  
  if (message?.type === "replay_event") {
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
  
  if (message?.type === "copy_to_clipboard") {
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
