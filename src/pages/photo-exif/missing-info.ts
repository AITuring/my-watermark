import { IMPORT_SCOPE_EDITABLE_FIELDS } from "@/pages/photo-exif/constants";
import type { PhotoExifItem, ImportScopeSelection, ImportScopeKey } from "@/pages/photo-exif/types";
import { editableGpsToPoint, isDirty } from "@/pages/photo-exif/utils";

export type PhotoListFilter = "auto" | "all" | "gps" | "time" | "camera" | "pending";

// These are the fields shown by the list, rather than optional EXIF tags such as descriptions.
export const getMissingPhotoInfo = (item: PhotoExifItem) => ({
    camera: !item.editableCurrent.model.trim(),
    time: !item.editableCurrent.dateTimeOriginal.trim(),
    gps: !editableGpsToPoint(item.gpsCurrent),
});

export const filterPhotoItems = (items: PhotoExifItem[], filter: PhotoListFilter, onlyMissing: boolean) =>
    items.filter((item) => {
        if (filter === "pending") return isDirty(item);
        if (isDirty(item)) return true;
        if (filter === "all" || (filter === "auto" && !onlyMissing)) return true;
        const missing = getMissingPhotoInfo(item);
        return filter === "auto" ? Object.values(missing).some(Boolean) : missing[filter];
    });

export const hasSourceMetadata = (item: PhotoExifItem, selection: ImportScopeSelection): boolean =>
    (selection.gps && Boolean(editableGpsToPoint(item.gpsCurrent))) ||
    (Object.keys(IMPORT_SCOPE_EDITABLE_FIELDS) as Array<Exclude<ImportScopeKey, "gps">>).some((scope) =>
        selection[scope] && IMPORT_SCOPE_EDITABLE_FIELDS[scope].some((key) => item.editableCurrent[key].trim().length > 0),
    );
