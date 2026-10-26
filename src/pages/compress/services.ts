import { MIN_FORCE_EDGE, PREVIEW_MAX_EDGE } from './constants';
import type { CompressedImage, CompressionConfig, CompressionResult, ZipConstructor } from './types';
import { loadImageCompression, loadJSZip, loadSaveAs } from '@/utils/lazy-deps';
import { getLargeImageAsset, processLargeImage } from '@/utils/large-image';

const getFileNameWithoutExtension = (fileName: string) => fileName.replace(/\.[^.]+$/, '');

const getFileExtensionByMimeType = (mimeType: string) => {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/bmp':
      return 'bmp';
    default:
      return '';
  }
};

export const getOutputFileName = (file: File) => {
  const baseName = getFileNameWithoutExtension(file.name);
  const extension = getFileExtensionByMimeType(file.type);
  return extension ? `compressed_${baseName}.${extension}` : `compressed_${file.name}`;
};

export const getImageDimensions = async (file: File): Promise<{ width: number; height: number }> => {
  const asset = await getLargeImageAsset(file);
  if (asset) return { width: asset.width, height: asset.height };
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      URL.revokeObjectURL(imageUrl);
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error(`读取图片尺寸失败: ${file.name}`));
    };

    image.src = imageUrl;
  });
};

export const createThumbnailPreview = async (file: File): Promise<string> => {
  const asset = await getLargeImageAsset(file);
  if (asset) return asset.previewUrl;
  const { width, height } = await getImageDimensions(file);
  const longestEdge = Math.max(width, height);

  if (longestEdge <= PREVIEW_MAX_EDGE) {
    return URL.createObjectURL(file);
  }

  const scale = PREVIEW_MAX_EDGE / longestEdge;
  const targetWidth = Math.max(Math.round(width * scale), 1);
  const targetHeight = Math.max(Math.round(height * scale), 1);
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    return URL.createObjectURL(file);
  }

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, {
      resizeWidth: targetWidth,
      resizeHeight: targetHeight,
      resizeQuality: 'high',
    });
    try {
      context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    } finally {
      bitmap.close();
    }
  } else {
    const sourceUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          context.drawImage(image, 0, 0, targetWidth, targetHeight);
          resolve();
        };
        image.onerror = () => reject(new Error(`生成缩略图失败: ${file.name}`));
        image.src = sourceUrl;
      });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`生成缩略图失败: ${file.name}`));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.82
    );
  });

  return URL.createObjectURL(thumbnailBlob);
};

export const buildCompressedImage = async (
  file: File,
  targetSizeMB: number,
  resizePercent: number
): Promise<CompressedImage> => {
  const { width, height } = await getImageDimensions(file);
  const preview = await createThumbnailPreview(file);

  return {
    id: Math.random().toString(36).slice(2, 11),
    originalFile: file,
    compressedFile: null,
    originalSize: file.size,
    compressedSize: 0,
    originalWidth: width,
    originalHeight: height,
    outputWidth: null,
    outputHeight: null,
    targetSizeMB,
    resizePercent,
    outputScalePercent: null,
    preview,
  };
};

export const compressImage = async (
  file: File,
  config: CompressionConfig
): Promise<CompressionResult> => {
  const normalizedSizeMB = Math.max(config.targetSizeMB, 0.1);
  const normalizedResizePercent = Math.min(Math.max(config.resizePercent, 1), 100);
  const { width, height } = await getImageDimensions(file);
  const largeAsset = await getLargeImageAsset(file);
  if (largeAsset) {
    const scale = normalizedResizePercent / 100;
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));
    let blob: Blob | null = null;
    for (const quality of [82, 72, 62, 52, 42]) {
      blob = await processLargeImage(file, {
        ...(scale < 1 ? { width: outputWidth, height: outputHeight } : {}), quality,
      });
      if (!blob) throw new Error('大图压缩服务不可用');
      if (blob.size <= normalizedSizeMB * 1024 * 1024) break;
    }
    if (!blob) throw new Error('大图压缩服务不可用');
    return { file: new File([blob], file.name, { type: 'image/jpeg' }),
      outputScalePercent: normalizedResizePercent, outputWidth, outputHeight };
  }
  const longestEdge = Math.max(width, height);
  const shouldResize = normalizedResizePercent < 100;
  const options = {
    maxSizeMB: normalizedSizeMB,
    useWebWorker: true,
    initialQuality: 0.82,
    alwaysKeepResolution: !shouldResize,
    ...(shouldResize
      ? {
          maxWidthOrHeight: Math.max(
            Math.round(longestEdge * (normalizedResizePercent / 100)),
            MIN_FORCE_EDGE
          ),
        }
      : {}),
  };

  try {
    const imageCompression = await loadImageCompression();
    const compressedFile = await imageCompression(file, options);
    const outputDimensions = await getImageDimensions(compressedFile);
    return {
      file: compressedFile,
      outputScalePercent: normalizedResizePercent,
      outputWidth: outputDimensions.width,
      outputHeight: outputDimensions.height,
    };
  } catch (error) {
    console.error('压缩失败:', error);
    throw error;
  }
};

