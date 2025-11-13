// Popup script: displays event count from background and toggles capture state

const captureToggle = document.getElementById("captureToggle") as HTMLInputElement;

// Load current capture state from storage
chrome.storage.local.get(["captureEnabled"], (result) => {
  const isEnabled = result.captureEnabled !== false; // default to true
  if (captureToggle) {
    captureToggle.checked = isEnabled;
  }
});

// Save capture state when toggled
if (captureToggle) {
  captureToggle.addEventListener("change", () => {
    const isEnabled = captureToggle.checked;
    chrome.storage.local.set({ captureEnabled: isEnabled }, () => {
      // Notify all tabs that capture state changed
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { 
              type: "set_capture_enabled", 
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
chrome.runtime.sendMessage({ type: "get_event_count" }, (response) => {
  if (response?.count !== undefined) {
    const countEl = document.getElementById("eventCount");
    if (countEl) {
      countEl.textContent = response.count.toString();
    }
  }
});
