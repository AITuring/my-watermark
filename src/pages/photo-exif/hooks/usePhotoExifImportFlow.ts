import { useCallback, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { DEFAULT_IMPORT_SCOPE_SELECTION, IMPORT_SCOPE_DEFINITIONS, pickerWindow } from "@/pages/photo-exif/constants";
import { overwriteItemsInPlace } from "@/pages/photo-exif/services/file-operations";
import type {
    CopyrightPreset,
    DirectoryImageEntry,
    FileSystemDirectoryHandle,
    ImportScopeSelection,
    PhotoExifItem,
} from "@/pages/photo-exif/types";
import {
    applySourceMetadataToItem,
    buildImportDiffRows,
    buildPhotoExifItemsSequentially,
    createImportScopeSelection,
    listDirectoryImageEntries,
    verifyPermission,
} from "@/pages/photo-exif/utils";

interface UsePhotoExifImportFlowOptions {
    items: PhotoExifItem[];
    setItems: React.Dispatch<React.SetStateAction<PhotoExifItem[]>>;
    selectedItem: PhotoExifItem | null;
    selectedItemRef: React.RefObject<PhotoExifItem | null>;
    selectedImportSourceId: string;
    selectedImportSourceItem: PhotoExifItem | null;
    copyrightPreset: CopyrightPreset;
    copyrightPresetEnabled: boolean;
    onItemsImported?: (itemIds: string[], activeItemId: string | null) => void;
}

export const usePhotoExifImportFlow = ({
    items,
    setItems,
    selectedItem,
    selectedItemRef,
    selectedImportSourceId,
    selectedImportSourceItem,
    copyrightPreset,
    copyrightPresetEnabled,
    onItemsImported,
}: UsePhotoExifImportFlowOptions) => {
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [isImportingDirectory, setIsImportingDirectory] = useState(false);
    const [isBindingDirectory, setIsBindingDirectory] = useState(false);
    const [isUploadPermissionDialogOpen, setIsUploadPermissionDialogOpen] = useState(false);
    const [recentUploadedCount, setRecentUploadedCount] = useState(0);
    const [isImportConfirmDialogOpen, setIsImportConfirmDialogOpen] = useState(false);
    const [pendingImportPersistInPlace, setPendingImportPersistInPlace] = useState(false);
    const [importScopeSelection, setImportScopeSelection] = useState<ImportScopeSelection>(DEFAULT_IMPORT_SCOPE_SELECTION);
    const [isOverwritingSelected, setIsOverwritingSelected] = useState(false);
    const importSourceInputRef = useRef<HTMLInputElement>(null);

    const persistenceContext = useMemo(
        () => ({ copyrightPreset, copyrightPresetEnabled }),
        [copyrightPreset, copyrightPresetEnabled],
    );

    const appendItems = useCallback((nextItems: PhotoExifItem[]) => {
        if (!nextItems.length) return;
        setItems((previous) => [...previous, ...nextItems]);
    }, [setItems]);

    const importScopeSummaries = useMemo(
        () =>
            IMPORT_SCOPE_DEFINITIONS.map((scope) => {
                const diffRows = selectedItem && selectedImportSourceItem ? buildImportDiffRows(selectedItem, selectedImportSourceItem, scope.key) : [];
                return {
                    ...scope,
                    diffRows,
                    diffCount: diffRows.filter((row) => row.changed).length,
                };
            }),
        [selectedItem, selectedImportSourceItem],
    );

    const defaultImportScopeSelection = useMemo(() => {
        const changedScopeKeys = importScopeSummaries.filter((scope) => scope.diffCount > 0).map((scope) => scope.key);
        return createImportScopeSelection(changedScopeKeys.length ? changedScopeKeys : IMPORT_SCOPE_DEFINITIONS.map((scope) => scope.key));
    }, [importScopeSummaries]);

    const notifyImported = useCallback((itemIds: string[]) => {
        onItemsImported?.(itemIds, selectedItemRef.current?.id ?? null);
    }, [onItemsImported, selectedItemRef]);

    const handleFiles = useCallback(async (
        files: File[],
        options?: { onAfterImport?: (itemIds: string[], activeItemId: string | null) => void },
    ) => {
        if (!files.length) return;
        try {
            const nextItems = await buildPhotoExifItemsSequentially(
                files.map((file) => ({ file, source: "dropzone" as const })),
                persistenceContext,
            );
            const importedIds = nextItems.map((item) => item.id);
            appendItems(nextItems);
            const activeItemId = selectedItemRef.current?.id ?? null;
            options?.onAfterImport?.(importedIds, activeItemId);
            notifyImported(importedIds);
            if (nextItems.some((item) => item.canOverwriteInPlace)) {
                setRecentUploadedCount(nextItems.length);
                setIsUploadPermissionDialogOpen(true);
            }
            toast.success(`已读取 ${nextItems.length} 张图片的 EXIF 信息`);
        } catch (error) {
            console.error(error);
            toast.error("读取图片失败，请重试");
        }
    }, [appendItems, items.length, notifyImported, persistenceContext, selectedItemRef]);

    const handleSelectDirectory = useCallback(async () => {
        if (!pickerWindow.showDirectoryPicker) {
            toast.error("当前浏览器不支持文件夹授权，请使用 Chrome 或 Edge");
            return;
        }

        setIsImportingDirectory(true);
        try {
            const handle = await pickerWindow.showDirectoryPicker({ mode: "readwrite" });
            const hasPermission = await verifyPermission(handle, true);
            if (!hasPermission) {
                toast.error("请授予文件夹读写权限后再试");
                return;
            }

            const entries = await listDirectoryImageEntries(handle);
            const nextItems = await buildPhotoExifItemsSequentially(
                entries.map(({ fileHandle, file }) => ({ file, fileHandle, source: "directory" as const })),
                persistenceContext,
            );

            setDirectoryHandle(handle);
            appendItems(nextItems);
            notifyImported(nextItems.map((item) => item.id));
            toast.success(`已从文件夹载入 ${nextItems.length} 张图片；JPEG / PNG 可直接原地改写，TIF 可导出修改`);
        } catch (error) {
            console.error(error);
            if ((error as Error).name !== "AbortError") {
                toast.error("读取文件夹失败，请重试");
            }
        } finally {
            setIsImportingDirectory(false);
        }
    }, [appendItems, notifyImported, persistenceContext]);

    const handleBindUploadedItemsToDirectory = useCallback(async () => {
        if (!pickerWindow.showDirectoryPicker) {
            toast.error("当前浏览器不支持文件夹授权，请使用 Chrome 或 Edge");
            return;
        }
        if (!items.length) {
            toast.error("请先上传图片，再授权绑定原文件");
            return;
        }

        setIsBindingDirectory(true);
        try {
            const handle = await pickerWindow.showDirectoryPicker({ mode: "readwrite" });
            const hasPermission = await verifyPermission(handle, true);
            if (!hasPermission) {
                toast.error("请授予文件夹读写权限后再试");
                return;
            }

            const entries = await listDirectoryImageEntries(handle);
            const entriesByName = new Map<string, Array<DirectoryImageEntry & { index: number }>>();
            entries.forEach((entry, index) => {
                const list = entriesByName.get(entry.file.name) ?? [];
                list.push({ ...entry, index });
                entriesByName.set(entry.file.name, list);
            });

            let matched = 0;
            let exactMatched = 0;
            let fallbackMatched = 0;
            let ambiguous = 0;
            let missing = 0;
            const usedEntryIndexes = new Set<number>();

            setItems((previous) =>
                previous.map((item) => {
                    if (item.fileHandle) return item;
                    const candidates = (entriesByName.get(item.file.name) ?? []).filter((entry) => !usedEntryIndexes.has(entry.index));
                    if (!candidates.length) {
                        missing += 1;
                        return item;
                    }

                    const exactCandidates = candidates.filter(
                        (entry) => entry.file.size === item.file.size && entry.file.lastModified === item.file.lastModified,
                    );
                    if (exactCandidates.length === 1) {
                        usedEntryIndexes.add(exactCandidates[0].index);
                        matched += 1;
                        exactMatched += 1;
                        return { ...item, fileHandle: exactCandidates[0].fileHandle, source: "linked" };
                    }
                    if (exactCandidates.length > 1) {
                        ambiguous += 1;
                        return item;
                    }

                    if (candidates.length === 1 && candidates[0].file.size === item.file.size) {
                        usedEntryIndexes.add(candidates[0].index);
                        matched += 1;
                        fallbackMatched += 1;
                        return { ...item, fileHandle: candidates[0].fileHandle, source: "linked" };
                    }

                    ambiguous += 1;
                    return item;
                }),
            );

            setDirectoryHandle(handle);
            if (matched > 0) {
                const summaryParts = [`已绑定 ${matched} 张图片`];
                if (exactMatched > 0) summaryParts.push(`精确匹配 ${exactMatched} 张`);
                if (fallbackMatched > 0) summaryParts.push(`文件名+大小匹配 ${fallbackMatched} 张`);
                if (missing > 0) summaryParts.push(`${missing} 张未找到`);
                if (ambiguous > 0) summaryParts.push(`${ambiguous} 张重名未绑定`);
                toast.success(summaryParts.join(", "));
            } else if (ambiguous > 0 || missing > 0) {
                toast.error(`未绑定成功: ${missing} 张未找到, ${ambiguous} 张存在重名或无法确认原文件`);
            } else {
                toast.error("所选文件夹里没有可绑定的图片");
            }
        } catch (error) {
            console.error(error);
            if ((error as Error).name !== "AbortError") {
                toast.error("授权并绑定失败，请重试");
            }
        } finally {
            setIsBindingDirectory(false);
        }
    }, [items, setItems]);

    const openImportConfirmDialog = useCallback((persistInPlace = false) => {
        if (!selectedItem) {
            toast.error("请先选择目标图片");
            return;
        }
        if (!selectedItem.canWriteExif) {
            toast.error("当前目标图片格式暂不支持导出元数据修改");
            return;
        }
        if (!selectedImportSourceId) {
            toast.error("请先选择一张来源图片");
            return;
        }
        if (!selectedImportSourceItem) {
            toast.error("来源图片不存在，请重新选择");
            return;
        }

        setPendingImportPersistInPlace(persistInPlace);
        setImportScopeSelection(defaultImportScopeSelection);
        setIsImportConfirmDialogOpen(true);
    }, [defaultImportScopeSelection, selectedImportSourceId, selectedImportSourceItem, selectedItem]);

    const confirmImportSelectedSourceMetadata = useCallback(async () => {
        if (!selectedItem || !selectedImportSourceItem) {
            toast.error("请先选择目标图片和来源图片");
            return;
        }
        if (!selectedItem.canWriteExif) {
            toast.error("当前目标图片格式暂不支持导出元数据修改");
            return;
        }
        if (!Object.values(importScopeSelection).some(Boolean)) {
            toast.error("请至少选择一类要导入的信息");
            return;
        }

        const stagedItem = applySourceMetadataToItem(selectedItem, selectedImportSourceItem, importScopeSelection);
        setIsImportConfirmDialogOpen(false);

        if (!pendingImportPersistInPlace) {
            setItems((previous) => previous.map((item) => (item.id === stagedItem.id ? stagedItem : item)));
            toast.success("已按所选范围导入来源图片信息到当前图片");
            return;
        }

        if (!stagedItem.canOverwriteInPlace || !stagedItem.fileHandle) {
            toast.error("当前图片只有 JPEG / PNG 支持原地改写，请先导出修改后图片");
            return;
        }

        setIsOverwritingSelected(true);
        try {
            const refreshedItems = await overwriteItemsInPlace([stagedItem], {
                directoryHandle,
                ...persistenceContext,
            });
            setItems((previous) => previous.map((item) => refreshedItems.get(item.id) ?? item));
            toast.success("已按所选范围导入并原地改写当前图片");
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "原地改写失败，请重试");
        } finally {
            setIsOverwritingSelected(false);
        }
    }, [directoryHandle, importScopeSelection, pendingImportPersistInPlace, persistenceContext, selectedImportSourceItem, selectedItem, setItems]);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: (acceptedFiles) => {
            void handleFiles(acceptedFiles);
        },
        multiple: true,
        noClick: true,
        accept: {
            "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff"],
        },
    });

    const resetImportFlow = useCallback(() => {
        setDirectoryHandle(null);
        setIsUploadPermissionDialogOpen(false);
        setRecentUploadedCount(0);
        setIsImportConfirmDialogOpen(false);
        setPendingImportPersistInPlace(false);
        setImportScopeSelection(DEFAULT_IMPORT_SCOPE_SELECTION);
        setIsOverwritingSelected(false);
    }, []);

    return {
        directoryHandle,
        isImportingDirectory,
        isBindingDirectory,
        isUploadPermissionDialogOpen,
        recentUploadedCount,
        isImportConfirmDialogOpen,
        pendingImportPersistInPlace,
        importScopeSelection,
        importScopeSummaries,
        defaultImportScopeSelection,
        isOverwritingSelected,
        importSourceInputRef,
        getRootProps,
        getInputProps,
        isDragActive,
        open,
        resetImportFlow,
        setIsOverwritingSelected,
        setIsUploadPermissionDialogOpen,
        setIsImportConfirmDialogOpen,
        setImportScopeSelection,
        handleFiles,
        handleSelectDirectory,
        handleBindUploadedItemsToDirectory,
        openImportConfirmDialog,
        confirmImportSelectedSourceMetadata,
    };
};
