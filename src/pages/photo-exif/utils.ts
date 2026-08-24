import piexif from "piexifjs";
import { disposeImageSource, isTiffFile, loadImageSource } from "@/utils/image-loading";
import { loadExifReader } from "@/utils/lazy-deps";
import {
    COPYRIGHT_PRESET_ENABLED_STORAGE_KEY,
    COPYRIGHT_PRESET_STORAGE_KEY,
    DEFAULT_COPYRIGHT_PRESET,
    EDITABLE_FIELDS,
    EXIF_HEADER,
    IMAGE_FILE_PATTERN,
    IMPORT_SCOPE_EDITABLE_FIELDS,
    PNG_EXIF_CHUNK_TYPE,
    PNG_SIGNATURE,
    PREVIEW_MAX_EDGE,
} from "@/pages/photo-exif/constants";
import type {
    CopyrightPreset,
    DirectoryImageEntry,
    EditableExif,
    EditableExifKey,
    EditableGps,
    ExifSummary,
    ExifTagRow,
    FileSystemDirectoryHandle,
    FileSystemFileHandle,
    FileSystemHandle,
    GpsPoint,
    ImportDiffRow,
    ImportScopeKey,
    ImportScopeSelection,
    PhotoExifItem,
    PiexifData,
    RenameRule,
} from "@/pages/photo-exif/types";

const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }
        table[index] = value >>> 0;
    }
    return table;
})();

const yieldToMainThread = (): Promise<void> =>
    new Promise((resolve) => {
        window.setTimeout(resolve, 0);
    });

const PREVIEW_FALLBACK_BATCH_COUNT = 64;
const PREVIEW_FALLBACK_TOTAL_BYTES = 120 * 1024 * 1024;

const createPreviewUrl = async (file: File): Promise<string> => {
    if (typeof window === "undefined") {
        return URL.createObjectURL(file);
    }

    try {
        const source = await loadImageSource(file);

        try {
            const widthValue = "naturalWidth" in source ? source.naturalWidth : source.width;
            const heightValue = "naturalHeight" in source ? source.naturalHeight : source.height;
            const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(widthValue, heightValue));
            const width = Math.max(1, Math.round(widthValue * scale));
            const height = Math.max(1, Math.round(heightValue * scale));
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");
            if (!context) {
                return URL.createObjectURL(file);
            }

            context.drawImage(source as CanvasImageSource, 0, 0, width, height);
            const previewBlob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, "image/jpeg", 0.82);
            });
            if (!previewBlob) {
                return URL.createObjectURL(file);
            }
            return URL.createObjectURL(previewBlob);
        } finally {
            disposeImageSource(source);
        }
    } catch (error) {
        console.warn("生成缩略图失败，回退为原图预览", file.name, error);
        return URL.createObjectURL(file);
    }
};

export const convertImageToJpegDataUrl = async (file: File): Promise<string> => {
    const source = await loadImageSource(file);

    try {
        const width = "naturalWidth" in source ? source.naturalWidth : source.width;
        const height = "naturalHeight" in source ? source.naturalHeight : source.height;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));

        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Canvas 上下文不可用");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.95);
    } finally {
        disposeImageSource(source);
    }
};

const readUint32BigEndian = (bytes: Uint8Array, offset: number): number =>
    (((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)) >>> 0;

const writeUint32BigEndian = (target: Uint8Array, offset: number, value: number) => {
    target[offset] = (value >>> 24) & 0xff;
    target[offset + 1] = (value >>> 16) & 0xff;
    target[offset + 2] = (value >>> 8) & 0xff;
    target[offset + 3] = value & 0xff;
};

const asciiToBytes = (text: string): Uint8Array => Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);

export const bytesToBinaryString = (bytes: Uint8Array): string => {
    let result = "";
    for (let index = 0; index < bytes.length; index += 1) {
        result += String.fromCharCode(bytes[index]);
    }
    return result;
};

const binaryStringToBytes = (value: string): Uint8Array => {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
        bytes[index] = value.charCodeAt(index) & 0xff;
    }
    return bytes;
};

const concatUint8Arrays = (chunks: Uint8Array[]): Uint8Array => {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach((chunk) => {
        merged.set(chunk, offset);
        offset += chunk.length;
    });
    return merged;
};

const calculateCrc32 = (bytes: Uint8Array): number => {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
        crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
};

