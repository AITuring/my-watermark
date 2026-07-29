import type { FocusStackLivePreview, FocusStackResult } from "@/utils/focus-stack";
import type { PreviewPanel } from "./types";

export function getResultPreviewPanels(result: FocusStackResult | null): PreviewPanel[] {
    if (!result) {
        return [];
    }

    return [
        {
            key: "result",
            label: "合成结果",
            url: result.resultUrl,
        },
        {
            key: "ownership",
            label: result.sourceCount > 2 ? "累计来源图" : "来源分布",
            url: result.ownershipMapUrl,
        },
        {
            key: "winner-overlay",
            label: result.sourceCount > 2 ? "最后一轮叠色" : "选区叠色",
            url: result.winnerOverlayUrl,
        },
        {
            key: "base",
            label: result.sourceCount > 2 ? "上一轮结果" : "参考图",
            url: result.basePreviewUrl,
        },
        {
            key: "candidate",
            label: result.sourceCount > 2 ? "最后候选图" : "对齐后",
            url: result.alignedPreviewUrl,
        },
        {
            key: "sharp-a",
            label: result.sourceCount > 2 ? "最后一轮基准清晰度" : "清晰度 A",
            url: result.sharpnessAUrl,
        },
        {
            key: "sharp-b",
            label: result.sourceCount > 2 ? "最后一轮候选清晰度" : "清晰度 B",
            url: result.sharpnessBUrl,
        },
        {
            key: "mask",
            label: result.sourceCount > 2 ? "最后一轮掩膜" : "清晰掩膜",
            url: result.maskUrl,
        },
    ];
}

export function getProcessingPreviewPanels(
    livePreview: FocusStackLivePreview | null
): PreviewPanel[] {
    if (!livePreview) {
        return [];
    }

    return [
        {
            key: "merged",
            label: "当前累计结果",
            url: livePreview.mergedUrl,
        },
        {
            key: "overlay",
            label: "深度叠加",
            url: livePreview.winnerOverlayUrl,
        },
        {
            key: "mask",
            label: "当前深度图",
            url: livePreview.maskUrl,
        },
        {
            key: "base",
            label: "当前基准图",
            url: livePreview.baseUrl,
        },
        {
            key: "candidate",
            label: "当前候选图",
            url: livePreview.candidateUrl,
        },
    ];
}

export function getResultPrimaryPanels(result: FocusStackResult | null): PreviewPanel[] {
    return getResultPreviewPanels(result).filter((panel) =>
        ["result", "ownership"].includes(panel.key)
    );
}

export function getResultSecondaryPanels(result: FocusStackResult | null): PreviewPanel[] {
    return getResultPreviewPanels(result).filter(
        (panel) => !["result", "ownership"].includes(panel.key)
    );
}
