import { Icon } from "@iconify/react";

import ImageUploader from "@/components/ImageUploader";
import UploadCard from "@/components/UploadCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { UploadState } from "../types";

interface UploadPanelProps {
    images: UploadState[];
    readyCount: number;
    loadingCount: number;
    errorCount: number;
    canProcess: boolean;
    isProcessing: boolean;
    stackPreviewImages: UploadState[];
    onUpload: (files: File[]) => void;
    onOpenManager: () => void;
    onClearImages: () => void;
    onProcess: () => void;
}

export default function UploadPanel({
    images,
    readyCount,
    loadingCount,
    errorCount,
    canProcess,
    isProcessing,
    stackPreviewImages,
    onUpload,
    onOpenManager,
    onClearImages,
    onProcess,
}: UploadPanelProps) {
    return (
        <UploadCard
            title="上传图片"
            description="第一张作为初始参考图，后续图片会按顺序自动对齐并并入清晰区域。"
            className="border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none"
            tips={
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
                    多张模式下，主视图里的 `累计来源图` 表示最终每个像素来自哪一张原图；`最后一轮叠色/掩膜`
                    只用于调试最后一步，不代表整组图片的全局归属。
                </div>
            }
            status={
                images.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">可用 {readyCount} 张</Badge>
                        {loadingCount > 0 && (
                            <Badge variant="secondary">加载中 {loadingCount} 张</Badge>
                        )}
                        {errorCount > 0 && (
                            <Badge variant="secondary">失败 {errorCount} 张</Badge>
                        )}
                        <Badge variant="secondary">
                            {loadingCount > 0
                                ? "等待预览生成"
                                : readyCount >= 2
                                  ? "可开始合成"
                                  : "至少 2 张"}
                        </Badge>
                    </div>
                ) : null
            }
            footer={
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="ghost"
                            onClick={onClearImages}
                            disabled={images.length === 0}
                        >
                            清空全部
                        </Button>
                        <Button variant="outline" onClick={onProcess} disabled={!canProcess}>
                            {isProcessing ? "处理中..." : "开始合成"}
                        </Button>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                        建议使用脚架和定时快门拍摄，曝光参数固定，仅改变对焦点；多张序列建议按从前到后或从后到前的焦点顺序整理。
                    </div>
                </>
            }
        >
            {images.length === 0 ? (
                <div className="space-y-2">
                    <Label>焦点序列</Label>
                    <ImageUploader onUpload={onUpload} fileType="焦点序列">
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500 dark:hover:bg-slate-900">
                            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                <Icon
                                    icon="mdi:image-multiple-outline"
                                    className="h-8 w-8"
                                />
                                <span className="text-sm">拖拽或点击添加一张或多张图</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                    支持 JPG/PNG/WEBP/GIF/TIF/TIFF，第一张作为初始参考
                                </span>
                            </div>
                        </div>
                    </ImageUploader>
                </div>
            ) : (
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={onOpenManager}
                        className="group w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-500 dark:hover:bg-slate-900"
                    >
                        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 dark:bg-slate-900">
                            {stackPreviewImages
                                .slice()
                                .reverse()
                                .map((image, stackIndex) => (
                                    <div
                                        key={image.id}
                                        className="absolute overflow-hidden rounded-2xl border border-white/80 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950"
                                        style={{
                                            top: 12 + stackIndex * 14,
                                            left: 18 + stackIndex * 12,
                                            right: 18 - stackIndex * 4,
                                            bottom: 18 - stackIndex * 6,
                                            transform: `rotate(${(stackIndex - 1.5) * 3}deg)`,
                                        }}
                                    >
                                        {image.previewUrl ? (
                                            <img
                                                src={image.previewUrl}
                                                alt={`图片 ${stackIndex + 1}`}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : image.status === "loading" ? (
                                            <div className="flex h-full w-full items-center justify-center text-slate-500 dark:text-slate-400">
                                                <Icon
                                                    icon="mdi:loading"
                                                    className="h-7 w-7 animate-spin"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-rose-500 dark:text-rose-300">
                                                <Icon
                                                    icon="mdi:alert-circle-outline"
                                                    className="h-7 w-7"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-black/50 px-4 py-3 text-white backdrop-blur-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-medium">
                                            {images.length} 张图片已堆叠
                                        </div>
                                        <div className="mt-1 text-xs text-white/80">
                                            点击展开，查看全部图片并调整顺序
                                        </div>
                                    </div>
                                    <Icon
                                        icon="mdi:arrow-expand-all"
                                        className="h-6 w-6 text-white/90"
                                    />
                                </div>
                            </div>
                        </div>
                    </button>
                </div>
            )}
        </UploadCard>
    );
}
