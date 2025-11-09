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

// Update badge with event count for a specific tab
function updateBadge(tabId?: number) {
	if (!tabId) return;
	
	const count = eventBuffer.filter(e => e.tabId === tabId).length;
	if (count > 0) {
		chrome.action.setBadgeText({ tabId, text: count > 99 ? "99+" : count.toString() });
		chrome.action.setBadgeBackgroundColor({ tabId, color: "#dc2626" }); // Red background
		chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" }); // White text
	} else {
		chrome.action.setBadgeText({ tabId, text: "" });
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