const createPngChunk = (type: string, data: Uint8Array): Uint8Array => {
    const typeBytes = asciiToBytes(type);
    const crcInput = concatUint8Arrays([typeBytes, data]);
    const chunk = new Uint8Array(12 + data.length);
    writeUint32BigEndian(chunk, 0, data.length);
    chunk.set(typeBytes, 4);
    chunk.set(data, 8);
    writeUint32BigEndian(chunk, 8 + data.length, calculateCrc32(crcInput));
    return chunk;
};

const assertPngSignature = (bytes: Uint8Array) => {
    if (bytes.length < PNG_SIGNATURE.length || !PNG_SIGNATURE.every((value: number, index: number) => bytes[index] === value)) {
        throw new Error("不是有效的 PNG 文件");
    }
};

export const extractPngExifChunk = (pngBytes: Uint8Array): Uint8Array | null => {
    assertPngSignature(pngBytes);
    let offset = PNG_SIGNATURE.length;

    while (offset + 12 <= pngBytes.length) {
        const length = readUint32BigEndian(pngBytes, offset);
        const type = bytesToBinaryString(pngBytes.slice(offset + 4, offset + 8));
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        const chunkEnd = dataEnd + 4;
        if (chunkEnd > pngBytes.length) {
            throw new Error("PNG 数据块结构损坏");
        }
        if (type === PNG_EXIF_CHUNK_TYPE) {
            return pngBytes.slice(dataStart, dataEnd);
        }
        offset = chunkEnd;
    }

    return null;
};

export const upsertPngExifChunk = (pngBytes: Uint8Array, exifPayload: Uint8Array): Uint8Array => {
    assertPngSignature(pngBytes);

    const chunks: Uint8Array[] = [pngBytes.slice(0, PNG_SIGNATURE.length)];
    const exifChunk = createPngChunk(PNG_EXIF_CHUNK_TYPE, exifPayload);
    let offset = PNG_SIGNATURE.length;
    let inserted = false;

    while (offset + 12 <= pngBytes.length) {
        const length = readUint32BigEndian(pngBytes, offset);
        const type = bytesToBinaryString(pngBytes.slice(offset + 4, offset + 8));
        const chunkEnd = offset + 12 + length;
        if (chunkEnd > pngBytes.length) {
            throw new Error("PNG 数据块结构损坏");
        }

        const chunk = pngBytes.slice(offset, chunkEnd);
        if (type === PNG_EXIF_CHUNK_TYPE) {
            offset = chunkEnd;
            continue;
        }
        if (!inserted && type === "IDAT") {
            chunks.push(exifChunk);
            inserted = true;
        }
        if (!inserted && type === "IEND") {
            chunks.push(exifChunk);
            inserted = true;
        }
        chunks.push(chunk);
        offset = chunkEnd;
    }

    return concatUint8Arrays(chunks);
};

export const exifStringToPngPayload = (exifString: string): Uint8Array => {
    const normalized = exifString.startsWith(EXIF_HEADER) ? exifString.slice(EXIF_HEADER.length) : exifString;
    return binaryStringToBytes(normalized);
};

export const cloneEditableExif = (editable: EditableExif): EditableExif => ({
    make: editable.make,
    model: editable.model,
    lensModel: editable.lensModel,
    software: editable.software,
    focalLength: editable.focalLength,
    fNumber: editable.fNumber,
    exposureTime: editable.exposureTime,
    iso: editable.iso,
    artist: editable.artist,
    copyright: editable.copyright,
    imageDescription: editable.imageDescription,
    dateTimeOriginal: editable.dateTimeOriginal,
    dateTimeDigitized: editable.dateTimeDigitized,
});

export const formatDiffDisplayValue = (value: string): string => value.trim() || "未设置";

const hasMeaningfulDiffValue = (value: string): boolean => value.trim().length > 0;

export const createImportScopeSelection = (selectedKeys: ImportScopeKey[]): ImportScopeSelection => ({
    gps: selectedKeys.includes("gps"),
    core: selectedKeys.includes("core"),
    time: selectedKeys.includes("time"),
    copyright: selectedKeys.includes("copyright"),
    description: selectedKeys.includes("description"),
});

