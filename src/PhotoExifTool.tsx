import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExifReader from "exifreader";
import piexif from "piexifjs";
import { useDropzone } from "react-dropzone";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import {
    AlertCircle,
    Camera,
    CheckCircle2,
    Download,
    FileImage,
    Files,
    Image as ImageIcon,
    Info,
    MapPin,
    PencilLine,
    RotateCcw,
    Trash2,
    Upload,
} from "lucide-react";
import { toast } from "sonner";
import DarkToggle from "@/components/DarkToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type EditableExifKey =
    | "make"
    | "model"
    | "lensModel"
    | "software"
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
    artist: string;
    copyright: string;
    imageDescription: string;
    dateTimeOriginal: string;
    dateTimeDigitized: string;
}

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

interface ExifTagRow {
    key: string;
    label: string;
    value: string;
}

interface PhotoExifItem {
    id: string;
    file: File;
    previewUrl: string;
    canWriteExif: boolean;
    summary: ExifSummary;
    editableOriginal: EditableExif;
    editableCurrent: EditableExif;
    tags: ExifTagRow[];
}

interface PiexifData {
    [key: string]: unknown;
    "0th": Record<number, unknown>;
    Exif: Record<number, unknown>;
    GPS: Record<number, unknown>;
    Interop: Record<number, unknown>;
    "1st": Record<number, unknown>;
    thumbnail: unknown;
}

const EMPTY_EDITABLE: EditableExif = {
    make: "",
    model: "",
    lensModel: "",
    software: "",
    artist: "",
    copyright: "",
    imageDescription: "",
    dateTimeOriginal: "",
    dateTimeDigitized: "",
};

const EDITABLE_FIELDS: Array<{ key: EditableExifKey; label: string; placeholder: string }> = [
    { key: "make", label: "品牌", placeholder: "例如 Sony / Fujifilm" },
    { key: "model", label: "机型", placeholder: "例如 A7R5 / X100VI" },
    { key: "lensModel", label: "镜头", placeholder: "例如 FE 35mm F1.4 GM" },
    { key: "software", label: "软件", placeholder: "例如 Lightroom / Capture One" },
    { key: "artist", label: "作者", placeholder: "摄影师或版权主体" },
    { key: "copyright", label: "版权", placeholder: "例如 Copyright 2026 LSY" },
    { key: "imageDescription", label: "描述", placeholder: "简短说明或拍摄主题" },
    { key: "dateTimeOriginal", label: "拍摄时间", placeholder: "格式 2026:07:12 18:30:00" },
    { key: "dateTimeDigitized", label: "数字化时间", placeholder: "格式 2026:07:12 18:30:00" },
];

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

const getTagText = (tags: Record<string, any>, key: string): string => {
    const tag = tags[key];
    if (!tag) return "";
    return String(tag.description ?? formatTagValue(tag.value) ?? "").trim();
};

const toTagRows = (tags: Record<string, any>): ExifTagRow[] =>
    Object.entries(tags)
        .filter(([name]) => !["MakerNote", "Thumbnail", "PhotoshopThumbnail"].includes(name))
        .map(([name, tag]) => ({
            key: name,
            label: name,
            value: String(tag?.description ?? formatTagValue(tag?.value) ?? ""),
        }))
        .filter((tag) => tag.value)
        .sort((a, b) => a.label.localeCompare(b.label));

const isWritableJpeg = (file: File): boolean => /image\/jpeg/i.test(file.type) || /\.jpe?g$/i.test(file.name);

const buildSummary = (file: File, tags: Record<string, any>): ExifSummary => {
    const width = getTagText(tags, "Image Width");
    const height = getTagText(tags, "Image Height");
    const latitude = getTagText(tags, "GPSLatitude");
    const longitude = getTagText(tags, "GPSLongitude");

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
        gps: latitude && longitude ? `${latitude}, ${longitude}` : "",
        resolution: width && height ? `${width} x ${height}` : file.type || "未知格式",
    };
};

const buildEditable = (tags: Record<string, any>): EditableExif => ({
    make: getTagText(tags, "Make"),
    model: getTagText(tags, "Model"),
    lensModel: getTagText(tags, "LensModel"),
    software: getTagText(tags, "Software"),
    artist: getTagText(tags, "Artist"),
    copyright: getTagText(tags, "Copyright"),
    imageDescription: getTagText(tags, "ImageDescription"),
    dateTimeOriginal: getTagText(tags, "DateTimeOriginal"),
    dateTimeDigitized: getTagText(tags, "DateTimeDigitized"),
});

