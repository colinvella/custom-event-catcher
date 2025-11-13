// Panel script: runs inside the DevTools panel (panel.html). Listens for messages from the background.
import { MessageType, CustomEventPayload as SharedCustomEventPayload } from './types';

// Mirror payload type locally (imported for consistency)
type CustomEventPayload = SharedCustomEventPayload;

const list = document.getElementById('list') as HTMLTableSectionElement;
const clearBtn = document.getElementById('clear') as HTMLButtonElement;
const exportBtn = document.getElementById('export') as HTMLButtonElement;
const exportFilteredBtn = document.getElementById('exportFiltered') as HTMLButtonElement;
const filterTypeInput = document.getElementById('filterType') as HTMLInputElement;
const filterDetailInput = document.getElementById('filterDetail') as HTMLInputElement;
const captureStatus = document.getElementById('captureStatus') as HTMLSpanElement;

let events: CustomEventPayload[] = [];
let filterType = '';
let filterDetail = '';

// Load and display capture status
function updateCaptureStatus() {
  chrome.storage.local.get(["captureEnabled"], (result) => {
    const isEnabled = result.captureEnabled !== false; // default to true
    if (captureStatus) {
      if (isEnabled) {
        captureStatus.textContent = "● Capturing";
        captureStatus.className = "capture-status enabled";
      } else {
        captureStatus.textContent = "○ Paused";
        captureStatus.className = "capture-status disabled";
      }
    }
  });
}

// Update status on load
updateCaptureStatus();

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.captureEnabled) {
    updateCaptureStatus();
  }
});

// Determine the inspected tab id for this panel so we can filter events to the current tab.
// `chrome.devtools.inspectedWindow.tabId` is available in the DevTools panel context.
const inspectedTabId: number | undefined = (typeof chrome !== 'undefined' && (chrome as any).devtools && (chrome as any).devtools.inspectedWindow)
  ? (chrome as any).devtools.inspectedWindow.tabId as number
  : undefined;

function renderEvent(e: CustomEventPayload) {
  const tr = document.createElement('tr');
  tr.className = 'event-row';

  // Time (first column)
  const timeTd = document.createElement('td');
  timeTd.className = 'cell cell-time';
  // Format date and time using system preferences
  const date = new Date(e.time);
  timeTd.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

  // Type (second column)
  const typeTd = document.createElement('td');
  typeTd.className = 'cell cell-type';
  typeTd.textContent = e.type;

  // Detail (third column)
  const detailTd = document.createElement('td');
  detailTd.className = 'cell cell-detail';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(e.detail, null, 2);
  detailTd.appendChild(pre);

  // Initiator (fourth column)
  const initiatorTd = document.createElement('td');
  initiatorTd.className = 'cell cell-initiator';
  if (e.initiator) {
    const link = document.createElement('a');
    const fileName = e.initiator.url.split('/').pop() || e.initiator.url;
    link.textContent = `${fileName}:${e.initiator.line}`;
    link.title = `${e.initiator.url}:${e.initiator.line}:${e.initiator.column}`;
    link.href = '#';
    link.addEventListener('click', (evt) => {
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
    initiatorTd.textContent = '—';
  }

  // Actions (fifth column)
  const actionsTd = document.createElement('td');
  actionsTd.className = 'cell cell-actions';

  // Replay button
  const replayBtn = document.createElement('span');
  replayBtn.className = 'replay-icon';
  replayBtn.textContent = '↻';
  replayBtn.title = 'Dispatch this event again in the inspected page';
  replayBtn.addEventListener('click', () => {
    // Send message to content script to replay the event
    chrome.tabs.sendMessage(inspectedTabId!, {
      type: MessageType.REPLAY_EVENT,
      payload: { type: e.type, detail: e.detail }
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('Could not replay event:', chrome.runtime.lastError.message);
      }
    });
  });

  // Copy button
  const copyBtn = document.createElement('span');
  copyBtn.className = 'copy-icon';
  copyBtn.textContent = '⎘';
  copyBtn.title = 'Copy event dispatch command to clipboard';
  copyBtn.addEventListener('click', () => {
    // Generate a ready-to-paste dispatchEvent command
    const detailJson = JSON.stringify(e.detail, null, 2);
    const command = `window.dispatchEvent(new CustomEvent(${JSON.stringify(e.type)}, {\n  detail: ${detailJson}\n}));`;
    
    // Send to content script which has proper clipboard access
    chrome.tabs.sendMessage(inspectedTabId!, {
      type: MessageType.COPY_TO_CLIPBOARD,
      payload: command
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Copy failed:', chrome.runtime.lastError.message);
        copyBtn.textContent = '✗';
        setTimeout(() => { copyBtn.textContent = '⎘'; }, 1000);
      } else if (response?.success) {
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = '⎘'; }, 1000);
      } else {
        copyBtn.textContent = '✗';
        setTimeout(() => { copyBtn.textContent = '⎘'; }, 1000);
      }
    });
  });

  actionsTd.appendChild(replayBtn);
  actionsTd.appendChild(copyBtn);

  tr.appendChild(timeTd);
  tr.appendChild(typeTd);
  tr.appendChild(detailTd);
  tr.appendChild(initiatorTd);
  tr.appendChild(actionsTd);

  list.appendChild(tr);
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

