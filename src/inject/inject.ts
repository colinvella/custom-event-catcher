// This script runs in the page context. It monkey-patches EventTarget.prototype.dispatchEvent
// to intercept CustomEvent instances and relay them via window.postMessage. It also logs to
// the page console so you can see events in the page's DevTools Console.

import { generateSelector, resolveTarget } from "../selector/selector";

(function () {
  if ((window as any).__cec_injected) return;
  (window as any).__cec_injected = true;

  const originalDispatch = EventTarget.prototype.dispatchEvent;

  EventTarget.prototype.dispatchEvent = function (event: Event) {
    try {
      if (typeof CustomEvent !== "undefined" && event instanceof CustomEvent) {
        // Capture stack trace to get the initiator
        const stack = new Error().stack || "";
        const stackLines = stack.split("\n");
        // Skip first 3 lines (Error, this function, and the caller's dispatchEvent call)
        // Find the first meaningful caller
        let initiator = null;
        for (let i = 3; i < stackLines.length; i++) {
          const line = stackLines[i].trim();
          // Extract location from stack line (format: "at functionName (file:line:col)")
          const match = line.match(/\((.*):(\d+):(\d+)\)/) || line.match(/at (.*):(\d+):(\d+)/);
          if (match) {
            initiator = {
              url: match[1],
              line: parseInt(match[2], 10),
              column: parseInt(match[3], 10)
            };
            break;
          }
        }
        
        // Generate a selector for the target element
        const targetSelector = generateSelector(this);
        
        const payload = {
          type: event.type,
          detail: (event as CustomEvent).detail,
          time: Date.now(),
          targetTag: (this && (this as Element).tagName) || null,
          targetSelector,
          initiator
        };
        // Log as a single grouped message so filtering keeps it together
        // Include initiator link if available
        if (initiator) {
          console.info(
            "%cCustom Event%c %s\n  Details: %o\n  Target: %s\n  Time: %s\n  Initiator: %s:%d:%d",
            "color: #3ba55c; font-weight: bold",
            "",
            event.type,
            payload.detail,
            payload.targetTag || "window",
            new Date(payload.time).toLocaleString(),
            initiator.url,
            initiator.line,
            initiator.column
          );
        } else {
          console.info(
            "%cCustom Event%c %s\n  Details: %o\n  Target: %s\n  Time: %s",
            "color: #3ba55c; font-weight: bold",
            "",
            event.type,
            payload.detail,
            payload.targetTag || "window",
            new Date(payload.time).toLocaleString()
          );
        }
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
        
        // Resolve the target element from the selector
        const target = resolveTarget(data.payload.targetSelector);
        target.dispatchEvent(customEvent);
      } catch (err) {
        console.error("Failed to replay event:", err);
      }
    }
  });
})();
