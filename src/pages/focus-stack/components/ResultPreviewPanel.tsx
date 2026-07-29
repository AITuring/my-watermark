import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFocusStackOwnershipColor, type FocusStackLivePreview, type FocusStackResult } from "@/utils/focus-stack";
import type { PreviewPanel } from "../types";

interface ResultPreviewPanelProps {
    result: FocusStackResult | null;
    livePreview: FocusStackLivePreview | null;
    isProcessing: boolean;
    processingPreviewPanels: PreviewPanel[];
    resultPrimaryPanels: PreviewPanel[];
    resultSecondaryPanels: PreviewPanel[];
    onOpenInspect: () => void;
}

export default function ResultPreviewPanel({
    result,
    livePreview,
    isProcessing,
    processingPreviewPanels,
    resultPrimaryPanels,
    resultSecondaryPanels,
    onOpenInspect,
}: ResultPreviewPanelProps) {
    return (
        <Card className="min-h-[720px] border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
            <CardHeader>
                <CardTitle>预览结果</CardTitle>
                <CardDescription>
                    同步查看合成结果和累计来源图，点击主图可放大预览；其他调试图保留在下方辅助判断。
                </CardDescription>
            </CardHeader>
            <CardContent>
                {result ? (
                    <div className="space-y-5">
                        {result.sourceCount > 2 && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                    累计来源图图例
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {Array.from({ length: result.sourceCount }, (_, index) => (
                                        <div
                                            key={`legend-${index + 1}`}
                                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            <span
                                                className="h-3 w-3 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        getFocusStackOwnershipColor(index),
                                                }}
                                            />
                                            <span>图片 {index + 1}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="grid gap-4 xl:grid-cols-2">
                            {resultPrimaryPanels.map((panel) => (
                                <button
                                    key={panel.key}
                                    type="button"
                                    onClick={onOpenInspect}
                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left transition hover:border-blue-400 dark:border-slate-800 dark:bg-slate-950"
                                >
                                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                                        <div>
                                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {panel.label}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                点击放大查看原始分辨率细节
                                            </div>
                                        </div>
                                        <Icon
                                            icon="mdi:magnify-plus-outline"
                                            className="h-5 w-5 text-slate-500 dark:text-slate-400"
                                        />
                                    </div>
                                    <div className="bg-slate-100 p-3 dark:bg-slate-950">
                                        <img
                                            src={panel.url}
                                            alt={panel.label}
                                            className="h-[420px] w-full rounded-xl object-contain xl:h-[560px]"
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {resultSecondaryPanels.length > 0 && (
                            <div className="space-y-3">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    其他调试图
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {resultSecondaryPanels.map((panel) => (
                                        <div
                                            key={panel.key}
                                            className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                                        >
                                            <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
                                                {panel.label}
                                            </div>
                                            <div className="p-3">
                                                <img
                                                    src={panel.url}
                                                    alt={panel.label}
                                                    className="aspect-[4/3] w-full rounded-xl object-contain"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : livePreview && isProcessing ? (
                    <div className="flex min-h-[520px] flex-col gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                                    正在堆叠深度图
                                </p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    当前展示第 {livePreview.stepIndex + 1} 张并入时的动态叠加视图。
                                </p>
                            </div>
                            <Badge variant="outline">{livePreview.stageLabel}</Badge>
                        </div>
                        <div className="grid flex-1 gap-4 xl:grid-cols-2">
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
                                    当前累计结果
                                </div>
                                <div className="bg-slate-100 p-3 dark:bg-slate-950">
                                    <img
                                        src={livePreview.mergedUrl}
                                        alt="当前累计结果"
                                        className="h-[380px] w-full rounded-xl object-contain xl:h-[520px]"
                                    />
                                </div>
                            </div>
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
                                    当前深度图
                                </div>
                                <div className="bg-slate-100 p-3 dark:bg-slate-950">
                                    <img
                                        src={livePreview.maskUrl}
                                        alt="当前深度图"
                                        className="h-[380px] w-full rounded-xl object-contain xl:h-[520px]"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {processingPreviewPanels
                                .filter((panel) => !["merged", "mask"].includes(panel.key))
                                .map((panel) => (
                                    <div
                                        key={panel.key}
                                        className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
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
                ) : (
                    <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-950">
                        <Icon
                            icon="mdi:layers-triple-outline"
                            className="h-12 w-12 text-slate-400"
                        />
                        <div>
                            <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                                结果会显示在这里
                            </p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                上传至少两张图后点击“开始合成”，即可查看最终输出、累计来源图和最后一轮调试图。
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
