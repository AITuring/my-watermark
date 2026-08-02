import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_IMPORT_SCOPE_SELECTION, EMPTY_EDITABLE, EMPTY_GPS } from "@/pages/photo-exif/constants";
import { applyBatchChangesToItems, applyCopyrightPresetToItems, applyRenamePreviewRowsToItems, resetItemsToOriginal } from "@/pages/photo-exif/actions/item-actions";
import { usePhotoExifMap, reverseGeocodePointWithAmap, searchLocationPointWithAmap } from "@/pages/photo-exif/hooks/usePhotoExifMap";
import { buildExportPayload, overwriteItemsInPlace } from "@/pages/photo-exif/services/file-operations";
import type {
    CopyrightPreset,
    EditableExif,
    EditableExifKey,
    EditableGps,
    FileSystemDirectoryHandle,
    GpsPoint,
    ImportScopeSelection,
    PhotoExifItem,
    RenamePreviewRow,
    RenameRule,
    RenameRuleType,
} from "@/pages/photo-exif/types";
import {
    applyRenameRulesToFileName,
    applySourceMetadataToItem,
    cloneEditableGps,
    editableGpsToPoint,
    formatGpsValue,
    getEffectiveFileName,
    getFileBaseName,
    getFileNameValidationError,
    isDirty,
    localInputValueToExifDateTime,
} from "@/pages/photo-exif/utils";
import { loadSaveAs } from "@/utils/lazy-deps";

interface UsePhotoExifBatchFlowOptions {
    items: PhotoExifItem[];
    setItems: React.Dispatch<React.SetStateAction<PhotoExifItem[]>>;
    selectedItem: PhotoExifItem | null;
    setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
    directoryHandle: FileSystemDirectoryHandle | null;
    copyrightPreset: CopyrightPreset;
    copyrightPresetEnabled: boolean;
    updateItemFileName: (itemId: string, value: string) => void;
    updateItemDateTimeField: (itemId: string, key: "dateTimeOriginal" | "dateTimeDigitized", value: string) => void;
}

