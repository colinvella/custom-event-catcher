// Inlined CustomEventPayload to avoid making this file an ES module
// (service worker scripts must not use module imports/exports in this build)
// Inlined CustomEventPayload used by background
interface CustomEventPayload {
	type: string;
	detail: any;
	time: number;
	targetTag: string | null;
	tabId?: number;
	tabUrl?: string;
	initiator?: {
		url: string;
		line: number;
		column: number;
	} | null;
}

interface Sender {
	tab?: { id?: number; url?: string };
}

interface CustomEventMessage {
	type: string;
	payload: CustomEventPayload;
}

// Background: receive events from content scripts and broadcast to panels
const eventBuffer: CustomEventPayload[] = [];
const MAX_BUFFER = 500;

// Function to update extension icon based on capture state
function updateIcon(isEnabled: boolean) {
	const iconSuffix = isEnabled ? "" : "-gray";
	chrome.action.setIcon({
		path: {
			"16": `icons/icon-16${iconSuffix}.png`,
			"32": `icons/icon-32${iconSuffix}.png`,
			"48": `icons/icon-48${iconSuffix}.png`,
			"64": `icons/icon-64${iconSuffix}.png`,
			"128": `icons/icon-128${iconSuffix}.png`
		}
	});
}

// Initialize icon on startup
chrome.storage.local.get(["captureEnabled"], (result) => {
	const isEnabled = result.captureEnabled !== false; // default to true
	updateIcon(isEnabled);
});

// Update icon when storage changes (e.g., from popup toggle)
chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName === "local" && changes.captureEnabled) {
		const isEnabled = changes.captureEnabled.newValue !== false;
		updateIcon(isEnabled);
		
		// Update badges for all tabs with the new color
		chrome.tabs.query({}, (tabs) => {
			tabs.forEach(tab => {
				if (tab.id) {
					updateBadge(tab.id);
				}
			});
		});
	}
});

// Update badge with event count for a specific tab
async function updateBadge(tabId?: number) {
	if (!tabId) return;
	
	try {
		// Verify the tab still exists
		await chrome.tabs.get(tabId);
		
		// Get capture state from storage
		const result = await chrome.storage.local.get(["captureEnabled"]);
		const isEnabled = result.captureEnabled !== false; // default to true
		
		const count = eventBuffer.filter(e => e.tabId === tabId).length;
		if (count > 0) {
			chrome.action.setBadgeText({ tabId, text: count > 99 ? "99+" : count.toString() });
			
			// Set badge color based on capture state
			if (isEnabled) {
				chrome.action.setBadgeBackgroundColor({ tabId, color: "#dc2626" }); // Red background
				chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" }); // White text
			} else {
				chrome.action.setBadgeBackgroundColor({ tabId, color: "#9ca3af" }); // Grey background
				chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" }); // White text
			}
		} else {
			chrome.action.setBadgeText({ tabId, text: "" });
		}
	} catch (err) {
		// Tab no longer exists, silently ignore
	}
}

chrome.runtime.onMessage.addListener((message: CustomEventMessage, sender: Sender, sendResponse) => {
	if (!message || !message.type) return;

    if (message.type === "cec_custom_event") {
		const event = {
			type: "custom-event",
			payload: {
				...message.payload,
				tabId: sender.tab?.id,
				tabUrl: sender.tab?.url
			}
		};

		// Broadcast to any listening panels (DevTools panel listens via chrome.runtime.onMessage)
			// Use a callback to swallow the runtime.lastError when there are no listeners
			try {
		// Buffer the event for later panels
		eventBuffer.push(event.payload);
		if (eventBuffer.length > MAX_BUFFER) eventBuffer.splice(0, eventBuffer.length - MAX_BUFFER);

		// Update badge count for this tab
		updateBadge(sender.tab?.id);			chrome.runtime.sendMessage(event, () => {
					// If no one handled the message, chrome sets runtime.lastError.
					// We intentionally ignore that to avoid noisy console errors.
					if (chrome.runtime.lastError) {
						// no-op
					}
				});
			} catch (err) {
				// ignore synchronous errors (shouldn't happen)
			}

		// Also log centrally in the service worker console
		console.log('[custom-event-catcher background] event', event.payload);
		return;
	}

	// Panel signals it's ready and wants backlog
	if (message.type === "panel_ready") {
		try {
			chrome.runtime.sendMessage({ type: "backlog", payload: eventBuffer.slice() }, () => {
				if (chrome.runtime.lastError) {
					// no-op
				}
			});
		} catch (err) {
			// ignore
		}
		return;
	}

	// Popup requests event count
	if (message.type === "get_event_count") {
		sendResponse({ count: eventBuffer.length });
		return true;
	}
});

// Update badge when switching tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
	updateBadge(activeInfo.tabId);
});

// Update badge when a tab is updated (e.g., navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === 'complete') {
		updateBadge(tabId);
	}
});