export const buildImportDiffRows = (target: PhotoExifItem, source: PhotoExifItem, scopeKey: ImportScopeKey): ImportDiffRow[] => {
    if (scopeKey === "gps") {
        const targetGps = editableGpsToPoint(target.gpsCurrent);
        const sourceGps = editableGpsToPoint(source.gpsCurrent);
        const targetGpsValue = targetGps ? formatGpsText(targetGps) : "";
        const sourceGpsValue = sourceGps ? formatGpsText(sourceGps) : "";
        const targetLocationValue = target.gpsCurrent.locationName.trim();
        const sourceLocationValue = source.gpsCurrent.locationName.trim();
        return [
            {
                fieldLabel: "GPS 坐标",
                targetValue: formatDiffDisplayValue(targetGpsValue),
                sourceValue: formatDiffDisplayValue(sourceGpsValue),
                changed: targetGpsValue !== sourceGpsValue,
                willClearTarget: hasMeaningfulDiffValue(targetGpsValue) && !hasMeaningfulDiffValue(sourceGpsValue),
            },
            {
                fieldLabel: "地点名称",
                targetValue: formatDiffDisplayValue(targetLocationValue),
                sourceValue: formatDiffDisplayValue(sourceLocationValue),
                changed: targetLocationValue !== sourceLocationValue,
                willClearTarget: hasMeaningfulDiffValue(targetLocationValue) && !hasMeaningfulDiffValue(sourceLocationValue),
            },
        ];
    }

    const editableFieldLabels: Record<EditableExifKey, string> = {
        make: "品牌",
        model: "机型",
        lensModel: "镜头",
        software: "软件",
        focalLength: "焦距",
        fNumber: "光圈",
        exposureTime: "快门",
        iso: "感光度",
        artist: "作者",
        copyright: "版权",
        imageDescription: "图片描述",
        dateTimeOriginal: "拍摄时间",
        dateTimeDigitized: "数字化时间",
    };

    return IMPORT_SCOPE_EDITABLE_FIELDS[scopeKey].map((fieldKey: EditableExifKey) => {
        const targetValue = target.editableCurrent[fieldKey].trim();
        const sourceValue = source.editableCurrent[fieldKey].trim();
        return {
            fieldLabel: editableFieldLabels[fieldKey],
            targetValue: formatDiffDisplayValue(targetValue),
            sourceValue: formatDiffDisplayValue(sourceValue),
            changed: targetValue !== sourceValue,
            willClearTarget: hasMeaningfulDiffValue(targetValue) && !hasMeaningfulDiffValue(sourceValue),
        };
    });
};

const formatTagValue = (value: unknown): string => {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map((entry) => formatTagValue(entry)).join(", ");
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
};

const getTagText = (tags: Record<string, unknown>, key: string): string => {
    const tag = tags[key] as { description?: string; value?: unknown } | undefined;
    if (!tag) return "";
    return String(tag.description ?? formatTagValue(tag.value) ?? "").trim();
};

const getTagTextFromKeys = (tags: Record<string, unknown>, keys: string[]): string => {
    for (const key of keys) {
        const text = getTagText(tags, key);
        if (text) return text;
    }
    return "";
};

const toTagRows = (tags: Record<string, unknown>): ExifTagRow[] =>
    Object.entries(tags)
        .filter(([name]) => !["MakerNote", "Thumbnail", "PhotoshopThumbnail"].includes(name))
        .map(([name, tag]) => {
            const item = tag as { description?: string; value?: unknown } | undefined;
            return {
                key: name,
                label: name,
                value: String(item?.description ?? formatTagValue(item?.value) ?? ""),
            };
        })
        .filter((tag) => tag.value)
        .sort((a, b) => a.label.localeCompare(b.label));

const isWritableJpeg = (file: File): boolean => /image\/jpeg/i.test(file.type) || /\.jpe?g$/i.test(file.name);
export const isPngFile = (file: File): boolean => /image\/png/i.test(file.type) || /\.png$/i.test(file.name);
const canExportMetadata = (file: File): boolean => isWritableJpeg(file) || isPngFile(file) || isTiffFile(file);
const canOverwriteMetadataInPlace = (file: File): boolean => isWritableJpeg(file) || isPngFile(file);

export const getFileBaseName = (name: string): string => {
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex <= 0) return name;
    return name.slice(0, dotIndex);
};

export const getFileExtension = (name: string): string => {
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex <= 0) return "";
    return name.slice(dotIndex);
};

export const replaceFileBaseName = (name: string, nextBaseName: string): string => {
    const extension = getFileExtension(name);
    return extension ? `${nextBaseName}${extension}` : nextBaseName;
};

export const applyRenameRulesToFileName = (name: string, rules: RenameRule[]): string => {
    if (!rules.length) return name;
    const extension = getFileExtension(name);
    let baseName = getFileBaseName(name);
    rules.forEach((rule) => {
        if (rule.type === "delete") {
            baseName = baseName.split(rule.value).join("");
            return;
        }
        if (rule.type === "add_prefix") {
            baseName = `${rule.value}${baseName}`;
            return;
        }
        baseName = `${baseName}${rule.value}`;
    });
    return `${baseName}${extension}`;
};

