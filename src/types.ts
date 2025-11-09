// Shared type definitions for the extension
export interface CustomEventPayload {
    type: string;
    detail: any;
    time: number;
    targetTag: string | null;
    tabId?: number;
    tabUrl?: string;
}