import { Badge } from "@/components/ui/badge";
import PanelCard from "@/components/PanelCard";
import { Progress } from "@/components/ui/progress";
import type { FocusStackStatusSummary, PreviewPanel } from "../types";

interface ProcessingStatusPanelProps {
    summary: FocusStackStatusSummary;
    processingPreviewPanels: PreviewPanel[];
}

export default function ProcessingStatusPanel({
    summary,
    processingPreviewPanels,
}: ProcessingStatusPanelProps) {
    const {
        imagesCount,
        readyCount,
        loadingCount,
        errorCount,
        progress,
        progressLabel,
        isProcessing,
        effectiveOffset,
        result,
        livePreview,
        autoAlign,
    } = summary;

    return (
        <PanelCard
            title="处理状态"
            description="先在低分辨率下逐张对齐，再按局部清晰度累计更清晰的来源。"
            className="border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none"
            contentClassName="space-y-4"
        >
                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">当前步骤: {progressLabel}</Badge>
                    <Badge variant="outline">已上传: {imagesCount} 张</Badge>
                    <Badge variant="outline">可用: {readyCount} 张</Badge>
                    {loadingCount > 0 && <Badge variant="outline">待解码: {loadingCount} 张</Badge>}
                    {errorCount > 0 && <Badge variant="outline">失败: {errorCount} 张</Badge>}
                    {livePreview && isProcessing && (
                        <Badge variant="outline">
                            进行中: 第 {livePreview.stepIndex + 1} / {livePreview.sourceCount} 张
                        </Badge>
                    )}
                    {result && (
                        <Badge variant="outline">
                            输出尺寸: {result.width} × {result.height}
                        </Badge>
                    )}
                    {result && (
                        <Badge variant="outline">来源数量: {result.sourceCount} 张</Badge>
                    )}
                    <Badge variant="outline">
                        最后一步偏移: {effectiveOffset.x.toFixed(1)}px /{" "}
                        {effectiveOffset.y.toFixed(1)}px
                    </Badge>
                    {result && autoAlign && (
                        <Badge variant="outline">
                            最后一步自动估计: {result.estimatedOffset.x.toFixed(1)}px /{" "}
                            {result.estimatedOffset.y.toFixed(1)}px
                        </Badge>
                    )}
                    {livePreview && isProcessing && (
                        <Badge variant="outline">
                            当前自动估计: {livePreview.estimatedOffset.x.toFixed(1)}px /{" "}
                            {livePreview.estimatedOffset.y.toFixed(1)}px
                        </Badge>
                    )}
                </div>
                <Progress value={progress} className="h-2.5" />
                {livePreview && isProcessing && (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-3 dark:border-slate-800">
                            <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
                                <span>{livePreview.stageLabel}</span>
                                <span>
                                    步骤 {livePreview.stepIndex} / {livePreview.totalSteps}
                                </span>
                            </div>
                            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
                                <img
                                    src={livePreview.baseUrl}
                                    alt="当前基准图"
                                    className="absolute inset-0 h-full w-full object-contain opacity-90"
                                />
                                <img
                                    src={livePreview.candidateUrl}
                                    alt="当前候选图"
                                    className="absolute inset-0 h-full w-full object-contain opacity-45"
                                />
                                <img
                                    src={livePreview.winnerOverlayUrl}
                                    alt="深度叠加图"
                                    className="absolute inset-0 h-full w-full object-contain mix-blend-screen animate-pulse"
                                />
                            </div>
                            <p className="mt-3 text-xs leading-5 text-slate-400">
                                红色保留当前基准，蓝色并入当前候选；叠加图会随每轮堆叠刷新，方便观察深度归属推进。
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                            {processingPreviewPanels.map((panel) => (
                                <div
                                    key={panel.key}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                                >
                                    <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        {panel.label}
                                    </div>
                                    <img
                                        src={panel.url}
                                        alt={panel.label}
                                        className="aspect-[4/3] w-full rounded-xl object-contain"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    如果边缘仍有轻微重影，优先微调水平/垂直位移，其次再小范围调整缩放补偿；多张时请先看
                    `累计来源图` 判断全局归属，再用最后一轮调试图排查局部问题。
                </p>
        </PanelCard>
    );
}
