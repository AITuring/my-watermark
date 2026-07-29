import { Image as ImageIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PhotoExifItem } from "@/pages/photo-exif/types";
import { editableGpsToPoint, getEffectiveFileName, isDirty } from "@/pages/photo-exif/utils";

interface PhotoListPanelProps {
    items: PhotoExifItem[];
    selectedId: string | null;
    selectedImportSourceId: string;
    secondaryButtonClass: string;
    onSelect: (itemId: string) => void;
    onRemove: (itemId: string) => void;
    onToggleImportSource: (itemId: string) => void;
}

const PhotoListPanel = ({
    items,
    selectedId,
    selectedImportSourceId,
    secondaryButtonClass,
    onSelect,
    onRemove,
    onToggleImportSource,
}: PhotoListPanelProps) => (
    <Card className="xl:col-span-3 border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                图片列表
            </CardTitle>
            <CardDescription>
                先上传图片筛选与查看；JPEG / PNG 可授权后原地写回，TIF 可导出修改
            </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
            <ScrollArea className="h-[calc(100vh-15rem)] min-h-[520px] pr-2">
                <div className="space-y-3">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelect(item.id)}
                            className={`w-full text-left rounded-2xl border p-3 ${
                                item.id === selectedId
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                        >
                            <div className="flex gap-3">
                                <img
                                    src={item.previewUrl}
                                    alt={getEffectiveFileName(item)}
                                    className="w-20 h-20 rounded-xl object-cover bg-slate-100 dark:bg-slate-800"
                                />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm break-all">{getEffectiveFileName(item)}</p>
                                            {getEffectiveFileName(item) !== item.originalFileName && (
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 break-all">
                                                    原名: {item.originalFileName}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onRemove(item.id);
                                            }}
                                            className="text-slate-400 hover:text-red-500"
                                            aria-label={`删除 ${getEffectiveFileName(item)}`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {item.id === selectedId && <Badge className="bg-blue-600 text-white hover:bg-blue-600">当前目标图</Badge>}
                                        {item.id === selectedImportSourceId && (
                                            <Badge className="bg-violet-600 text-white hover:bg-violet-600">当前来源图</Badge>
                                        )}
                                        {item.gpsCurrent.locationName.trim() && <Badge variant="outline">GPS地址</Badge>}
                                        {!item.gpsCurrent.locationName.trim() && editableGpsToPoint(item.gpsCurrent) && (
                                            <Badge variant="outline">含 GPS</Badge>
                                        )}
                                        {isDirty(item) && (
                                            <Badge className="bg-amber-500 text-white hover:bg-amber-500">已修改</Badge>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                                        <p>{item.summary.make || "未知品牌"} {item.summary.model || ""}</p>
                                        <p>{item.summary.dateTimeOriginal || "未读取到拍摄时间"}</p>
                                        {item.gpsCurrent.locationName.trim() && <p>{item.gpsCurrent.locationName}</p>}
                                        <p>{item.summary.gps || "无 GPS"}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={secondaryButtonClass}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onToggleImportSource(item.id);
                                            }}
                                        >
                                            {item.id === selectedImportSourceId ? "取消来源图" : "设为来源图"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </CardContent>
    </Card>
);

export default PhotoListPanel;
