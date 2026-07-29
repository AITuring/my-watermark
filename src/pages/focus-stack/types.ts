import type { FocusStackLivePreview, FocusStackResult } from "@/utils/focus-stack";

export interface UploadState {
    id: string;
    file: File | null;
    previewUrl: string;
    status: "loading" | "ready" | "error";
    errorMessage?: string;
}

export interface InspectViewport {
    x: number;
    y: number;
}

export interface InspectMetrics {
    viewportWidth: number;
    viewportHeight: number;
}

export interface PreviewPanel {
    key: string;
    label: string;
    url: string;
}

export interface FocusStackParameterValues {
    autoAlign: boolean;
    manualShiftX: number;
    manualShiftY: number;
    scale: number;
    searchRadius: number;
    smoothRadius: number;
    confidenceThreshold: number;
    featherRadius: number;
    foregroundProtect: number;
}

export interface FocusStackStatusSummary {
    imagesCount: number;
    readyCount: number;
    loadingCount: number;
    errorCount: number;
    progress: number;
    progressLabel: string;
    isProcessing: boolean;
    effectiveOffset: {
        x: number;
        y: number;
    };
    result: FocusStackResult | null;
    livePreview: FocusStackLivePreview | null;
    autoAlign: boolean;
}