export const forceCompressImage = async (
  file: File,
  targetSizeLimitMB: number
): Promise<CompressionResult> => {
  const { width, height } = await getImageDimensions(file);
  const largeAsset = await getLargeImageAsset(file);
  if (largeAsset) {
    const targetBytes = Math.max(targetSizeLimitMB, 0.1) * 1024 * 1024;
    let scale = 1;
    let best: CompressionResult | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const outputWidth = Math.max(1, Math.round(width * scale));
      const outputHeight = Math.max(1, Math.round(height * scale));
      const blob = await processLargeImage(file, {
        ...(scale < 1 ? { width: outputWidth, height: outputHeight } : {}),
        quality: Math.max(30, 78 - attempt * 7),
      });
      if (!blob) throw new Error('大图压缩服务不可用');
      best = { file: new File([blob], file.name, { type: 'image/jpeg' }),
        outputScalePercent: Math.round(scale * 100), outputWidth, outputHeight };
      if (blob.size <= targetBytes) return best;
      scale *= 0.72;
    }
    return best!;
  }
  const imageCompression = await loadImageCompression();
  const normalizedSizeMB = Math.max(targetSizeLimitMB, 0.1);
  const targetBytes = normalizedSizeMB * 1024 * 1024;
  const originalLongestEdge = Math.max(width, height);
  let longestEdge = originalLongestEdge;
  let currentQuality = 0.72;
  let bestResult: File = file;
  let bestScalePercent = 100;
  let bestOutputWidth = width;
  let bestOutputHeight = height;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const compressedFile = await imageCompression(file, {
      maxSizeMB: normalizedSizeMB,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: currentQuality,
      maxWidthOrHeight: Math.max(Math.round(longestEdge), MIN_FORCE_EDGE),
      maxIteration: 12,
    });
    const outputDimensions = await getImageDimensions(compressedFile);

    bestResult = compressedFile;
    bestOutputWidth = outputDimensions.width;
    bestOutputHeight = outputDimensions.height;
    bestScalePercent = Math.max(
      Math.round((Math.max(Math.round(longestEdge), MIN_FORCE_EDGE) / originalLongestEdge) * 100),
      Math.round((MIN_FORCE_EDGE / originalLongestEdge) * 100)
    );

    if (compressedFile.size <= targetBytes || longestEdge <= MIN_FORCE_EDGE) {
      return {
        file: compressedFile,
        outputScalePercent: Math.min(bestScalePercent, 100),
        outputWidth: outputDimensions.width,
        outputHeight: outputDimensions.height,
      };
    }

    longestEdge = Math.max(Math.round(longestEdge * 0.72), MIN_FORCE_EDGE);
    currentQuality = Math.max(currentQuality * 0.82, 0.12);
  }

  return {
    file: bestResult,
    outputScalePercent: Math.min(bestScalePercent, 100),
    outputWidth: bestOutputWidth,
    outputHeight: bestOutputHeight,
  };
};

export const exportCompressedImages = async (images: CompressedImage[]) => {
  const compressedImages = images.filter((image) => image.compressedFile);
  if (compressedImages.length === 0) {
    alert('没有压缩后的图片可以导出');
    return;
  }

  if (compressedImages.length === 1) {
    const image = compressedImages[0];
    const saveAs = await loadSaveAs();
    saveAs(image.compressedFile!, getOutputFileName(image.compressedFile!));
    return;
  }

  const JSZip = (await loadJSZip()) as ZipConstructor;
  const saveAs = await loadSaveAs();
  const zip = new JSZip();

  compressedImages.forEach((image) => {
    if (image.compressedFile) {
      zip.file(getOutputFileName(image.compressedFile), image.compressedFile);
    }
  });

  try {
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'compressed_images.zip');
  } catch (error) {
    console.error('导出失败:', error);
    alert('导出失败，请重试');
  }
};
