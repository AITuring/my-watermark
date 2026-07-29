import type { FocusStackLivePreview, FocusStackResult } from "@/utils/focus-stack";
import type { UploadState } from "./types";

export const MIN_INSPECT_ZOOM = 1;
export const MAX_INSPECT_ZOOM = 4;
export const DOUBLE_CLICK_ZOOM = 2;

export function revokeUploadPreview(state: UploadState) {
    if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
    }
}

export function revokeFocusStackResult(result: FocusStackResult | null) {
    if (!result) {
        return;
    }
    URL.revokeObjectURL(result.resultUrl);
    URL.revokeObjectURL(result.ownershipMapUrl);
    URL.revokeObjectURL(result.maskUrl);
    URL.revokeObjectURL(result.winnerOverlayUrl);
    URL.revokeObjectURL(result.basePreviewUrl);
    URL.revokeObjectURL(result.alignedPreviewUrl);
    URL.revokeObjectURL(result.sharpnessAUrl);
    URL.revokeObjectURL(result.sharpnessBUrl);
}

export function revokeLivePreview(preview: FocusStackLivePreview | null) {
    if (!preview) {
        return;
    }
    URL.revokeObjectURL(preview.baseUrl);
    URL.revokeObjectURL(preview.candidateUrl);
    URL.revokeObjectURL(preview.maskUrl);
    URL.revokeObjectURL(preview.winnerOverlayUrl);
    URL.revokeObjectURL(preview.mergedUrl);
}

export function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
            window.setTimeout(resolve, 0);
            return;
        }
        requestAnimationFrame(() => resolve());
    });
}
