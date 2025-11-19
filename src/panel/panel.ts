// Panel script: runs inside the DevTools panel (panel.html). Listens for messages from the background.
import { MessageType, CustomEventPayload as SharedCustomEventPayload } from "../types";
import { resolveTarget as resolveTargetFn } from "../selector/selector";

// Mirror payload type locally (imported for consistency)
type CustomEventPayload = SharedCustomEventPayload;

// Serialize the resolveTarget function for use in inspectedWindow.eval
// We need to convert it to a string since we can't import modules in eval context
const resolveTargetSerialized = resolveTargetFn.toString();

const list = document.getElementById("list") as HTMLTableSectionElement;
const clearBtn = document.getElementById("clear") as HTMLButtonElement;
const exportBtn = document.getElementById("export") as HTMLButtonElement;
const exportFilteredBtn = document.getElementById("exportFiltered") as HTMLButtonElement;
const seeLatestBtn = document.getElementById("seeLatest") as HTMLButtonElement;
const preserveLogCheckbox = document.getElementById("preserveLog") as HTMLInputElement;
const filterTypeInput = document.getElementById("filterType") as HTMLInputElement;
const typeDropdown = document.getElementById("typeDropdown") as HTMLDivElement;
const filterDetailInput = document.getElementById("filterDetail") as HTMLInputElement;
const captureStatus = document.getElementById("captureStatus") as HTMLSpanElement;
const tableContainer = document.querySelector(".table-container") as HTMLDivElement;


let events: CustomEventPayload[] = [];
let filterType = "";
let filterDetail = "";
let uniqueEventTypes: Set<string> = new Set();
let preserveLog = false; // per current tab
let isAutoScrolling = false; // Track when we're auto-scrolling to bottom

// Update tooltip based on preserve log state
function updatePreserveLogTooltip() {
  if (preserveLogCheckbox) {
    const label = preserveLogCheckbox.parentElement;
    if (label) {
      label.title = preserveLog 
        ? "Disable to clear logs on page refresh"
        : "Enable to preserve logs across page refreshes";
    }
  }
}

// Check if user is scrolled to the bottom (within 50px threshold)
function isScrolledToBottom(): boolean {
  if (!tableContainer) return false;
  const threshold = 50;
  return tableContainer.scrollHeight - tableContainer.scrollTop - tableContainer.clientHeight <= threshold;
}

// Scroll to bottom with smooth animation
function scrollToBottom() {
  if (!tableContainer) return;
  isAutoScrolling = true;
  tableContainer.scrollTo({
    top: tableContainer.scrollHeight,
    behavior: "smooth"
  });
  // isAutoScrolling will be cleared by the scrollend event listener
}

// Update See Latest button state based on scroll position
function updateSeeLatestButton() {
  if (!seeLatestBtn) return;
  const atBottom = isScrolledToBottom();
  seeLatestBtn.disabled = atBottom;
}

// Save preserve log preference when toggled (per tab)
function savePreserveLogForTab() {
  if (typeof inspectedTabId !== "number") return;
  chrome.storage.local.get(["preserveLogByTab"], (res) => {
    const map = (res.preserveLogByTab || {}) as Record<number, boolean>;
    map[inspectedTabId] = preserveLog;
    chrome.storage.local.set({ preserveLogByTab: map });
  });
}
if (preserveLogCheckbox) {
  preserveLogCheckbox.addEventListener("change", () => {
    preserveLog = preserveLogCheckbox.checked;
    savePreserveLogForTab();
    updatePreserveLogTooltip();
  });
}

// Load and display capture status
function updateCaptureStatus() {
  chrome.storage.local.get(["captureEnabled"], (result) => {
    const isEnabled = result.captureEnabled !== false; // default to true
    if (captureStatus) {
      if (isEnabled) {
        captureStatus.textContent = "● Capturing";
        captureStatus.className = "capture-status enabled";
        captureStatus.title = "Click to pause event capture";
      } else {
        captureStatus.textContent = "○ Paused";
        captureStatus.className = "capture-status disabled";
        captureStatus.title = "Click to resume event capture";
      }
    }
  });
}

