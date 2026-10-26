import { Button } from "@/components/ui/button";
import PanelCard from "@/components/PanelCard";
import { Download, PackageOpen, Send, Trash2 } from "lucide-react";
import type { TransferTarget } from "@/utils/crop-transfer";
import type { SavedCropGroup } from "../types";

type RightPanelProps = {
    className?: string;
    savedCropCount: number;
    groupedSavedCrops: SavedCropGroup[];
    selectedSavedCropIds: string[];
    selectedSavedCropCount: number;
    isBatchDownloading: boolean;
    isBatchExporting: boolean;
    isRoutingExporting: boolean;
    onExportBatch: () => void;
    onDownloadBatch: () => void;
    onRouteWithCrops: (target: TransferTarget) => void;
    onClearSavedCrops: () => void;
    onRemoveSavedCrop: (id: string) => void;
    onToggleSavedCrop: (id: string) => void;
    onToggleAllSavedCrops: () => void;
    onRemoveSelectedSavedCrops: () => void;
};

export default function RightPanel({
    className = "",
    savedCropCount,
    groupedSavedCrops,
    selectedSavedCropIds,
    selectedSavedCropCount,
    isBatchDownloading,
    isBatchExporting,
    isRoutingExporting,
    onExportBatch,
    onDownloadBatch,
    onRouteWithCrops,
    onClearSavedCrops,
    onRemoveSavedCrop,
    onToggleSavedCrop,
    onToggleAllSavedCrops,
    onRemoveSelectedSavedCrops,
}: RightPanelProps) {
    const hasSavedCrops = savedCropCount > 0;
    const allSavedCropsSelected = hasSavedCrops && selectedSavedCropCount === savedCropCount;

    return (
        <PanelCard
            title="暂存结果"
            icon={<PackageOpen className="h-4 w-4" />}
            count={`${savedCropCount} 张`}
            className={`flex h-full min-h-0 flex-col rounded-lg border-border/60 bg-background/90 shadow-sm ${className}`}
            headerClassName="px-4 py-3"
            titleClassName="text-base"
            contentClassName="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6 pt-0"
        >
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>已选 {selectedSavedCropCount} / {savedCropCount} 张</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={onToggleAllSavedCrops}
                            disabled={!hasSavedCrops}
                        >
                            {allSavedCropsSelected ? "取消全选" : "全选"}
                        </Button>
                    </div>
                    <div className="grid gap-2">
                    <Button
                        onClick={onExportBatch}
                        disabled={!selectedSavedCropCount || isBatchExporting || isBatchDownloading}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        {isBatchExporting ? "正在生成 ZIP..." : "导出选中 ZIP"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onDownloadBatch}
                        disabled={!selectedSavedCropCount || isBatchExporting || isBatchDownloading}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        {isBatchDownloading ? "正在准备下载..." : "下载选中"}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => onRouteWithCrops("watermark")}
                        disabled={!selectedSavedCropCount || isRoutingExporting || isBatchExporting || isBatchDownloading}
                    >
                        <Send className="mr-2 h-4 w-4" />
                        发送选中到水印
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => onRouteWithCrops("puzzle")}
                        disabled={!selectedSavedCropCount || isRoutingExporting || isBatchExporting || isBatchDownloading}
                    >
                        <Send className="mr-2 h-4 w-4" />
                        发送选中到拼图
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onRemoveSelectedSavedCrops}
                        disabled={!selectedSavedCropCount || isBatchExporting || isBatchDownloading}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除选中
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onClearSavedCrops}
                        disabled={!hasSavedCrops || isBatchExporting || isBatchDownloading}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        清空暂存
                    </Button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
                    {groupedSavedCrops.length ? (
                        groupedSavedCrops.map((group) => (
                            <div
                                key={group.sourceImageId}
                                className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium">{group.sourceName}</div>
                                        <div className="text-[11px] text-muted-foreground">
                                            已暂存 {group.items.length} 张
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {group.items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-3 rounded-lg bg-background px-3 py-2"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedSavedCropIds.includes(item.id)}
                                                onChange={() => onToggleSavedCrop(item.id)}
                                                aria-label={`选择 ${item.file.name}`}
                                                className="h-4 w-4 shrink-0 accent-primary"
                                            />
                                            <img
                                                src={item.previewUrl}
                                                alt={item.file.name}
                                                className="h-14 w-14 rounded-md bg-black/5 object-cover"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs">第 {item.index} 张</div>
                                                <div className="truncate text-[11px] text-muted-foreground">
                                                    {item.outputW} × {item.outputH}
                                                </div>
                                                <div className="truncate text-[11px] text-muted-foreground">
                                                    {item.file.name}
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 px-2 text-muted-foreground"
                                                onClick={() => onRemoveSavedCrop(item.id)}
                                            >
                                                删除
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                            暂存区还是空的。先在中间裁一张，再点“暂存当前裁切”。
                        </div>
                    )}
                </div>
        </PanelCard>
    );
}
