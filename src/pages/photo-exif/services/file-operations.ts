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
import { getLargeImageAsset } from '@/utils/large-image';

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

    if (await getLargeImageAsset(item.file)) {
        const header = new Uint8Array(await item.file.slice(0, Math.min(item.file.size, 16 * 1024 * 1024)).arrayBuffer());
        if (header[0] !== 0xff || header[1] !== 0xd8) throw new Error('JPEG 文件头无效');
        const segments: Array<{ start: number; end: number; exif: boolean }> = [];
        let offset = 2;
        let existingExif: Uint8Array | null = null;
        while (offset + 4 <= header.length) {
            if (header[offset] !== 0xff) throw new Error('JPEG 标记无效');
            const marker = header[offset + 1];
            if (marker === 0xda || marker === 0xd9) break;
            const length = (header[offset + 2] << 8) | header[offset + 3];
            const end = offset + length + 2;
            if (length < 2 || end > header.length) throw new Error('JPEG 文件头过大或不完整');
            const exif = marker === 0xe1 &&
                bytesToBinaryString(header.slice(offset + 4, offset + 10)) === EXIF_HEADER;
            if (exif && !existingExif) existingExif = header.slice(offset + 4, end);
            segments.push({ start: offset, end, exif });
            offset = end;
        }
        if (offset + 2 > header.length || header[offset + 1] !== 0xda) {
            throw new Error('未找到 JPEG 图像数据起点');
        }
        let sourceExif = createEmptyExifObject();
        if (existingExif) {
            try {
                sourceExif = { ...sourceExif,
                    ...(piexif.load(bytesToBinaryString(existingExif)) as Record<string, unknown>) };
            } catch (error) {
                console.warn('原图 EXIF 不可读，将创建新的 EXIF 块', item.file.name, error);
            }
        }
        const outputExif = applyEditableToExif(sourceExif, editableToSave, item.gpsCurrent);
        const exifString = piexif.dump(outputExif as Record<string, unknown>);
        if (exifString.length + 2 > 65535) throw new Error('EXIF 信息超过 JPEG 单段上限');
        const app1 = new Uint8Array(exifString.length + 4);
        app1[0] = 0xff; app1[1] = 0xe1;
        app1[2] = (exifString.length + 2) >> 8;
        app1[3] = (exifString.length + 2) & 0xff;
        for (let i = 0; i < exifString.length; i += 1) app1[i + 4] = exifString.charCodeAt(i) & 0xff;
        return new File([item.file.slice(0, 2), app1,
            ...segments.filter((segment) => !segment.exif).map((segment) => item.file.slice(segment.start, segment.end)),
            item.file.slice(offset)], outputFileName, { type: 'image/jpeg' });
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