// Toggle capture state when status is clicked
function toggleCaptureState() {
  chrome.storage.local.get(["captureEnabled"], (result) => {
    const currentState = result.captureEnabled !== false;
    const newState = !currentState;
    chrome.storage.local.set({ captureEnabled: newState }, () => {
      updateCaptureStatus();
      // Broadcast to content scripts
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: MessageType.CAPTURE_TOGGLE,
              enabled: newState
            }, () => {
              if (chrome.runtime.lastError) {
                // Ignore errors for tabs without content script
              }
            });
          }
        });
      });
    });
  });
}

// Make status clickable
if (captureStatus) {
  captureStatus.addEventListener("click", toggleCaptureState);
}

// Update status on load
updateCaptureStatus();

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.captureEnabled) {
    updateCaptureStatus();
  }
});

// Determine the inspected tab id for this panel so we can filter events to the current tab.
// `chrome.devtools.inspectedWindow.tabId` is available in the DevTools panel context.
const inspectedTabId: number | undefined = (typeof chrome !== "undefined" && (chrome as any).devtools && (chrome as any).devtools.inspectedWindow)
  ? (chrome as any).devtools.inspectedWindow.tabId as number
  : undefined;

// Load per-tab preserve log and filters for this tab
if (typeof inspectedTabId === "number") {
  chrome.storage.local.get(["preserveLogByTab", "filtersByTab"], (res) => {
    const plMap = (res.preserveLogByTab || {}) as Record<number, boolean>;
    preserveLog = plMap[inspectedTabId] === true;
    if (preserveLogCheckbox) {
      preserveLogCheckbox.checked = preserveLog;
      updatePreserveLogTooltip();
    }

    const filtersMap = (res.filtersByTab || {}) as Record<number, { type?: string; detail?: string }>;
    const f = filtersMap[inspectedTabId] || {};
    if (typeof f.type === "string") {
      filterType = f.type;
      if (filterTypeInput) filterTypeInput.value = filterType;
    }
    if (typeof f.detail === "string") {
      filterDetail = f.detail;
      if (filterDetailInput) filterDetailInput.value = filterDetail;
    }
    refreshDisplay();
  });
}

// Persist filters per tab
function saveFiltersForTab() {
  if (typeof inspectedTabId !== "number") return;
  chrome.storage.local.get(["filtersByTab"], (res) => {
    const map = (res.filtersByTab || {}) as Record<number, { type?: string; detail?: string }>;
    map[inspectedTabId] = { type: filterType, detail: filterDetail };
    chrome.storage.local.set({ filtersByTab: map });
  });
}

// Track page navigation to clear events on refresh (unless preserve log is enabled)
// Use DevTools network navigation event which fires on page load/refresh
if ((chrome as any).devtools && (chrome as any).devtools.network) {
  (chrome as any).devtools.network.onNavigated.addListener((url: string) => {
    // Page navigated - clear events unless preserve log is enabled
    if (!preserveLog) {
      events = [];
      uniqueEventTypes.clear();
      list.innerHTML = "";
      updateEventTypeList();
    }
  });
}

