import { Button } from "@/components/ui/button";
import PanelCard from "@/components/PanelCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crop, ImagePlus, Images, RotateCcw, Scissors, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import { ratioOptions, type CropImage, type CropMode } from "../types";

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
}: LeftPanelProps) {
    return (
        <PanelCard
            title="图片裁切"
            icon={<Scissors className="h-4 w-4" />}
            count={`${images.length} 张`}
            className={`flex h-full min-h-0 flex-col border-border/60 bg-background/90 shadow-sm ${className}`}
            headerClassName="px-4 py-3"
            titleClassName="text-base"
            contentClassName="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6 pt-0"
        >
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Button asChild className="w-full">
                            <label className="flex cursor-pointer items-center justify-center gap-2 text-center">
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
                        </Button>
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

                <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
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
                            <div className="grid grid-cols-2 gap-2">
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
                        ) : mode === "ratio" ? (
                            <div className="space-y-2">
                                <Select value={ratioPreset} onValueChange={onRatioPresetChange}>
                                    <SelectTrigger>
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
                            <div className="rounded-xl bg-background px-3 py-2 text-xs text-muted-foreground">
                                自由裁切会按当前选区的原始像素导出。
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Images className="h-4 w-4" />
                            原图列表
                        </div>
                        <div className="text-xs text-muted-foreground">选择一张进入编辑</div>
                    </div>
                    <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                        {images.length ? (
                            images.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onSelectImage(item.id)}
                                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                                        activeId === item.id
                                            ? "border-primary bg-primary/5 shadow-sm"
                                            : "border-border/60 bg-background hover:bg-muted/30"
                                    }`}
                                >
                                    <img
                                        src={item.previewUrl}
                                        alt={item.name}
                                        className="h-14 w-14 rounded-xl bg-black/5 object-cover"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm">{item.name}</div>
                                        <div className="text-[11px] text-muted-foreground">
                                            {item.width} × {item.height}
                                        </div>
                                    </div>
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
                                </button>
                            ))
                        ) : (
                            <div className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                                先上传一批原图，再从这里选择要裁切的图片。
                            </div>
                        )}
                    </div>
                </div>
        </PanelCard>
    );
}
