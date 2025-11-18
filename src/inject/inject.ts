// This script runs in the page context. It monkey-patches EventTarget.prototype.dispatchEvent
// to intercept CustomEvent instances and relay them via window.postMessage. It also logs to
// the page console so you can see events in the page's DevTools Console.

(function () {
  if ((window as any).__cec_injected) return;
  (window as any).__cec_injected = true;

  /**
   * Generate a CSS selector for a given event target
   */
  function generateSelector(target: EventTarget): string | null {
    if (target === window) {
      return "window";
    } else if (target === document) {
      return "document";
    } else if (target && (target as Element).nodeType === Node.ELEMENT_NODE) {
      const element = target as Element;
      // Prefer ID if available
      if (element.id) {
        return `#${element.id}`;
      } else {
        // Build selector with tag, classes, and nth-child
        let selector = element.tagName.toLowerCase();
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.trim().split(/\s+/).filter(c => c);
          if (classes.length > 0) {
            selector += '.' + classes.join('.');
          }
        }
        // Add nth-child to make it more specific
        const parent = element.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(element) + 1;
          selector += `:nth-child(${index})`;
        }
        return selector;
      }
    }
    return null;
  }

  /**
   * Resolve an event target from a CSS selector
   */
  function resolveTarget(selector: string | null): EventTarget {
    if (!selector) {
      return window;
    }
    
    if (selector === "window") {
      return window;
    } else if (selector === "document") {
      return document;
    } else {
      // Try to find the element using the selector
      const element = document.querySelector(selector);
      if (element) {
        return element;
      } else {
        console.warn(`Replay: Could not find element with selector "${selector}", using window instead`);
        return window;
      }
    }
  }

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