function renderEvent(e: CustomEventPayload) {
  const tr = document.createElement("tr");
  tr.className = "event-row";

  // Time (first column)
  const timeTd = document.createElement("td");
  timeTd.className = "cell cell-time";
  // Compact time display: HH:mm:ss; full timestamp as tooltip
  const date = new Date(e.time);
  const shortTime = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  timeTd.textContent = shortTime;
  timeTd.title = date.toLocaleString();

  // Type (second column)
  const typeTd = document.createElement("td");
  typeTd.className = "cell cell-type";
  typeTd.textContent = e.type;

  // Detail (third column)
  const detailTd = document.createElement("td");
  detailTd.className = "cell cell-detail";
  const scroll = document.createElement("div");
  scroll.className = "detail-scroll";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(e.detail, null, 2);
  scroll.appendChild(pre);
  detailTd.appendChild(scroll);

  // Target (fourth column)
  const targetTd = document.createElement("td");
  targetTd.className = "cell cell-target";
  
  if (e.targetSelector && e.targetSelector !== "window" && e.targetSelector !== "document") {
    // Make it clickable to inspect the element
    const link = document.createElement("a");
    link.textContent = e.targetSelector;
    link.title = `Click to inspect element: ${e.targetSelector}`;
    link.href = "#";
    link.addEventListener("click", (evt) => {
      evt.preventDefault();
      // Use DevTools inspectedWindow.eval to execute code with access to Console Command Line API
      if ((chrome as any).devtools && (chrome as any).devtools.inspectedWindow) {
        // Escape the selector for safe embedding in the eval code
        const escapedSelector = JSON.stringify(e.targetSelector);
        // Use the serialized resolveTarget function from selector.ts
        const code = `
          (function() {
            const resolveTarget = ${resolveTargetSerialized};
            
            const element = resolveTarget(${escapedSelector});
            if (element && element !== window && element !== document) {
              inspect(element);
            }
          })();
        `;
        
        (chrome as any).devtools.inspectedWindow.eval(code, (result: any, exceptionInfo: any) => {
          if (exceptionInfo) {
            console.warn("Could not inspect element:", exceptionInfo);
          }
        });
      }
    });
    targetTd.appendChild(link);
  } else {
    targetTd.textContent = e.targetSelector || "—";
    targetTd.title = e.targetSelector || "";
  }

  // Initiator (fifth column)
  const initiatorTd = document.createElement("td");
  initiatorTd.className = "cell cell-initiator";
  if (e.initiator) {
    const link = document.createElement("a");
    const fileName = e.initiator.url.split("/").pop() || e.initiator.url;
    link.textContent = `${fileName}:${e.initiator.line}`;
    link.title = `${e.initiator.url}:${e.initiator.line}:${e.initiator.column}`;
    link.href = "#";
    link.addEventListener("click", (evt) => {
      evt.preventDefault();
      // Use DevTools API to open source file
      if ((chrome as any).devtools && (chrome as any).devtools.panels) {
        (chrome as any).devtools.panels.openResource(
          e.initiator!.url,
          e.initiator!.line - 1, // 0-indexed
          () => {
            // Opened successfully
          }
        );
      }
    });
    initiatorTd.appendChild(link);
  } else {
    initiatorTd.textContent = "—";
  }

  // Actions (sixth column)
  const actionsTd = document.createElement("td");
  actionsTd.className = "cell cell-actions";

  // Replay button
  const replayBtn = document.createElement("span");
  replayBtn.className = "replay-icon";
  replayBtn.textContent = "↻";
  replayBtn.title = "Dispatch this event again in the inspected page";
  replayBtn.addEventListener("click", () => {
    // Send message to content script to replay the event
    chrome.tabs.sendMessage(inspectedTabId!, {
      type: MessageType.REPLAY_CUSTOM_EVENT,
      payload: { type: e.type, detail: e.detail, targetSelector: e.targetSelector }
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn("Could not replay event:", chrome.runtime.lastError.message);
      }
    });
  });

  // Copy button
  const copyBtn = document.createElement("span");
  copyBtn.className = "copy-icon";
  copyBtn.textContent = "⎘";
  copyBtn.title = "Copy event dispatch command to clipboard";
  copyBtn.addEventListener("click", () => {
    // Generate a ready-to-paste dispatchEvent command
    const detailJson = JSON.stringify(e.detail, null, 2);
    const command = `window.dispatchEvent(new CustomEvent(${JSON.stringify(e.type)}, {\n  detail: ${detailJson}\n}));`;
    
    // Send to content script which has proper clipboard access
    chrome.tabs.sendMessage(inspectedTabId!, {
      type: MessageType.COPY_TO_CLIPBOARD,
      payload: command
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Copy failed:", chrome.runtime.lastError.message);
        copyBtn.textContent = "✗";
        setTimeout(() => { copyBtn.textContent = "⎘"; }, 1000);
      } else if (response?.success) {
        copyBtn.textContent = "✓";
        setTimeout(() => { copyBtn.textContent = "⎘"; }, 1000);
      } else {
        copyBtn.textContent = "✗";
        setTimeout(() => { copyBtn.textContent = "⎘"; }, 1000);
      }
    });
  });

  actionsTd.appendChild(replayBtn);
  actionsTd.appendChild(copyBtn);

  tr.appendChild(timeTd);
  tr.appendChild(typeTd);
  tr.appendChild(detailTd);
  tr.appendChild(targetTd);
  tr.appendChild(initiatorTd);
  tr.appendChild(actionsTd);

  // Check if user was at bottom before adding new row
  const wasAtBottom = isScrolledToBottom();

  list.appendChild(tr);

  // Auto-scroll if user was at bottom or if we're already auto-scrolling
  if (wasAtBottom || isAutoScrolling) {
    scrollToBottom();
  }
  
  // Update See Latest button state
  updateSeeLatestButton();
}