export const getFileNameValidationError = (baseName: string): string => {
    const normalized = baseName.trim();
    if (!normalized) return "图片名称不能为空";
    if (/[\\/:*?"<>|]/.test(normalized)) return '图片名称不能包含 \\ / : * ? " < > |';
    if (normalized === "." || normalized === "..") return "图片名称不合法";
    return "";
};

export const getEffectiveFileName = (item: PhotoExifItem): string => item.currentFileName.trim() || item.originalFileName;

export const getExportName = (name: string): string => {
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex === -1) return `${name}-exif.jpg`;
    return `${name.slice(0, dotIndex)}-exif${name.slice(dotIndex)}`;
};

export const getExportTargetFileName = (item: PhotoExifItem, exportName?: string): string => {
    const nextFileName = exportName ?? getEffectiveFileName(item);
    if (!isTiffFile(item.file)) {
        return nextFileName === item.originalFileName ? getExportName(item.file.name) : nextFileName;
    }

    const nextBaseName = getFileBaseName(nextFileName).trim() || getFileBaseName(item.originalFileName).trim() || "image";
    return `${nextBaseName}.jpg`;
};

export const exifDateTimeToLocalInputValue = (value: string): string => {
    const match = value.trim().match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return "";
    const [, year, month, day, hour, minute, second] = match;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

export const localInputValueToExifDateTime = (value: string): string => {
    const normalized = value.trim();
    if (!normalized) return "";
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return normalized;
    const [, year, month, day, hour, minute, second = "00"] = match;
    return `${year}:${month}:${day} ${hour}:${minute}:${second}`;
};

const normalizeRational = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (value && typeof value === "object") {
        const candidate = value as { numerator?: unknown; denominator?: unknown };
        if (typeof candidate.numerator === "number" && typeof candidate.denominator === "number" && candidate.denominator !== 0) {
            return candidate.numerator / candidate.denominator;
        }
    }
    return null;
};

const parseGpsDescription = (description: unknown): number | null => {
    const text = formatTagValue(description).trim();
    if (!text) return null;
    const matches = text.match(/-?\d+(?:\.\d+)?/g);
    if (!matches?.length) return null;
    const numbers = matches.map(Number).filter((value) => Number.isFinite(value));
    if (!numbers.length) return null;
    if (numbers.length >= 3) {
        return numbers[0] + numbers[1] / 60 + numbers[2] / 3600;
    }
    return numbers[0];
};

const parseGpsCoordinate = (tagValue: unknown, tagDescription: unknown, ref: string): number | null => {
    let degrees: number | null = null;

    if (Array.isArray(tagValue)) {
        const values = tagValue.map(normalizeRational).filter((value): value is number => value != null);
        if (values.length >= 3) {
            degrees = values[0] + values[1] / 60 + values[2] / 3600;
        } else if (values.length === 1) {
            degrees = values[0];
        }
    } else {
        degrees = normalizeRational(tagValue);
    }

    if (degrees == null) {
        degrees = parseGpsDescription(tagDescription);
    }
    if (degrees == null) return null;
    if (["S", "W"].includes(ref.toUpperCase())) {
        return -Math.abs(degrees);
    }
    return Math.abs(degrees);
};

const parseGpsPoint = (tags: Record<string, unknown>): GpsPoint | null => {
    const latitudeTag = tags.GPSLatitude as { description?: unknown; value?: unknown } | undefined;
    const longitudeTag = tags.GPSLongitude as { description?: unknown; value?: unknown } | undefined;
    const latitudeRef = getTagText(tags, "GPSLatitudeRef");
    const longitudeRef = getTagText(tags, "GPSLongitudeRef");
    const lat = parseGpsCoordinate(latitudeTag?.value, latitudeTag?.description ?? "", latitudeRef);
    const lng = parseGpsCoordinate(longitudeTag?.value, longitudeTag?.description ?? "", longitudeRef);

    if (lat == null || lng == null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
};

export const formatGpsValue = (value: number): string => value.toFixed(6);
export const formatGpsText = (point: GpsPoint | null): string => (point ? `${formatGpsValue(point.lat)}, ${formatGpsValue(point.lng)}` : "");

const buildEditableGps = (gpsPoint: GpsPoint | null): EditableGps => ({
    enabled: Boolean(gpsPoint),
    lat: gpsPoint ? formatGpsValue(gpsPoint.lat) : "",
    lng: gpsPoint ? formatGpsValue(gpsPoint.lng) : "",
    locationName: "",
});

export const cloneEditableGps = (gps: EditableGps): EditableGps => ({
    enabled: gps.enabled,
    lat: gps.lat,
    lng: gps.lng,
    locationName: gps.locationName,
});

export const editableGpsToPoint = (gps: EditableGps): GpsPoint | null => {
    if (!gps.enabled) return null;
    const lat = Number(gps.lat);
    const lng = Number(gps.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
};

export const applyEditableStateToItem = (item: PhotoExifItem, nextEditable: EditableExif): PhotoExifItem => ({
    ...item,
    editableCurrent: cloneEditableExif(nextEditable),
    summary: {
        ...item.summary,
        make: nextEditable.make,
        model: nextEditable.model,
        lensModel: nextEditable.lensModel,
        software: nextEditable.software,
        focalLength: nextEditable.focalLength,
        fNumber: nextEditable.fNumber,
        exposureTime: nextEditable.exposureTime,
        iso: nextEditable.iso,
        dateTimeOriginal: nextEditable.dateTimeOriginal,
    },
});

export const applyGpsStateToItem = (item: PhotoExifItem, nextGps: EditableGps): PhotoExifItem => {
    const nextPoint = editableGpsToPoint(nextGps);
    return {
        ...item,
        gpsCurrent: cloneEditableGps(nextGps),
        gpsPoint: nextPoint,
        summary: {
            ...item.summary,
            gps: formatGpsText(nextPoint),
        },
    };
};

export const applySourceMetadataToItem = (
    target: PhotoExifItem,
    source: PhotoExifItem,
    selection: ImportScopeSelection,
): PhotoExifItem => {
    let nextItem = target;

    const nextEditable = cloneEditableExif(target.editableCurrent);
    (Object.keys(IMPORT_SCOPE_EDITABLE_FIELDS) as Array<Exclude<ImportScopeKey, "gps">>).forEach((scopeKey) => {
        if (!selection[scopeKey]) return;
        IMPORT_SCOPE_EDITABLE_FIELDS[scopeKey].forEach((fieldKey: EditableExifKey) => {
            nextEditable[fieldKey] = source.editableCurrent[fieldKey];
        });
    });
    nextItem = applyEditableStateToItem(nextItem, nextEditable);

    if (selection.gps) {
        nextItem = applyGpsStateToItem(nextItem, cloneEditableGps(source.gpsCurrent));
    }

    return nextItem;
};

export const extractLngLat = (location: unknown): GpsPoint | null => {
    if (!location) return null;
    if (typeof location === "object") {
        const candidate = location as {
            lat?: unknown;
            lng?: unknown;
            getLat?: () => unknown;
            getLng?: () => unknown;
        };
        if (typeof candidate.lat === "number" && typeof candidate.lng === "number") {
            return { lat: candidate.lat, lng: candidate.lng };
        }
        if (typeof candidate.getLat === "function" && typeof candidate.getLng === "function") {
            const lat = Number(candidate.getLat());
            const lng = Number(candidate.getLng());
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                return { lat, lng };
            }
        }
    }
    if (typeof location === "string" && location.includes(",")) {
        const [lngValue, latValue] = location.split(",");
        const lat = Number(latValue);
        const lng = Number(lngValue);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return { lat, lng };
        }
    }
    return null;
};

const toExifRational = (value: number): [number, number] => [Math.round(value * 1000000), 1000000];

const decimalToExifDms = (decimal: number): Array<[number, number]> => {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesFloat = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesFloat);
    const seconds = (minutesFloat - minutes) * 60;

    return [
        [degrees, 1],
        [minutes, 1],
        toExifRational(seconds),
    ];
};

