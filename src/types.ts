// Shared type definitions for the extension
export interface CustomEventPayload {
    type: string;
    detail: any;
    time: number;
    targetTag: string | null;
    tabId?: number;
    tabUrl?: string;
    initiator?: {
        url: string;
        line: number;
        column: number;
    } | null;
}

// Centralized message type constants as a const enum so values are fully inlined at build time.
// Using a const enum eliminates the runtime object while retaining string literal types.
// esbuild supports const enum inlining; tsc (type-check only with noEmit) validates usage.
export const enum MessageType {
    TRACK_EVENT = "cec-track-event",                 // Content script -> background to track new event
    SHOW_EVENT = "cec-show-event",                   // Background -> panel add new event
    BACKLOG_REQUEST = "cec-backlog-request",         // Panel -> background requesting events backlog
    BACKLOG_RESPONSE = "cec-backlog-response",       // Background -> panel sending events backglog
    COUNT_REQUEST = "cec-count-request",             // Popup -> background asking for buffer size
    REPLAY_CUSTOM_EVENT = "cec-replay-custom-event", // Panel -> content script to redispatch
    COPY_TO_CLIPBOARD = "cec-copy-to-clipboard",     // Panel -> content script to copy helper code
    CAPTURE_TOGGLE = "cec-capture-toggle",           // Popup -> content script to toggle capture
    CLEAR_CUSTOM_EVENTS = "cec-clear-events"         // Panel -> background to clear buffer and reset badge
}

export interface RuntimeMessage<T extends MessageType = MessageType, P = any> {
    type: T;
    payload?: P;
}

export interface BacklogMessage extends RuntimeMessage<MessageType.BACKLOG_RESPONSE, CustomEventPayload[]> {}
export interface CustomEventForwardMessage extends RuntimeMessage<MessageType.SHOW_EVENT, CustomEventPayload> {}