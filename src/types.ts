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

// Centralized message type constants. Using a const object + union type avoids
// const enum pitfalls with some tooling while still giving strong typing.
export const MESSAGE = {
    CEC_CUSTOM_EVENT: 'cec_custom_event',       // Content script -> background
    CUSTOM_EVENT: 'custom-event',               // Background -> panel broadcast wrapper
    PANEL_READY: 'panel_ready',                 // Panel -> background requesting backlog
    GET_EVENT_COUNT: 'get_event_count',         // Popup -> background asking for buffer size
    BACKLOG: 'backlog',                         // Background -> panel sending stored events
    REPLAY_EVENT: 'replay_event',               // Panel -> content script to redispatch
    COPY_TO_CLIPBOARD: 'copy_to_clipboard',     // Panel -> content script to copy helper code
    SET_CAPTURE_ENABLED: 'set_capture_enabled'  // Popup -> content scripts to toggle capture
} as const;

export type MessageType = typeof MESSAGE[keyof typeof MESSAGE];

export interface RuntimeMessage<T extends MessageType = MessageType, P = any> {
    type: T;
    payload?: P;
}

export interface BacklogMessage extends RuntimeMessage<typeof MESSAGE.BACKLOG, CustomEventPayload[]> {}
export interface CustomEventForwardMessage extends RuntimeMessage<typeof MESSAGE.CUSTOM_EVENT, CustomEventPayload> {}