const buildSummary = (file: File, tags: Record<string, unknown>, gpsPoint: GpsPoint | null): ExifSummary => {
    const width = getTagText(tags, "Image Width");
    const height = getTagText(tags, "Image Height");
    return {
        make: getTagText(tags, "Make"),
        model: getTagText(tags, "Model"),
        lensModel: getTagText(tags, "LensModel"),
        software: getTagText(tags, "Software"),
        dateTimeOriginal: getTagText(tags, "DateTimeOriginal"),
        focalLength: getTagText(tags, "FocalLength"),
        fNumber: getTagText(tags, "FNumber"),
        exposureTime: getTagText(tags, "ExposureTime"),
        iso: getTagText(tags, "ISOSpeedRatings"),
        gps: formatGpsText(gpsPoint),
        resolution: width && height ? `${width} x ${height}` : file.type || "未知格式",
    };
};

const buildEditable = (tags: Record<string, unknown>): EditableExif => ({
    make: getTagText(tags, "Make"),
    model: getTagText(tags, "Model"),
    lensModel: getTagText(tags, "LensModel"),
    software: getTagText(tags, "Software"),
    focalLength: getTagText(tags, "FocalLength"),
    fNumber: getTagText(tags, "FNumber"),
    exposureTime: getTagText(tags, "ExposureTime"),
    iso: getTagText(tags, "ISOSpeedRatings") || getTagText(tags, "PhotographicSensitivity"),
    artist: getTagTextFromKeys(tags, ["Artist", "XPAuthor"]),
    copyright: getTagTextFromKeys(tags, ["Copyright", "XPSubject"]),
    imageDescription: getTagTextFromKeys(tags, ["ImageDescription", "XPComment"]),
    dateTimeOriginal: getTagText(tags, "DateTimeOriginal"),
    dateTimeDigitized: getTagText(tags, "DateTimeDigitized"),
});

