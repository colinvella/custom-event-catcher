// Popup script: displays event count from background and toggles capture state
import { MessageType } from "../types";

const captureToggle = document.getElementById("captureToggle") as HTMLInputElement;

// Function to update extension icon based on capture state
function updateExtensionIcon(isEnabled: boolean) {
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

// Load current capture state from storage
chrome.storage.local.get(["captureEnabled"], (result) => {
	const isEnabled = result.captureEnabled !== false; // default to true
	if (captureToggle) {
		captureToggle.checked = isEnabled;
	}
	updateExtensionIcon(isEnabled);
});

// Save capture state when toggled
if (captureToggle) {
  captureToggle.addEventListener("change", () => {
    const isEnabled = captureToggle.checked;
    
    // Update the icon immediately
    updateExtensionIcon(isEnabled);
    
    chrome.storage.local.set({ captureEnabled: isEnabled }, () => {
      // Notify all tabs that capture state changed
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { 
              type: MessageType.CAPTURE_TOGGLE, 
              enabled: isEnabled 
            }, () => {
              // Ignore errors for tabs without content script
              if (chrome.runtime.lastError) {
                // no-op
              }
            });
          }
        });
      });
    });
  });
}

// Get the current event count from background
chrome.runtime.sendMessage({ type: MessageType.COUNT_REQUEST }, (response) => {
  if (response?.count !== undefined) {
    const countEl = document.getElementById("eventCount");
    if (countEl) {
      countEl.textContent = response.count.toString();
    }
  }
});

// show version from manifest
const version = chrome.runtime.getManifest().version;
document.querySelector("#version")!.textContent = version;