export const usePhotoExifBatchFlow = ({
    items,
    setItems,
    selectedItem,
    setSelectedId,
    directoryHandle,
    copyrightPreset,
    copyrightPresetEnabled,
    updateItemFileName,
    updateItemDateTimeField,
}: UsePhotoExifBatchFlowOptions) => {
    const [batchImportSourceId, setBatchImportSourceId] = useState("");
    const [batchEditable, setBatchEditable] = useState<EditableExif>(EMPTY_EDITABLE);
    const [batchGps, setBatchGps] = useState<EditableGps>(EMPTY_GPS);
    const [batchGpsSourceId, setBatchGpsSourceId] = useState("");
    const [renameRules, setRenameRules] = useState<RenameRule[]>([]);
    const [renameRuleInputs, setRenameRuleInputs] = useState<Record<RenameRuleType, string>>({
        delete: "",
        add_prefix: "",
        add_suffix: "",
    });
    const [renameFilterKeyword, setRenameFilterKeyword] = useState("");
    const [batchOverwriteEmpty, setBatchOverwriteEmpty] = useState(false);
    const [batchImportScopeSelection, setBatchImportScopeSelection] = useState<ImportScopeSelection>(DEFAULT_IMPORT_SCOPE_SELECTION);
    const [batchLocationSearchQuery, setBatchLocationSearchQuery] = useState("");
    const [isExportingBatch, setIsExportingBatch] = useState(false);
    const [isOverwritingInPlace, setIsOverwritingInPlace] = useState(false);
    const [isSearchingLocation, setIsSearchingLocation] = useState(false);

    useEffect(() => {
        setBatchLocationSearchQuery(batchGps.locationName);
    }, [batchGps.locationName]);

    const persistenceContext = useMemo(
        () => ({ copyrightPreset, copyrightPresetEnabled }),
        [copyrightPreset, copyrightPresetEnabled],
    );

    const gpsSourceOptions = useMemo(
        () => items.filter((item) => editableGpsToPoint(item.gpsCurrent)),
        [items],
    );
    const batchImportSourceOptions = useMemo(() => items, [items]);
    const batchImportSourceItem = useMemo(
        () => items.find((item) => item.id === batchImportSourceId) ?? null,
        [items, batchImportSourceId],
    );
    const batchImportTargetItems = useMemo(
        () => items.filter((item) => item.canWriteExif && item.id !== batchImportSourceId),
        [items, batchImportSourceId],
    );
    const batchImportWritableTargetItems = useMemo(
        () => batchImportTargetItems.filter((item) => item.canOverwriteInPlace && item.fileHandle),
        [batchImportTargetItems],
    );

    const renamePreviewRows = useMemo<RenamePreviewRow[]>(() => {
        const normalizedKeyword = renameFilterKeyword.trim().toLowerCase();
        const rows = items
            .filter((item) => item.canWriteExif)
            .filter((item) => !normalizedKeyword || getEffectiveFileName(item).toLowerCase().includes(normalizedKeyword))
            .map((item) => {
                const originalName = getEffectiveFileName(item);
                const nextName = applyRenameRulesToFileName(originalName, renameRules);
                return {
                    itemId: item.id,
                    originalName,
                    nextName,
                    changed: originalName !== nextName,
                    validationError: getFileNameValidationError(getFileBaseName(nextName)),
                };
            });
        const nextNameCounts = rows.reduce<Map<string, number>>((map, row) => {
            if (!row.changed || row.validationError) return map;
            const key = row.nextName.toLowerCase();
            map.set(key, (map.get(key) ?? 0) + 1);
            return map;
        }, new Map());

        return rows.map((row) => {
            const duplicate = row.changed && !row.validationError && (nextNameCounts.get(row.nextName.toLowerCase()) ?? 0) > 1;
            return {
                ...row,
                duplicate,
                canApply: row.changed && !row.validationError && !duplicate,
            };
        });
    }, [items, renameFilterKeyword, renameRules]);
    const renameChangedCount = useMemo(() => renamePreviewRows.filter((row) => row.changed).length, [renamePreviewRows]);
    const renameApplicableCount = useMemo(() => renamePreviewRows.filter((row) => row.canApply).length, [renamePreviewRows]);
    const renameBlockedCount = useMemo(() => renamePreviewRows.filter((row) => row.changed && !row.canApply).length, [renamePreviewRows]);

    const applyBatchGpsPoint = useCallback(async (point: GpsPoint, resolveAddress = false) => {
        let locationName = batchGps.locationName;
        if (resolveAddress) {
            try {
                const resolved = await reverseGeocodePointWithAmap(point);
                if (resolved) {
                    locationName = resolved;
                    setBatchLocationSearchQuery(resolved);
                }
            } catch (error) {
                console.error(error);
            }
        }

        setBatchGpsSourceId("");
        setBatchGps({
            enabled: true,
            lat: formatGpsValue(point.lat),
            lng: formatGpsValue(point.lng),
            locationName,
        });
    }, [batchGps.locationName]);

    const batchGpsPoint = useMemo(
        () => editableGpsToPoint(batchGps),
        [batchGps],
    );
    const { containerRef: batchMapContainerRef, mapState: batchMapState } = usePhotoExifMap({
        point: batchGpsPoint,
        title: batchGps.locationName || "批量 GPS 位置",
        draggable: true,
        errorMessage: "批量地图加载失败，请稍后重试",
        onPointSelect: (point) => {
            void applyBatchGpsPoint(point, true);
        },
    });

    const clearAllBatchState = useCallback(() => {
        setBatchImportSourceId("");
        setBatchEditable(EMPTY_EDITABLE);
        setBatchGps(EMPTY_GPS);
        setBatchGpsSourceId("");
        setRenameRules([]);
        setRenameRuleInputs({ delete: "", add_prefix: "", add_suffix: "" });
        setRenameFilterKeyword("");
        setBatchImportScopeSelection(DEFAULT_IMPORT_SCOPE_SELECTION);
        setBatchLocationSearchQuery("");
    }, []);

    const setSelectedAsBatchImportSource = useCallback(() => {
        if (!selectedItem) {
            toast.error("请先在左侧选择一张图片");
            return;
        }
        setBatchImportSourceId(selectedItem.id);
        toast.success("已将当前图片设为批量来源图");
    }, [selectedItem]);

    const applyCopyrightPresetToAll = useCallback(() => {
        if (!copyrightPresetEnabled) {
            toast.error("请先打开默认应用开关");
            return;
        }
        const { nextItems, affected } = applyCopyrightPresetToItems(items, copyrightPreset);
        setItems(nextItems);
        toast.success(`已将默认版权应用到 ${affected} 张可导出图片`);
    }, [copyrightPreset, copyrightPresetEnabled, items, setItems]);

    const applyBatchChanges = useCallback(() => {
        const sourceGps = batchGpsSourceId ? items.find((item) => item.id === batchGpsSourceId)?.gpsCurrent ?? null : null;
        const result = applyBatchChangesToItems(items, batchEditable, batchGps, batchOverwriteEmpty, sourceGps);
        if (result.hasGpsValidationError) {
            toast.error("请填写有效的批量 GPS 经纬度，或选择一张带 GPS 的照片同步");
            return;
        }
        if (result.hasNoChanges) {
            toast.error("请至少填写一个批量修改字段，或配置 GPS 批量处理");
            return;
        }
        setItems(result.nextItems);
        toast.success(`已把批量修改应用到 ${result.affected} 张可导出图片`);
    }, [batchEditable, batchGps, batchGpsSourceId, batchOverwriteEmpty, items, setItems]);

    const resetAllEditable = useCallback(() => {
        setItems((previous) => resetItemsToOriginal(previous));
        toast.success("已恢复全部图片的原始可编辑字段");
    }, [setItems]);

    const updateBatchEditableField = useCallback((key: EditableExifKey, value: string) => {
        setBatchEditable((previous) => ({
            ...previous,
            [key]: key === "dateTimeOriginal" || key === "dateTimeDigitized" ? localInputValueToExifDateTime(value) : value,
        }));
    }, []);

    const updateRenameRuleInput = useCallback((type: RenameRuleType, value: string) => {
        setRenameRuleInputs((previous) => ({ ...previous, [type]: value }));
    }, []);

    const submitRenameRule = useCallback((type: RenameRuleType) => {
        const nextValue = renameRuleInputs[type].trim();
        if (!nextValue) return;
        setRenameRules((previous) => [...previous, { id: Math.random().toString(36).slice(2, 11), type, value: nextValue }]);
        setRenameRuleInputs((previous) => ({ ...previous, [type]: "" }));
    }, [renameRuleInputs]);

    const removeRenameRule = useCallback((ruleId: string) => {
        setRenameRules((previous) => previous.filter((rule) => rule.id !== ruleId));
    }, []);

    const clearRenameRules = useCallback(() => {
        setRenameRules([]);
        setRenameRuleInputs({ delete: "", add_prefix: "", add_suffix: "" });
        setRenameFilterKeyword("");
        toast.success("已清空批量改名规则");
    }, []);

    const applyRenameRulesToWorkbench = useCallback(() => {
        if (!renameRules.length) {
            toast.error("请先添加至少一条改名规则");
            return;
        }
        if (!renamePreviewRows.length) {
            toast.error("没有匹配到可改名的图片");
            return;
        }

        const { nextItems, affected, blocked } = applyRenamePreviewRowsToItems(items, renamePreviewRows);
        setItems(nextItems);
        if (affected > 0) toast.success(`已更新 ${affected} 张图片的文件名`);
        if (blocked > 0) toast.error(`${blocked} 张图片因名称重复或非法被跳过`);
    }, [items, renamePreviewRows, renameRules.length, setItems]);

    const updateBatchGpsField = useCallback((key: "lat" | "lng" | "locationName", value: string) => {
        setBatchGps((previous) => ({
            ...previous,
            enabled: key === "locationName" ? previous.enabled : true,
            [key]: value,
        }));
        if (batchGpsSourceId) {
            setBatchGpsSourceId("");
        }
    }, [batchGpsSourceId]);

    const syncBatchGpsFromSelected = useCallback(() => {
        if (!selectedItem) {
            toast.error("请先在左侧选择一张图片");
            return;
        }
        const sourcePoint = editableGpsToPoint(selectedItem.gpsCurrent);
        if (!sourcePoint) {
            toast.error("当前选中图片没有可同步的 GPS 信息");
            return;
        }
        setBatchGpsSourceId(selectedItem.id);
        setBatchGps(cloneEditableGps(selectedItem.gpsCurrent));
        toast.success("已选择当前图片作为批量 GPS 同步来源");
    }, [selectedItem]);

    const clearBatchGpsConfig = useCallback(() => {
        setBatchGps({ ...EMPTY_GPS });
        setBatchGpsSourceId("");
        setBatchLocationSearchQuery("");
        toast.success("已清空批量 GPS 配置");
    }, []);

    const applyBatchSourceImport = useCallback(async (persistInPlace = false) => {
        if (!batchImportSourceId) {
            toast.error("请先选择一张批量来源图");
            return;
        }
        if (!Object.values(batchImportScopeSelection).some(Boolean)) {
            toast.error("请至少选择一类要导入的信息");
            return;
        }
        const sourceItem = items.find((item) => item.id === batchImportSourceId);
        if (!sourceItem) {
            toast.error("批量来源图不存在，请重新选择");
            return;
        }
        if (!batchImportTargetItems.length) {
            toast.error("没有可导入的目标图片");
            return;
        }

        const stagedItems = batchImportTargetItems.map((item) => applySourceMetadataToItem(item, sourceItem, batchImportScopeSelection));
        const stagedItemsMap = new Map(stagedItems.map((item) => [item.id, item]));

        if (!persistInPlace) {
            setItems((previous) => previous.map((item) => stagedItemsMap.get(item.id) ?? item));
            toast.success(`已将来源图信息导入到 ${stagedItems.length} 张图片`);
            return;
        }

        const writableItems = stagedItems.filter((item) => item.canOverwriteInPlace && item.fileHandle);
        if (!writableItems.length) {
            toast.error("当前没有已授权原文件的目标 JPEG / PNG，无法批量原地写回");
            return;
        }

        setIsOverwritingInPlace(true);
        try {
            const refreshedItems = await overwriteItemsInPlace(writableItems, {
                directoryHandle,
                ...persistenceContext,
            });
            setItems((previous) => previous.map((item) => refreshedItems.get(item.id) ?? item));
            toast.success(`已导入来源图信息并原地写回 ${refreshedItems.size} 张 JPEG / PNG`);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "批量导入并写回失败，请重试");
        } finally {
            setIsOverwritingInPlace(false);
        }
    }, [batchImportScopeSelection, batchImportSourceId, batchImportTargetItems, directoryHandle, items, persistenceContext, setItems]);

    const searchBatchLocation = useCallback(async () => {
        const keyword = batchLocationSearchQuery.trim();
        if (!keyword) {
            toast.error("请输入批量 GPS 的地点名称");
            return;
        }

        setIsSearchingLocation(true);
        try {
            const point = await searchLocationPointWithAmap(keyword);
            if (!point) {
                toast.error("未找到该地点，请尝试更精确的名称");
                return;
            }

            setBatchGpsSourceId("");
            setBatchGps({
                enabled: true,
                lat: formatGpsValue(point.point.lat),
                lng: formatGpsValue(point.point.lng),
                locationName: point.title,
            });
            setBatchLocationSearchQuery(point.title);
            toast.success("已根据地点名称更新批量 GPS 坐标");
        } catch (error) {
            console.error(error);
            toast.error("批量地点搜索失败，请稍后重试");
        } finally {
            setIsSearchingLocation(false);
        }
    }, [batchLocationSearchQuery]);

    const exportBatch = useCallback(async () => {
        const writableDirtyItems = items.filter((item) => item.canWriteExif && isDirty(item));
        if (!writableDirtyItems.length) {
            toast.error("没有可导出的已修改图片");
            return;
        }

        setIsExportingBatch(true);
        try {
            const payload = await buildExportPayload(writableDirtyItems, persistenceContext);
            const saveAs = await loadSaveAs();
            saveAs(payload.data, payload.fileName);
            toast.success(`已导出 ${writableDirtyItems.length} 张修改后的图片`);
        } catch (error) {
            console.error(error);
            toast.error("批量导出失败，请重试");
        } finally {
            setIsExportingBatch(false);
        }
    }, [items, persistenceContext]);

    const overwriteBatchInPlace = useCallback(async () => {
        const writableDirtyItems = items.filter((item) => item.canOverwriteInPlace && item.fileHandle && isDirty(item));
        if (!writableDirtyItems.length) {
            toast.error("没有可原地改写的已修改 JPEG / PNG，请先从文件夹载入图片");
            return;
        }

        setIsOverwritingInPlace(true);
        try {
            const refreshedItems = await overwriteItemsInPlace(writableDirtyItems, {
                directoryHandle,
                ...persistenceContext,
            });
            setItems((previous) => previous.map((item) => refreshedItems.get(item.id) ?? item));
            toast.success(`已原地改写 ${refreshedItems.size} 张 JPEG / PNG 图片的 EXIF`);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "原地改写失败，请重试");
        } finally {
            setIsOverwritingInPlace(false);
        }
    }, [directoryHandle, items, persistenceContext, setItems]);

    const clearAllBatchEffects = useCallback(() => {
        clearAllBatchState();
    }, [clearAllBatchState]);

    return {
        batchImportSourceId,
        batchImportSourceItem,
        batchEditable,
        batchGps,
        batchGpsSourceId,
        renameRules,
        renameRuleInputs,
        renameFilterKeyword,
        batchOverwriteEmpty,
        batchImportScopeSelection,
        batchLocationSearchQuery,
        isExportingBatch,
        isOverwritingInPlace,
        isSearchingLocation,
        gpsSourceOptions,
        batchImportSourceOptions,
        batchImportTargetItems,
        batchImportWritableTargetItems,
        renamePreviewRows,
        renameChangedCount,
        renameApplicableCount,
        renameBlockedCount,
        batchMapContainerRef,
        batchMapState,
        setBatchImportSourceId,
        setBatchGpsSourceId,
        setBatchImportScopeSelection,
        setBatchOverwriteEmpty,
        setRenameFilterKeyword,
        setBatchLocationSearchQuery,
        setBatchGps,
        clearAllBatchEffects,
        setSelectedAsBatchImportSource,
        applyCopyrightPresetToAll,
        applyBatchChanges,
        resetAllEditable,
        updateBatchEditableField,
        updateRenameRuleInput,
        submitRenameRule,
        removeRenameRule,
        clearRenameRules,
        applyRenameRulesToWorkbench,
        updateBatchGpsField,
        syncBatchGpsFromSelected,
        clearBatchGpsConfig,
        applyBatchSourceImport,
        searchBatchLocation,
        exportBatch,
        overwriteBatchInPlace,
        onSelectItem: setSelectedId,
        onItemFileNameChange: updateItemFileName,
        onItemDateTimeFieldChange: updateItemDateTimeField,
    };
};
