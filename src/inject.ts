// This script runs in the page context. It monkey-patches EventTarget.prototype.dispatchEvent
// to intercept CustomEvent instances and relay them via window.postMessage. It also logs to
// the page console so you can see events in the page's DevTools Console.

(function () {
  if ((window as any).__cec_injected) return;
  (window as any).__cec_injected = true;

  const originalDispatch = EventTarget.prototype.dispatchEvent;

  EventTarget.prototype.dispatchEvent = function (event: Event) {
    try {
      if (typeof CustomEvent !== "undefined" && event instanceof CustomEvent) {
        const payload = {
          type: event.type,
          detail: (event as CustomEvent).detail,
          time: Date.now(),
          targetTag: (this && (this as Element).tagName) || null
        };
        // Log using info level so it appears as a distinct category in Console filters
        console.info("%cCustom Event%c %s", "color: #3ba55c; font-weight: bold", "", event.type);
        console.info("  Details:", payload.detail);
        console.info("  Target:", payload.targetTag || "window");
        console.info("  Time:", new Date(payload.time).toLocaleString());
        // Post to content script
        window.postMessage({ __CEC_CUSTOM_EVENT: true, payload }, "*");
      }
    } catch (err) {
      // ignore
    }
    return originalDispatch.call(this, event);
  };

  // Listen for replay requests from the content script
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.__CEC_REPLAY_EVENT) {
      try {
        const customEvent = new CustomEvent(data.payload.type, {
          detail: data.payload.detail
        });
        window.dispatchEvent(customEvent);
      } catch (err) {
        console.error("Failed to replay event:", err);
      }
    }
  });
})();