export const applyCopyrightPresetToEditable = (
    editable: EditableExif,
    preset: CopyrightPreset,
    enabled: boolean,
): EditableExif => ({
    ...editable,
    artist: enabled ? (editable.artist.trim() || preset.artist) : editable.artist,
    copyright: enabled ? (editable.copyright.trim() || preset.copyright) : editable.copyright,
});

export const readStoredCopyrightPreset = (): CopyrightPreset => {
    if (typeof window === "undefined") return DEFAULT_COPYRIGHT_PRESET;
    try {
        const raw = window.localStorage.getItem(COPYRIGHT_PRESET_STORAGE_KEY);
        if (!raw) return DEFAULT_COPYRIGHT_PRESET;
        const parsed = JSON.parse(raw) as Partial<CopyrightPreset>;
        return {
            artist: String(parsed.artist ?? DEFAULT_COPYRIGHT_PRESET.artist),
            copyright: String(parsed.copyright ?? DEFAULT_COPYRIGHT_PRESET.copyright),
        };
    } catch {
        return DEFAULT_COPYRIGHT_PRESET;
    }
};

export const readStoredCopyrightPresetEnabled = (): boolean => {
    if (typeof window === "undefined") return true;
    try {
        const raw = window.localStorage.getItem(COPYRIGHT_PRESET_ENABLED_STORAGE_KEY);
        if (raw == null) return true;
        return raw === "true";
    } catch {
        return true;
    }
};

export const createEmptyExifObject = (): PiexifData => ({
    "0th": {},
    Exif: {},
    GPS: {},
    Interop: {},
    "1st": {},
    thumbnail: null,
});

export const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("读取图片失败"));
        reader.readAsDataURL(file);
    });

export const dataUrlToFile = (dataUrl: string, fileName: string): File => {
    const [header, base64] = dataUrl.split(",");
    const mimeMatch = header.match(/data:(.*?);base64/);
    const mime = mimeMatch?.[1] ?? "image/jpeg";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new File([bytes], fileName, { type: mime });
};

const setOrDelete = (target: Record<number, unknown>, key: number, value: string) => {
    if (value.trim()) {
        target[key] = value.trim();
        return;
    }
    delete target[key];
};

const containsNonLatin1 = (value: string): boolean =>
    Array.from(value).some((char) => char.charCodeAt(0) > 0xff);

const toLatin1ExifText = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed || containsNonLatin1(trimmed)) return "";
    return trimmed.replaceAll("\0", "");
};

const encodeXpUtf16Le = (value: string): number[] => {
    const bytes: number[] = [];
    for (const char of Array.from(value.trim())) {
        const codePoint = char.codePointAt(0);
        if (codePoint == null) continue;
        if (codePoint <= 0xffff) {
            bytes.push(codePoint & 0xff, (codePoint >> 8) & 0xff);
            continue;
        }
        const normalized = codePoint - 0x10000;
        const highSurrogate = 0xd800 + (normalized >> 10);
        const lowSurrogate = 0xdc00 + (normalized & 0x3ff);
        bytes.push(highSurrogate & 0xff, (highSurrogate >> 8) & 0xff, lowSurrogate & 0xff, (lowSurrogate >> 8) & 0xff);
    }
    bytes.push(0, 0);
    return bytes;
};

const setOrDeleteXpText = (target: Record<number, unknown>, key: number, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
        delete target[key];
        return;
    }
    target[key] = encodeXpUtf16Le(trimmed);
};

const parseFirstNumber = (value: string): number | null => {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
};

