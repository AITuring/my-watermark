import { memo, useEffect, useState, type RefObject } from "react";
import {
    AlertCircle,
    Download,
    FileImage,
    Files,
    LocateFixed,
    PencilLine,
    RotateCcw,
    Save,
    Search,
    Trash2,
    Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import {
    DEFAULT_IMPORT_SCOPE_SELECTION,
    EDITABLE_FIELDS,
    IMPORT_SCOPE_DEFINITIONS,
    RENAME_RULE_DEFINITIONS,
} from "@/pages/photo-exif/constants";
import type {
    EditableExif,
    EditableExifKey,
    EditableGps,
    ImportScopeSelection,
    MapLoadState,
    PhotoExifItem,
    RenamePreviewRow,
    RenameRule,
    RenameRuleType,
} from "@/pages/photo-exif/types";
import {
    createImportScopeSelection,
    editableGpsToPoint,
    exifDateTimeToLocalInputValue,
    getEffectiveFileName,
    getFileBaseName,
    getFileExtension,
    getFileNameValidationError,
    isDirty,
} from "@/pages/photo-exif/utils";

interface BatchTabContentProps {
    items: PhotoExifItem[];
    renameRules: RenameRule[];
    renameRuleInputs: Record<RenameRuleType, string>;
    renameFilterKeyword: string;
    renamePreviewRows: RenamePreviewRow[];
    renameChangedCount: number;
    renameApplicableCount: number;
    renameBlockedCount: number;
    batchImportScopeSelection: ImportScopeSelection;
    batchImportSourceId: string;
    batchImportSourceOptions: PhotoExifItem[];
    batchImportTargetItems: PhotoExifItem[];
    batchImportWritableTargetItems: PhotoExifItem[];
    batchImportSourceItem: PhotoExifItem | null;
    batchOnlyMissing: boolean;
    onBatchOnlyMissingChange: (value: boolean) => void;
    batchOverwriteEmpty: boolean;
    batchEditable: EditableExif;
    batchGps: EditableGps;
    batchGpsSourceId: string;
    gpsSourceOptions: PhotoExifItem[];
    batchLocationSearchQuery: string;
    batchMapState: MapLoadState;
    isSearchingLocation: boolean;
    isExportingBatch: boolean;
    isOverwritingInPlace: boolean;
    secondaryButtonClass: string;
    primaryButtonClass: string;
    accentButtonClass: string;
    dangerButtonClass: string;
    dangerSubtleButtonClass: string;
    batchMapContainerRef: RefObject<HTMLDivElement | null>;
    onSetSelectedAsBatchImportSource: () => void;
    onBatchImportScopeSelectionChange: (selection: ImportScopeSelection) => void;
    onBatchImportSourceIdChange: (value: string) => void;
    onApplyBatchSourceImport: () => void;
    onApplyBatchSourceImportAndWrite: () => void;
    onRenameRuleInputChange: (type: RenameRuleType, value: string) => void;
    onSubmitRenameRule: (type: RenameRuleType) => void;
    onRemoveRenameRule: (ruleId: string) => void;
    onRenameFilterKeywordChange: (value: string) => void;
    onClearRenameRules: () => void;
    onApplyRenameRulesToWorkbench: () => void;
    onBatchOverwriteEmptyChange: (checked: boolean) => void;
    onBatchEditableFieldChange: (key: EditableExifKey, value: string) => void;
    onSyncBatchGpsFromSelected: () => void;
    onClearBatchGpsConfig: () => void;
    onBatchGpsSourceIdChange: (value: string) => void;
    onBatchLocationSearchQueryChange: (value: string) => void;
    onSearchBatchLocation: () => void;
    onBatchGpsFieldChange: (key: "lat" | "lng" | "locationName", value: string) => void;
    onApplyBatchChanges: () => void;
    onResetAllEditable: () => void;
    onExportBatch: () => void;
    onOverwriteBatchInPlace: () => void;
    onSelectItem: (itemId: string) => void;
    onItemFileNameChange: (itemId: string, value: string) => void;
    onItemDateTimeFieldChange: (itemId: string, key: "dateTimeOriginal" | "dateTimeDigitized", value: string) => void;
}

const OVERVIEW_AUTO_COLLAPSE_THRESHOLD = 8;

interface BatchItemOverviewBodyProps {
    items: PhotoExifItem[];
    secondaryButtonClass: string;
    onSelectItem: (itemId: string) => void;
    onItemFileNameChange: (itemId: string, value: string) => void;
    onItemDateTimeFieldChange: (itemId: string, key: "dateTimeOriginal" | "dateTimeDigitized", value: string) => void;
}

const BatchItemOverviewBody = memo(({
    items,
    secondaryButtonClass,
    onSelectItem,
    onItemFileNameChange,
    onItemDateTimeFieldChange,
}: BatchItemOverviewBodyProps) => (
    <ScrollArea className="h-[560px] pr-3">
        <div className="space-y-3">
            {items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2 min-w-0">
                            <p className="font-medium break-all">{getEffectiveFileName(item)}</p>
                            <div className="flex flex-wrap gap-2">
                                {isDirty(item) && (
                                    <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                                        已修改待处理
                                    </Badge>
                                )}
                                {item.gpsCurrent.locationName.trim() && <Badge variant="outline">GPS地址</Badge>}
                                {!item.gpsCurrent.locationName.trim() && editableGpsToPoint(item.gpsCurrent) && (
                                    <Badge variant="outline">含 GPS</Badge>
                                )}
                            </div>
                        </div>
                        <Button variant="outline" className={secondaryButtonClass} onClick={() => onSelectItem(item.id)}>
                            查看详情
                        </Button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4 text-sm">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">设备</p>
                            <p className="mt-1 break-words">{`${item.summary.make || "-"} ${item.summary.model || ""}`.trim() || "-"}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">拍摄时间</p>
                            <p className="mt-1 break-words">{item.summary.dateTimeOriginal || "-"}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">GPS</p>
                            <p className="mt-1 break-words">{item.summary.gps || "-"}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">GPS 地址</p>
                            <p className="mt-1 break-words">{item.gpsCurrent.locationName || "-"}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">原地改写</p>
                            <p className="mt-1 break-words">{item.fileHandle && item.canOverwriteInPlace ? "支持" : "不支持"}</p>
                        </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                        <div>
                            <p className="text-sm font-medium">逐张编辑</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                这里的文件名与时间修改会直接进入批量导出和批量原地写回
                            </p>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor={`batch-item-file-name-${item.id}`}>文件名</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id={`batch-item-file-name-${item.id}`}
                                        value={getFileBaseName(item.currentFileName)}
                                        placeholder="输入导出或写回时使用的文件名"
                                        disabled={!item.canWriteExif}
                                        onChange={(event) => onItemFileNameChange(item.id, event.target.value)}
                                    />
                                    {getFileExtension(item.currentFileName) && (
                                        <div className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
                                            {getFileExtension(item.currentFileName)}
                                        </div>
                                    )}
                                </div>
                                <p className={`text-xs ${getFileNameValidationError(getFileBaseName(item.currentFileName)) ? "text-rose-500" : "text-slate-500 dark:text-slate-400"}`}>
                                    {getFileNameValidationError(getFileBaseName(item.currentFileName)) || `原始文件名：${item.originalFileName}`}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`batch-item-date-time-original-${item.id}`}>拍摄时间</Label>
                                <Input
                                    id={`batch-item-date-time-original-${item.id}`}
                                    type="datetime-local"
                                    step="1"
                                    value={exifDateTimeToLocalInputValue(item.editableCurrent.dateTimeOriginal)}
                                    disabled={!item.canWriteExif}
                                    onChange={(event) => onItemDateTimeFieldChange(item.id, "dateTimeOriginal", event.target.value)}
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    写回 `DateTimeOriginal`
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`batch-item-date-time-digitized-${item.id}`}>数字化时间</Label>
                                <Input
                                    id={`batch-item-date-time-digitized-${item.id}`}
                                    type="datetime-local"
                                    step="1"
                                    value={exifDateTimeToLocalInputValue(item.editableCurrent.dateTimeDigitized)}
                                    disabled={!item.canWriteExif}
                                    onChange={(event) => onItemDateTimeFieldChange(item.id, "dateTimeDigitized", event.target.value)}
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    写回 `DateTimeDigitized`
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </ScrollArea>
));
BatchItemOverviewBody.displayName = "BatchItemOverviewBody";

