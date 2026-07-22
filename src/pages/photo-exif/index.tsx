import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import ExifReader from "exifreader";
import piexif from "piexifjs";
import { useDropzone } from "react-dropzone";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import {
    AlertCircle,
    Camera,
    ChevronDown,
    ChevronRight,
    Download,
    FileImage,
    Files,
    Image as ImageIcon,
    LocateFixed,
    PencilLine,
    RotateCcw,
    Search,
    Save,
    Trash2,
    Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { disposeImageSource, isTiffFile, loadImageSource } from "@/utils/image-loading";
import ImportPanel from "@/pages/photo-exif/components/ImportPanel";
import StatsOverview from "@/pages/photo-exif/components/StatsOverview";
import WorkbenchHeader from "@/pages/photo-exif/components/WorkbenchHeader";

type EditableExifKey =
    | "make"
    | "model"
    | "lensModel"
    | "software"
    | "focalLength"
    | "fNumber"
    | "exposureTime"
    | "iso"
    | "artist"
    | "copyright"
    | "imageDescription"
    | "dateTimeOriginal"
    | "dateTimeDigitized";

interface EditableExif {
    make: string;
    model: string;
    lensModel: string;
    software: string;
    focalLength: string;
    fNumber: string;
    exposureTime: string;
    iso: string;
    artist: string;
    copyright: string;
    imageDescription: string;
    dateTimeOriginal: string;
    dateTimeDigitized: string;
}

interface CopyrightPreset {
    artist: string;
    copyright: string;
}

interface ExifTagRow {
    key: string;
    label: string;
    value: string;
}

interface GpsPoint {
    lat: number;
    lng: number;
}

interface EditableGps {
    enabled: boolean;
    lat: string;
    lng: string;
    locationName: string;
}

type ImportScopeKey = "gps" | "core" | "time" | "copyright" | "description";

type ImportScopeSelection = Record<ImportScopeKey, boolean>;

interface ImportDiffRow {
    fieldLabel: string;
    targetValue: string;
    sourceValue: string;
    changed: boolean;
    willClearTarget: boolean;
}

type RenameRuleType = "delete" | "add_prefix" | "add_suffix";

interface RenameRule {
    id: string;
    type: RenameRuleType;
    value: string;
}

interface RenamePreviewRow {
    itemId: string;
    originalName: string;
    nextName: string;
    changed: boolean;
    validationError: string;
    duplicate: boolean;
    canApply: boolean;
}

const cloneEditableExif = (editable: EditableExif): EditableExif => ({
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

interface ExifSummary {
    make: string;
    model: string;
    lensModel: string;
    software: string;
    dateTimeOriginal: string;
    focalLength: string;
    fNumber: string;
    exposureTime: string;
    iso: string;
    gps: string;
    resolution: string;
}

interface FileSystemPermissionDescriptor {
    mode?: "read" | "readwrite";
}

interface FileSystemWritableFileStream {
    write(data: Blob | BufferSource | string): Promise<void>;
    close(): Promise<void>;
}

interface FileSystemHandle {
    kind: "file" | "directory";
    name: string;
    queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<"granted" | "denied" | "prompt">;
    requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<"granted" | "denied" | "prompt">;
}

interface FileSystemFileHandle extends FileSystemHandle {
    kind: "file";
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: "directory";
    values(): AsyncIterableIterator<FileSystemHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    removeEntry(name: string): Promise<void>;
}

interface PickerWindow extends Window {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
}

interface PhotoExifItem {
    id: string;
    file: File;
    originalFileName: string;
    currentFileName: string;
    previewUrl: string;
    canWriteExif: boolean;
    canOverwriteInPlace: boolean;
    summary: ExifSummary;
    editableOriginal: EditableExif;
    editableCurrent: EditableExif;
    tags: ExifTagRow[];
    gpsPoint: GpsPoint | null;
    gpsOriginal: EditableGps;
    gpsCurrent: EditableGps;
    fileHandle: FileSystemFileHandle | null;
    source: "dropzone" | "linked" | "directory";
}

interface DirectoryImageEntry {
    fileHandle: FileSystemFileHandle;
    file: File;
}

const PREVIEW_MAX_EDGE = 256;
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_EXIF_CHUNK_TYPE = "eXIf";
const EXIF_HEADER = "Exif\x00\x00";
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

const convertImageToJpegDataUrl = async (file: File): Promise<string> => {
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

        // PNG 透明区域导出 JPEG 时需要铺底色，避免变成黑底。
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

const bytesToBinaryString = (bytes: Uint8Array): string => {
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
    if (bytes.length < PNG_SIGNATURE.length || !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
        throw new Error("不是有效的 PNG 文件");
    }
};

const extractPngExifChunk = (pngBytes: Uint8Array): Uint8Array | null => {
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

const upsertPngExifChunk = (pngBytes: Uint8Array, exifPayload: Uint8Array): Uint8Array => {
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

const exifStringToPngPayload = (exifString: string): Uint8Array => {
    const normalized = exifString.startsWith(EXIF_HEADER) ? exifString.slice(EXIF_HEADER.length) : exifString;
    return binaryStringToBytes(normalized);
};

const buildPhotoExifItemsSequentially = async (
    entries: Array<{
        file: File;
        fileHandle?: FileSystemFileHandle | null;
        source?: PhotoExifItem["source"];
    }>,
    options: {
        copyrightPreset: CopyrightPreset;
        copyrightPresetEnabled: boolean;
    },
): Promise<PhotoExifItem[]> => {
    const nextItems: PhotoExifItem[] = [];

    for (const [index, entry] of entries.entries()) {
        nextItems.push(await buildPhotoExifItem(entry.file, {
            fileHandle: entry.fileHandle,
            source: entry.source,
            copyrightPreset: options.copyrightPreset,
            copyrightPresetEnabled: options.copyrightPresetEnabled,
        }));

        if (index < entries.length - 1) {
            await yieldToMainThread();
        }
    }

    return nextItems;
};

interface PiexifData {
    [key: string]: unknown;
    "0th": Record<number, unknown>;
    Exif: Record<number, unknown>;
    GPS: Record<number, unknown>;
    Interop: Record<number, unknown>;
    "1st": Record<number, unknown>;
    thumbnail: unknown;
}

interface MapSdkLike {
    Map: new (container: HTMLDivElement, options: Record<string, unknown>) => MapInstanceLike;
    Marker: new (options: Record<string, unknown>) => MarkerLike;
    Geocoder: new (options?: Record<string, unknown>) => GeocoderLike;
    PlaceSearch: new (options?: Record<string, unknown>) => PlaceSearchLike;
}

interface MapInstanceLike {
    setZoomAndCenter(zoom: number, center: [number, number]): void;
    add(marker: MarkerLike): void;
    clearMap(): void;
    on(eventName: string, handler: (event: any) => void): void;
    destroy?: () => void;
}

interface MarkerLike {
    setPosition(position: [number, number]): void;
    on(eventName: string, handler: (event: any) => void): void;
}

interface GeocoderLike {
    getAddress(location: [number, number], callback: (status: string, result: any) => void): void;
    getLocation(address: string, callback: (status: string, result: any) => void): void;
}

interface PlaceSearchLike {
    search(keyword: string, callback: (status: string, result: any) => void): void;
}

const EMPTY_EDITABLE: EditableExif = {
    make: "",
    model: "",
    lensModel: "",
    software: "",
    focalLength: "",
    fNumber: "",
    exposureTime: "",
    iso: "",
    artist: "",
    copyright: "",
    imageDescription: "",
    dateTimeOriginal: "",
    dateTimeDigitized: "",
};

const COPYRIGHT_PRESET_STORAGE_KEY = "photo-exif-copyright-preset";
const COPYRIGHT_PRESET_ENABLED_STORAGE_KEY = "photo-exif-copyright-preset-enabled";
const DEFAULT_COPYRIGHT_PRESET: CopyrightPreset = {
    artist: "笑谈间气吐霓虹",
    copyright: `Copyright ${new Date().getFullYear()} 笑谈间气吐霓虹. All Rights Reserved.`,
};

const EMPTY_GPS: EditableGps = {
    enabled: false,
    lat: "",
    lng: "",
    locationName: "",
};

const EDITABLE_FIELDS: Array<{ key: EditableExifKey; label: string; placeholder: string }> = [
    { key: "make", label: "品牌", placeholder: "例如 Sony / Fujifilm" },
    { key: "model", label: "机型", placeholder: "例如 A7R5 / X100VI" },
    { key: "lensModel", label: "镜头", placeholder: "例如 FE 35mm F1.4 GM" },
    { key: "software", label: "软件", placeholder: "例如 Lightroom / Capture One" },
    { key: "focalLength", label: "焦距", placeholder: "例如 35 mm" },
    { key: "fNumber", label: "光圈", placeholder: "例如 f/2.8" },
    { key: "exposureTime", label: "快门", placeholder: "例如 1/125" },
    { key: "iso", label: "感光度", placeholder: "例如 100" },
    { key: "imageDescription", label: "描述", placeholder: "简短说明或拍摄主题" },
    { key: "dateTimeOriginal", label: "拍摄时间", placeholder: "格式 2026:07:12 18:30:00" },
    { key: "dateTimeDigitized", label: "数字化时间", placeholder: "格式 2026:07:12 18:30:00" },
];

const pickerWindow = window as PickerWindow;
const IMAGE_FILE_PATTERN = /\.(jpg|jpeg|png|webp|heic|heif|tif|tiff)$/i;
const DEFAULT_MAP_CENTER: GpsPoint = { lat: 39.90923, lng: 116.397428 };
const secondaryButtonClass =
    "rounded-xl border-slate-300 bg-white px-4 text-slate-700 hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900";
const primaryButtonClass =
    "rounded-xl bg-slate-900 px-4 text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";
const accentButtonClass =
    "rounded-xl bg-blue-600 px-4 text-white shadow-sm hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400";
const dangerButtonClass =
    "rounded-xl bg-rose-600 px-4 text-white shadow-sm hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400";
const dangerSubtleButtonClass =
    "rounded-xl border-rose-200 bg-rose-50 px-4 text-rose-700 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50";
const DEFAULT_IMPORT_SCOPE_SELECTION: ImportScopeSelection = {
    gps: true,
    core: true,
    time: true,
    copyright: true,
    description: true,
};
const IMPORT_SCOPE_DEFINITIONS: Array<{ key: ImportScopeKey; label: string; description: string }> = [
    { key: "gps", label: "GPS", description: "导入经纬度和地点名称" },
    { key: "core", label: "核心信息", description: "导入品牌、机型、镜头、软件、焦距、光圈、快门和 ISO" },
    { key: "time", label: "时间", description: "导入拍摄时间和数字化时间" },
    { key: "copyright", label: "版权", description: "导入作者和版权声明" },
    { key: "description", label: "图片说明", description: "导入图片描述" },
];
const RENAME_RULE_DEFINITIONS: Array<{ type: RenameRuleType; label: string; placeholder: string }> = [
    { type: "delete", label: "删除文本", placeholder: "例如 IMG_ / DSC_" },
    { type: "add_prefix", label: "添加前缀", placeholder: "例如 旅行_" },
    { type: "add_suffix", label: "添加后缀", placeholder: "例如 _精选" },
];
const IMPORT_SCOPE_EDITABLE_FIELDS: Record<Exclude<ImportScopeKey, "gps">, EditableExifKey[]> = {
    core: ["make", "model", "lensModel", "software", "focalLength", "fNumber", "exposureTime", "iso"],
    time: ["dateTimeOriginal", "dateTimeDigitized"],
    copyright: ["artist", "copyright"],
    description: ["imageDescription"],
};

const formatDiffDisplayValue = (value: string): string => value.trim() || "未设置";

const hasMeaningfulDiffValue = (value: string): boolean => value.trim().length > 0;

const createImportScopeSelection = (selectedKeys: ImportScopeKey[]): ImportScopeSelection => ({
    gps: selectedKeys.includes("gps"),
    core: selectedKeys.includes("core"),
    time: selectedKeys.includes("time"),
    copyright: selectedKeys.includes("copyright"),
    description: selectedKeys.includes("description"),
});

const buildImportDiffRows = (target: PhotoExifItem, source: PhotoExifItem, scopeKey: ImportScopeKey): ImportDiffRow[] => {
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

    return IMPORT_SCOPE_EDITABLE_FIELDS[scopeKey].map((fieldKey) => {
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
const isPngFile = (file: File): boolean => /image\/png/i.test(file.type) || /\.png$/i.test(file.name);
const canExportMetadata = (file: File): boolean => isWritableJpeg(file) || isPngFile(file) || isTiffFile(file);
const canOverwriteMetadataInPlace = (file: File): boolean => isWritableJpeg(file) || isPngFile(file);

const getFileBaseName = (name: string): string => {
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex <= 0) return name;
    return name.slice(0, dotIndex);
};

const getFileExtension = (name: string): string => {
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex <= 0) return "";
    return name.slice(dotIndex);
};

const replaceFileBaseName = (name: string, nextBaseName: string): string => {
    const extension = getFileExtension(name);
    return extension ? `${nextBaseName}${extension}` : nextBaseName;
};

const applyRenameRulesToFileName = (name: string, rules: RenameRule[]): string => {
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

const getFileNameValidationError = (baseName: string): string => {
    const normalized = baseName.trim();
    if (!normalized) return "图片名称不能为空";
    if (/[\\/:*?"<>|]/.test(normalized)) return '图片名称不能包含 \\ / : * ? " < > |';
    if (normalized === "." || normalized === "..") return "图片名称不合法";
    return "";
};

const getEffectiveFileName = (item: PhotoExifItem): string => item.currentFileName.trim() || item.originalFileName;
const getExportTargetFileName = (item: PhotoExifItem, exportName?: string): string => {
    const nextFileName = exportName ?? getEffectiveFileName(item);
    if (!isTiffFile(item.file)) {
        return nextFileName === item.originalFileName ? getExportName(item.file.name) : nextFileName;
    }

    const nextBaseName = getFileBaseName(nextFileName).trim() || getFileBaseName(item.originalFileName).trim() || "image";
    return `${nextBaseName}.jpg`;
};

const exifDateTimeToLocalInputValue = (value: string): string => {
    const match = value.trim().match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return "";
    const [, year, month, day, hour, minute, second] = match;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

const localInputValueToExifDateTime = (value: string): string => {
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

const formatGpsValue = (value: number): string => value.toFixed(6);

const formatGpsText = (point: GpsPoint | null): string => (point ? `${formatGpsValue(point.lat)}, ${formatGpsValue(point.lng)}` : "");

const buildEditableGps = (gpsPoint: GpsPoint | null): EditableGps => ({
    enabled: Boolean(gpsPoint),
    lat: gpsPoint ? formatGpsValue(gpsPoint.lat) : "",
    lng: gpsPoint ? formatGpsValue(gpsPoint.lng) : "",
    locationName: "",
});

const cloneEditableGps = (gps: EditableGps): EditableGps => ({
    enabled: gps.enabled,
    lat: gps.lat,
    lng: gps.lng,
    locationName: gps.locationName,
});

const editableGpsToPoint = (gps: EditableGps): GpsPoint | null => {
    if (!gps.enabled) return null;
    const lat = Number(gps.lat);
    const lng = Number(gps.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
};

const applyEditableStateToItem = (item: PhotoExifItem, nextEditable: EditableExif): PhotoExifItem => ({
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

const applyGpsStateToItem = (item: PhotoExifItem, nextGps: EditableGps): PhotoExifItem => {
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

const applySourceMetadataToItem = (
    target: PhotoExifItem,
    source: PhotoExifItem,
    selection: ImportScopeSelection,
): PhotoExifItem => {
    let nextItem = target;

    const nextEditable = cloneEditableExif(target.editableCurrent);
    (Object.keys(IMPORT_SCOPE_EDITABLE_FIELDS) as Array<Exclude<ImportScopeKey, "gps">>).forEach((scopeKey) => {
        if (!selection[scopeKey]) return;
        IMPORT_SCOPE_EDITABLE_FIELDS[scopeKey].forEach((fieldKey) => {
            nextEditable[fieldKey] = source.editableCurrent[fieldKey];
        });
    });
    nextItem = applyEditableStateToItem(nextItem, nextEditable);

    if (selection.gps) {
        nextItem = applyGpsStateToItem(nextItem, cloneEditableGps(source.gpsCurrent));
    }

    return nextItem;
};

const extractLngLat = (location: unknown): GpsPoint | null => {
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

const applyCopyrightPresetToEditable = (
    editable: EditableExif,
    preset: CopyrightPreset,
    enabled: boolean,
): EditableExif => ({
    ...editable,
    artist: enabled ? (editable.artist.trim() || preset.artist) : editable.artist,
    copyright: enabled ? (editable.copyright.trim() || preset.copyright) : editable.copyright,
});

const readStoredCopyrightPreset = (): CopyrightPreset => {
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

const readStoredCopyrightPresetEnabled = (): boolean => {
    if (typeof window === "undefined") return true;
    try {
        const raw = window.localStorage.getItem(COPYRIGHT_PRESET_ENABLED_STORAGE_KEY);
        if (raw == null) return true;
        return raw === "true";
    } catch {
        return true;
    }
};

const createEmptyExifObject = (): PiexifData => ({
    "0th": {},
    Exif: {},
    GPS: {},
    Interop: {},
    "1st": {},
    thumbnail: null,
});

const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("读取图片失败"));
        reader.readAsDataURL(file);
    });

const dataUrlToFile = (dataUrl: string, fileName: string): File => {
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

const getExportName = (name: string): string => {
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex === -1) return `${name}-exif.jpg`;
    return `${name.slice(0, dotIndex)}-exif${name.slice(dotIndex)}`;
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
    return trimmed.replace(/\u0000/g, "");
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

const applyEditableToExif = (source: PiexifData, editable: EditableExif, gps: EditableGps): PiexifData => {
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

const isDirty = (item: PhotoExifItem): boolean =>
    item.currentFileName !== item.originalFileName ||
    EDITABLE_FIELDS.some(({ key }) => item.editableCurrent[key] !== item.editableOriginal[key]) ||
    item.gpsCurrent.enabled !== item.gpsOriginal.enabled ||
    item.gpsCurrent.lat !== item.gpsOriginal.lat ||
    item.gpsCurrent.lng !== item.gpsOriginal.lng ||
    item.gpsCurrent.locationName !== item.gpsOriginal.locationName;

const verifyPermission = async (handle: FileSystemHandle, readWrite: boolean): Promise<boolean> => {
    const descriptor: FileSystemPermissionDescriptor = readWrite ? { mode: "readwrite" } : { mode: "read" };
    try {
        if ((await handle.queryPermission(descriptor)) === "granted") return true;
        if ((await handle.requestPermission(descriptor)) === "granted") return true;
    } catch (error) {
        console.error("Permission request failed", error);
    }
    return false;
};

const listDirectoryImageEntries = async (handle: FileSystemDirectoryHandle): Promise<DirectoryImageEntry[]> => {
    const entries: DirectoryImageEntry[] = [];
    for await (const entry of handle.values()) {
        if (entry.kind !== "file" || !IMAGE_FILE_PATTERN.test(entry.name)) continue;
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        entries.push({ fileHandle, file });
    }
    return entries;
};

const buildPhotoExifItem = async (
    file: File,
    options?: {
        id?: string;
        fileHandle?: FileSystemFileHandle | null;
        source?: PhotoExifItem["source"];
        copyrightPreset?: CopyrightPreset;
        copyrightPresetEnabled?: boolean;
    },
): Promise<PhotoExifItem> => {
    let tags: Record<string, unknown> = {};
    try {
        tags = await ExifReader.load(file);
    } catch (error) {
        console.warn("读取 EXIF 失败", file.name, error);
    }

    const previewUrl = await createPreviewUrl(file);
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

const PhotoExifWorkbench: React.FC = () => {
    const [items, setItems] = useState<PhotoExifItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedImportSourceId, setSelectedImportSourceId] = useState("");
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
    const [isCopyrightPresetExpanded, setIsCopyrightPresetExpanded] = useState(false);
    const [copyrightPreset, setCopyrightPreset] = useState<CopyrightPreset>(() => readStoredCopyrightPreset());
    const [copyrightPresetEnabled, setCopyrightPresetEnabled] = useState<boolean>(() => readStoredCopyrightPresetEnabled());
    const [isExportingSingle, setIsExportingSingle] = useState(false);
    const [isOverwritingSelected, setIsOverwritingSelected] = useState(false);
    const [isExportingBatch, setIsExportingBatch] = useState(false);
    const [isImportingDirectory, setIsImportingDirectory] = useState(false);
    const [isBindingDirectory, setIsBindingDirectory] = useState(false);
    const [isOverwritingInPlace, setIsOverwritingInPlace] = useState(false);
    const [isSearchingLocation, setIsSearchingLocation] = useState(false);
    const [isUploadPermissionDialogOpen, setIsUploadPermissionDialogOpen] = useState(false);
    const [recentUploadedCount, setRecentUploadedCount] = useState(0);
    const [isImportConfirmDialogOpen, setIsImportConfirmDialogOpen] = useState(false);
    const [pendingImportPersistInPlace, setPendingImportPersistInPlace] = useState(false);
    const [importScopeSelection, setImportScopeSelection] = useState<ImportScopeSelection>(DEFAULT_IMPORT_SCOPE_SELECTION);
    const [batchImportScopeSelection, setBatchImportScopeSelection] = useState<ImportScopeSelection>(DEFAULT_IMPORT_SCOPE_SELECTION);
    const [locationSearchQuery, setLocationSearchQuery] = useState("");
    const [batchLocationSearchQuery, setBatchLocationSearchQuery] = useState("");
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [mapState, setMapState] = useState<{ loading: boolean; error: string | null }>({
        loading: false,
        error: null,
    });
    const [batchMapState, setBatchMapState] = useState<{ loading: boolean; error: string | null }>({
        loading: false,
        error: null,
    });
    const itemsRef = useRef<PhotoExifItem[]>([]);
    const selectedItemRef = useRef<PhotoExifItem | null>(null);
    const importSourceInputRef = useRef<HTMLInputElement>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const batchMapContainerRef = useRef<HTMLDivElement>(null);
    const mapSdkRef = useRef<MapSdkLike | null>(null);
    const mapRef = useRef<MapInstanceLike | null>(null);
    const markerRef = useRef<MarkerLike | null>(null);
    const batchMapRef = useRef<MapInstanceLike | null>(null);
    const batchMarkerRef = useRef<MarkerLike | null>(null);

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
        mapRef.current?.destroy?.();
        batchMapRef.current?.destroy?.();
    }, []);

    const selectedItem = useMemo(
        () => items.find((item) => item.id === selectedId) ?? null,
        [items, selectedId],
    );

    useEffect(() => {
        selectedItemRef.current = selectedItem;
        setLocationSearchQuery(selectedItem?.gpsCurrent.locationName ?? "");
    }, [selectedItem]);

    useEffect(() => {
        setBatchLocationSearchQuery(batchGps.locationName);
    }, [batchGps.locationName]);

    useEffect(() => {
        if (!selectedItem) {
            setSelectedImportSourceId("");
            return;
        }
        if (selectedImportSourceId === selectedItem.id) {
            setSelectedImportSourceId("");
        }
    }, [selectedImportSourceId, selectedItem]);

    const writableCount = useMemo(() => items.filter((item) => item.canWriteExif).length, [items]);
    const dirtyCount = useMemo(() => items.filter((item) => item.canWriteExif && isDirty(item)).length, [items]);
    const gpsCount = useMemo(() => items.filter((item) => editableGpsToPoint(item.gpsCurrent)).length, [items]);
    const linkedCount = useMemo(() => items.filter((item) => item.fileHandle).length, [items]);
    const bindableCount = useMemo(() => items.filter((item) => item.canOverwriteInPlace && !item.fileHandle).length, [items]);
    const inplaceCount = useMemo(
        () => items.filter((item) => item.canOverwriteInPlace && item.fileHandle && isDirty(item)).length,
        [items],
    );
    const gpsSourceOptions = useMemo(
        () => items.filter((item) => editableGpsToPoint(item.gpsCurrent)),
        [items],
    );
    const singleImportSourceOptions = useMemo(
        () => items.filter((item) => item.id !== selectedId),
        [items, selectedId],
    );
    const batchImportSourceOptions = useMemo(() => items, [items]);
    const selectedImportSourceItem = useMemo(
        () => items.find((item) => item.id === selectedImportSourceId) ?? null,
        [items, selectedImportSourceId],
    );
    const batchImportSourceItem = useMemo(
        () => items.find((item) => item.id === batchImportSourceId) ?? null,
        [items, batchImportSourceId],
    );
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
        const changedScopeKeys = importScopeSummaries
            .filter((scope) => scope.diffCount > 0)
            .map((scope) => scope.key);
        return createImportScopeSelection(changedScopeKeys.length ? changedScopeKeys : IMPORT_SCOPE_DEFINITIONS.map((scope) => scope.key));
    }, [importScopeSummaries]);
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
            .filter((item) => {
                if (!normalizedKeyword) return true;
                return getEffectiveFileName(item).toLowerCase().includes(normalizedKeyword);
            })
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
    const renameChangedCount = useMemo(
        () => renamePreviewRows.filter((row) => row.changed).length,
        [renamePreviewRows],
    );
    const renameApplicableCount = useMemo(
        () => renamePreviewRows.filter((row) => row.canApply).length,
        [renamePreviewRows],
    );
    const renameBlockedCount = useMemo(
        () => renamePreviewRows.filter((row) => row.changed && !row.canApply).length,
        [renamePreviewRows],
    );
    const loadAMap = useCallback(async (): Promise<MapSdkLike> => {
        if (mapSdkRef.current) return mapSdkRef.current;
        (window as Window & { _AMapSecurityConfig?: Record<string, string> })._AMapSecurityConfig = {
            securityJsCode: "8d5961ba4c131a09904cab742029ca42",
        };
        const sdk = await AMapLoader.load({
            key: "55b6c2fbb0875490d011d74ad99aac31",
            version: "2.0",
            plugins: ["AMap.Geocoder", "AMap.PlaceSearch"],
        });
        mapSdkRef.current = sdk as unknown as MapSdkLike;
        return mapSdkRef.current;
    }, []);

    const updateItemGps = useCallback((itemId: string, updater: (current: EditableGps) => EditableGps) => {
        setItems((previous) =>
            previous.map((item) => {
                if (item.id !== itemId) return item;
                const nextGps = updater(item.gpsCurrent);
                return applyGpsStateToItem(item, nextGps);
            }),
        );
    }, []);

    const updateItemEditable = useCallback((itemId: string, updater: (current: EditableExif) => EditableExif) => {
        setItems((previous) =>
            previous.map((item) => {
                if (item.id !== itemId) return item;
                const nextEditable = updater(item.editableCurrent);
                return applyEditableStateToItem(item, nextEditable);
            }),
        );
    }, []);

    const updateItemFileName = useCallback((itemId: string, value: string) => {
        setItems((previous) =>
            previous.map((item) => {
                if (item.id !== itemId) return item;
                return {
                    ...item,
                    currentFileName: replaceFileBaseName(item.currentFileName, value),
                };
            }),
        );
    }, []);

    const updateItemDateTimeField = useCallback((itemId: string, key: "dateTimeOriginal" | "dateTimeDigitized", value: string) => {
        updateItemEditable(itemId, (current) => ({
            ...current,
            [key]: localInputValueToExifDateTime(value),
        }));
    }, [updateItemEditable]);

    const reverseGeocodePoint = useCallback(async (point: GpsPoint): Promise<string> => {
        const sdk = await loadAMap();
        return new Promise((resolve) => {
            const geocoder = new sdk.Geocoder({});
            geocoder.getAddress([point.lng, point.lat], (status, result) => {
                if (status === "complete") {
                    const formattedAddress = String(result?.regeocode?.formattedAddress ?? "").trim();
                    resolve(formattedAddress);
                    return;
                }
                resolve("");
            });
        });
    }, [loadAMap]);

    const searchLocationPoint = useCallback(async (keyword: string): Promise<{ point: GpsPoint; title: string } | null> => {
        const sdk = await loadAMap();
        return new Promise((resolve) => {
            const placeSearch = new sdk.PlaceSearch({
                pageSize: 8,
                extensions: "base",
            } as Record<string, unknown>);
            placeSearch.search(keyword, (status, result) => {
                if (status === "complete" && result?.poiList?.pois?.length) {
                    const poi = result.poiList.pois[0];
                    const pointValue = extractLngLat(poi?.location);
                    if (pointValue) {
                        resolve({
                            point: pointValue,
                            title: String(poi?.name ?? keyword).trim() || keyword,
                        });
                        return;
                    }
                }

                const geocoder = new sdk.Geocoder({});
                geocoder.getLocation(keyword, (geoStatus, geoResult) => {
                    if (geoStatus === "complete" && geoResult?.geocodes?.length) {
                        const geoPoint = extractLngLat(geoResult.geocodes[0]?.location);
                        if (geoPoint) {
                            resolve({ point: geoPoint, title: keyword });
                            return;
                        }
                    }
                    resolve(null);
                });
            });
        });
    }, [loadAMap]);

    const applySelectedGpsPoint = useCallback(async (point: GpsPoint, resolveAddress = false) => {
        const activeItem = selectedItemRef.current;
        if (!activeItem || !activeItem.canWriteExif) return;

        let locationName = activeItem.gpsCurrent.locationName;
        if (resolveAddress) {
            try {
                const resolved = await reverseGeocodePoint(point);
                if (resolved) {
                    locationName = resolved;
                    setLocationSearchQuery(resolved);
                }
            } catch (error) {
                console.error(error);
            }
        }

        updateItemGps(activeItem.id, () => ({
            enabled: true,
            lat: formatGpsValue(point.lat),
            lng: formatGpsValue(point.lng),
            locationName,
        }));
    }, [reverseGeocodePoint, updateItemGps]);

    const applyBatchGpsPoint = useCallback(async (point: GpsPoint, resolveAddress = false) => {
        let locationName = batchGps.locationName;
        if (resolveAddress) {
            try {
                const resolved = await reverseGeocodePoint(point);
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
    }, [batchGps.locationName, reverseGeocodePoint]);

    useEffect(() => {
        const gpsPoint = selectedItem ? editableGpsToPoint(selectedItem.gpsCurrent) : null;
        if (!mapContainerRef.current) return;

        let cancelled = false;
        const renderMap = async () => {
            setMapState({ loading: true, error: null });
            try {
                const sdk = await loadAMap();
                if (cancelled || !mapContainerRef.current) return;

                if (!mapRef.current) {
                    mapRef.current = new sdk.Map(mapContainerRef.current, {
                        zoom: 15,
                        center: [gpsPoint?.lng ?? DEFAULT_MAP_CENTER.lng, gpsPoint?.lat ?? DEFAULT_MAP_CENTER.lat],
                    });
                    mapRef.current.on("click", (event: any) => {
                        const activeItem = selectedItemRef.current;
                        if (!activeItem?.canWriteExif) return;
                        const point = extractLngLat(event?.lnglat);
                        if (point) {
                            void applySelectedGpsPoint(point, true);
                        }
                    });
                }

                mapRef.current.clearMap();
                markerRef.current = null;
                mapRef.current.setZoomAndCenter(15, [gpsPoint?.lng ?? DEFAULT_MAP_CENTER.lng, gpsPoint?.lat ?? DEFAULT_MAP_CENTER.lat]);
                if (gpsPoint) {
                    const marker = new sdk.Marker({
                        position: [gpsPoint.lng, gpsPoint.lat],
                        title: selectedItem?.file.name ?? "拍摄位置",
                        draggable: selectedItem?.canWriteExif,
                    } as Record<string, unknown>);
                    marker.on("dragend", (event: any) => {
                        const point = extractLngLat(event?.lnglat ?? event?.target?.getPosition?.());
                        if (point) {
                            void applySelectedGpsPoint(point, true);
                        }
                    });
                    markerRef.current = marker;
                    mapRef.current.add(marker);
                }
                if (!cancelled) {
                    setMapState({ loading: false, error: null });
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setMapState({ loading: false, error: "地图加载失败，请稍后重试" });
                }
            }
        };

        void renderMap();
        return () => {
            cancelled = true;
        };
    }, [applySelectedGpsPoint, loadAMap, selectedItem]);

    useEffect(() => {
        const gpsPoint = editableGpsToPoint({
            ...batchGps,
            enabled: true,
        });
        if (!batchMapContainerRef.current) return;

        let cancelled = false;
        const renderBatchMap = async () => {
            setBatchMapState({ loading: true, error: null });
            try {
                const sdk = await loadAMap();
                if (cancelled || !batchMapContainerRef.current) return;

                if (!batchMapRef.current) {
                    batchMapRef.current = new sdk.Map(batchMapContainerRef.current, {
                        zoom: 15,
                        center: [gpsPoint?.lng ?? DEFAULT_MAP_CENTER.lng, gpsPoint?.lat ?? DEFAULT_MAP_CENTER.lat],
                    });
                    batchMapRef.current.on("click", (event: any) => {
                        const point = extractLngLat(event?.lnglat);
                        if (point) {
                            void applyBatchGpsPoint(point, true);
                        }
                    });
                }

                batchMapRef.current.clearMap();
                batchMarkerRef.current = null;
                batchMapRef.current.setZoomAndCenter(15, [gpsPoint?.lng ?? DEFAULT_MAP_CENTER.lng, gpsPoint?.lat ?? DEFAULT_MAP_CENTER.lat]);
                if (gpsPoint) {
                    const marker = new sdk.Marker({
                        position: [gpsPoint.lng, gpsPoint.lat],
                        title: batchGps.locationName || "批量 GPS 位置",
                        draggable: true,
                    } as Record<string, unknown>);
                    marker.on("dragend", (event: any) => {
                        const point = extractLngLat(event?.lnglat ?? event?.target?.getPosition?.());
                        if (point) {
                            void applyBatchGpsPoint(point, true);
                        }
                    });
                    batchMarkerRef.current = marker;
                    batchMapRef.current.add(marker);
                }
                if (!cancelled) {
                    setBatchMapState({ loading: false, error: null });
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setBatchMapState({ loading: false, error: "批量地图加载失败，请稍后重试" });
                }
            }
        };

        void renderBatchMap();
        return () => {
            cancelled = true;
        };
    }, [applyBatchGpsPoint, batchGps, loadAMap]);

    const appendItems = useCallback((nextItems: PhotoExifItem[]) => {
        if (!nextItems.length) return;
        setItems((previous) => [...previous, ...nextItems]);
        setSelectedId((previous) => previous ?? nextItems[0]?.id ?? null);
    }, []);

    const handleFiles = useCallback(async (files: File[], options?: { selectAsImportSource?: boolean }) => {
        if (!files.length) return;
        try {
            const nextItems = await buildPhotoExifItemsSequentially(
                files.map((file) => ({
                    file,
                    source: "dropzone" as const,
                })),
                {
                    copyrightPreset,
                    copyrightPresetEnabled,
                },
            );
            appendItems(nextItems);
            if (options?.selectAsImportSource) {
                const activeItem = selectedItemRef.current;
                const preferredSourceItem = nextItems.find((item) => item.id !== activeItem?.id) ?? nextItems[0];
                if (preferredSourceItem) {
                    setSelectedImportSourceId(preferredSourceItem.id);
                }
            }
            if (nextItems.some((item) => item.canOverwriteInPlace)) {
                setRecentUploadedCount(nextItems.length);
                setIsUploadPermissionDialogOpen(true);
            }
            toast.success(`已读取 ${nextItems.length} 张图片的 EXIF 信息`);
        } catch (error) {
            console.error(error);
            toast.error("读取图片失败，请重试");
        }
    }, [appendItems, copyrightPreset, copyrightPresetEnabled]);

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
                entries.map(({ fileHandle, file }) => ({
                    file,
                    fileHandle,
                    source: "directory" as const,
                })),
                {
                    copyrightPreset,
                    copyrightPresetEnabled,
                },
            );

            setDirectoryHandle(handle);
            appendItems(nextItems);
            toast.success(`已从文件夹载入 ${nextItems.length} 张图片；JPEG / PNG 可直接原地改写，TIF 可导出修改`);
        } catch (error) {
            console.error(error);
            if ((error as Error).name !== "AbortError") {
                toast.error("读取文件夹失败，请重试");
            }
        } finally {
            setIsImportingDirectory(false);
        }
    }, [appendItems, copyrightPreset, copyrightPresetEnabled]);

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
                        return {
                            ...item,
                            fileHandle: exactCandidates[0].fileHandle,
                            source: "linked",
                        };
                    }
                    if (exactCandidates.length > 1) {
                        ambiguous += 1;
                        return item;
                    }

                    if (candidates.length === 1 && candidates[0].file.size === item.file.size) {
                        usedEntryIndexes.add(candidates[0].index);
                        matched += 1;
                        fallbackMatched += 1;
                        return {
                            ...item,
                            fileHandle: candidates[0].fileHandle,
                            source: "linked",
                        };
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
    }, [items]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        void handleFiles(acceptedFiles);
    }, [handleFiles]);

    const handleImportSourceFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        void handleFiles(files, { selectAsImportSource: true });
    }, [handleFiles]);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        multiple: true,
        noClick: true,
        accept: {
            "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff"],
        },
    });

    const removeItem = (id: string) => {
        setItems((previous) => {
            const item = previous.find((entry) => entry.id === id);
            if (item) {
                URL.revokeObjectURL(item.previewUrl);
            }
            const nextItems = previous.filter((entry) => entry.id !== id);
            if (selectedId === id) {
                setSelectedId(nextItems[0]?.id ?? null);
            }
            return nextItems;
        });
    };

    const toggleImportSource = (itemId: string) => {
        setSelectedImportSourceId((previous) => (previous === itemId ? "" : itemId));
    };

    const clearAll = () => {
        items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        setItems([]);
        setSelectedId(null);
        setBatchImportSourceId("");
        setBatchEditable(EMPTY_EDITABLE);
        setBatchGps(EMPTY_GPS);
        setRenameRules([]);
        setRenameRuleInputs({
            delete: "",
            add_prefix: "",
            add_suffix: "",
        });
        setRenameFilterKeyword("");
        setDirectoryHandle(null);
        toast.success("已清空图片列表");
    };

    const setSelectedAsBatchImportSource = () => {
        if (!selectedItem) {
            toast.error("请先在左侧选择一张图片");
            return;
        }
        setBatchImportSourceId(selectedItem.id);
        toast.success("已将当前图片设为批量来源图");
    };

    const updateCopyrightPresetField = (key: keyof CopyrightPreset, value: string) => {
        setCopyrightPreset((previous) => ({
            ...previous,
            [key]: value,
        }));
    };

    const applyCopyrightPresetToAll = () => {
        if (!copyrightPresetEnabled) {
            toast.error("请先打开默认应用开关");
            return;
        }
        let affected = 0;
        setItems((previous) =>
            previous.map((item) => {
                if (!item.canWriteExif) return item;
                affected += 1;
                return applyEditableStateToItem(item, {
                    ...item.editableCurrent,
                    artist: copyrightPreset.artist,
                    copyright: copyrightPreset.copyright,
                });
            }),
        );
        toast.success(`已将默认版权应用到 ${affected} 张可导出图片`);
    };

    const applyBatchChanges = () => {
        const activeFields = EDITABLE_FIELDS.filter(({ key }) => batchOverwriteEmpty || batchEditable[key].trim());
        const sourceGps = batchGpsSourceId
            ? items.find((item) => item.id === batchGpsSourceId)?.gpsCurrent ?? null
            : null;
        const manualGpsInputted = Boolean(batchGps.lat.trim() || batchGps.lng.trim() || batchGps.locationName.trim() || batchGps.enabled);
        const manualGpsPoint = editableGpsToPoint({
            ...batchGps,
            enabled: true,
        });
        const shouldClearGps = batchOverwriteEmpty && !sourceGps && !manualGpsInputted;
        const shouldApplyGps = Boolean(sourceGps) || manualGpsInputted || shouldClearGps;

        if (manualGpsInputted && !sourceGps && !manualGpsPoint) {
            toast.error("请填写有效的批量 GPS 经纬度，或选择一张带 GPS 的照片同步");
            return;
        }

        if (!activeFields.length && !shouldApplyGps) {
            toast.error("请至少填写一个批量修改字段，或配置 GPS 批量处理");
            return;
        }

        let affected = 0;
        setItems((previous) =>
            previous.map((item) => {
                if (!item.canWriteExif) return item;
                affected += 1;
                const nextEditable = { ...item.editableCurrent };
                activeFields.forEach(({ key }) => {
                    nextEditable[key] = batchEditable[key];
                });
                const nextItem = applyEditableStateToItem(item, nextEditable);
                if (!shouldApplyGps) return nextItem;

                if (sourceGps) {
                    return applyGpsStateToItem(nextItem, sourceGps);
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
            }),
        );
        toast.success(`已把批量修改应用到 ${affected} 张可导出图片`);
    };

    const resetAllEditable = () => {
        setItems((previous) =>
            previous.map((item) =>
                applyGpsStateToItem(
                    {
                        ...applyEditableStateToItem(item, item.editableOriginal),
                        currentFileName: item.originalFileName,
                    },
                    item.gpsOriginal,
                ),
            ),
        );
        toast.success("已恢复全部图片的原始可编辑字段");
    };

    const updateSelectedGpsField = (key: "lat" | "lng" | "locationName", value: string) => {
        if (!selectedItem) return;
        updateItemGps(selectedItem.id, (current) => {
            const nextGps = {
                ...current,
                enabled: key === "locationName" ? current.enabled : true,
                [key]: value,
            };
            return nextGps;
        });
    };

    const updateSelectedFileName = (value: string) => {
        if (!selectedItem) return;
        updateItemFileName(selectedItem.id, value);
    };

    const updateSelectedDateTimeField = (key: "dateTimeOriginal" | "dateTimeDigitized", value: string) => {
        if (!selectedItem) return;
        updateItemDateTimeField(selectedItem.id, key, value);
    };

    const updateBatchEditableField = (key: EditableExifKey, value: string) => {
        setBatchEditable((previous) => ({
            ...previous,
            [key]: key === "dateTimeOriginal" || key === "dateTimeDigitized"
                ? localInputValueToExifDateTime(value)
                : value,
        }));
    };

    const updateRenameRuleInput = (type: RenameRuleType, value: string) => {
        setRenameRuleInputs((previous) => ({
            ...previous,
            [type]: value,
        }));
    };

    const submitRenameRule = (type: RenameRuleType) => {
        const nextValue = renameRuleInputs[type].trim();
        if (!nextValue) return;
        setRenameRules((previous) => [
            ...previous,
            {
                id: Math.random().toString(36).slice(2, 11),
                type,
                value: nextValue,
            },
        ]);
        setRenameRuleInputs((previous) => ({
            ...previous,
            [type]: "",
        }));
    };

    const removeRenameRule = (ruleId: string) => {
        setRenameRules((previous) => previous.filter((rule) => rule.id !== ruleId));
    };

    const clearRenameRules = () => {
        setRenameRules([]);
        setRenameRuleInputs({
            delete: "",
            add_prefix: "",
            add_suffix: "",
        });
        setRenameFilterKeyword("");
        toast.success("已清空批量改名规则");
    };

    const applyRenameRulesToWorkbench = () => {
        if (!renameRules.length) {
            toast.error("请先添加至少一条改名规则");
            return;
        }
        if (!renamePreviewRows.length) {
            toast.error("没有匹配到可改名的图片");
            return;
        }

        const previewMap = new Map(renamePreviewRows.map((row) => [row.itemId, row]));
        let affected = 0;
        let blocked = 0;
        setItems((previous) =>
            previous.map((item) => {
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
            }),
        );

        if (affected > 0) {
            toast.success(`已更新 ${affected} 张图片的文件名`);
        }
        if (blocked > 0) {
            toast.error(`${blocked} 张图片因名称重复或非法被跳过`);
        }
    };

    const updateBatchGpsField = (key: "lat" | "lng" | "locationName", value: string) => {
        setBatchGps((previous) => ({
            ...previous,
            enabled: key === "locationName" ? previous.enabled : true,
            [key]: value,
        }));
        if (batchGpsSourceId) {
            setBatchGpsSourceId("");
        }
    };

    const syncBatchGpsFromSelected = () => {
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
    };

    const clearBatchGpsConfig = () => {
        setBatchGps({ ...EMPTY_GPS });
        setBatchGpsSourceId("");
        setBatchLocationSearchQuery("");
        toast.success("已清空批量 GPS 配置");
    };

    const applyBatchSourceImport = async (persistInPlace = false) => {
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
            const refreshedItems = await overwriteItemsInPlace(writableItems);
            setItems((previous) => previous.map((item) => refreshedItems.get(item.id) ?? item));
            toast.success(`已导入来源图信息并原地写回 ${refreshedItems.size} 张 JPEG / PNG`);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "批量导入并写回失败，请重试");
        } finally {
            setIsOverwritingInPlace(false);
        }
    };

    const clearSelectedGps = () => {
        if (!selectedItem) return;
        updateItemGps(selectedItem.id, () => ({ ...EMPTY_GPS }));
        setLocationSearchQuery("");
        toast.success("已清除当前图片的 GPS 信息");
    };

    const searchSelectedLocation = async () => {
        const keyword = locationSearchQuery.trim();
        const activeItem = selectedItemRef.current;
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
            const point = await searchLocationPoint(keyword);

            if (!point) {
                toast.error("未找到该地点，请尝试更精确的名称");
                return;
            }

            updateItemGps(activeItem.id, () => ({
                enabled: true,
                lat: formatGpsValue(point.point.lat),
                lng: formatGpsValue(point.point.lng),
                locationName: point.title,
            }));
            setLocationSearchQuery(point.title);
            toast.success("已根据地点名称更新 GPS 坐标");
        } catch (error) {
            console.error(error);
            toast.error("地点搜索失败，请稍后重试");
        } finally {
            setIsSearchingLocation(false);
        }
    };

    const searchBatchLocation = async () => {
        const keyword = batchLocationSearchQuery.trim();
        if (!keyword) {
            toast.error("请输入批量 GPS 的地点名称");
            return;
        }

        setIsSearchingLocation(true);
        try {
            const point = await searchLocationPoint(keyword);
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
    };

    const generateUpdatedFile = useCallback(async (item: PhotoExifItem, exportName?: string): Promise<File> => {
        if (!item.canWriteExif) {
            throw new Error("当前格式暂不支持导出 EXIF 修改");
        }
        const nextFileName = exportName ?? getEffectiveFileName(item);
        const fileNameError = getFileNameValidationError(getFileBaseName(nextFileName));
        if (fileNameError) {
            throw new Error(fileNameError);
        }

        const outputFileName = getExportTargetFileName(item, exportName);
        const editableToSave = applyCopyrightPresetToEditable(item.editableCurrent, copyrightPreset, copyrightPresetEnabled);

        if (isPngFile(item.file)) {
            const pngBytes = new Uint8Array(await item.file.arrayBuffer());
            let sourceExif = createEmptyExifObject();
            const existingExifPayload = extractPngExifChunk(pngBytes);
            if (existingExifPayload) {
                try {
                    sourceExif = {
                        ...createEmptyExifObject(),
                        ...(piexif.load(EXIF_HEADER + bytesToBinaryString(existingExifPayload)) as Record<string, unknown>),
                    };
                } catch (error) {
                    console.warn("PNG 原图 EXIF 不可读，将创建新的 EXIF 块", item.file.name, error);
                }
            }

            const outputExif = applyEditableToExif(sourceExif, editableToSave, item.gpsCurrent);
            const exifString = piexif.dump(outputExif as Record<string, unknown>);
            const updatedPngBytes = upsertPngExifChunk(pngBytes, exifStringToPngPayload(exifString));
            const pngBlob = new Blob([updatedPngBytes as unknown as BlobPart], { type: "image/png" });
            return new File([pngBlob], outputFileName, { type: "image/png" });
        }

        const originalDataUrl = item.canOverwriteInPlace
            ? await readAsDataUrl(item.file)
            : await convertImageToJpegDataUrl(item.file);
        let sourceExif = createEmptyExifObject();
        if (item.canOverwriteInPlace) {
            try {
                sourceExif = {
                    ...createEmptyExifObject(),
                    ...(piexif.load(originalDataUrl) as Record<string, unknown>),
                };
            } catch (error) {
                console.warn("原图 EXIF 不可读，将创建新的 EXIF 块", item.file.name, error);
            }
        }

        const outputExif = applyEditableToExif(sourceExif, editableToSave, item.gpsCurrent);
        const exifString = piexif.dump(outputExif as Record<string, unknown>);

        let jpegData = originalDataUrl;
        try {
            jpegData = piexif.remove(originalDataUrl);
        } catch {
            jpegData = originalDataUrl;
        }

        const updatedDataUrl = piexif.insert(exifString, jpegData);
        return dataUrlToFile(updatedDataUrl, outputFileName);
    }, [copyrightPreset, copyrightPresetEnabled]);

    const refreshItemFromHandle = useCallback(async (item: PhotoExifItem): Promise<PhotoExifItem> => {
        if (!item.fileHandle) return item;
        const refreshedFile = await item.fileHandle.getFile();
        const refreshedItem = await buildPhotoExifItem(refreshedFile, {
            id: item.id,
            fileHandle: item.fileHandle,
            source: item.source,
            copyrightPreset,
            copyrightPresetEnabled,
        });
        URL.revokeObjectURL(item.previewUrl);
        return refreshedItem;
    }, [copyrightPreset, copyrightPresetEnabled]);

    const overwriteItemsInPlace = useCallback(async (targetItems: PhotoExifItem[]): Promise<Map<string, PhotoExifItem>> => {
        if (directoryHandle) {
            const hasDirectoryPermission = await verifyPermission(directoryHandle, true);
            if (!hasDirectoryPermission) {
                throw new Error("缺少文件夹读写权限，无法原地改写");
            }
        }

        const refreshedItems = new Map<string, PhotoExifItem>();
        for (const item of targetItems) {
            const handle = item.fileHandle;
            if (!handle) continue;
            const hasPermission = await verifyPermission(handle, true);
            if (!hasPermission) {
                throw new Error(`缺少 ${item.file.name} 的写入权限`);
            }
            const nextFileName = getEffectiveFileName(item);
            const output = await generateUpdatedFile(item, nextFileName);
            let writeHandle = handle;

            if (directoryHandle && nextFileName !== item.file.name) {
                try {
                    const existingHandle = await directoryHandle.getFileHandle(nextFileName);
                    if (existingHandle && nextFileName !== item.file.name) {
                        throw new Error(`目标文件名 ${nextFileName} 已存在，请先更换名称`);
                    }
                } catch (error) {
                    if ((error as Error).name !== "NotFoundError") {
                        throw error;
                    }
                }
                writeHandle = await directoryHandle.getFileHandle(nextFileName, { create: true });
            }

            const writable = await writeHandle.createWritable();
            await writable.write(output);
            await writable.close();

            if (directoryHandle && nextFileName !== item.file.name) {
                await directoryHandle.removeEntry(item.file.name);
            }

            const refreshed = await refreshItemFromHandle({
                ...item,
                fileHandle: writeHandle,
                currentFileName: nextFileName,
            });
            refreshedItems.set(item.id, refreshed);
        }
        return refreshedItems;
    }, [directoryHandle, generateUpdatedFile, refreshItemFromHandle]);

    const openImportConfirmDialog = (persistInPlace = false) => {
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

        const sourceItem = items.find((item) => item.id === selectedImportSourceId);
        if (!sourceItem) {
            toast.error("来源图片不存在，请重新选择");
            return;
        }

        setPendingImportPersistInPlace(persistInPlace);
        setImportScopeSelection(defaultImportScopeSelection);
        setIsImportConfirmDialogOpen(true);
    };

    const confirmImportSelectedSourceMetadata = async () => {
        if (!selectedItem) {
            toast.error("请先选择目标图片");
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

        const sourceItem = items.find((item) => item.id === selectedImportSourceId);
        if (!sourceItem) {
            toast.error("来源图片不存在，请重新选择");
            return;
        }

        const stagedItem = applySourceMetadataToItem(selectedItem, sourceItem, importScopeSelection);
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
            const refreshedItems = await overwriteItemsInPlace([stagedItem]);
            setItems((previous) => previous.map((item) => refreshedItems.get(item.id) ?? item));
            toast.success("已按所选范围导入并原地改写当前图片");
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "原地改写失败，请重试");
        } finally {
            setIsOverwritingSelected(false);
        }
    };

    const overwriteSelectedInPlace = async () => {
        if (!selectedItem) {
            toast.error("请先选择图片");
            return;
        }
        if (!selectedItem.canOverwriteInPlace || !selectedItem.fileHandle) {
            toast.error("当前图片只有 JPEG / PNG 支持原地改写，请先导出修改后图片");
            return;
        }
        if (!isDirty(selectedItem)) {
            toast.error("当前图片没有待写回的修改");
            return;
        }

        setIsOverwritingSelected(true);
        try {
            const refreshedItems = await overwriteItemsInPlace([selectedItem]);
            setItems((previous) => previous.map((item) => refreshedItems.get(item.id) ?? item));
            toast.success("已原地改写当前图片的 EXIF");
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "原地改写失败，请重试");
        } finally {
            setIsOverwritingSelected(false);
        }
    };

    const exportSelected = async () => {
        if (!selectedItem) {
            toast.error("请先选择图片");
            return;
        }
        if (!selectedItem.canWriteExif) {
            toast.error("当前仅支持导出修改后的 JPEG / PNG / TIF");
            return;
        }

        setIsExportingSingle(true);
        try {
            const output = await generateUpdatedFile(selectedItem);
            saveAs(output, output.name);
            toast.success("已导出修改后的图片");
        } catch (error) {
            console.error(error);
            toast.error("导出失败，请检查图片格式或重试");
        } finally {
            setIsExportingSingle(false);
        }
    };

    const exportBatch = async () => {
        const writableDirtyItems = items.filter((item) => item.canWriteExif && isDirty(item));
        if (!writableDirtyItems.length) {
            toast.error("没有可导出的已修改图片");
            return;
        }

        setIsExportingBatch(true);
        try {
            if (writableDirtyItems.length === 1) {
                const output = await generateUpdatedFile(writableDirtyItems[0]);
                saveAs(output, output.name);
            } else {
                const zip = new JSZip();
                for (const item of writableDirtyItems) {
                    const output = await generateUpdatedFile(item);
                    zip.file(output.name, output);
                }
                const content = await zip.generateAsync({ type: "blob" });
                saveAs(content, "photo-exif-updated.zip");
            }
            toast.success(`已导出 ${writableDirtyItems.length} 张修改后的图片`);
        } catch (error) {
            console.error(error);
            toast.error("批量导出失败，请重试");
        } finally {
            setIsExportingBatch(false);
        }
    };

    const overwriteBatchInPlace = async () => {
        const writableDirtyItems = items.filter((item) => item.canOverwriteInPlace && item.fileHandle && isDirty(item));
        if (!writableDirtyItems.length) {
            toast.error("没有可原地改写的已修改 JPEG / PNG，请先从文件夹载入图片");
            return;
        }

        setIsOverwritingInPlace(true);
        try {
            const refreshedItems = await overwriteItemsInPlace(writableDirtyItems);
            setItems((previous) => previous.map((item) => refreshedItems.get(item.id) ?? item));
            toast.success(`已原地改写 ${refreshedItems.size} 张 JPEG / PNG 图片的 EXIF`);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "原地改写失败，请重试");
        } finally {
            setIsOverwritingInPlace(false);
        }
    };

    const selectedGpsPoint = selectedItem ? editableGpsToPoint(selectedItem.gpsCurrent) : null;
    const selectedFileExtension = selectedItem ? getFileExtension(selectedItem.currentFileName) : "";
    const selectedFileNameValue = selectedItem ? getFileBaseName(selectedItem.currentFileName) : "";
    const selectedFileNameError = selectedItem ? getFileNameValidationError(selectedFileNameValue) : "";
    const selectedDateTimeOriginalValue = selectedItem ? exifDateTimeToLocalInputValue(selectedItem.editableCurrent.dateTimeOriginal) : "";
    const selectedDateTimeDigitizedValue = selectedItem ? exifDateTimeToLocalInputValue(selectedItem.editableCurrent.dateTimeDigitized) : "";

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 px-4 py-4 lg:px-5">
            <div className="mx-auto max-w-[1680px] space-y-5">
                <WorkbenchHeader
                    hasItems={items.length > 0}
                    dangerSubtleButtonClass={dangerSubtleButtonClass}
                    onClearAll={clearAll}
                />

                <ImportPanel
                    accentButtonClass={accentButtonClass}
                    getInputProps={getInputProps}
                    getRootProps={getRootProps}
                    isBindingDirectory={isBindingDirectory}
                    isDragActive={isDragActive}
                    isImportingDirectory={isImportingDirectory}
                    bindableCount={bindableCount}
                    directoryHandleName={directoryHandle?.name ?? null}
                    hasItems={items.length > 0}
                    itemCount={items.length}
                    linkedCount={linkedCount}
                    openFilePicker={open}
                    onBindDirectory={() => void handleBindUploadedItemsToDirectory()}
                    onSelectDirectory={() => void handleSelectDirectory()}
                    primaryButtonClass={primaryButtonClass}
                    secondaryButtonClass={secondaryButtonClass}
                />

                {items.length > 0 && (
                    <>
                        <StatsOverview
                            dirtyCount={dirtyCount}
                            gpsCount={gpsCount}
                            inplaceCount={inplaceCount}
                            itemCount={items.length}
                            writableCount={writableCount}
                        />

                        <div className="grid gap-5 xl:grid-cols-12">
                            <Card className="xl:col-span-3 border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ImageIcon className="w-5 h-5" />
                                        图片列表
                                    </CardTitle>
                                    <CardDescription>
                                        先上传图片筛选与查看；JPEG / PNG 可授权后原地写回，TIF 可导出修改
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <ScrollArea className="h-[calc(100vh-15rem)] min-h-[520px] pr-2">
                                        <div className="space-y-3">
                                            {items.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setSelectedId(item.id)}
                                                    className={`w-full text-left rounded-2xl border p-3 ${
                                                        item.id === selectedId
                                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                                    }`}
                                                >
                                                    <div className="flex gap-3">
                                                        <img
                                                            src={item.previewUrl}
                                                            alt={getEffectiveFileName(item)}
                                                            className="w-20 h-20 rounded-xl object-cover bg-slate-100 dark:bg-slate-800"
                                                        />
                                                        <div className="min-w-0 flex-1 space-y-2">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <p className="font-medium text-sm break-all">{getEffectiveFileName(item)}</p>
                                                                    {getEffectiveFileName(item) !== item.originalFileName && (
                                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 break-all">
                                                                            原名: {item.originalFileName}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        removeItem(item.id);
                                                                    }}
                                                                    className="text-slate-400 hover:text-red-500"
                                                                    aria-label={`删除 ${getEffectiveFileName(item)}`}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {item.id === selectedId && <Badge className="bg-blue-600 text-white hover:bg-blue-600">当前目标图</Badge>}
                                                                {item.id === selectedImportSourceId && (
                                                                    <Badge className="bg-violet-600 text-white hover:bg-violet-600">当前来源图</Badge>
                                                                )}
                                                                {item.gpsCurrent.locationName.trim() && <Badge variant="outline">GPS地址</Badge>}
                                                                {!item.gpsCurrent.locationName.trim() && editableGpsToPoint(item.gpsCurrent) && (
                                                                    <Badge variant="outline">含 GPS</Badge>
                                                                )}
                                                                {isDirty(item) && (
                                                                    <Badge className="bg-amber-500 text-white hover:bg-amber-500">已修改</Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                                                                <p>{item.summary.make || "未知品牌"} {item.summary.model || ""}</p>
                                                                <p>{item.summary.dateTimeOriginal || "未读取到拍摄时间"}</p>
                                                                {item.gpsCurrent.locationName.trim() && <p>{item.gpsCurrent.locationName}</p>}
                                                                <p>{item.summary.gps || "无 GPS"}</p>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 pt-1">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className={secondaryButtonClass}
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        toggleImportSource(item.id);
                                                                    }}
                                                                >
                                                                    {item.id === selectedImportSourceId ? "取消来源图" : "设为来源图"}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>

                            <div className="xl:col-span-9 space-y-5">
                                <Tabs defaultValue="viewer" className="space-y-3">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="viewer">单图查看与修改</TabsTrigger>
                                        <TabsTrigger value="batch">批量处理</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="viewer" className="space-y-4">
                                        {selectedItem ? (
                                            <>
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
                                                                        onClick={() => void exportSelected()}
                                                                        disabled={!selectedItem.canWriteExif || isExportingSingle}
                                                                    >
                                                                        <Download className="w-4 h-4 mr-2" />
                                                                        {isExportingSingle ? "导出中..." : "导出修改后图片"}
                                                                    </Button>
                                                                    <Button
                                                                        className={dangerButtonClass}
                                                                        onClick={() => void overwriteSelectedInPlace()}
                                                                        disabled={!selectedItem.canOverwriteInPlace || !selectedItem.fileHandle || !isDirty(selectedItem) || isOverwritingSelected}
                                                                    >
                                                                        {/* <AlertCircle className="w-4 h-4 mr-1" /> */}
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
                                                                            onChange={(event) => updateSelectedFileName(event.target.value)}
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
                                                                        onChange={(event) => updateSelectedDateTimeField("dateTimeOriginal", event.target.value)}
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
                                                                        onChange={(event) => updateSelectedDateTimeField("dateTimeDigitized", event.target.value)}
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
                                                                onChange={handleImportSourceFileChange}
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
                                                                        onChange={(event) => setSelectedImportSourceId(event.target.value)}
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
                                                                        onClick={() => openImportConfirmDialog(false)}
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
                                                                        <Button variant="outline" className={dangerSubtleButtonClass} onClick={clearSelectedGps} disabled={!selectedItem.canWriteExif}>
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
                                                                                onChange={(event) => setLocationSearchQuery(event.target.value)}
                                                                                onKeyDown={(event) => {
                                                                                    if (event.key === "Enter") {
                                                                                        event.preventDefault();
                                                                                        void searchSelectedLocation();
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <Button
                                                                                className={primaryButtonClass}
                                                                                onClick={() => void searchSelectedLocation()}
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
                                                                            onChange={(event) => updateSelectedGpsField("lat", event.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="selected-gps-lng">经度</Label>
                                                                        <Input
                                                                            id="selected-gps-lng"
                                                                            value={selectedItem.gpsCurrent.lng}
                                                                            placeholder="例如 121.473701"
                                                                            disabled={!selectedItem.canWriteExif}
                                                                            onChange={(event) => updateSelectedGpsField("lng", event.target.value)}
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
                                                                        <Button variant="outline" className={secondaryButtonClass} onClick={applyCopyrightPresetToAll} disabled={!copyrightPresetEnabled}>
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
                                                                        <Switch checked={copyrightPresetEnabled} onCheckedChange={setCopyrightPresetEnabled} />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="flex w-full items-start justify-between gap-4 text-left"
                                                                        onClick={() => setIsCopyrightPresetExpanded((previous) => !previous)}
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
                                                                                        onChange={(event) => updateCopyrightPresetField("artist", event.target.value)}
                                                                                    />
                                                                                </div>
                                                                                <div className="space-y-2">
                                                                                    <Label htmlFor="copyright-preset-text">默认版权</Label>
                                                                                    <Input
                                                                                        id="copyright-preset-text"
                                                                                        value={copyrightPreset.copyright}
                                                                                        placeholder="例如 Copyright 2026 笑谈间气吐霓虹. All Rights Reserved."
                                                                                        onChange={(event) => updateCopyrightPresetField("copyright", event.target.value)}
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
                                            </>
                                        ) : (
                                            <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                                <CardContent className="p-16 text-center text-slate-500 dark:text-slate-400">
                                                    请选择左侧图片开始查看
                                                </CardContent>
                                            </Card>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="batch" className="space-y-6">
                                        <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <PencilLine className="w-5 h-5" />
                                                    批量改名助手
                                                </CardTitle>
                                                <CardDescription>
                                                    把常和 EXIF 联动使用的改名规则直接放进工作台；应用后会进入当前图片的导出/原地写回文件名
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="pt-0 space-y-6">
                                                <div className="grid gap-4 xl:grid-cols-3">
                                                    {RENAME_RULE_DEFINITIONS.map((definition) => (
                                                        <div key={definition.type} className="space-y-2">
                                                            <Label htmlFor={`rename-rule-${definition.type}`}>{definition.label}</Label>
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    id={`rename-rule-${definition.type}`}
                                                                    value={renameRuleInputs[definition.type]}
                                                                    placeholder={definition.placeholder}
                                                                    onChange={(event) => updateRenameRuleInput(definition.type, event.target.value)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === "Enter") {
                                                                            event.preventDefault();
                                                                            submitRenameRule(definition.type);
                                                                        }
                                                                    }}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className={secondaryButtonClass}
                                                                    onClick={() => submitRenameRule(definition.type)}
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
                                                                        onClick={() => removeRenameRule(rule.id)}
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
                                                                onChange={(event) => setRenameFilterKeyword(event.target.value)}
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className={secondaryButtonClass}
                                                                onClick={() => setRenameFilterKeyword("")}
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
                                                        onClick={applyRenameRulesToWorkbench}
                                                        disabled={!renameRules.length || !renamePreviewRows.length}
                                                    >
                                                        <PencilLine className="w-4 h-4 mr-2" />
                                                        应用到当前工作台
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" className={dangerSubtleButtonClass} onClick={clearRenameRules}>
                                                        <RotateCcw className="w-4 h-4 mr-2" />
                                                        清空规则
                                                    </Button>
                                                </div>

                                                <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-medium">改名预览</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                真正落盘发生在后续“导出已修改图片”或“原地改写已修改 JPEG / PNG”
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

                                        <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Upload className="w-5 h-5" />
                                                    批量来源图导入
                                                </CardTitle>
                                                <CardDescription>
                                                    选择一张来源图后，可把它的 EXIF 与 GPS 按范围导入到其它全部可导出图片
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="pt-0 space-y-6">
                                                <div className="flex flex-wrap gap-2">
                                                    <Button variant="outline" className={secondaryButtonClass} onClick={setSelectedAsBatchImportSource}>
                                                        从当前图片设为来源图
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className={secondaryButtonClass}
                                                        onClick={() => setBatchImportScopeSelection(createImportScopeSelection(["gps"]))}
                                                    >
                                                        只导入GPS
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className={secondaryButtonClass}
                                                        onClick={() => setBatchImportScopeSelection(createImportScopeSelection(["time"]))}
                                                    >
                                                        只导入时间
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className={secondaryButtonClass}
                                                        onClick={() => setBatchImportScopeSelection(DEFAULT_IMPORT_SCOPE_SELECTION)}
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
                                                            onChange={(event) => setBatchImportSourceId(event.target.value)}
                                                            className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm ring-offset-background dark:border-slate-800"
                                                        >
                                                            <option value="">请选择来源图片</option>
                                                            {batchImportSourceOptions.map((item) => (
                                                                <option key={item.id} value={item.id}>
                                                                    {getEffectiveFileName(item)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300 space-y-1">
                                                        <p>目标图片：{batchImportTargetItems.length} 张</p>
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
                                                                    setBatchImportScopeSelection((previous) => ({
                                                                        ...previous,
                                                                        [scope.key]: event.target.checked,
                                                                    }))
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
                                                    <Button className={accentButtonClass} size="sm" onClick={() => void applyBatchSourceImport(false)}>
                                                        导入到全部图片
                                                    </Button>
                                                    {/* <Button
                                                        className={dangerButtonClass}
                                                        size="sm"
                                                        onClick={() => void applyBatchSourceImport(true)}
                                                        disabled={isOverwritingInPlace}
                                                    >
                                                        <AlertCircle className="w-4 h-4 mr-1" />
                                                        <Save className="w-4 h-4 mr-2" />
                                                        {isOverwritingInPlace ? "写回中..." : "导入并原地写回已授权 JPEG / PNG"}
                                                    </Button> */}
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
                                                    默认只覆盖你填写的字段；打开“空值也覆盖”后，留空字段会清空原有值
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="pt-0 space-y-6">
                                                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium">空值也覆盖</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            打开后，批量表单里未填写的字段也会写成空值
                                                        </p>
                                                    </div>
                                                    <Switch checked={batchOverwriteEmpty} onCheckedChange={setBatchOverwriteEmpty} />
                                                </div>

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
                                                                onChange={(event) => updateBatchEditableField(field.key, event.target.value)}
                                                            />
                                                            {(field.key === "dateTimeOriginal" || field.key === "dateTimeDigitized") && (
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                    自动转换为 EXIF 时间格式后批量应用
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div>
                                                            <h3 className="text-base font-semibold flex items-center gap-2">
                                                                <LocateFixed className="w-4 h-4" />
                                                                批量 GPS 处理
                                                            </h3>
                                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                                可手动统一设置 GPS，或从一张已有定位的照片同步到全部可导出图片
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button variant="outline" className={secondaryButtonClass} onClick={syncBatchGpsFromSelected}>
                                                                从当前图片同步
                                                            </Button>
                                                            <Button variant="outline" className={dangerSubtleButtonClass} onClick={clearBatchGpsConfig}>
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
                                                            onChange={(event) => {
                                                                const nextId = event.target.value;
                                                                setBatchGpsSourceId(nextId);
                                                                const sourceItem = items.find((item) => item.id === nextId);
                                                                if (sourceItem) {
                                                                    setBatchGps(cloneEditableGps(sourceItem.gpsCurrent));
                                                                }
                                                            }}
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
                                                                    onChange={(event) => setBatchLocationSearchQuery(event.target.value)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === "Enter") {
                                                                            event.preventDefault();
                                                                            void searchBatchLocation();
                                                                        }
                                                                    }}
                                                                />
                                                                <Button
                                                                    className={primaryButtonClass}
                                                                    onClick={() => void searchBatchLocation()}
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
                                                                onChange={(event) => updateBatchGpsField("lat", event.target.value)}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="batch-gps-lng">批量经度</Label>
                                                            <Input
                                                                id="batch-gps-lng"
                                                                value={batchGps.lng}
                                                                placeholder="例如 121.473701"
                                                                onChange={(event) => updateBatchGpsField("lng", event.target.value)}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="batch-gps-location">地点名称</Label>
                                                            <Input
                                                                id="batch-gps-location"
                                                                value={batchGps.locationName}
                                                                placeholder="例如 上海外滩"
                                                                onChange={(event) => updateBatchGpsField("locationName", event.target.value)}
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
                                                        <p>3. 打开“空值也覆盖”且 GPS 配置为空时，会批量清除全部可导出图片的 GPS。</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-900/60">
                                                    <Button onClick={applyBatchChanges} size="sm" className={primaryButtonClass}>
                                                        <PencilLine className="w-4 h-4 mr-2" />
                                                        应用到全部图片
                                                    </Button>
                                                    <Button variant="outline" size="sm" className={dangerSubtleButtonClass} onClick={resetAllEditable}>
                                                        <RotateCcw className="w-4 h-4 mr-2" />
                                                        恢复全部修改
                                                    </Button>
                                                    <Button variant="outline" size="sm" className={secondaryButtonClass} onClick={() => void exportBatch()} disabled={isExportingBatch}>
                                                        <Download className="w-4 h-4 mr-2" />
                                                        {isExportingBatch ? "导出中..." : "导出已修改图片"}
                                                    </Button>
                                                    <Button className={dangerButtonClass} size="sm" onClick={() => void overwriteBatchInPlace()} disabled={isOverwritingInPlace}>
                                                        {/* <AlertCircle className="w-4 h-4 mr-1" /> */}
                                                        <Save className="w-4 h-4 mr-2" />
                                                        {isOverwritingInPlace ? "原地改写中..." : "原地改写已修改 JPEG / PNG"}
                                                    </Button>
                                                </div>

                                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-600 dark:text-slate-300 space-y-2">
                                                    <p>原地改写说明：</p>
                                                    <p>1. 仅对从“选择文件夹并授权写入”导入的 JPEG / PNG 生效。</p>
                                                    <p>2. 会直接覆盖原文件，请先确认字段修改无误。</p>
                                                    <p>3. 原地写回后，列表会自动刷新为最新 EXIF 状态。</p>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <FileImage className="w-5 h-5" />
                                                    批量逐张编辑与概览
                                                </CardTitle>
                                                <CardDescription>
                                                    支持逐张调整文件名和时间，并快速查看哪些图片可导出、可原地改写或包含位置信息
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="pt-0">
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
                                                                    <Button variant="outline" className={secondaryButtonClass} onClick={() => setSelectedId(item.id)}>
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
                                                                                    onChange={(event) => updateItemFileName(item.id, event.target.value)}
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
                                                                                onChange={(event) => updateItemDateTimeField(item.id, "dateTimeOriginal", event.target.value)}
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
                                                                                onChange={(event) => updateItemDateTimeField(item.id, "dateTimeDigitized", event.target.value)}
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
                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    </>
                )}
            </div>
            <Dialog open={isImportConfirmDialogOpen} onOpenChange={setIsImportConfirmDialogOpen}>
                <DialogContent className="max-w-5xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                    <DialogHeader>
                        <DialogTitle>选择要导入的信息</DialogTitle>
                        <DialogDescription className="text-slate-600 dark:text-slate-400">
                            {pendingImportPersistInPlace
                                ? "先勾选需要从 B 图导入到 A 图的内容，再根据右侧差异确认是否执行。确认后会直接写回原文件。"
                                : "先勾选需要从 B 图导入到 A 图的内容，再根据右侧差异确认是否执行。"}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedItem && selectedImportSourceItem && (
                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">A 图（目标图）</p>
                                    <p className="mt-1 text-sm font-medium break-all">{getEffectiveFileName(selectedItem)}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">B 图（来源图）</p>
                                    <p className="mt-1 text-sm font-medium break-all">{getEffectiveFileName(selectedImportSourceItem)}</p>
                                </div>
                            </div>
                            <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={secondaryButtonClass}
                                            onClick={() => setImportScopeSelection(createImportScopeSelection(["gps"]))}
                                        >
                                            只导入GPS
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={secondaryButtonClass}
                                            onClick={() => setImportScopeSelection(createImportScopeSelection(["time"]))}
                                        >
                                            只导入时间
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={secondaryButtonClass}
                                            onClick={() => setImportScopeSelection(defaultImportScopeSelection)}
                                        >
                                            恢复默认勾选
                                        </Button>
                                    </div>
                                    {importScopeSummaries.map((scope) => (
                                        <label
                                            key={scope.key}
                                            className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${
                                                importScopeSelection[scope.key]
                                                    ? "border-blue-500 bg-blue-50/70 dark:border-blue-500/70 dark:bg-blue-950/20"
                                                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                checked={importScopeSelection[scope.key]}
                                                onChange={(event) =>
                                                    setImportScopeSelection((previous) => ({
                                                        ...previous,
                                                        [scope.key]: event.target.checked,
                                                    }))
                                                }
                                            />
                                            <div className="min-w-0 space-y-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-sm font-medium">{scope.label}</p>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        {scope.diffCount ? `${scope.diffCount} 处差异` : "无差异"}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{scope.description}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                                        <div>
                                            <p className="text-sm font-medium">A / B 差异预览</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                仅展示当前勾选分类；左侧是 A 图当前值，右侧是 B 图来源值
                                            </p>
                                        </div>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {Object.values(importScopeSelection).filter(Boolean).length} 类已选
                                        </span>
                                    </div>
                                    <ScrollArea className="h-[360px] pr-4">
                                        <div className="space-y-4 pt-4">
                                            {importScopeSummaries.filter((scope) => importScopeSelection[scope.key]).length > 0 ? (
                                                importScopeSummaries
                                                    .filter((scope) => importScopeSelection[scope.key])
                                                    .map((scope) => {
                                                        const changedRows = scope.diffRows.filter((row) => row.changed);
                                                        return (
                                                            <div key={scope.key} className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <p className="text-sm font-medium">{scope.label}</p>
                                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                                        {changedRows.length ? `${changedRows.length} 处将被覆盖` : "当前无差异"}
                                                                    </span>
                                                                </div>
                                                                {changedRows.length ? (
                                                                    <div className="space-y-2">
                                                                        {changedRows.map((row) => (
                                                                            <div
                                                                                key={`${scope.key}-${row.fieldLabel}`}
                                                                                className={`grid gap-2 rounded-xl p-3 ${
                                                                                    row.willClearTarget
                                                                                        ? "border border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20"
                                                                                        : "bg-slate-50/70 dark:bg-slate-900/50"
                                                                                }`}
                                                                            >
                                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{row.fieldLabel}</p>
                                                                                    {row.willClearTarget && (
                                                                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
                                                                                            导入后将清空
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="grid gap-2 md:grid-cols-2">
                                                                                    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                                                                                        <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">A 图当前值</p>
                                                                                        <p className="mt-1 text-sm break-words">{row.targetValue}</p>
                                                                                    </div>
                                                                                    <div
                                                                                        className={`rounded-lg border p-3 ${
                                                                                            row.willClearTarget
                                                                                                ? "border-amber-300 bg-amber-100/80 dark:border-amber-900/60 dark:bg-amber-950/40"
                                                                                                : "border-blue-200 bg-blue-50/80 dark:border-blue-900/60 dark:bg-blue-950/30"
                                                                                        }`}
                                                                                    >
                                                                                        <p
                                                                                            className={`text-[11px] uppercase tracking-wide ${
                                                                                                row.willClearTarget
                                                                                                    ? "text-amber-700 dark:text-amber-200"
                                                                                                    : "text-blue-600 dark:text-blue-300"
                                                                                            }`}
                                                                                        >
                                                                                            B 图来源值
                                                                                        </p>
                                                                                        <p className="mt-1 text-sm break-words">{row.sourceValue}</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-slate-500 dark:text-slate-400">该分类下 A / B 当前没有差异，导入后不会有可见变化。</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                            ) : (
                                                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                                    请至少勾选一类要导入的信息。
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button variant="outline" className={secondaryButtonClass} onClick={() => setIsImportConfirmDialogOpen(false)}>
                            取消
                        </Button>
                        <Button
                            className={pendingImportPersistInPlace ? dangerButtonClass : accentButtonClass}
                            disabled={!selectedItem || !selectedImportSourceItem || !Object.values(importScopeSelection).some(Boolean)}
                            onClick={() => void confirmImportSelectedSourceMetadata()}
                        >
                            {pendingImportPersistInPlace ? "确认导入并原地写回" : "确认导入到当前"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isUploadPermissionDialogOpen} onOpenChange={setIsUploadPermissionDialogOpen}>
                <DialogContent className="max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                    <DialogHeader>
                        <DialogTitle>已上传图片</DialogTitle>
                        <DialogDescription className="text-slate-600 dark:text-slate-400">
                            已读取 {recentUploadedCount} 张图片。若要后续直接写回 JPEG / PNG 原文件，现在请继续授权图片所在文件夹的读取与写入权限。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
                        授权后，已上传的 JPEG / PNG 图片就可以直接写回原文件；不授权也可以继续查看和导出修改后图片。
                    </div>
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button variant="outline" className={secondaryButtonClass} onClick={() => setIsUploadPermissionDialogOpen(false)}>
                            稍后再说
                        </Button>
                        <Button
                            className={accentButtonClass}
                            onClick={() => {
                                setIsUploadPermissionDialogOpen(false);
                                void handleBindUploadedItemsToDirectory();
                            }}
                        >
                            授权文件夹读取权限
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PhotoExifWorkbench;
