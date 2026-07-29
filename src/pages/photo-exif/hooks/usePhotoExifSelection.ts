import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditableExif, EditableGps, PhotoExifItem } from "@/pages/photo-exif/types";
import {
    applyEditableStateToItem,
    applyGpsStateToItem,
    editableGpsToPoint,
    exifDateTimeToLocalInputValue,
    getFileBaseName,
    getFileExtension,
    getFileNameValidationError,
    localInputValueToExifDateTime,
    replaceFileBaseName,
} from "@/pages/photo-exif/utils";

interface UsePhotoExifSelectionOptions {
    items: PhotoExifItem[];
    setItems: React.Dispatch<React.SetStateAction<PhotoExifItem[]>>;
}

export const usePhotoExifSelection = ({ items, setItems }: UsePhotoExifSelectionOptions) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedImportSourceId, setSelectedImportSourceId] = useState("");
    const [locationSearchQuery, setLocationSearchQuery] = useState("");
    const selectedItemRef = useRef<PhotoExifItem | null>(null);

    const selectedItem = useMemo(
        () => items.find((item) => item.id === selectedId) ?? null,
        [items, selectedId],
    );

    useEffect(() => {
        selectedItemRef.current = selectedItem;
        setLocationSearchQuery(selectedItem?.gpsCurrent.locationName ?? "");
    }, [selectedItem]);

    useEffect(() => {
        if (!selectedItem) {
            setSelectedImportSourceId("");
            return;
        }
        if (selectedImportSourceId === selectedItem.id) {
            setSelectedImportSourceId("");
        }
    }, [selectedImportSourceId, selectedItem]);

    const selectedImportSourceItem = useMemo(
        () => items.find((item) => item.id === selectedImportSourceId) ?? null,
        [items, selectedImportSourceId],
    );

    const singleImportSourceOptions = useMemo(
        () => items.filter((item) => item.id !== selectedId),
        [items, selectedId],
    );

    const updateItemGps = useCallback((itemId: string, updater: (current: EditableGps) => EditableGps) => {
        setItems((previous) =>
            previous.map((item) => (item.id === itemId ? applyGpsStateToItem(item, updater(item.gpsCurrent)) : item)),
        );
    }, [setItems]);

    const updateItemEditable = useCallback((itemId: string, updater: (current: EditableExif) => EditableExif) => {
        setItems((previous) =>
            previous.map((item) => (item.id === itemId ? applyEditableStateToItem(item, updater(item.editableCurrent)) : item)),
        );
    }, [setItems]);

    const updateItemFileName = useCallback((itemId: string, value: string) => {
        setItems((previous) =>
            previous.map((item) =>
                item.id === itemId
                    ? { ...item, currentFileName: replaceFileBaseName(item.currentFileName, value) }
                    : item,
            ),
        );
    }, [setItems]);

    const updateItemDateTimeField = useCallback((itemId: string, key: "dateTimeOriginal" | "dateTimeDigitized", value: string) => {
        updateItemEditable(itemId, (current) => ({
            ...current,
            [key]: localInputValueToExifDateTime(value),
        }));
    }, [updateItemEditable]);

    const updateSelectedGpsField = useCallback((key: "lat" | "lng" | "locationName", value: string) => {
        if (!selectedItem) return;
        updateItemGps(selectedItem.id, (current) => ({
            ...current,
            enabled: key === "locationName" ? current.enabled : true,
            [key]: value,
        }));
    }, [selectedItem, updateItemGps]);

    const updateSelectedFileName = useCallback((value: string) => {
        if (!selectedItem) return;
        updateItemFileName(selectedItem.id, value);
    }, [selectedItem, updateItemFileName]);

    const updateSelectedDateTimeField = useCallback((key: "dateTimeOriginal" | "dateTimeDigitized", value: string) => {
        if (!selectedItem) return;
        updateItemDateTimeField(selectedItem.id, key, value);
    }, [selectedItem, updateItemDateTimeField]);

    const removeItem = useCallback((id: string) => {
        setItems((previous) => {
            const item = previous.find((entry) => entry.id === id);
            if (item) URL.revokeObjectURL(item.previewUrl);
            const nextItems = previous.filter((entry) => entry.id !== id);
            if (selectedId === id) setSelectedId(nextItems[0]?.id ?? null);
            return nextItems;
        });
    }, [selectedId, setItems]);

    const toggleImportSource = useCallback((itemId: string) => {
        setSelectedImportSourceId((previous) => (previous === itemId ? "" : itemId));
    }, []);

    const selectedGpsPoint = selectedItem ? editableGpsToPoint(selectedItem.gpsCurrent) : null;
    const selectedFileExtension = selectedItem ? getFileExtension(selectedItem.currentFileName) : "";
    const selectedFileNameValue = selectedItem ? getFileBaseName(selectedItem.currentFileName) : "";
    const selectedFileNameError = selectedItem ? getFileNameValidationError(selectedFileNameValue) : "";
    const selectedDateTimeOriginalValue = selectedItem ? exifDateTimeToLocalInputValue(selectedItem.editableCurrent.dateTimeOriginal) : "";
    const selectedDateTimeDigitizedValue = selectedItem ? exifDateTimeToLocalInputValue(selectedItem.editableCurrent.dateTimeDigitized) : "";

    return {
        selectedId,
        selectedItem,
        selectedItemRef,
        selectedGpsPoint,
        selectedImportSourceId,
        selectedImportSourceItem,
        singleImportSourceOptions,
        locationSearchQuery,
        selectedFileExtension,
        selectedFileNameValue,
        selectedFileNameError,
        selectedDateTimeOriginalValue,
        selectedDateTimeDigitizedValue,
        setSelectedId,
        setSelectedImportSourceId,
        setLocationSearchQuery,
        updateItemGps,
        updateItemEditable,
        updateItemFileName,
        updateItemDateTimeField,
        updateSelectedGpsField,
        updateSelectedFileName,
        updateSelectedDateTimeField,
        removeItem,
        toggleImportSource,
    };
};