const decimalToExifRational = (value: number): [number, number] => {
    const sign = value < 0 ? -1 : 1;
    const absolute = Math.abs(value);
    const scaled = Math.round(absolute * 1000000);
    return [scaled * sign, 1000000];
};

const parseRationalText = (value: string): [number, number] | null => {
    const text = value.trim();
    if (!text) return null;

    const fractionMatch = text.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (fractionMatch) {
        const numerator = Number(fractionMatch[1]);
        const denominator = Number(fractionMatch[2]);
        if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
            return decimalToExifRational(numerator / denominator);
        }
    }

    const parsed = parseFirstNumber(text);
    return parsed == null ? null : decimalToExifRational(parsed);
};

const setOrDeleteRational = (target: Record<number, unknown>, key: number, value: string) => {
    const parsed = parseRationalText(value);
    if (parsed) {
        target[key] = parsed;
        return;
    }
    delete target[key];
};

const setOrDeleteShort = (target: Record<number, unknown>, key: number, value: string) => {
    const parsed = parseFirstNumber(value);
    if (parsed != null) {
        target[key] = Math.max(0, Math.round(parsed));
        return;
    }
    delete target[key];
};

export const applyEditableToExif = (source: PiexifData, editable: EditableExif, gps: EditableGps): PiexifData => {
    const exifObject: PiexifData = {
        "0th": { ...((source["0th"] ?? {}) as Record<number, unknown>) },
        Exif: { ...((source.Exif ?? {}) as Record<number, unknown>) },
        GPS: { ...((source.GPS ?? {}) as Record<number, unknown>) },
        Interop: { ...((source.Interop ?? {}) as Record<number, unknown>) },
        "1st": { ...((source["1st"] ?? {}) as Record<number, unknown>) },
        thumbnail: source.thumbnail ?? null,
    };

    setOrDelete(exifObject["0th"], piexif.ImageIFD.Make, toLatin1ExifText(editable.make));
    setOrDelete(exifObject["0th"], piexif.ImageIFD.Model, toLatin1ExifText(editable.model));
    setOrDelete(exifObject["0th"], piexif.ImageIFD.Software, toLatin1ExifText(editable.software));
    setOrDelete(exifObject["0th"], piexif.ImageIFD.Artist, toLatin1ExifText(editable.artist));
    setOrDelete(exifObject["0th"], piexif.ImageIFD.Copyright, toLatin1ExifText(editable.copyright));
    setOrDelete(exifObject["0th"], piexif.ImageIFD.ImageDescription, toLatin1ExifText(editable.imageDescription));
    setOrDelete(exifObject["0th"], piexif.ImageIFD.DateTime, toLatin1ExifText(editable.dateTimeOriginal || editable.dateTimeDigitized));
    setOrDelete(exifObject.Exif, piexif.ExifIFD.LensModel, toLatin1ExifText(editable.lensModel));
    setOrDeleteRational(exifObject.Exif, piexif.ExifIFD.FocalLength, editable.focalLength);
    setOrDeleteRational(exifObject.Exif, piexif.ExifIFD.FNumber, editable.fNumber);
    setOrDeleteRational(exifObject.Exif, piexif.ExifIFD.ExposureTime, editable.exposureTime);
    setOrDeleteShort(exifObject.Exif, piexif.ExifIFD.ISOSpeedRatings, editable.iso);
    setOrDelete(exifObject.Exif, piexif.ExifIFD.DateTimeOriginal, toLatin1ExifText(editable.dateTimeOriginal));
    setOrDelete(exifObject.Exif, piexif.ExifIFD.DateTimeDigitized, toLatin1ExifText(editable.dateTimeDigitized));
    setOrDeleteXpText(exifObject["0th"], piexif.ImageIFD.XPAuthor, editable.artist);
    setOrDeleteXpText(exifObject["0th"], piexif.ImageIFD.XPSubject, editable.copyright);
    setOrDeleteXpText(exifObject["0th"], piexif.ImageIFD.XPComment, editable.imageDescription);

    const gpsPoint = editableGpsToPoint(gps);
    if (gpsPoint) {
        exifObject.GPS[piexif.GPSIFD.GPSLatitudeRef] = gpsPoint.lat >= 0 ? "N" : "S";
        exifObject.GPS[piexif.GPSIFD.GPSLatitude] = decimalToExifDms(gpsPoint.lat);
        exifObject.GPS[piexif.GPSIFD.GPSLongitudeRef] = gpsPoint.lng >= 0 ? "E" : "W";
        exifObject.GPS[piexif.GPSIFD.GPSLongitude] = decimalToExifDms(gpsPoint.lng);
        exifObject.GPS[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0];
    } else {
        delete exifObject.GPS[piexif.GPSIFD.GPSLatitudeRef];
        delete exifObject.GPS[piexif.GPSIFD.GPSLatitude];
        delete exifObject.GPS[piexif.GPSIFD.GPSLongitudeRef];
        delete exifObject.GPS[piexif.GPSIFD.GPSLongitude];
        delete exifObject.GPS[piexif.GPSIFD.GPSVersionID];
    }

    return exifObject;
};

