// DevTools bootstrap script: creates the Custom Events panel.
// Panel content lives in panel/panel.html (copied to dist/panel/ at build time).

chrome.devtools.panels.create("Custom Events", "", "panel/panel.html", (panel) => {
  console.log("Custom Events DevTools panel created", panel);
});
