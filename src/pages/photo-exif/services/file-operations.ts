import piexif from "piexifjs";
import type {
    CopyrightPreset,
    FileSystemDirectoryHandle,
    PhotoExifItem,
} from "@/pages/photo-exif/types";
import {
    applyCopyrightPresetToEditable,
    applyEditableToExif,
    buildPhotoExifItem,
    bytesToBinaryString,
    convertImageToJpegDataUrl,
    createEmptyExifObject,
    dataUrlToFile,
    exifStringToPngPayload,
    extractPngExifChunk,
    getEffectiveFileName,
    getExportTargetFileName,
    getFileBaseName,
    getFileNameValidationError,
    isPngFile,
    readAsDataUrl,
    upsertPngExifChunk,
    verifyPermission,
} from "@/pages/photo-exif/utils";
import { EXIF_HEADER } from "@/pages/photo-exif/constants";
import { loadJSZip } from "@/utils/lazy-deps";

type ZipInstance = {
    file: (name: string, data: Blob | File) => void;
    generateAsync: (options: { type: "blob" }) => Promise<Blob>;
};

type ZipConstructor = new () => ZipInstance;

interface PersistenceContext {
    copyrightPreset: CopyrightPreset;
    copyrightPresetEnabled: boolean;
}

interface OverwriteItemsInPlaceOptions extends PersistenceContext {
    directoryHandle: FileSystemDirectoryHandle | null;
}

export const generateUpdatedFile = async (
    item: PhotoExifItem,
    context: PersistenceContext,
    exportName?: string,
): Promise<File> => {
    if (!item.canWriteExif) {
        throw new Error("当前格式暂不支持导出 EXIF 修改");
    }

    const nextFileName = exportName ?? getEffectiveFileName(item);
    const fileNameError = getFileNameValidationError(getFileBaseName(nextFileName));
    if (fileNameError) {
        throw new Error(fileNameError);
    }

    const outputFileName = getExportTargetFileName(item, exportName);
    const editableToSave = applyCopyrightPresetToEditable(
        item.editableCurrent,
        context.copyrightPreset,
        context.copyrightPresetEnabled,
    );

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
};

export const refreshItemFromHandle = async (
    item: PhotoExifItem,
    context: PersistenceContext,
): Promise<PhotoExifItem> => {
    if (!item.fileHandle) return item;
    const refreshedFile = await item.fileHandle.getFile();
    const refreshedItem = await buildPhotoExifItem(refreshedFile, {
        id: item.id,
        fileHandle: item.fileHandle,
        source: item.source,
        copyrightPreset: context.copyrightPreset,
        copyrightPresetEnabled: context.copyrightPresetEnabled,
    });
    URL.revokeObjectURL(item.previewUrl);
    return refreshedItem;
};

export const overwriteItemsInPlace = async (
    targetItems: PhotoExifItem[],
    options: OverwriteItemsInPlaceOptions,
): Promise<Map<string, PhotoExifItem>> => {
    if (options.directoryHandle) {
        const hasDirectoryPermission = await verifyPermission(options.directoryHandle, true);
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
        const output = await generateUpdatedFile(item, options, nextFileName);
        let writeHandle = handle;

        if (options.directoryHandle && nextFileName !== item.file.name) {
            try {
                const existingHandle = await options.directoryHandle.getFileHandle(nextFileName);
                if (existingHandle && nextFileName !== item.file.name) {
                    throw new Error(`目标文件名 ${nextFileName} 已存在，请先更换名称`);
                }
            } catch (error) {
                if ((error as Error).name !== "NotFoundError") {
                    throw error;
                }
            }
            writeHandle = await options.directoryHandle.getFileHandle(nextFileName, { create: true });
        }

        const writable = await writeHandle.createWritable();
        await writable.write(output);
        await writable.close();

        if (options.directoryHandle && nextFileName !== item.file.name) {
            await options.directoryHandle.removeEntry(item.file.name);
        }

        const refreshed = await refreshItemFromHandle(
            {
                ...item,
                fileHandle: writeHandle,
                currentFileName: nextFileName,
            },
            options,
        );
        refreshedItems.set(item.id, refreshed);
    }

    return refreshedItems;
};

export const buildExportPayload = async (
    targetItems: PhotoExifItem[],
    context: PersistenceContext,
): Promise<{ data: Blob | File; fileName: string }> => {
    if (targetItems.length === 1) {
        const output = await generateUpdatedFile(targetItems[0], context);
        return {
            data: output,
            fileName: output.name,
        };
    }

    const JSZip = (await loadJSZip()) as ZipConstructor;
    const zip = new JSZip();
    for (const item of targetItems) {
        const output = await generateUpdatedFile(item, context);
        zip.file(output.name, output);
    }

    return {
        data: await zip.generateAsync({ type: "blob" }),
        fileName: "photo-exif-updated.zip",
    };
};