export const isDirty = (item: PhotoExifItem): boolean =>
    item.currentFileName !== item.originalFileName ||
    EDITABLE_FIELDS.some(({ key }) => item.editableCurrent[key] !== item.editableOriginal[key]) ||
    item.gpsCurrent.enabled !== item.gpsOriginal.enabled ||
    item.gpsCurrent.lat !== item.gpsOriginal.lat ||
    item.gpsCurrent.lng !== item.gpsOriginal.lng ||
    item.gpsCurrent.locationName !== item.gpsOriginal.locationName;

export const verifyPermission = async (handle: FileSystemHandle, readWrite: boolean): Promise<boolean> => {
    const descriptor = readWrite ? { mode: "readwrite" as const } : { mode: "read" as const };
    try {
        if ((await handle.queryPermission(descriptor)) === "granted") return true;
        if ((await handle.requestPermission(descriptor)) === "granted") return true;
    } catch (error) {
        console.error("Permission request failed", error);
    }
    return false;
};

export const listDirectoryImageEntries = async (handle: FileSystemDirectoryHandle): Promise<DirectoryImageEntry[]> => {
    const entries: DirectoryImageEntry[] = [];
    for await (const entry of handle.values()) {
        if (entry.kind !== "file" || !IMAGE_FILE_PATTERN.test(entry.name)) continue;
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        entries.push({ fileHandle, file });
    }
    return entries;
};

export const buildPhotoExifItem = async (
    file: File,
    options?: {
        id?: string;
        fileHandle?: PhotoExifItem["fileHandle"];
        source?: PhotoExifItem["source"];
        copyrightPreset?: CopyrightPreset;
        copyrightPresetEnabled?: boolean;
        preferOriginalPreview?: boolean;
    },
): Promise<PhotoExifItem> => {
    let tags: Record<string, unknown> = {};
    try {
        const ExifReader = (await loadExifReader()) as {
            load: (file: File) => Promise<Record<string, unknown>>;
        };
        tags = await ExifReader.load(file);
    } catch (error) {
        console.warn("读取 EXIF 失败", file.name, error);
    }

    const previewUrl = options?.preferOriginalPreview
        ? URL.createObjectURL(file)
        : await createPreviewUrl(file);
    const gpsPoint = parseGpsPoint(tags);
    const editable = buildEditable(tags);
    const editableGps = buildEditableGps(gpsPoint);
    return {
        id: options?.id ?? crypto.randomUUID(),
        file,
        originalFileName: file.name,
        currentFileName: file.name,
        previewUrl,
        canWriteExif: canExportMetadata(file),
        canOverwriteInPlace: canOverwriteMetadataInPlace(file),
        summary: buildSummary(file, tags, gpsPoint),
        editableOriginal: editable,
        editableCurrent: editable,
        tags: toTagRows(tags),
        gpsPoint,
        gpsOriginal: editableGps,
        gpsCurrent: { ...editableGps },
        fileHandle: options?.fileHandle ?? null,
        source: options?.source ?? "dropzone",
    };
};

export const buildPhotoExifItemsSequentially = async (
    entries: Array<{
        file: File;
        fileHandle?: PhotoExifItem["fileHandle"];
        source?: PhotoExifItem["source"];
    }>,
    options: {
        copyrightPreset: CopyrightPreset;
        copyrightPresetEnabled: boolean;
    },
): Promise<PhotoExifItem[]> => {
    const nextItems: PhotoExifItem[] = [];
    const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
    const preferOriginalPreview = entries.length >= PREVIEW_FALLBACK_BATCH_COUNT
        || totalBytes >= PREVIEW_FALLBACK_TOTAL_BYTES;

    for (const [index, entry] of entries.entries()) {
        nextItems.push(await buildPhotoExifItem(entry.file, {
            fileHandle: entry.fileHandle,
            source: entry.source,
            copyrightPreset: options.copyrightPreset,
            copyrightPresetEnabled: options.copyrightPresetEnabled,
            preferOriginalPreview,
        }));
        if (index < entries.length - 1) {
            await yieldToMainThread();
        }
    }
    return nextItems;
};