const BatchTabContent = ({
    items,
    renameRules,
    renameRuleInputs,
    renameFilterKeyword,
    renamePreviewRows,
    renameChangedCount,
    renameApplicableCount,
    renameBlockedCount,
    batchImportScopeSelection,
    batchImportSourceId,
    batchImportSourceOptions,
    batchImportTargetItems,
    batchImportWritableTargetItems,
    batchImportSourceItem,
    batchOnlyMissing,
    onBatchOnlyMissingChange,
    batchOverwriteEmpty,
    batchEditable,
    batchGps,
    batchGpsSourceId,
    gpsSourceOptions,
    batchLocationSearchQuery,
    batchMapState,
    isSearchingLocation,
    isExportingBatch,
    isOverwritingInPlace,
    secondaryButtonClass,
    primaryButtonClass,
    accentButtonClass,
    dangerButtonClass,
    dangerSubtleButtonClass,
    batchMapContainerRef,
    onSetSelectedAsBatchImportSource,
    onBatchImportScopeSelectionChange,
    onBatchImportSourceIdChange,
    onApplyBatchSourceImport,
    onApplyBatchSourceImportAndWrite,
    onRenameRuleInputChange,
    onSubmitRenameRule,
    onRemoveRenameRule,
    onRenameFilterKeywordChange,
    onClearRenameRules,
    onApplyRenameRulesToWorkbench,
    onBatchOverwriteEmptyChange,
    onBatchEditableFieldChange,
    onSyncBatchGpsFromSelected,
    onClearBatchGpsConfig,
    onBatchGpsSourceIdChange,
    onBatchLocationSearchQueryChange,
    onSearchBatchLocation,
    onBatchGpsFieldChange,
    onApplyBatchChanges,
    onResetAllEditable,
    onExportBatch,
    onOverwriteBatchInPlace,
    onSelectItem,
    onItemFileNameChange,
    onItemDateTimeFieldChange,
}: BatchTabContentProps) => {
    const [isItemOverviewExpanded, setIsItemOverviewExpanded] = useState(items.length <= OVERVIEW_AUTO_COLLAPSE_THRESHOLD);

    useEffect(() => {
        if (items.length <= OVERVIEW_AUTO_COLLAPSE_THRESHOLD) {
            setIsItemOverviewExpanded(true);
        }
    }, [items.length]);

    const pendingCount = items.filter(isDirty).length;
    const pendingWritableCount = items.filter((item) => isDirty(item) && item.canOverwriteInPlace && item.fileHandle).length;
    return (
        <TabsContent value="batch" className="space-y-4">
        <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                    <PencilLine className="w-5 h-5" />
                    批量重命名
                </CardTitle>
                <CardDescription>
                    对已载入照片按文件名筛选，添加规则后检查预览；应用后点击下方“写回全部待保存照片”或“导出已修改图片”保存。
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
                <div className="grid gap-4 xl:grid-cols-3">
                    {RENAME_RULE_DEFINITIONS.map((definition) => (
                        <div key={definition.type} className="space-y-2">
                            <Label htmlFor={`rename-rule-${definition.type}`}>{definition.label}</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id={`rename-rule-${definition.type}`}
                                    value={renameRuleInputs[definition.type]}
                                    placeholder={definition.placeholder}
                                    onChange={(event) => onRenameRuleInputChange(definition.type, event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            onSubmitRenameRule(definition.type);
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={secondaryButtonClass}
                                    onClick={() => onSubmitRenameRule(definition.type)}
                                >
                                    添加
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium">当前规则</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                规则按添加顺序依次执行，适合先删前缀，再补统一前后缀
                            </p>
                        </div>
                        <Badge variant="outline">{renameRules.length} 条规则</Badge>
                    </div>
                    {renameRules.length ? (
                        <div className="flex flex-wrap gap-2">
                            {renameRules.map((rule) => (
                                <div
                                    key={rule.id}
                                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
                                >
                                    <span className="text-slate-500 dark:text-slate-400">
                                        {rule.type === "delete" ? "删除" : rule.type === "add_prefix" ? "前缀" : "后缀"}
                                    </span>
                                    <span className="font-medium break-all">{rule.value}</span>
                                    <button
                                        type="button"
                                        onClick={() => onRemoveRenameRule(rule.id)}
                                        className="text-slate-400 hover:text-rose-500"
                                        aria-label="删除改名规则"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            还没有规则，先输入要删除的内容或要追加的前后缀
                        </p>
                    )}
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="space-y-2">
                        <Label htmlFor="rename-filter-keyword">筛选范围</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="rename-filter-keyword"
                                value={renameFilterKeyword}
                                placeholder="只处理名称里包含这个关键词的图片；留空表示全部"
                                onChange={(event) => onRenameFilterKeywordChange(event.target.value)}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={secondaryButtonClass}
                                onClick={() => onRenameFilterKeywordChange("")}
                                disabled={!renameFilterKeyword}
                            >
                                <Search className="w-4 h-4 mr-2" />
                                清空
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            只对当前工作台里可导出修改的图片生效；TIF 也会使用这里的文件名预设
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300 space-y-1">
                        <p>匹配图片：{renamePreviewRows.length} 张</p>
                        <p>名称变化：{renameChangedCount} 张</p>
                        <p>可直接应用：{renameApplicableCount} 张</p>
                        <p>待处理冲突：{renameBlockedCount} 张</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-900/60">
                    <Button
                        type="button"
                        size="sm"
                        className={primaryButtonClass}
                        onClick={onApplyRenameRulesToWorkbench}
                        disabled={!renameRules.length || !renamePreviewRows.length}
                    >
                        <PencilLine className="w-4 h-4 mr-2" />
                        应用到当前工作台
                    </Button>
                    <Button type="button" variant="outline" size="sm" className={dangerSubtleButtonClass} onClick={onClearRenameRules}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        清空规则
                    </Button>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium">改名预览</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                真正落盘发生在后续“导出已修改图片”或“写回全部待保存照片”
                            </p>
                        </div>
                        <Badge variant="outline">{renamePreviewRows.length} 条结果</Badge>
                    </div>
                    {renamePreviewRows.length ? (
                        <ScrollArea className="h-[260px] pr-3">
                            <div className="space-y-3">
                                {renamePreviewRows.map((row) => (
                                    <div key={row.itemId} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1 space-y-2">
                                                <p className="text-xs text-slate-500 dark:text-slate-400 break-all">
                                                    原名：{row.originalName}
                                                </p>
                                                <p className={`text-sm font-medium break-all ${row.canApply ? "text-blue-600 dark:text-blue-300" : "text-slate-900 dark:text-slate-100"}`}>
                                                    目标：{row.nextName}
                                                </p>
                                            </div>
                                            <Badge
                                                className={
                                                    row.canApply
                                                        ? "bg-emerald-600 text-white hover:bg-emerald-600"
                                                        : row.duplicate || row.validationError
                                                            ? "bg-rose-600 text-white hover:bg-rose-600"
                                                            : "bg-slate-500 text-white hover:bg-slate-500"
                                                }
                                            >
                                                {row.canApply ? "可应用" : row.duplicate ? "名称重复" : row.validationError ? "名称非法" : "无变化"}
                                            </Badge>
                                        </div>
                                        {(row.validationError || row.duplicate) && (
                                            <p className="mt-2 text-xs text-rose-500">
                                                {row.validationError || "目标名称与其它图片重复，请调整规则或筛选范围"}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            当前没有可预览结果，先上传图片或调整筛选关键词
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
        <div className="flex items-center justify-between gap-4 rounded-2xl border p-4">
            <div>
                <Label htmlFor="batch-only-missing">只补充缺失信息</Label>
                <p className="text-sm text-slate-500">保留已有字段和 GPS，左侧默认仅显示缺相机、拍摄时间或 GPS 的照片；可在左侧切换筛选。</p>
            </div>
            <Switch id="batch-only-missing" checked={batchOnlyMissing} onCheckedChange={onBatchOnlyMissingChange} />
        </div>


                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-900/60">
                    <p className="w-full px-2 text-sm" role="status">{pendingCount ? `${pendingCount} 张待保存（${pendingWritableCount} 张可写回）。页面预览尚未写入原文件，待写回照片会保留在左侧。` : "没有待保存修改。先预览补齐结果，或直接补齐并写回。"}</p>
                    <Button variant="outline" size="sm" className={secondaryButtonClass} onClick={onExportBatch} disabled={isExportingBatch || isOverwritingInPlace || !pendingCount}>
                        <Download className="w-4 h-4 mr-2" />
                        {isExportingBatch ? "导出中..." : "导出已修改图片"}
                    </Button>
                    <Button className={dangerButtonClass} size="sm" onClick={onOverwriteBatchInPlace} disabled={isOverwritingInPlace || !pendingWritableCount}>
                        <Save className="w-4 h-4 mr-2" />
                        {isOverwritingInPlace ? "原地改写中..." : "写回全部待保存照片"}
                    </Button>
                </div>

        <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    批量来源图导入
                </CardTitle>
                <CardDescription>
                    选择来源图和信息范围，只处理左侧当前筛选出的照片；已有信息按“只补充缺失信息”设置保留。
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className={secondaryButtonClass} onClick={onSetSelectedAsBatchImportSource}>
                        从当前图片设为来源图
                    </Button>
                    <Button
                        variant="outline"
                        className={secondaryButtonClass}
                        onClick={() => onBatchImportScopeSelectionChange(createImportScopeSelection(["gps"]))}
                    >
                        只导入GPS
                    </Button>
                    <Button
                        variant="outline"
                        className={secondaryButtonClass}
                        onClick={() => onBatchImportScopeSelectionChange(createImportScopeSelection(["time"]))}
                    >
                        只导入时间
                    </Button>
                    <Button
                        variant="outline"
                        className={secondaryButtonClass}
                        onClick={() => onBatchImportScopeSelectionChange(DEFAULT_IMPORT_SCOPE_SELECTION)}
                    >
                        恢复默认勾选
                    </Button>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="space-y-2">
                        <Label htmlFor="batch-import-source">来源图片</Label>
                        <select
                            id="batch-import-source"
                            title="选择批量来源图片"
                            aria-label="选择批量来源图片"
                            value={batchImportSourceId}
                            onChange={(event) => onBatchImportSourceIdChange(event.target.value)}
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm ring-offset-background dark:border-slate-800"
                        >
                            <option value="">{batchImportSourceOptions.length ? "请选择来源图片" : "没有包含所选信息的来源图片"}</option>
                            {batchImportSourceOptions.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {getEffectiveFileName(item)}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500">仅列出含有所勾选信息的照片（{batchImportSourceOptions.length} 张）</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300 space-y-1">
                        <p>当前筛选目标：{batchImportTargetItems.length} 张</p>
                        <p>可原地写回：{batchImportWritableTargetItems.length} 张</p>
                        <p>当前来源图：{batchImportSourceItem ? getEffectiveFileName(batchImportSourceItem) : "未选择"}</p>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {IMPORT_SCOPE_DEFINITIONS.map((scope) => (
                        <label
                            key={`batch-scope-${scope.key}`}
                            className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${
                                batchImportScopeSelection[scope.key]
                                    ? "border-blue-500 bg-blue-50/70 dark:border-blue-500/70 dark:bg-blue-950/20"
                                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                            }`}
                        >
                            <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                checked={batchImportScopeSelection[scope.key]}
                                onChange={(event) =>
                                    onBatchImportScopeSelectionChange({
                                        ...batchImportScopeSelection,
                                        [scope.key]: event.target.checked,
                                    })
                                }
                            />
                            <div className="min-w-0 space-y-1">
                                <p className="text-sm font-medium">{scope.label}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{scope.description}</p>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-900/60">
                    <Button variant="outline" className={secondaryButtonClass} size="sm" onClick={onApplyBatchSourceImport} disabled={isOverwritingInPlace || !batchImportSourceItem || !batchImportTargetItems.length}>
                        预览补齐（不改原文件）
                    </Button>
                    <Button className={accentButtonClass} size="sm" onClick={onApplyBatchSourceImportAndWrite} disabled={isOverwritingInPlace || !batchImportSourceItem || !batchImportTargetItems.length}>
                        {isOverwritingInPlace ? "写回中…" : "补齐并写回原文件"}
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Files className="w-5 h-5" />
                    批量统一修改
                </CardTitle>
                <CardDescription>
                    默认只补充照片中缺失的字段；关闭“只补充缺失信息”后可统一覆盖已有值
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="space-y-1">
                        <p className="text-sm font-medium">空值也覆盖</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            需先关闭“只补充缺失信息”；打开后，未填写的字段及 GPS 会清空
                        </p>
                    </div>
                    <Switch disabled={batchOnlyMissing} checked={!batchOnlyMissing && batchOverwriteEmpty} onCheckedChange={onBatchOverwriteEmptyChange} />
                </div>

                <details><summary className="cursor-pointer text-sm font-medium">填写相机、镜头与拍摄参数</summary><div className="pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    {EDITABLE_FIELDS.map((field) => (
                        <div key={field.key} className="space-y-2">
                            <Label htmlFor={`batch-${field.key}`}>{field.label}</Label>
                            <Input
                                id={`batch-${field.key}`}
                                type={field.key === "dateTimeOriginal" || field.key === "dateTimeDigitized" ? "datetime-local" : undefined}
                                step={field.key === "dateTimeOriginal" || field.key === "dateTimeDigitized" ? "1" : undefined}
                                value={
                                    field.key === "dateTimeOriginal" || field.key === "dateTimeDigitized"
                                        ? exifDateTimeToLocalInputValue(batchEditable[field.key])
                                        : batchEditable[field.key]
                                }
                                placeholder={field.key === "dateTimeOriginal" || field.key === "dateTimeDigitized" ? undefined : field.placeholder}
                                onChange={(event) => onBatchEditableFieldChange(field.key, event.target.value)}
                            />
                            {(field.key === "dateTimeOriginal" || field.key === "dateTimeDigitized") && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    自动转换为 EXIF 时间格式后批量应用
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                </div></details>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-base font-semibold flex items-center gap-2">
                                <LocateFixed className="w-4 h-4" />
                                批量 GPS 处理
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                可手动统一设置 GPS，或从一张已有定位的照片同步到当前筛选照片
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className={secondaryButtonClass} onClick={onSyncBatchGpsFromSelected}>
                                从当前图片同步
                            </Button>
                            <Button variant="outline" className={dangerSubtleButtonClass} onClick={onClearBatchGpsConfig}>
                                清空 GPS 配置
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="batch-gps-source">同步来源照片</Label>
                        <select
                            id="batch-gps-source"
                            title="选择批量 GPS 同步来源照片"
                            aria-label="选择批量 GPS 同步来源照片"
                            value={batchGpsSourceId}
                            onChange={(event) => onBatchGpsSourceIdChange(event.target.value)}
                            className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2 text-sm ring-offset-background"
                        >
                            <option value="">不使用同步来源，改为手动填写 GPS</option>
                            {gpsSourceOptions.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {getEffectiveFileName(item)}{item.gpsCurrent.locationName.trim() ? ` - ${item.gpsCurrent.locationName}` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                        <div>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Input
                                    value={batchLocationSearchQuery}
                                    placeholder="搜索批量地点，例如 上海外滩 / 故宫博物院"
                                    disabled={isSearchingLocation}
                                    onChange={(event) => onBatchLocationSearchQueryChange(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            onSearchBatchLocation();
                                        }
                                    }}
                                />
                                <Button
                                    className={primaryButtonClass}
                                    onClick={onSearchBatchLocation}
                                    disabled={isSearchingLocation}
                                >
                                    <Search className="w-4 h-4 mr-2" />
                                    {isSearchingLocation ? "搜索中..." : "搜索地点"}
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 lg:justify-end">
                            {batchGps.locationName || "未设置地点名称"}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="batch-gps-lat">批量纬度</Label>
                            <Input
                                id="batch-gps-lat"
                                value={batchGps.lat}
                                placeholder="例如 31.230416"
                                onChange={(event) => onBatchGpsFieldChange("lat", event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="batch-gps-lng">批量经度</Label>
                            <Input
                                id="batch-gps-lng"
                                value={batchGps.lng}
                                placeholder="例如 121.473701"
                                onChange={(event) => onBatchGpsFieldChange("lng", event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="batch-gps-location">地点名称</Label>
                            <Input
                                id="batch-gps-location"
                                value={batchGps.locationName}
                                placeholder="例如 上海外滩"
                                onChange={(event) => onBatchGpsFieldChange("locationName", event.target.value)}
                            />
                        </div>
                    </div>

                    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div ref={batchMapContainerRef} className="h-[280px] w-full bg-slate-100 dark:bg-slate-900" />
                    </div>
                    {batchMapState.loading && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">批量地图加载中...</p>
                    )}
                    {batchMapState.error && (
                        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            {batchMapState.error}
                        </div>
                    )}

                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <p>1. 选了“同步来源照片”后，批量应用时会优先使用该照片的 GPS。</p>
                        <p>2. 未选来源时，可手动填写、搜索地点，或直接点击地图和拖拽标记设置 GPS。</p>
                        <p>3. 打开“空值也覆盖”且 GPS 配置为空时，关闭“只补充缺失信息”后，会清除当前筛选照片的 GPS。</p>
                    </div>
                </div>


                <div className="flex flex-wrap gap-2">                    <Button onClick={onApplyBatchChanges} size="sm" className={primaryButtonClass}>
                        <PencilLine className="w-4 h-4 mr-2" />
                        预览填写内容（不改原文件）
                    </Button>
                    <Button variant="outline" size="sm" className={dangerSubtleButtonClass} onClick={onResetAllEditable}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        恢复全部修改
                    </Button>
</div>
            </CardContent>
        </Card>

            <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
            <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <FileImage className="w-5 h-5" />
                                批量逐张编辑与概览
                            </CardTitle>
                            <CardDescription>
                                支持逐张调整文件名和时间，并快速查看哪些图片可导出、可原地改写或包含位置信息
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline">{items.length} 张</Badge>
                            {items.length > OVERVIEW_AUTO_COLLAPSE_THRESHOLD && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={secondaryButtonClass}
                                    onClick={() => setIsItemOverviewExpanded((previous) => !previous)}
                                >
                                    {isItemOverviewExpanded ? "收起列表" : "展开列表"}
                                </Button>
                            )}
                        </div>
                    </div>
            </CardHeader>
            <CardContent className="pt-0">
                    {isItemOverviewExpanded ? (
                        <BatchItemOverviewBody
                            items={items}
                            secondaryButtonClass={secondaryButtonClass}
                            onSelectItem={onSelectItem}
                            onItemFileNameChange={onItemFileNameChange}
                            onItemDateTimeFieldChange={onItemDateTimeFieldChange}
                        />
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-400 space-y-2">
                            <p>当前工作台共有 {items.length} 张图片。</p>
                            <p>为避免批量改名时整页重复渲染，这里的逐张编辑列表在较多图片时默认折叠，按需展开即可。</p>
                        </div>
                    )}
            </CardContent>
        </Card>

        </TabsContent>
    );
};

export default BatchTabContent;