function matchesFilter(e: CustomEventPayload): boolean {
  // Check if type contains filterType substring (case-insensitive)
  if (filterType && !e.type.toLowerCase().includes(filterType.toLowerCase())) {
    return false;
  }
  
  // Check if stringified detail contains filterDetail substring (case-insensitive)
  if (filterDetail) {
    const detailStr = JSON.stringify(e.detail);
    if (!detailStr.toLowerCase().includes(filterDetail.toLowerCase())) {
      return false;
    }
  }
  
  return true;
}


function updateEventTypeList() {
  // Update the dropdown with unique event types from ALL events
  uniqueEventTypes = new Set(events.map(e => e.type));
  // Don't render here - let showDropdown() handle rendering when needed
}

function renderDropdownItems(types: string[]) {
  if (!typeDropdown) return;
  
  typeDropdown.innerHTML = "";
  
  if (types.length === 0) {
    const noResults = document.createElement("div");
    noResults.className = "dropdown-item no-results";
    noResults.textContent = "No event types";
    typeDropdown.appendChild(noResults);
    return;
  }
  
  types.forEach(type => {
    const item = document.createElement("div");
    item.className = "dropdown-item";
    item.textContent = type;
    item.addEventListener("click", () => {
      filterTypeInput.value = type;
      filterType = type;
      hideDropdown();
      refreshDisplay();
      saveFiltersForTab();
    });
    typeDropdown.appendChild(item);
  });
}

function showDropdown() {
  if (typeDropdown && filterTypeInput) {
    const allTypes = Array.from(uniqueEventTypes).sort();
    
    // Always show all types - don't filter based on current input
    // This allows users to see and select any event type regardless of current filter
    renderDropdownItems(allTypes);
    
    // Position dropdown below the input using fixed positioning
    const rect = filterTypeInput.getBoundingClientRect();
    typeDropdown.style.top = `${rect.bottom + 2}px`;
    typeDropdown.style.left = `${rect.left}px`;
    typeDropdown.style.width = `${rect.width}px`;
    
    typeDropdown.classList.add("show");
  }
}

function hideDropdown() {
  if (typeDropdown) {
    typeDropdown.classList.remove("show");
  }
}

function refreshDisplay() {
  list.innerHTML = "";
  events.forEach(e => {
    if (matchesFilter(e)) {
      renderEvent(e);
    }
  });
  updateEventTypeList();
  updateExportFilteredButton();
}

function updateExportFilteredButton() {
  // Enable Export Filtered button only when filters are active
  const hasFilter = filterType !== "" || filterDetail !== "";
  exportFilteredBtn.disabled = !hasFilter;
}


function addEvent(e: CustomEventPayload) {
  // If we know the inspected tab id, show only events coming from that tab.
  if (typeof inspectedTabId === "number" && e.tabId !== inspectedTabId) {
    return;
  }

  events.push(e);
  uniqueEventTypes.add(e.type);
  updateEventTypeList();
  if (matchesFilter(e)) {
    renderEvent(e);
  }
}


clearBtn.addEventListener("click", () => {
  events = [];
  uniqueEventTypes.clear();
  updateEventTypeList();
  list.innerHTML = "";
  // Notify background to clear buffer and reset badge
  chrome.runtime.sendMessage({ type: MessageType.CLEAR_CUSTOM_EVENTS }, () => {
    if (chrome.runtime.lastError) {
      // no-op
    }
  });
});

exportBtn.addEventListener("click", () => {
  const a = document.createElement("a");
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
  a.href = URL.createObjectURL(blob);
  a.download = `custom-events-${new Date().toISOString()}.json`;
  a.click();
});

exportFilteredBtn.addEventListener("click", () => {
  const filteredEvents = events.filter(e => matchesFilter(e));
  const a = document.createElement("a");
  const blob = new Blob([JSON.stringify(filteredEvents, null, 2)], { type: "application/json" });
  a.href = URL.createObjectURL(blob);
  a.download = `custom-events-filtered-${new Date().toISOString()}.json`;
  a.click();
});

