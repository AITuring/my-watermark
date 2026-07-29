import type { RefObject } from "react";
import {
    AlertCircle,
    Camera,
    ChevronDown,
    ChevronRight,
    Download,
    LocateFixed,
    Save,
    Search,
    Trash2,
    Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import type { CopyrightPreset, GpsPoint, MapLoadState, PhotoExifItem } from "@/pages/photo-exif/types";
import { getEffectiveFileName, isDirty } from "@/pages/photo-exif/utils";

interface ViewerTabContentProps {
    selectedItem: PhotoExifItem | null;
    selectedGpsPoint: GpsPoint | null;
    selectedFileExtension: string;
    selectedFileNameValue: string;
    selectedFileNameError: string;
    selectedDateTimeOriginalValue: string;
    selectedDateTimeDigitizedValue: string;
    singleImportSourceOptions: PhotoExifItem[];
    selectedImportSourceId: string;
    locationSearchQuery: string;
    mapState: MapLoadState;
    copyrightPreset: CopyrightPreset;
    copyrightPresetEnabled: boolean;
    isCopyrightPresetExpanded: boolean;
    isExportingSingle: boolean;
    isOverwritingSelected: boolean;
    isSearchingLocation: boolean;
    secondaryButtonClass: string;
    primaryButtonClass: string;
    dangerButtonClass: string;
    dangerSubtleButtonClass: string;
    importSourceInputRef: RefObject<HTMLInputElement | null>;
    mapContainerRef: RefObject<HTMLDivElement | null>;
    onExportSelected: () => void;
    onOverwriteSelectedInPlace: () => void;
    onSelectedFileNameChange: (value: string) => void;
    onSelectedDateTimeFieldChange: (key: "dateTimeOriginal" | "dateTimeDigitized", value: string) => void;
    onImportSourceFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onSelectedImportSourceIdChange: (value: string) => void;
    onOpenImportConfirmDialog: () => void;
    onClearSelectedGps: () => void;
    onLocationSearchQueryChange: (value: string) => void;
    onSearchSelectedLocation: () => void;
    onSelectedGpsFieldChange: (key: "lat" | "lng" | "locationName", value: string) => void;
    onApplyCopyrightPresetToAll: () => void;
    onCopyrightPresetEnabledChange: (checked: boolean) => void;
    onToggleCopyrightPresetExpanded: () => void;
    onCopyrightPresetFieldChange: (key: keyof CopyrightPreset, value: string) => void;
}

const ViewerTabContent = ({
    selectedItem,
    selectedGpsPoint,
    selectedFileExtension,
    selectedFileNameValue,
    selectedFileNameError,
    selectedDateTimeOriginalValue,
    selectedDateTimeDigitizedValue,
    singleImportSourceOptions,
    selectedImportSourceId,
    locationSearchQuery,
    mapState,
    copyrightPreset,
    copyrightPresetEnabled,
    isCopyrightPresetExpanded,
    isExportingSingle,
    isOverwritingSelected,
    isSearchingLocation,
    secondaryButtonClass,
    primaryButtonClass,
    dangerButtonClass,
    dangerSubtleButtonClass,
    importSourceInputRef,
    mapContainerRef,
    onExportSelected,
    onOverwriteSelectedInPlace,
    onSelectedFileNameChange,
    onSelectedDateTimeFieldChange,
    onImportSourceFileChange,
    onSelectedImportSourceIdChange,
    onOpenImportConfirmDialog,
    onClearSelectedGps,
    onLocationSearchQueryChange,
    onSearchSelectedLocation,
    onSelectedGpsFieldChange,
    onApplyCopyrightPresetToAll,
    onCopyrightPresetEnabledChange,
    onToggleCopyrightPresetExpanded,
    onCopyrightPresetFieldChange,
}: ViewerTabContentProps) => (
    <TabsContent value="viewer" className="space-y-4">
        {selectedItem ? (
            <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                <CardContent className="space-y-5 p-5">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs text-slate-500 dark:text-slate-400">当前图片</p>
                            <h2 className="mt-1 text-lg font-semibold break-all">
                                {getEffectiveFileName(selectedItem)}
                            </h2>
                            {getEffectiveFileName(selectedItem) !== selectedItem.originalFileName && (
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 break-all">
                                    原名: {selectedItem.originalFileName}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {selectedGpsPoint && <Badge variant="outline">含 GPS</Badge>}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">保存当前修改</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    GPS、版权或导入的整套信息修改后，可导出新图或直接写回原文件；开启默认版权后会在保存时自动补齐
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    className={secondaryButtonClass}
                                    onClick={onExportSelected}
                                    disabled={!selectedItem.canWriteExif || isExportingSingle}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    {isExportingSingle ? "导出中..." : "导出修改后图片"}
                                </Button>
                                <Button
                                    className={dangerButtonClass}
                                    onClick={onOverwriteSelectedInPlace}
                                    disabled={!selectedItem.canOverwriteInPlace || !selectedItem.fileHandle || !isDirty(selectedItem) || isOverwritingSelected}
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {isOverwritingSelected ? "写回中..." : "写回原文件"}
                                </Button>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {!selectedItem.canWriteExif
                                ? "当前图片格式暂不支持导出元数据修改。"
                                : !selectedItem.canOverwriteInPlace
                                  ? "当前图片可导出修改后的 JPEG；原地写回仅支持 JPEG / PNG。"
                                  : !selectedItem.fileHandle
                                    ? "当前 JPEG / PNG 还没授权原文件，可先导出修改后图片；如需直接写回，请先点击“授权原文件”。"
                                    : !isDirty(selectedItem)
                                      ? "当前图片还没有待保存的修改。"
                                      : "已授权原文件，可直接原地写回。"}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold">文件名与时间</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                可直接修改导出/写回后的文件名，以及拍摄时间和数字化时间
                            </p>
                        </div>
                        <div className="grid gap-4 xl:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="selected-file-name">文件名</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="selected-file-name"
                                        value={selectedFileNameValue}
                                        placeholder="输入导出或写回时使用的文件名"
                                        disabled={!selectedItem.canWriteExif}
                                        onChange={(event) => onSelectedFileNameChange(event.target.value)}
                                    />
                                    {selectedFileExtension && (
                                        <div className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
                                            {selectedFileExtension}
                                        </div>
                                    )}
                                </div>
                                <p className={`text-xs ${selectedFileNameError ? "text-rose-500" : "text-slate-500 dark:text-slate-400"}`}>
                                    {selectedFileNameError || `留空或非法名称会在保存时拦截，原始文件名：${selectedItem.originalFileName}`}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="selected-date-time-original">拍摄时间</Label>
                                <Input
                                    id="selected-date-time-original"
                                    type="datetime-local"
                                    step="1"
                                    value={selectedDateTimeOriginalValue}
                                    disabled={!selectedItem.canWriteExif}
                                    onChange={(event) => onSelectedDateTimeFieldChange("dateTimeOriginal", event.target.value)}
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    会写回 `DateTimeOriginal`，格式自动转换为 EXIF 时间
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="selected-date-time-digitized">数字化时间</Label>
                                <Input
                                    id="selected-date-time-digitized"
                                    type="datetime-local"
                                    step="1"
                                    value={selectedDateTimeDigitizedValue}
                                    disabled={!selectedItem.canWriteExif}
                                    onChange={(event) => onSelectedDateTimeFieldChange("dateTimeDigitized", event.target.value)}
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    可选；会写回 `DateTimeDigitized`
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                        <input
                            ref={importSourceInputRef}
                            type="file"
                            accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.tif,.tiff"
                            multiple
                            aria-label="继续上传来源图片"
                            title="继续上传来源图片"
                            className="hidden"
                            onChange={onImportSourceFileChange}
                        />
                        <div>
                            <h3 className="text-lg font-semibold">整套信息导入</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                适合 A 图信息被清空、但 B 图与它是同一张照片的情况，可直接把 B 的可写 EXIF 字段和 GPS 整体导入到当前图片
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 p-3 dark:border-slate-800">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {singleImportSourceOptions.length
                                    ? "如果来源图还没在列表里，可继续上传；新上传的图片会自动设为当前来源图。"
                                    : "当前还没有可选来源图，可继续上传一张同场景照片作为来源图。"}
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                className={secondaryButtonClass}
                                onClick={() => importSourceInputRef.current?.click()}
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                继续上传来源图
                            </Button>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                            <div className="space-y-2">
                                <Label htmlFor="selected-import-source">来源图片</Label>
                                <select
                                    id="selected-import-source"
                                    title="选择整套信息导入的来源图片"
                                    aria-label="选择整套信息导入的来源图片"
                                    value={selectedImportSourceId}
                                    onChange={(event) => onSelectedImportSourceIdChange(event.target.value)}
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm ring-offset-background dark:border-slate-800"
                                >
                                    <option value="">请选择来源图片</option>
                                    {singleImportSourceOptions.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {getEffectiveFileName(item)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    className={secondaryButtonClass}
                                    onClick={onOpenImportConfirmDialog}
                                    disabled={!selectedItem.canWriteExif || !singleImportSourceOptions.length}
                                >
                                    导入到当前
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                        <div>
                            <h3 className="flex items-center gap-2 text-lg font-semibold">
                                <Camera className="w-5 h-5" />
                                核心信息
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                汇总展示当前图片的主要 EXIF 信息，便于快速核对机身、镜头、时间和 GPS。
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {[
                                { label: "品牌", value: selectedItem.summary.make || "-" },
                                { label: "机型", value: selectedItem.summary.model || "-" },
                                { label: "镜头", value: selectedItem.summary.lensModel || "-" },
                                { label: "ISO", value: selectedItem.summary.iso || "-" },
                                { label: "光圈", value: selectedItem.summary.fNumber || "-" },
                                { label: "快门", value: selectedItem.summary.exposureTime || "-" },
                                { label: "焦距", value: selectedItem.summary.focalLength || "-" },
                                { label: "拍摄时间", value: selectedItem.summary.dateTimeOriginal || "-" },
                                { label: "软件", value: selectedItem.summary.software || "-" },
                                { label: "GPS", value: selectedItem.summary.gps || "-" },
                            ].map((entry) => (
                                <div key={entry.label} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{entry.label}</p>
                                    <p className="mt-1 text-sm font-medium break-words">{entry.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {(selectedGpsPoint || selectedItem.canWriteExif) && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                                        <LocateFixed className="w-5 h-5" />
                                        GPS 编辑
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {selectedGpsPoint
                                            ? `经纬度：${selectedGpsPoint.lat.toFixed(6)}, ${selectedGpsPoint.lng.toFixed(6)}`
                                            : "可搜索地点、点击地图或拖拽标记设置 GPS"}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" className={dangerSubtleButtonClass} onClick={onClearSelectedGps} disabled={!selectedItem.canWriteExif}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        清除 GPS
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                                <div>
                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <Input
                                            value={locationSearchQuery}
                                            placeholder="搜索地点，例如 上海外滩 / 故宫博物院"
                                            disabled={!selectedItem.canWriteExif || isSearchingLocation}
                                            onChange={(event) => onLocationSearchQueryChange(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    onSearchSelectedLocation();
                                                }
                                            }}
                                        />
                                        <Button
                                            className={primaryButtonClass}
                                            onClick={onSearchSelectedLocation}
                                            disabled={!selectedItem.canWriteExif || isSearchingLocation}
                                        >
                                            <Search className="w-4 h-4 mr-2" />
                                            {isSearchingLocation ? "搜索中..." : "搜索地点"}
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 lg:justify-end">
                                    {selectedItem.gpsCurrent.locationName || "未设置地点名称"}
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="selected-gps-lat">纬度</Label>
                                    <Input
                                        id="selected-gps-lat"
                                        value={selectedItem.gpsCurrent.lat}
                                        placeholder="例如 31.230416"
                                        disabled={!selectedItem.canWriteExif}
                                        onChange={(event) => onSelectedGpsFieldChange("lat", event.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="selected-gps-lng">经度</Label>
                                    <Input
                                        id="selected-gps-lng"
                                        value={selectedItem.gpsCurrent.lng}
                                        placeholder="例如 121.473701"
                                        disabled={!selectedItem.canWriteExif}
                                        onChange={(event) => onSelectedGpsFieldChange("lng", event.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                                <div ref={mapContainerRef} className="h-[280px] w-full bg-slate-100 dark:bg-slate-900" />
                            </div>
                            {mapState.loading && (
                                <p className="text-sm text-slate-500 dark:text-slate-400">地图加载中...</p>
                            )}
                            {mapState.error && (
                                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    {mapState.error}
                                </div>
                            )}
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                可直接拖拽地图上的标记到目标位置；如果当前还没有 GPS，可先搜索地点，或直接点击地图落点。
                            </p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold">版权</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        当前图片版权仅展示；默认预设会在保存时自动补齐缺失的作者与版权
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" className={secondaryButtonClass} onClick={onApplyCopyrightPresetToAll} disabled={!copyrightPresetEnabled}>
                                        填充到全部图片
                                    </Button>
                                </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">保存时自动补齐默认版权</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            打开后，保存当前图片或批量导出/写回时，会自动补齐缺失的默认作者与版权
                                        </p>
                                    </div>
                                    <Switch checked={copyrightPresetEnabled} onCheckedChange={onCopyrightPresetEnabledChange} />
                                </div>
                                <button
                                    type="button"
                                    className="flex w-full items-start justify-between gap-4 text-left"
                                    onClick={onToggleCopyrightPresetExpanded}
                                    aria-controls="copyright-preset-panel"
                                >
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex items-center gap-2">
                                            {isCopyrightPresetExpanded ? (
                                                <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                            )}
                                            <p className="text-sm font-medium">默认版权预设</p>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {isCopyrightPresetExpanded ? "编辑默认作者与默认版权" : "点击展开编辑默认作者与默认版权"}
                                        </p>
                                    </div>
                                </button>
                                {isCopyrightPresetExpanded && (
                                    <div
                                        id="copyright-preset-panel"
                                        className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800"
                                    >
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="copyright-preset-artist">默认作者</Label>
                                                <Input
                                                    id="copyright-preset-artist"
                                                    value={copyrightPreset.artist}
                                                    placeholder="例如 笑谈间气吐霓虹"
                                                    onChange={(event) => onCopyrightPresetFieldChange("artist", event.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="copyright-preset-text">默认版权</Label>
                                                <Input
                                                    id="copyright-preset-text"
                                                    value={copyrightPreset.copyright}
                                                    placeholder="例如 Copyright 2026 笑谈间气吐霓虹. All Rights Reserved."
                                                    onChange={(event) => onCopyrightPresetFieldChange("copyright", event.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">当前图片作者</p>
                                    <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 min-h-10">
                                        {selectedItem.editableCurrent.artist || "未读取到作者"}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">当前图片版权</p>
                                    <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 min-h-10 break-words">
                                        {selectedItem.editableCurrent.copyright || "未读取到版权声明"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        ) : (
            <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                <CardContent className="p-16 text-center text-slate-500 dark:text-slate-400">
                    请选择左侧图片开始查看
                </CardContent>
            </Card>
        )}
    </TabsContent>
);

export default ViewerTabContent;
