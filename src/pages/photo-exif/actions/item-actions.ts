import { EDITABLE_FIELDS, EMPTY_GPS } from "@/pages/photo-exif/constants";
import type {
    CopyrightPreset,
    EditableExif,
    EditableGps,
    PhotoExifItem,
    RenamePreviewRow,
} from "@/pages/photo-exif/types";
import {
    applyEditableStateToItem,
    applyGpsStateToItem,
    cloneEditableGps,
    editableGpsToPoint,
    formatGpsValue,
} from "@/pages/photo-exif/utils";

export const applyCopyrightPresetToItems = (
    items: PhotoExifItem[],
    copyrightPreset: CopyrightPreset,
): { nextItems: PhotoExifItem[]; affected: number } => {
    let affected = 0;
    const nextItems = items.map((item) => {
        if (!item.canWriteExif) return item;
        affected += 1;
        return applyEditableStateToItem(item, {
            ...item.editableCurrent,
            artist: copyrightPreset.artist,
            copyright: copyrightPreset.copyright,
        });
    });

    return { nextItems, affected };
};

export const applyBatchChangesToItems = (
    items: PhotoExifItem[],
    batchEditable: EditableExif,
    batchGps: EditableGps,
    batchOverwriteEmpty: boolean,
    sourceGps: EditableGps | null,
): { nextItems: PhotoExifItem[]; affected: number; hasGpsValidationError: boolean; hasNoChanges: boolean } => {
    const activeFields = EDITABLE_FIELDS.filter(({ key }) => batchOverwriteEmpty || batchEditable[key].trim());
    const manualGpsInputted = Boolean(batchGps.lat.trim() || batchGps.lng.trim() || batchGps.locationName.trim() || batchGps.enabled);
    const manualGpsPoint = editableGpsToPoint({
        ...batchGps,
        enabled: true,
    });
    const shouldClearGps = batchOverwriteEmpty && !sourceGps && !manualGpsInputted;
    const shouldApplyGps = Boolean(sourceGps) || manualGpsInputted || shouldClearGps;

    if (manualGpsInputted && !sourceGps && !manualGpsPoint) {
        return {
            nextItems: items,
            affected: 0,
            hasGpsValidationError: true,
            hasNoChanges: false,
        };
    }

    if (!activeFields.length && !shouldApplyGps) {
        return {
            nextItems: items,
            affected: 0,
            hasGpsValidationError: false,
            hasNoChanges: true,
        };
    }

    let affected = 0;
    const nextItems = items.map((item) => {
        if (!item.canWriteExif) return item;
        affected += 1;
        const nextEditable = { ...item.editableCurrent };
        activeFields.forEach(({ key }) => {
            nextEditable[key] = batchEditable[key];
        });
        const nextItem = applyEditableStateToItem(item, nextEditable);
        if (!shouldApplyGps) return nextItem;

        if (sourceGps) {
            return applyGpsStateToItem(nextItem, cloneEditableGps(sourceGps));
        }

        if (manualGpsPoint) {
            return applyGpsStateToItem(nextItem, {
                enabled: true,
                lat: formatGpsValue(manualGpsPoint.lat),
                lng: formatGpsValue(manualGpsPoint.lng),
                locationName: batchGps.locationName.trim(),
            });
        }

        return applyGpsStateToItem(nextItem, EMPTY_GPS);
    });

    return {
        nextItems,
        affected,
        hasGpsValidationError: false,
        hasNoChanges: false,
    };
};

export const resetItemsToOriginal = (items: PhotoExifItem[]): PhotoExifItem[] =>
    items.map((item) =>
        applyGpsStateToItem(
            {
                ...applyEditableStateToItem(item, item.editableOriginal),
                currentFileName: item.originalFileName,
            },
            item.gpsOriginal,
        ),
    );

export const applyRenamePreviewRowsToItems = (
    items: PhotoExifItem[],
    renamePreviewRows: RenamePreviewRow[],
): { nextItems: PhotoExifItem[]; affected: number; blocked: number } => {
    const previewMap = new Map(renamePreviewRows.map((row) => [row.itemId, row]));
    let affected = 0;
    let blocked = 0;

    const nextItems = items.map((item) => {
        const preview = previewMap.get(item.id);
        if (!preview || !item.canWriteExif) return item;
        if (!preview.canApply) {
            if (preview.changed) blocked += 1;
            return item;
        }
        affected += 1;
        return {
            ...item,
            currentFileName: preview.nextName,
        };
    });

    return { nextItems, affected, blocked };
};
