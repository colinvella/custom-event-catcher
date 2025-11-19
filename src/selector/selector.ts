/**
 * Shadow DOM-aware selector utilities for generating and resolving CSS selectors.
 * Uses custom ":shadow-root" pseudo-selector to traverse shadow boundaries.
 */

/**
 * Generate a CSS selector for a given element (without shadow DOM traversal)
 * Uses only IDs or tag with nth-child for stability
 */
function generateElementSelector(element: Element): string {
  // Prefer ID if available
  if (element.id) {
    return `#${element.id}`;
  } else {
    // Use tag name with nth-child for stable selection
    let selector = element.tagName.toLowerCase();
    
    // Add nth-child to make it specific
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element) + 1;
      selector += `:nth-child(${index})`;
    }
    return selector;
  }
}

/**
 * Generate a CSS selector for a given event target, including shadow DOM traversal.
 * Uses ":shadow-root" pseudo-selector to indicate shadow root boundaries.
 * 
 * @param target - The EventTarget to generate a selector for
 * @returns A CSS selector string, or "window"/"document" for those special targets, or null if unable to generate
 * 
 * @example
 * // Regular DOM element
 * generateSelector(element) // "div.container:nth-child(1)"
 * 
 * // Element in shadow DOM
 * generateSelector(element) // "my-component:nth-child(1):shadow-root span.label:nth-child(2)"
 * 
 * // Nested shadow DOM
 * generateSelector(element) // "outer:shadow-root inner:shadow-root div.content"
 */
export function generateSelector(target: EventTarget): string | null {
  if (target === window) {
    return "window";
  } else if (target === document) {
    return "document";
  } else if (target && (target as Element).nodeType === Node.ELEMENT_NODE) {
    const element = target as Element;
    const parts: string[] = [];
    let current: Element | null = element;
    
    // Walk up the tree, collecting selectors and detecting shadow root boundaries
    while (current) {
      const currentSelector = generateElementSelector(current);
      
      // Move to next ancestor
      let next: Element | null = null;
      let crossedShadowBoundary = false;
      
      if (current.parentElement) {
        next = current.parentElement;
      } else {
        // No parentElement - check if we're in a shadow root
        const rootNode: Node = current.getRootNode();
        if (rootNode && (rootNode as ShadowRoot).host) {
          // We're in a shadow DOM - the next element will be the host
          const shadowRoot = rootNode as ShadowRoot;
          next = shadowRoot.host as Element;
          crossedShadowBoundary = true;
        }
      }
      
      // Add current element's selector
      parts.unshift(currentSelector);
      
      // If we crossed a shadow boundary, the next iteration will be the host
      // We need to mark that the host should have :shadow-root appended
      if (crossedShadowBoundary && next) {
        // Add a marker so we know the next element needs :shadow-root
        parts.unshift(":SHADOW-BOUNDARY:");
      }
      
      current = next;
    }
    
    // Now join parts, attaching :shadow-root to the preceding element (no space)
    let result = "";
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === ":SHADOW-BOUNDARY:") {
        // Append :shadow-root to the last added selector (no space before)
        result += ":shadow-root";
        // Add space after :shadow-root for the next element
        if (i < parts.length - 1) {
          result += " ";
        }
      } else {
        // Add space before this part if needed
        if (result && !result.endsWith(" ")) {
          result += " ";
        }
        result += parts[i];
      }
    }
    
    return result;
  }
  return null;
}

/**
 * Resolve an event target from a CSS selector, including shadow DOM traversal.
 * Handles ":shadow-root" pseudo-selector as shadow root boundary indicator.
 * 
 * @param selector - The CSS selector to resolve, with optional ":shadow-root" markers
 * @returns The resolved EventTarget, or window as fallback if not found
 * 
 * @example
 * // Regular DOM element
 * resolveTarget("div.container") // <div class="container">
 * 
 * // Element in shadow DOM
 * resolveTarget("my-component:shadow-root span.label") // <span class="label"> inside shadow root
 * 
 * // Special targets
 * resolveTarget("window") // window object
 * resolveTarget("document") // document object
 */
export function resolveTarget(selector: string | null): EventTarget {
  if (!selector) {
    return window;
  }
  
  if (selector === "window") {
    return window;
  } else if (selector === "document") {
    return document;
  } else {
    try {
      // Check if selector contains shadow root markers
      if (selector.includes(":shadow-root")) {
        // Parse the selector to identify shadow boundaries
        // We need to find patterns like "host:shadow-root content" where content continues until the next :shadow-root
        let currentRoot: Document | ShadowRoot = document;
        let element: Element | null = null;
        let remaining = selector;
        
        while (remaining) {
          const shadowRootIndex = remaining.indexOf(":shadow-root");
          
          if (shadowRootIndex === -1) {
            // No more shadow roots - query remaining selector in current root
            element = currentRoot.querySelector(remaining.trim());
            if (!element) {
              console.warn(`Replay: Could not find element with selector "${remaining.trim()}" in current context`);
              return window;
            }
            break;
          }
          
          // Find the shadow host: work backwards from :shadow-root to find where the host selector starts
          // The host selector is the last "word" before :shadow-root (may include spaces from descendant selectors before it)
          let hostStart = 0;
          let beforeShadowRoot = remaining.substring(0, shadowRootIndex);
          
          // Find the last space that separates the host from any ancestors
          let lastSpace = beforeShadowRoot.lastIndexOf(" ");
          if (lastSpace !== -1) {
            hostStart = lastSpace + 1;
          }
          
          const ancestorsSelector = beforeShadowRoot.substring(0, hostStart).trim();
          const hostSelector = beforeShadowRoot.substring(hostStart).trim();
          
          // First, navigate to any ancestors before the host
          if (ancestorsSelector) {
            const ancestor: Element | null = currentRoot.querySelector(ancestorsSelector);
            if (!ancestor) {
              console.warn(`Replay: Could not find ancestor with selector "${ancestorsSelector}"`);
              return window;
            }
            // Continue from this element's context, but we need the host as a child
            const hostInContext: Element | null = ancestor.querySelector(hostSelector);
            if (!hostInContext) {
              console.warn(`Replay: Could not find host "${hostSelector}" within ancestor`);
              return window;
            }
            element = hostInContext;
          } else {
            // No ancestors, just find the host in current root
            element = currentRoot.querySelector(hostSelector);
            if (!element) {
              console.warn(`Replay: Could not find shadow host with selector "${hostSelector}"`);
              return window;
            }
          }
          
          // Enter the shadow root
          if (!element || !element.shadowRoot) {
            console.warn(`Replay: Element "${hostSelector}" does not have a shadow root`);
            return window;
          }
          currentRoot = element.shadowRoot;
          
          // Move past :shadow-root
          remaining = remaining.substring(shadowRootIndex + ":shadow-root".length).trim();
        }
        
        return element || window;
      } else {
        // Regular selector without shadow DOM
        const element = document.querySelector(selector);
        if (element) {
          return element;
        } else {
          console.warn(`Replay: Could not find element with selector "${selector}", using window instead`);
          return window;
        }
      }
    } catch (err) {
      console.error(`Replay: Error resolving selector "${selector}":`, err);
      return window;
    }
  }
}
