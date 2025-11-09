// This script runs in the DevTools page context and creates a panel.
// The panel's content is `panel.html` which lives in the extension root.

// Create a DevTools panel named 'CEC'
chrome.devtools.panels.create("Custom Events", "", "panel.html", (panel) => {
  // Panel created
  console.log("Custom Events DevTools panel created", panel);
});
