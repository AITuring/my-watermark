import { Button, buttonVariants } from "@/components/ui/button";
import PanelCard from "@/components/PanelCard";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Check, Crop, ImagePlus, Images, RotateCcw, Scissors, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import { ratioOptions, type CropImage, type CropMode } from "../types";
import StorageStatus from "./StorageStatus";
import type { FileStorageEstimate } from "@/utils/file-storage";
import type { CropBatchFailure } from "../hooks/useCropExports";

type LeftPanelProps = {
    className?: string;
    images: CropImage[];
    activeId: string | null;
    mode: CropMode;
    targetWidth: number;
    targetHeight: number;
    ratioPreset: string;
    customRatioW: number;
    customRatioH: number;
    onModeChange: (value: CropMode) => void;
    onTargetWidthChange: (value: number) => void;
    onTargetHeightChange: (value: number) => void;
    onRatioPresetChange: (value: string) => void;
    onCustomRatioWChange: (value: number) => void;
    onCustomRatioHChange: (value: number) => void;
    onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
    onResetAllCrop: () => void;
    onClearAllImages: () => void;
    onSelectImage: (id: string) => void;
    onRemoveImage: (id: string) => void;
    onSwapAspect: () => void;
    selectedImageIds: string[];
    onToggleImage: (id: string) => void;
    onToggleAllImages: () => void;
    onBatchCrop: () => void;
    onApplyRuleToSelected: () => void;
    batchProgress: { completed: number; total: number; currentName: string; failed: number } | null;
    batchFailures: CropBatchFailure[];
    onCancelBatch: () => void;
    onRetryFailed: () => void;
    storageEstimate: FileStorageEstimate;
};

