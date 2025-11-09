// Panel script: runs inside the DevTools panel (panel.html). Listens for messages from the background.

interface CustomEventPayload {
  type: string;
  detail: any;
  time: number;
  targetTag: string | null;
  tabId?: number;
  tabUrl?: string;
}

const list = document.getElementById('list') as HTMLTableSectionElement;
const clearBtn = document.getElementById('clear') as HTMLButtonElement;
const exportBtn = document.getElementById('export') as HTMLButtonElement;

let events: CustomEventPayload[] = [];

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

  // Actions (fourth column)
  const actionsTd = document.createElement('td');
  actionsTd.className = 'cell cell-actions';

  // Replay button
  const replayBtn = document.createElement('button');
  replayBtn.textContent = 'Replay';
  replayBtn.title = 'Dispatch this event again in the inspected page';
  replayBtn.addEventListener('click', () => {
    // Send message to content script to replay the event
    chrome.tabs.sendMessage(inspectedTabId!, {
      type: 'replay_event',
      payload: { type: e.type, detail: e.detail }
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('Could not replay event:', chrome.runtime.lastError.message);
      }
    });
  });

  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.title = 'Copy event dispatch command to clipboard';
  copyBtn.addEventListener('click', () => {
    // Generate a ready-to-paste dispatchEvent command
    const detailJson = JSON.stringify(e.detail, null, 2);
    const command = `window.dispatchEvent(new CustomEvent(${JSON.stringify(e.type)}, {\n  detail: ${detailJson}\n}));`;
    
    // Send to content script which has proper clipboard access
    chrome.tabs.sendMessage(inspectedTabId!, {
      type: 'copy_to_clipboard',
      payload: command
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Copy failed:', chrome.runtime.lastError.message);
        copyBtn.textContent = '✗';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1000);
      } else if (response?.success) {
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1000);
      } else {
        copyBtn.textContent = '✗';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1000);
      }
    });
  });

  actionsTd.appendChild(replayBtn);
  actionsTd.appendChild(copyBtn);

  tr.appendChild(timeTd);
  tr.appendChild(typeTd);
  tr.appendChild(detailTd);
  tr.appendChild(actionsTd);

  list.appendChild(tr);
}

function addEvent(e: CustomEventPayload) {
  // If we know the inspected tab id, show only events coming from that tab.
  if (typeof inspectedTabId === 'number' && e.tabId !== inspectedTabId) {
    return;
  }

  events.push(e);
  renderEvent(e);
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

// Listen for messages from background (and other extension parts)
chrome.runtime.onMessage.addListener((message: any) => {
  if (message?.type === "custom-event" && message.payload) {
    addEvent(message.payload as CustomEventPayload);
  }
});

// If you want to request backlog events from background when panel opens, you could send a message here.
// Request backlog from background when panel opens so we can display events that occurred while the panel was closed
console.log("Custom Events panel initialized - requesting backlog");
try {
  chrome.runtime.sendMessage({ type: "panel_ready" }, () => {
    if (chrome.runtime.lastError) {
      // no-op
    }
  });
} catch (err) {
  // ignore
}

// Handle backlog message
chrome.runtime.onMessage.addListener((message: any) => {
  if (message?.type === "backlog" && Array.isArray(message.payload)) {
    (message.payload as CustomEventPayload[]).forEach(e => addEvent(e));
  }
});
