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
	// Use attribute selector for IDs to avoid CSS identifier escaping issues (e.g., dots in IDs)
	const escapeAttr = (v: string) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	return `[id="${escapeAttr(element.id)}"]`;
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
 * @param selector - The CSS selector to resolve, supporting a custom ":shadow-root" pseudo selector to allow shadow DOM traversal
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
	}

	if (selector === "document") {
		return document;
	}

	const parts = selector.split(/:shadow-root\s+/);
	let currentRoot: Document | ShadowRoot = document;
	let element: Element | null = null;
	for (const part of parts) {
		element = currentRoot.querySelector(part.trim());
		if (!element) {
			console.warn(`Could not find element with selector "${part.trim()}"`);
			return window;
		}
		currentRoot = element.shadowRoot ?? currentRoot;
	}
	return element ?? window;
}