function refreshDisplay() {
  list.innerHTML = '';
  events.forEach(e => {
    if (matchesFilter(e)) {
      renderEvent(e);
    }
  });
  updateExportFilteredButton();
}

function updateExportFilteredButton() {
  // Enable Export Filtered button only when filters are active
  const hasFilter = filterType !== '' || filterDetail !== '';
  exportFilteredBtn.disabled = !hasFilter;
}

function addEvent(e: CustomEventPayload) {
  // If we know the inspected tab id, show only events coming from that tab.
  if (typeof inspectedTabId === 'number' && e.tabId !== inspectedTabId) {
    return;
  }

  events.push(e);
  if (matchesFilter(e)) {
    renderEvent(e);
  }
}

clearBtn.addEventListener('click', () => {
  events = [];
  list.innerHTML = '';
});

exportBtn.addEventListener('click', () => {
  const a = document.createElement('a');
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
  a.href = URL.createObjectURL(blob);
  a.download = `custom-events-${new Date().toISOString()}.json`;
  a.click();
});

exportFilteredBtn.addEventListener('click', () => {
  const filteredEvents = events.filter(e => matchesFilter(e));
  const a = document.createElement('a');
  const blob = new Blob([JSON.stringify(filteredEvents, null, 2)], { type: "application/json" });
  a.href = URL.createObjectURL(blob);
  a.download = `custom-events-filtered-${new Date().toISOString()}.json`;
  a.click();
});

// Filter input listeners
filterTypeInput.addEventListener('input', () => {
  filterType = filterTypeInput.value;
  refreshDisplay();
});

filterDetailInput.addEventListener('input', () => {
  filterDetail = filterDetailInput.value;
  refreshDisplay();
});

// Initialize button state
updateExportFilteredButton();

// Listen for messages from background (and other extension parts)
chrome.runtime.onMessage.addListener((message: { type: MessageType; payload?: any }) => {
  if (message?.type === MessageType.CUSTOM_EVENT && message.payload) {
    addEvent(message.payload as CustomEventPayload);
  }
});

// If you want to request backlog events from background when panel opens, you could send a message here.
// Request backlog from background when panel opens so we can display events that occurred while the panel was closed
console.log("Custom Events panel initialized - requesting backlog");
try {
  chrome.runtime.sendMessage({ type: MessageType.PANEL_READY }, () => {
    if (chrome.runtime.lastError) {
      // no-op
    }
  });
} catch (err) {
  // ignore
}

// Handle backlog message
chrome.runtime.onMessage.addListener((message: { type: MessageType; payload?: any }) => {
  if (message?.type === MessageType.BACKLOG && Array.isArray(message.payload)) {
    (message.payload as CustomEventPayload[]).forEach(e => addEvent(e));
  }
});