export default function LeftPanel({
    className = "",
    images,
    activeId,
    mode,
    targetWidth,
    targetHeight,
    ratioPreset,
    customRatioW,
    customRatioH,
    onModeChange,
    onTargetWidthChange,
    onTargetHeightChange,
    onRatioPresetChange,
    onCustomRatioWChange,
    onCustomRatioHChange,
    onUpload,
    onResetAllCrop,
    onClearAllImages,
    onSelectImage,
    onRemoveImage,
    onSwapAspect,
    selectedImageIds,
    onToggleImage,
    onToggleAllImages,
    onBatchCrop,
    onApplyRuleToSelected,
    batchProgress,
    batchFailures,
    onCancelBatch,
    onRetryFailed,
    storageEstimate,
}: LeftPanelProps) {
    return (
        <PanelCard
            title="图片裁切"
            icon={<Scissors className="h-4 w-4" />}
            count={`${images.length} 张`}
            className={`flex h-full min-h-0 flex-col rounded-lg border-border/60 bg-background/90 shadow-sm ${className}`}
            headerClassName="px-4 py-3"
            titleClassName="text-base"
            contentClassName="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6 pt-0"
        >
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <label className={buttonVariants({ className: "w-full cursor-pointer" })}>
                            <ImagePlus className="h-4 w-4" />
                            上传原图
                            <input
                                className="hidden"
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={onUpload}
                            />
                        </label>
                        <Button variant="secondary" onClick={onResetAllCrop} disabled={!images.length}>
                            <RotateCcw className="h-4 w-4" />
                            重置全部
                        </Button>
                    </div>
                    <Button
                        variant="ghost"
                        className="w-full justify-center"
                        onClick={onClearAllImages}
                        disabled={!images.length}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        清空原图列表
                    </Button>
                </div>

                <StorageStatus estimate={storageEstimate} />

                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Crop className="h-4 w-4" />
                        导出规则
                    </div>
                    <div className="space-y-2">
                        <Select value={mode} onValueChange={(value) => onModeChange(value as CropMode)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fixed">固定像素导出</SelectItem>
                                <SelectItem value="ratio">按比例选区导出</SelectItem>
                                <SelectItem value="free">自由裁切导出</SelectItem>
                            </SelectContent>
                        </Select>
                        {mode === "fixed" ? (
                            <div className="flex items-center gap-2">
                                <div className="grid flex-1 grid-cols-2 gap-2">
                                    <Input
                                        type="number"
                                        value={targetWidth}
                                        min={1}
                                        onChange={(e) => onTargetWidthChange(Number(e.target.value || 1))}
                                    />
                                    <Input
                                        type="number"
                                        value={targetHeight}
                                        min={1}
                                        onChange={(e) => onTargetHeightChange(Number(e.target.value || 1))}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    onClick={onSwapAspect}
                                    title="切换宽高比例"
                                >
                                    <ArrowUpDown className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : mode === "ratio" ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Select value={ratioPreset} onValueChange={onRatioPresetChange}>
                                        <SelectTrigger className="flex-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ratioOptions.map((item) => (
                                                <SelectItem key={item.label} value={item.label}>
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="shrink-0"
                                        onClick={onSwapAspect}
                                        title="切换宽高比例"
                                    >
                                        <ArrowUpDown className="h-4 w-4" />
                                    </Button>
                                </div>
                                {ratioPreset === "自定义" && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            type="number"
                                            value={customRatioW}
                                            min={1}
                                            onChange={(e) => onCustomRatioWChange(Number(e.target.value || 1))}
                                        />
                                        <Input
                                            type="number"
                                            value={customRatioH}
                                            min={1}
                                            onChange={(e) => onCustomRatioHChange(Number(e.target.value || 1))}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">
                                自由裁切会按当前选区的原始像素导出。
                            </div>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={onApplyRuleToSelected}
                            disabled={!selectedImageIds.length}
                        >
                            应用规则到选中 ({selectedImageIds.length})
                        </Button>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Images className="h-4 w-4" />
                            原图列表
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={onToggleAllImages} disabled={!images.length}>
                            {selectedImageIds.length === images.length ? "取消全选" : "全选"}
                        </Button>
                    </div>
                    <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                        {images.length ? (
                            images.map((item) => (
                                <div
                                    key={item.id}
                                    className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 transition ${
                                        activeId === item.id
                                            ? "border-primary bg-primary/5 shadow-sm"
                                            : "border-border/60 bg-background hover:bg-muted/30"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onSelectImage(item.id)}
                                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-0.5 text-left"
                                    >
                                        <span
                                            role="checkbox"
                                            tabIndex={0}
                                            aria-checked={selectedImageIds.includes(item.id)}
                                            aria-label={`选择 ${item.name}`}
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                                selectedImageIds.includes(item.id)
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-border bg-background"
                                            }`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onToggleImage(item.id);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    onToggleImage(item.id);
                                                }
                                            }}
                                        >
                                            {selectedImageIds.includes(item.id) && <Check className="h-3 w-3" />}
                                        </span>
                                        <img
                                            src={item.previewUrl}
                                            alt={item.name}
                                            className="h-14 w-14 rounded-md bg-black/5 object-cover"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm">{item.name}</div>
                                            <div className="text-[11px] text-muted-foreground">
                                                {item.width} × {item.height}
                                            </div>
                                        </div>
                                    </button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2 text-muted-foreground"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveImage(item.id);
                                        }}
                                    >
                                        删除
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                                先上传一批原图，再从这里选择要裁切的图片。
                            </div>
                        )}
                    </div>
                    {batchProgress && (
                        <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                            <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate">正在裁切：{batchProgress.currentName}</span>
                                <span className="tabular-nums">
                                    {batchProgress.completed}/{batchProgress.total} · 失败 {batchProgress.failed}
                                </span>
                            </div>
                            <Progress
                                value={
                                    batchProgress.total
                                        ? (batchProgress.completed / batchProgress.total) * 100
                                        : 0
                                }
                                className="h-1.5"
                            />
                            <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={onCancelBatch}>
                                取消批量裁切
                            </Button>
                        </div>
                    )}
                    {batchFailures.length > 0 && !batchProgress && (
                        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                                <span>失败 {batchFailures.length} 项</span>
                                <Button type="button" variant="outline" size="sm" onClick={onRetryFailed}>重试失败项</Button>
                            </div>
                            <div className="space-y-1 text-muted-foreground">
                                {batchFailures.map((item) => <div key={item.image.id} className="truncate">{item.image.name}：{item.message}</div>)}
                            </div>
                        </div>
                    )}
                    <Button type="button" onClick={onBatchCrop} disabled={!selectedImageIds.length || Boolean(batchProgress)}>
                        {batchProgress
                            ? `正在裁切 ${batchProgress.completed}/${batchProgress.total}...`
                            : `批量暂存选中 (${selectedImageIds.length})`}
                    </Button>
                </div>
        </PanelCard>
    );
}
