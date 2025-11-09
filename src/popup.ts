// Popup script: displays event count from background

// Get the current event count from background
chrome.runtime.sendMessage({ type: "get_event_count" }, (response) => {
  if (response?.count !== undefined) {
    const countEl = document.getElementById("eventCount");
    if (countEl) {
      countEl.textContent = response.count.toString();
    }
  }
});
