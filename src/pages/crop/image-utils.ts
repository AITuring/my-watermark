import type { CropBox, CropImage, EditorPreview } from "./types";
import { getLargeImageAsset, processLargeImage } from '@/utils/large-image';

const MAX_EDITOR_PREVIEW_SIZE = 2200;

export const loadImageElement = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("load-image-failed"));
        img.src = src;
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
        }
    });

export const createEditorPreviewAsset = async (
    source: CanvasImageSource,
    width: number,
    height: number,
    fallbackUrl: string
): Promise<EditorPreview> => {
    const longestSide = Math.max(width, height);
    if (longestSide <= MAX_EDITOR_PREVIEW_SIZE) {
        return {
            url: fallbackUrl,
            width,
            height,
        };
    }

    const scale = MAX_EDITOR_PREVIEW_SIZE / longestSide;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return {
            url: fallbackUrl,
            width,
            height,
        };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.88)
    );

    return blob
        ? {
              url: URL.createObjectURL(blob),
              width: canvas.width,
              height: canvas.height,
          }
        : {
              url: fallbackUrl,
              width,
              height,
          };
};

export const transformImageAsset = async (image: CropImage, angleDeg: number) => {
    const largeAsset = await getLargeImageAsset(image.file);
    if (largeAsset) {
        const quarterTurn = Math.abs(angleDeg) % 180 === 90;
        const width = quarterTurn ? image.height : image.width;
        const height = quarterTurn ? image.width : image.height;
        const blob = await processLargeImage(image.file, { rotate: angleDeg, quality: 95 });
        if (!blob) throw new Error('大图旋转失败');
        const file = new File([blob], `${image.name}.jpg`, { type: 'image/jpeg' });
        const nextAsset = await getLargeImageAsset(file);
        if (!nextAsset) throw new Error('大图旋转后预览失败');
        return { file, url: nextAsset.previewUrl, previewUrl: nextAsset.previewUrl,
            previewWidth: Math.round(nextAsset.width * Math.min(1, 2200 / Math.max(width, height))),
            previewHeight: Math.round(nextAsset.height * Math.min(1, 2200 / Math.max(width, height))),
            width, height };
    }
    const img = await loadImageElement(image.url);

    const angleRad = (angleDeg * Math.PI) / 180;
    const sin = Math.abs(Math.sin(angleRad));
    const cos = Math.abs(Math.cos(angleRad));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(image.width * cos + image.height * sin));
    canvas.height = Math.max(1, Math.ceil(image.width * sin + image.height * cos));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("canvas-context-unavailable");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angleRad);
    ctx.drawImage(img, -image.width / 2, -image.height / 2);

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.95)
    );
    if (!blob) {
        throw new Error("transform-export-failed");
    }

    const nextUrl = URL.createObjectURL(blob);
    const file = new File([blob], `${image.name}.jpg`, { type: "image/jpeg" });
    const preview = await createEditorPreviewAsset(canvas, canvas.width, canvas.height, nextUrl);

    return {
        file,
        url: nextUrl,
        previewUrl: preview.url,
        previewWidth: preview.width,
        previewHeight: preview.height,
        width: canvas.width,
        height: canvas.height,
    };
};

export const drawCropToBlob = async (
    image: CropImage,
    crop: CropBox,
    outputW: number,
    outputH: number
) => {
    const largeAsset = await getLargeImageAsset(image.file);
    if (largeAsset) {
        return processLargeImage(image.file, {
            crop: { x: Math.round(crop.x), y: Math.round(crop.y),
                width: Math.round(crop.w), height: Math.round(crop.h) },
            width: Math.round(outputW), height: Math.round(outputH), quality: 95,
        });
    }
    const img = await loadImageElement(image.url);
    const canvas = document.createElement("canvas");
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, outputW, outputH);

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.95)
    );
    return blob;
};
