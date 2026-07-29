import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
    COPYRIGHT_PRESET_ENABLED_STORAGE_KEY,
    COPYRIGHT_PRESET_STORAGE_KEY,
    EMPTY_GPS,
} from "@/pages/photo-exif/constants";
import { usePhotoExifMap, reverseGeocodePointWithAmap, searchLocationPointWithAmap } from "@/pages/photo-exif/hooks/usePhotoExifMap";
import { usePhotoExifImportFlow } from "@/pages/photo-exif/hooks/usePhotoExifImportFlow";
import { usePhotoExifBatchFlow } from "@/pages/photo-exif/hooks/usePhotoExifBatchFlow";
import { usePhotoExifSelection } from "@/pages/photo-exif/hooks/usePhotoExifSelection";
import { buildExportPayload, overwriteItemsInPlace } from "@/pages/photo-exif/services/file-operations";
import type { CopyrightPreset, GpsPoint, PhotoExifItem } from "@/pages/photo-exif/types";
import {
    editableGpsToPoint,
    formatGpsValue,
    isDirty,
    readStoredCopyrightPreset,
    readStoredCopyrightPresetEnabled,
} from "@/pages/photo-exif/utils";
import { loadSaveAs } from "@/utils/lazy-deps";

export const usePhotoExifWorkbench = () => {
    const [items, setItems] = useState<PhotoExifItem[]>([]);
    const [isCopyrightPresetExpanded, setIsCopyrightPresetExpanded] = useState(false);
    const [copyrightPreset, setCopyrightPreset] = useState<CopyrightPreset>(() => readStoredCopyrightPreset());
    const [copyrightPresetEnabled, setCopyrightPresetEnabled] = useState<boolean>(() => readStoredCopyrightPresetEnabled());
    const [isExportingSingle, setIsExportingSingle] = useState(false);
    const [isSearchingLocation, setIsSearchingLocation] = useState(false);
    const itemsRef = useRef<PhotoExifItem[]>([]);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    useEffect(() => {
        window.localStorage.setItem(COPYRIGHT_PRESET_STORAGE_KEY, JSON.stringify(copyrightPreset));
    }, [copyrightPreset]);

    useEffect(() => {
        window.localStorage.setItem(COPYRIGHT_PRESET_ENABLED_STORAGE_KEY, String(copyrightPresetEnabled));
    }, [copyrightPresetEnabled]);

    useEffect(() => () => {
        itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    }, []);

    const selection = usePhotoExifSelection({ items, setItems });

    const handleImportedSelection = useCallback((itemIds: string[], activeItemId: string | null) => {
        if (!activeItemId && itemIds.length) {
            selection.setSelectedId(itemIds[0]);
        }
    }, [selection]);

    const importFlow = usePhotoExifImportFlow({
        items,
        setItems,
        selectedItem: selection.selectedItem,
        selectedItemRef: selection.selectedItemRef,
        selectedImportSourceId: selection.selectedImportSourceId,
        selectedImportSourceItem: selection.selectedImportSourceItem,
        copyrightPreset,
        copyrightPresetEnabled,
        onItemsImported: handleImportedSelection,
    });

    const batchFlow = usePhotoExifBatchFlow({
        items,
        setItems,
        selectedItem: selection.selectedItem,
        setSelectedId: selection.setSelectedId,
        directoryHandle: importFlow.directoryHandle,
        copyrightPreset,
        copyrightPresetEnabled,
        updateItemFileName: selection.updateItemFileName,
        updateItemDateTimeField: selection.updateItemDateTimeField,
    });

    const writableCount = useMemo(() => items.filter((item) => item.canWriteExif).length, [items]);
    const dirtyCount = useMemo(() => items.filter((item) => item.canWriteExif && isDirty(item)).length, [items]);
    const gpsCount = useMemo(() => items.filter((item) => editableGpsToPoint(item.gpsCurrent)).length, [items]);
    const linkedCount = useMemo(() => items.filter((item) => item.fileHandle).length, [items]);
    const bindableCount = useMemo(() => items.filter((item) => item.canOverwriteInPlace && !item.fileHandle).length, [items]);
    const inplaceCount = useMemo(
        () => items.filter((item) => item.canOverwriteInPlace && item.fileHandle && isDirty(item)).length,
        [items],
    );

    const persistenceContext = useMemo(
        () => ({ copyrightPreset, copyrightPresetEnabled }),
        [copyrightPreset, copyrightPresetEnabled],
    );

    const applySelectedGpsPoint = useCallback(async (point: GpsPoint, resolveAddress = false) => {
        const activeItem = selection.selectedItemRef.current;
        if (!activeItem || !activeItem.canWriteExif) return;

        let locationName = activeItem.gpsCurrent.locationName;
        if (resolveAddress) {
            try {
                const resolved = await reverseGeocodePointWithAmap(point);
                if (resolved) {
                    locationName = resolved;
                    selection.setLocationSearchQuery(resolved);
                }
            } catch (error) {
                console.error(error);
            }
        }

        selection.updateItemGps(activeItem.id, () => ({
            enabled: true,
            lat: formatGpsValue(point.lat),
            lng: formatGpsValue(point.lng),
            locationName,
        }));
    }, [selection]);

    const { containerRef: mapContainerRef, mapState } = usePhotoExifMap({
        point: selection.selectedGpsPoint,
        title: selection.selectedItem?.file.name ?? "拍摄位置",
        draggable: Boolean(selection.selectedItem?.canWriteExif),
        errorMessage: "地图加载失败，请稍后重试",
        onPointSelect: (point) => {
            void applySelectedGpsPoint(point, true);
        },
    });

    const updateCopyrightPresetField = useCallback((key: keyof CopyrightPreset, value: string) => {
        setCopyrightPreset((previous) => ({ ...previous, [key]: value }));
    }, []);

    const clearSelectedGps = useCallback(() => {
        if (!selection.selectedItem) return;
        selection.updateItemGps(selection.selectedItem.id, () => ({ ...EMPTY_GPS }));
        selection.setLocationSearchQuery("");
        toast.success("已清除当前图片的 GPS 信息");
    }, [selection]);

    const searchSelectedLocation = useCallback(async () => {
        const keyword = selection.locationSearchQuery.trim();
        const activeItem = selection.selectedItemRef.current;
        if (!activeItem) {
            toast.error("请先选择图片");
            return;
        }
        if (!activeItem.canWriteExif) {
            toast.error("当前图片格式暂不支持编辑后导出元数据");
            return;
        }
        if (!keyword) {
            toast.error("请输入地点名称");
            return;
        }

        setIsSearchingLocation(true);
        try {
            const point = await searchLocationPointWithAmap(keyword);
            if (!point) {
                toast.error("未找到该地点，请尝试更精确的名称");
                return;
            }

            selection.updateItemGps(activeItem.id, () => ({
                enabled: true,
                lat: formatGpsValue(point.point.lat),
                lng: formatGpsValue(point.point.lng),
                locationName: point.title,
            }));
            selection.setLocationSearchQuery(point.title);
            toast.success("已根据地点名称更新 GPS 坐标");
        } catch (error) {
            console.error(error);
            toast.error("地点搜索失败，请稍后重试");
        } finally {
            setIsSearchingLocation(false);
        }
    }, [selection]);

    const overwriteSelectedInPlace = useCallback(async () => {
        if (!selection.selectedItem) {
            toast.error("请先选择图片");
            return;
        }
        if (!selection.selectedItem.canOverwriteInPlace || !selection.selectedItem.fileHandle) {
            toast.error("当前图片只有 JPEG / PNG 支持原地改写，请先导出修改后图片");
            return;
        }
        if (!isDirty(selection.selectedItem)) {
            toast.error("当前图片没有待写回的修改");
            return;
        }

        try {
            importFlow.setIsOverwritingSelected(true);
            const refreshedItems = await overwriteItemsInPlace([selection.selectedItem], {
                directoryHandle: importFlow.directoryHandle,
                ...persistenceContext,
            });
            setItems((previous) => previous.map((item) => refreshedItems.get(item.id) ?? item));
            toast.success("已原地改写当前图片的 EXIF");
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "原地改写失败，请重试");
        } finally {
            importFlow.setIsOverwritingSelected(false);
        }
    }, [importFlow.directoryHandle, persistenceContext, selection.selectedItem]);

    const exportSelected = useCallback(async () => {
        if (!selection.selectedItem) {
            toast.error("请先选择图片");
            return;
        }
        if (!selection.selectedItem.canWriteExif) {
            toast.error("当前仅支持导出修改后的 JPEG / PNG / TIF");
            return;
        }

        setIsExportingSingle(true);
        try {
            const payload = await buildExportPayload([selection.selectedItem], persistenceContext);
            const saveAs = await loadSaveAs();
            saveAs(payload.data, payload.fileName);
            toast.success("已导出修改后的图片");
        } catch (error) {
            console.error(error);
            toast.error("导出失败，请检查图片格式或重试");
        } finally {
            setIsExportingSingle(false);
        }
    }, [persistenceContext, selection.selectedItem]);

    const handleImportSourceFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        void importFlow.handleFiles(files, {
            onAfterImport: (itemIds, activeItemId) => {
                const preferredSourceId = itemIds.find((itemId) => itemId !== activeItemId) ?? itemIds[0];
                if (preferredSourceId) {
                    selection.setSelectedImportSourceId(preferredSourceId);
                }
            },
        });
    }, [importFlow, selection]);

    const clearAll = useCallback(() => {
        items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        setItems([]);
        selection.setSelectedId(null);
        selection.setSelectedImportSourceId("");
        selection.setLocationSearchQuery("");
        batchFlow.clearAllBatchEffects();
        importFlow.resetImportFlow();
        toast.success("已清空图片列表");
    }, [batchFlow, importFlow, items, selection]);

    const stats = useMemo(
        () => ({
            itemCount: items.length,
            writableCount,
            dirtyCount,
            gpsCount,
            linkedCount,
            bindableCount,
            inplaceCount,
        }),
        [bindableCount, dirtyCount, gpsCount, inplaceCount, items.length, linkedCount, writableCount],
    );

    const preferences = useMemo(
        () => ({
            copyrightPreset,
            copyrightPresetEnabled,
            isCopyrightPresetExpanded,
            setCopyrightPresetEnabled,
            setIsCopyrightPresetExpanded,
            updateCopyrightPresetField,
        }),
        [
            copyrightPreset,
            copyrightPresetEnabled,
            isCopyrightPresetExpanded,
            setCopyrightPresetEnabled,
            setIsCopyrightPresetExpanded,
            updateCopyrightPresetField,
        ],
    );

    const selectionGroup = useMemo(
        () => ({
            ...selection,
        }),
        [selection],
    );

    const importFlowGroup = useMemo(
        () => ({
            ...importFlow,
            handleImportSourceFileChange,
        }),
        [handleImportSourceFileChange, importFlow],
    );

    const batchFlowGroup = useMemo(
        () => ({
            ...batchFlow,
        }),
        [batchFlow],
    );

    const singleFlow = useMemo(
        () => ({
            isExportingSingle,
            isSearchingLocation: isSearchingLocation || batchFlow.isSearchingLocation,
            mapContainerRef,
            mapState,
            clearSelectedGps,
            searchSelectedLocation,
            exportSelected,
            overwriteSelectedInPlace,
        }),
        [
            batchFlow.isSearchingLocation,
            clearSelectedGps,
            exportSelected,
            isExportingSingle,
            isSearchingLocation,
            mapContainerRef,
            mapState,
            overwriteSelectedInPlace,
            searchSelectedLocation,
        ],
    );

    return {
        items,
        clearAll,
        stats,
        preferences,
        selection: selectionGroup,
        importFlow: importFlowGroup,
        batchFlow: batchFlowGroup,
        singleFlow,
    };
};
