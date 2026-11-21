import { memo } from "react";
import { Image as ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PhotoExifItem } from "@/pages/photo-exif/types";
import { getEffectiveFileName, isDirty } from "@/pages/photo-exif/utils";

import { getMissingPhotoInfo, type PhotoListFilter } from "@/pages/photo-exif/missing-info";

interface PhotoListPanelProps {
    totalCount: number;
    filter: PhotoListFilter;
    onlyMissing: boolean;
    onFilterChange: (value: PhotoListFilter) => void;
    items: PhotoExifItem[];
    selectedId: string | null;
    selectedImportSourceId: string;
    secondaryButtonClass: string;
    onSelect: (itemId: string) => void;
    onRemove: (itemId: string) => void;
    onToggleImportSource: (itemId: string) => void;
}

const PhotoListPanel = memo(({
    items, totalCount, filter, onlyMissing, onFilterChange, selectedId, selectedImportSourceId, onSelect, onRemove, onToggleImportSource,
}: PhotoListPanelProps) => (
    <Card className="min-w-0 overflow-hidden self-start lg:sticky lg:top-4 border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><ImageIcon className="h-4 w-4" />照片</h2>
            <span className="text-xs text-slate-500">{items.length} / {totalCount} 张</span>
        </div>
        <div className="border-b px-3 py-2">
            <select aria-label="照片列表筛选" className="w-full min-h-11 rounded-md border bg-background px-2 text-sm" value={filter} onChange={(event) => onFilterChange(event.target.value as PhotoListFilter)}>
                <option value="auto">{onlyMissing ? "仅缺失信息（相机 / 时间 / GPS）" : "跟随处理模式：全部照片"}</option>
                <option value="gps">仅缺 GPS</option>
                <option value="time">仅缺拍摄时间</option>
                <option value="camera">仅缺相机型号</option>
                <option value="pending">待写回 / 待导出</option>
                <option value="all">全部照片（可选来源图）</option>
            </select>
        </div>
        <div className="max-h-[45dvh] overflow-y-auto overscroll-contain p-2 lg:max-h-[max(12rem,calc(100dvh-21rem))]" aria-label="照片列表">
            <div className="space-y-1">
                {!items.length && <p className="px-3 py-8 text-center text-sm text-slate-500">没有符合条件的照片。可切换“全部照片”查看或选择来源图。</p>}
                {items.map((item) => {
                    const name = getEffectiveFileName(item);
                    const selected = item.id === selectedId;
                    const source = item.id === selectedImportSourceId;
                    const info = getMissingPhotoInfo(item);
                    const missing = [info.camera && "相机", info.time && "时间", info.gps && "GPS"].filter(Boolean);
                    return (
                        <div key={item.id} className={`rounded-lg border ${selected ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                            <button type="button" onClick={() => onSelect(item.id)} aria-pressed={selected} className="flex w-full min-w-0 gap-3 p-2 text-left rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                                <img src={item.previewUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-md object-cover bg-slate-100 dark:bg-slate-800" />
                                <span className="min-w-0 flex-1">
                                    <span className="break-all text-sm font-medium leading-5" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={name}>{name}</span>
                                    <span className="mt-1 block text-xs text-slate-500">{missing.length ? `缺${missing.join(" / ")}` : isDirty(item) ? "预览已补齐" : "信息完整"}{isDirty(item) ? " · 待写回" : ""}{source ? " · 来源图" : ""}</span>
                                </span>
                            </button>
                            {selected && (
                                <div className="flex items-center justify-between gap-2 px-2 pb-1">
                                    <Button type="button" variant="ghost" size="sm" className="min-h-11 text-xs" onClick={() => onToggleImportSource(item.id)}>{source ? "取消来源图" : "设为来源图"}</Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-slate-400 hover:text-red-500" onClick={() => onRemove(item.id)} aria-label={`移除 ${name}`}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    </Card>
));
PhotoListPanel.displayName = "PhotoListPanel";
export default PhotoListPanel;
