import { Button } from "@/components/ui/button";
import PanelCard from "@/components/PanelCard";
import { Download, PackageOpen, Send, Trash2 } from "lucide-react";
import type { TransferTarget } from "@/utils/crop-transfer";
import type { SavedCropGroup } from "../types";

type RightPanelProps = {
    className?: string;
    savedCropCount: number;
    groupedSavedCrops: SavedCropGroup[];
    isRoutingExporting: boolean;
    onExportBatch: () => void;
    onRouteWithCrops: (target: TransferTarget) => void;
    onClearSavedCrops: () => void;
    onRemoveSavedCrop: (id: string) => void;
};

export default function RightPanel({
    className = "",
    savedCropCount,
    groupedSavedCrops,
    isRoutingExporting,
    onExportBatch,
    onRouteWithCrops,
    onClearSavedCrops,
    onRemoveSavedCrop,
}: RightPanelProps) {
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
                <div className="grid gap-2">
                    <Button onClick={onExportBatch} disabled={!savedCropCount}>
                        <Download className="mr-2 h-4 w-4" />
                        导出 ZIP
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => onRouteWithCrops("watermark")}
                        disabled={!savedCropCount || isRoutingExporting}
                    >
                        <Send className="mr-2 h-4 w-4" />
                        发送到水印
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => onRouteWithCrops("puzzle")}
                        disabled={!savedCropCount || isRoutingExporting}
                    >
                        <Send className="mr-2 h-4 w-4" />
                        发送到拼图
                    </Button>
                    <Button variant="ghost" onClick={onClearSavedCrops} disabled={!savedCropCount}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        清空暂存
                    </Button>
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
