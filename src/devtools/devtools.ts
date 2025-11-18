// DevTools bootstrap script: creates the Custom Events panel.
// Panel content lives in panel.html (copied to extension root at build time).

chrome.devtools.panels.create("Custom Events", "", "panel.html", (panel) => {
  console.log("Custom Events DevTools panel created", panel);
});