const createEmptyExifObject = (): PiexifData => ({
    "0th": {} as Record<number, unknown>,
    Exif: {} as Record<number, unknown>,
    GPS: {} as Record<number, unknown>,
    Interop: {} as Record<number, unknown>,
    "1st": {} as Record<number, unknown>,
    thumbnail: null as unknown,
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

const applyEditableToExif = (source: PiexifData, editable: EditableExif): PiexifData => {
    const exifObject = {
        "0th": { ...(source["0th"] ?? {}) },
        Exif: { ...(source.Exif ?? {}) },
        GPS: { ...(source.GPS ?? {}) },
        Interop: { ...(source.Interop ?? {}) },
        "1st": { ...(source["1st"] ?? {}) },
        thumbnail: source.thumbnail ?? null,
    };

    setOrDelete(exifObject["0th"], piexif.ImageIFD.Make, editable.make);
    setOrDelete(exifObject["0th"], piexif.ImageIFD.Model, editable.model);
    setOrDelete(exifObject["0th"], piexif.ImageIFD.Software, editable.software);
    setOrDelete(exifObject["0th"], piexif.ImageIFD.Artist, editable.artist);
    setOrDelete(exifObject["0th"], piexif.ImageIFD.Copyright, editable.copyright);
    setOrDelete(exifObject["0th"], piexif.ImageIFD.ImageDescription, editable.imageDescription);
    setOrDelete(exifObject["0th"], piexif.ImageIFD.DateTime, editable.dateTimeOriginal || editable.dateTimeDigitized);
    setOrDelete(exifObject.Exif, piexif.ExifIFD.LensModel, editable.lensModel);
    setOrDelete(exifObject.Exif, piexif.ExifIFD.DateTimeOriginal, editable.dateTimeOriginal);
    setOrDelete(exifObject.Exif, piexif.ExifIFD.DateTimeDigitized, editable.dateTimeDigitized);

    return exifObject;
};

const isDirty = (item: PhotoExifItem): boolean =>
    EDITABLE_FIELDS.some(({ key }) => item.editableCurrent[key] !== item.editableOriginal[key]);

const PhotoExifTool: React.FC = () => {
    const [items, setItems] = useState<PhotoExifItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [batchEditable, setBatchEditable] = useState<EditableExif>(EMPTY_EDITABLE);
    const [batchOverwriteEmpty, setBatchOverwriteEmpty] = useState(false);
    const [isExportingSingle, setIsExportingSingle] = useState(false);
    const [isExportingBatch, setIsExportingBatch] = useState(false);
    const itemsRef = useRef<PhotoExifItem[]>([]);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    useEffect(() => () => {
        itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    }, []);

    const selectedItem = useMemo(
        () => items.find((item) => item.id === selectedId) ?? null,
        [items, selectedId],
    );

    const writableCount = useMemo(
        () => items.filter((item) => item.canWriteExif).length,
        [items],
    );

    const dirtyCount = useMemo(
        () => items.filter((item) => item.canWriteExif && isDirty(item)).length,
        [items],
    );

    const gpsCount = useMemo(
        () => items.filter((item) => item.summary.gps).length,
        [items],
    );

    const handleFiles = useCallback(async (files: File[]) => {
        if (!files.length) return;

        try {
            const nextItems = await Promise.all(
                files.map(async (file) => {
                    let tags: Record<string, any> = {};

                    try {
                        tags = await ExifReader.load(file);
                    } catch (error) {
                        console.warn("读取 EXIF 失败", file.name, error);
                    }

                    const editable = buildEditable(tags);

                    return {
                        id: crypto.randomUUID(),
                        file,
                        previewUrl: URL.createObjectURL(file),
                        canWriteExif: isWritableJpeg(file),
                        summary: buildSummary(file, tags),
                        editableOriginal: editable,
                        editableCurrent: { ...editable },
                        tags: toTagRows(tags),
                    } satisfies PhotoExifItem;
                }),
            );

            setItems((previous) => [...previous, ...nextItems]);
            setSelectedId((previous) => previous ?? nextItems[0]?.id ?? null);
            toast.success(`已读取 ${nextItems.length} 张图片的 EXIF 信息`);
        } catch (error) {
            console.error(error);
            toast.error("读取图片失败，请重试");
        }
    }, []);

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            void handleFiles(acceptedFiles);
        },
        [handleFiles],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: true,
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

    const clearAll = () => {
        items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        setItems([]);
        setSelectedId(null);
        setBatchEditable(EMPTY_EDITABLE);
        toast.success("已清空图片列表");
    };

    const updateSelectedField = (key: EditableExifKey, value: string) => {
        if (!selectedItem) return;

        setItems((previous) =>
            previous.map((item) =>
                item.id === selectedItem.id
                    ? {
                        ...item,
                        editableCurrent: {
                            ...item.editableCurrent,
                            [key]: value,
                        },
                    }
                    : item,
            ),
        );
    };

    const resetSelected = () => {
        if (!selectedItem) return;

        setItems((previous) =>
            previous.map((item) =>
                item.id === selectedItem.id
                    ? { ...item, editableCurrent: { ...item.editableOriginal } }
                    : item,
            ),
        );
        toast.success("已恢复该图片的原始可编辑字段");
    };

    const applyBatchChanges = () => {
        const activeFields = EDITABLE_FIELDS.filter(({ key }) => batchOverwriteEmpty || batchEditable[key].trim());
        if (!activeFields.length) {
            toast.error("请至少填写一个批量修改字段");
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

                return {
                    ...item,
                    editableCurrent: nextEditable,
                };
            }),
        );

        toast.success(`已把批量修改应用到 ${affected} 张 JPEG 图片`);
    };

    const resetAllEditable = () => {
        setItems((previous) =>
            previous.map((item) => ({
                ...item,
                editableCurrent: { ...item.editableOriginal },
            })),
        );
        toast.success("已恢复全部图片的原始可编辑字段");
    };

    const generateUpdatedFile = async (item: PhotoExifItem): Promise<File> => {
        if (!item.canWriteExif) {
            throw new Error("当前仅支持为 JPEG/JPG 写回 EXIF");
        }

        const originalDataUrl = await readAsDataUrl(item.file);
        let sourceExif = createEmptyExifObject();

        try {
            sourceExif = {
                ...createEmptyExifObject(),
                ...piexif.load(originalDataUrl),
            };
        } catch (error) {
            console.warn("原图 EXIF 不可读，将创建新的 EXIF 块", item.file.name, error);
        }

        const outputExif = applyEditableToExif(sourceExif, item.editableCurrent);
        const exifString = piexif.dump(outputExif);

        let jpegData = originalDataUrl;
        try {
            jpegData = piexif.remove(originalDataUrl);
        } catch {
            jpegData = originalDataUrl;
        }

        const updatedDataUrl = piexif.insert(exifString, jpegData);
        return dataUrlToFile(updatedDataUrl, getExportName(item.file.name));
    };

    const exportSelected = async () => {
        if (!selectedItem) {
            toast.error("请先选择图片");
            return;
        }

        if (!selectedItem.canWriteExif) {
            toast.error("当前仅支持导出修改后的 JPEG/JPG");
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
            toast.error("没有可导出的已修改 JPEG 图片");
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

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">照片 EXIF 查看与修改</h1>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            支持单图详情查看、批量概览与统一修改。当前写回导出仅支持 JPEG/JPG，其他格式先支持读取。
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <DarkToggle />
                        {items.length > 0 && (
                            <Button variant="outline" onClick={clearAll}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                清空全部
                            </Button>
                        )}
                    </div>
                </header>

                <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                    <CardContent className="p-6">
                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
                                isDragActive
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                    : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
                            }`}
                        >
                            <input {...getInputProps()} />
                            <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                            <div className="space-y-2">
                                <p className="text-lg font-medium">
                                    {isDragActive ? "释放图片开始读取" : "拖拽图片到这里，或点击选择照片"}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    可一次选择多张图片，支持查看 JPEG / PNG / WebP / HEIC / TIFF 等常见格式元数据
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {items.length > 0 && (
                    <>
                        <div className="grid gap-4 md:grid-cols-4">
                            <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300 flex items-center justify-center">
                                        <Files className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">已加载图片</p>
                                        <p className="text-2xl font-semibold">{items.length}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center justify-center">
                                        <PencilLine className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">可写回 JPEG</p>
                                        <p className="text-2xl font-semibold">{writableCount}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300 flex items-center justify-center">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">待导出修改</p>
                                        <p className="text-2xl font-semibold">{dirtyCount}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300 flex items-center justify-center">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">含 GPS 信息</p>
                                        <p className="text-2xl font-semibold">{gpsCount}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-12">
                            <Card className="lg:col-span-4 border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ImageIcon className="w-5 h-5" />
                                        图片列表
                                    </CardTitle>
                                    <CardDescription>
                                        选择一张图片查看详细 EXIF，并编辑可写回字段
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <ScrollArea className="h-[680px] pr-3">
                                        <div className="space-y-3">
                                            {items.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setSelectedId(item.id)}
                                                    className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                                                        item.id === selectedId
                                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                                    }`}
                                                >
                                                    <div className="flex gap-3">
                                                        <img
                                                            src={item.previewUrl}
                                                            alt={item.file.name}
                                                            className="w-20 h-20 rounded-xl object-cover bg-slate-100 dark:bg-slate-800"
                                                        />
                                                        <div className="min-w-0 flex-1 space-y-2">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <p className="font-medium text-sm break-all">
                                                                    {item.file.name}
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        removeItem(item.id);
                                                                    }}
                                                                    className="text-slate-400 hover:text-red-500"
                                                                    aria-label={`删除 ${item.file.name}`}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                <Badge variant="outline">
                                                                    {item.canWriteExif ? "可修改" : "只读"}
                                                                </Badge>
                                                                {isDirty(item) && (
                                                                    <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                                                                        已修改
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                                                                <p>{item.summary.make || "未知品牌"} {item.summary.model || ""}</p>
                                                                <p>{item.summary.dateTimeOriginal || "未读取到拍摄时间"}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>

                            <div className="lg:col-span-8 space-y-6">
                                <Tabs defaultValue="viewer" className="space-y-4">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="viewer">单图查看与修改</TabsTrigger>
                                        <TabsTrigger value="batch">批量处理</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="viewer" className="space-y-6">
                                        {selectedItem ? (
                                            <>
                                                <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                                    <CardContent className="p-6 grid gap-6 md:grid-cols-[320px_1fr]">
                                                        <div className="space-y-4">
                                                            <img
                                                                src={selectedItem.previewUrl}
                                                                alt={selectedItem.file.name}
                                                                className="w-full rounded-2xl object-cover bg-slate-100 dark:bg-slate-800"
                                                            />
                                                            <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                                                                <p className="break-all">{selectedItem.file.name}</p>
                                                                <p>{(selectedItem.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                                <p>{selectedItem.summary.resolution}</p>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                <Badge variant={selectedItem.canWriteExif ? "default" : "secondary"}>
                                                                    {selectedItem.canWriteExif ? "JPEG 可写回" : "当前格式只读"}
                                                                </Badge>
                                                                {selectedItem.summary.gps && (
                                                                    <Badge variant="outline">含 GPS</Badge>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-6">
                                                            <div>
                                                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                                                    <Camera className="w-5 h-5" />
                                                                    核心信息
                                                                </h2>
                                                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                                                                        <div
                                                                            key={entry.label}
                                                                            className="rounded-xl border border-slate-200 dark:border-slate-800 p-3"
                                                                        >
                                                                            <p className="text-xs text-slate-500 dark:text-slate-400">{entry.label}</p>
                                                                            <p className="mt-1 text-sm font-medium break-words">{entry.value}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <Separator />

                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between gap-4">
                                                                    <div>
                                                                        <h3 className="text-lg font-semibold flex items-center gap-2">
                                                                            <PencilLine className="w-5 h-5" />
                                                                            可写回字段
                                                                        </h3>
                                                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                                                            修改后导出新文件，不会覆盖原图
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <Button variant="outline" onClick={resetSelected}>
                                                                            <RotateCcw className="w-4 h-4 mr-2" />
                                                                            恢复本图
                                                                        </Button>
                                                                        <Button
                                                                            onClick={() => void exportSelected()}
                                                                            disabled={!selectedItem.canWriteExif || isExportingSingle}
                                                                        >
                                                                            <Download className="w-4 h-4 mr-2" />
                                                                            {isExportingSingle ? "导出中..." : "导出本图"}
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {!selectedItem.canWriteExif && (
                                                                    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-200 flex gap-3">
                                                                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                                                        当前图片格式不是 JPEG/JPG，因此先支持 EXIF 查看，不支持直接写回导出。
                                                                    </div>
                                                                )}

                                                                <div className="grid gap-4 sm:grid-cols-2">
                                                                    {EDITABLE_FIELDS.map((field) => (
                                                                        <div key={field.key} className="space-y-2">
                                                                            <Label htmlFor={`selected-${field.key}`}>{field.label}</Label>
                                                                            <Input
                                                                                id={`selected-${field.key}`}
                                                                                value={selectedItem.editableCurrent[field.key]}
                                                                                placeholder={field.placeholder}
                                                                                disabled={!selectedItem.canWriteExif}
                                                                                onChange={(event) =>
                                                                                    updateSelectedField(field.key, event.target.value)
                                                                                }
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center gap-2">
                                                            <Info className="w-5 h-5" />
                                                            全量 EXIF 标签
                                                        </CardTitle>
                                                        <CardDescription>
                                                            展示从文件里解析到的原始标签文本，方便排查或核对
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="pt-0">
                                                        <ScrollArea className="h-[380px] pr-3">
                                                            {selectedItem.tags.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {selectedItem.tags.map((tag) => (
                                                                        <div
                                                                            key={tag.key}
                                                                            className="rounded-xl border border-slate-200 dark:border-slate-800 p-3"
                                                                        >
                                                                            <p className="text-xs text-slate-500 dark:text-slate-400">{tag.label}</p>
                                                                            <p className="mt-1 text-sm break-words">{tag.value}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                                                    这张图片没有读取到可展示的 EXIF 标签
                                                                </div>
                                                            )}
                                                        </ScrollArea>
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
                                                    <Switch
                                                        checked={batchOverwriteEmpty}
                                                        onCheckedChange={setBatchOverwriteEmpty}
                                                    />
                                                </div>

                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    {EDITABLE_FIELDS.map((field) => (
                                                        <div key={field.key} className="space-y-2">
                                                            <Label htmlFor={`batch-${field.key}`}>{field.label}</Label>
                                                            <Input
                                                                id={`batch-${field.key}`}
                                                                value={batchEditable[field.key]}
                                                                placeholder={field.placeholder}
                                                                onChange={(event) =>
                                                                    setBatchEditable((previous) => ({
                                                                        ...previous,
                                                                        [field.key]: event.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex flex-wrap gap-3">
                                                    <Button onClick={applyBatchChanges}>
                                                        <PencilLine className="w-4 h-4 mr-2" />
                                                        应用到全部 JPEG
                                                    </Button>
                                                    <Button variant="outline" onClick={resetAllEditable}>
                                                        <RotateCcw className="w-4 h-4 mr-2" />
                                                        恢复全部修改
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => void exportBatch()}
                                                        disabled={isExportingBatch}
                                                    >
                                                        <Download className="w-4 h-4 mr-2" />
                                                        {isExportingBatch ? "导出中..." : "导出已修改图片"}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <FileImage className="w-5 h-5" />
                                                    批量概览
                                                </CardTitle>
                                                <CardDescription>
                                                    方便快速筛出可写回文件、已修改文件和包含位置信息的图片
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="pt-0">
                                                <ScrollArea className="h-[500px] pr-3">
                                                    <div className="space-y-3">
                                                        {items.map((item) => (
                                                            <div
                                                                key={item.id}
                                                                className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4"
                                                            >
                                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                                    <div className="space-y-2 min-w-0">
                                                                        <p className="font-medium break-all">{item.file.name}</p>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            <Badge variant={item.canWriteExif ? "default" : "secondary"}>
                                                                                {item.canWriteExif ? "JPEG 可写回" : "只读"}
                                                                            </Badge>
                                                                            {isDirty(item) && (
                                                                                <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                                                                                    已修改待导出
                                                                                </Badge>
                                                                            )}
                                                                            {item.summary.gps && (
                                                                                <Badge variant="outline">含 GPS</Badge>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <Button variant="outline" onClick={() => setSelectedId(item.id)}>
                                                                        查看详情
                                                                    </Button>
                                                                </div>
                                                                <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
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
        </div>
    );
};

export default PhotoExifTool;