// See Latest button - scroll to bottom on click
seeLatestBtn.addEventListener("click", () => {
  scrollToBottom();
});

// Update See Latest button state on scroll
tableContainer.addEventListener("scroll", () => {
  updateSeeLatestButton();
});

// Clear auto-scrolling flag when scroll animation completes
tableContainer.addEventListener("scrollend", () => {
  isAutoScrolling = false;
});

// Filter input listeners
// Keyboard navigation state for dropdown
let dropdownIndex: number = -1;

filterTypeInput.addEventListener("input", () => {
  filterType = filterTypeInput.value;
  dropdownIndex = -1; // reset selection
  showDropdown(); // Update dropdown to show filtered results
  refreshDisplay();
  saveFiltersForTab();
});

filterTypeInput.addEventListener("keydown", (e: KeyboardEvent) => {
  const items = Array.from(typeDropdown.querySelectorAll<HTMLDivElement>(".dropdown-item"));
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (!typeDropdown.classList.contains("show")) showDropdown();
    if (items.length > 0) {
      dropdownIndex = Math.min(items.length - 1, dropdownIndex + 1);
      items.forEach((el, idx) => el.classList.toggle("selected", idx === dropdownIndex));
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (!typeDropdown.classList.contains("show")) showDropdown();
    if (items.length > 0) {
      dropdownIndex = Math.max(0, dropdownIndex - 1);
      items.forEach((el, idx) => el.classList.toggle("selected", idx === dropdownIndex));
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (dropdownIndex >= 0 && dropdownIndex < items.length) {
      const value = items[dropdownIndex].textContent || '';
      filterTypeInput.value = value;
      filterType = value;
    }
    hideDropdown();
    refreshDisplay();
    saveFiltersForTab();
  } else if (e.key === "Escape") {
    // If there's a value, clear it; otherwise just hide dropdown
    if (filterTypeInput.value) {
      filterTypeInput.value = "";
      filterType = "";
      dropdownIndex = -1;
      hideDropdown();
      refreshDisplay();
      saveFiltersForTab();
    } else {
      hideDropdown();
    }
  }
});

filterTypeInput.addEventListener("focus", () => {
  showDropdown();
});

filterTypeInput.addEventListener("blur", () => {
  // Delay hiding to allow click on dropdown item
  setTimeout(() => hideDropdown(), 200);
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!filterTypeInput.contains(e.target as Node) && !typeDropdown.contains(e.target as Node)) {
    hideDropdown();
  }
});

filterDetailInput.addEventListener("input", () => {
  filterDetail = filterDetailInput.value;
  refreshDisplay();
  saveFiltersForTab();
});

// Clear detail filter with Esc when focused
filterDetailInput.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    if (filterDetailInput.value) {
      e.preventDefault();
      filterDetailInput.value = "";
      filterDetail = "";
      refreshDisplay();
      saveFiltersForTab();
    }
  }
});

// Initialize button state
updateExportFilteredButton();

// Listen for messages from background (and other extension parts)

chrome.runtime.onMessage.addListener((message: { type: MessageType; payload?: any }) => {
  if (message?.type === MessageType.SHOW_EVENT && message.payload) {
    addEvent(message.payload as CustomEventPayload);
    updateEventTypeList();
  }
});

// If you want to request backlog events from background when panel opens, you could send a message here.
// Request backlog from background when panel opens so we can display events that occurred while the panel was closed
console.log("Custom Events panel initialized - requesting backlog");
try {
  chrome.runtime.sendMessage({ type: MessageType.BACKLOG_REQUEST }, () => {
    if (chrome.runtime.lastError) {
      // no-op
    }
  });
} catch (err) {
  // ignore
}


// Handle backlog message

chrome.runtime.onMessage.addListener((message: { type: MessageType; payload?: any }) => {
  if (message?.type === MessageType.BACKLOG_RESPONSE && Array.isArray(message.payload)) {
    events = [];
    uniqueEventTypes.clear();
    (message.payload as CustomEventPayload[]).forEach(e => {
      events.push(e);
      uniqueEventTypes.add(e.type);
    });
    refreshDisplay(); // This will update the dropdown and the table
  }
});