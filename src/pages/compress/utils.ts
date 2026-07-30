import type { CompressedImage, ImageConfigPatch } from './types';

export const getImageTargetBytes = (image: CompressedImage) => Math.max(image.targetSizeMB, 0.1) * 1024 * 1024;

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getCompressionRatio = (original: number, compressed: number): string => {
  if (compressed === 0) return '0%';
  const ratio = ((original - compressed) / original) * 100;
  return `${ratio.toFixed(1)}%`;
};

export const formatResolution = (width: number, height: number) => `${width} x ${height}`;
export const formatResizeLabel = (percent: number) => (percent === 100 ? '原尺寸' : `保留 ${percent}%`);

export const getTargetResolution = (image: CompressedImage) => {
  if (image.outputWidth && image.outputHeight) {
    return {
      width: image.outputWidth,
      height: image.outputHeight,
    };
  }

  const scale = image.resizePercent / 100;
  return {
    width: Math.max(Math.round(image.originalWidth * scale), 1),
    height: Math.max(Math.round(image.originalHeight * scale), 1),
  };
};

export const getImageStatus = (image: CompressedImage) => {
  if (!image.compressedFile) {
    return {
      label: '待压缩',
      className: 'bg-white/90 text-slate-700 border-slate-200',
    };
  }

  if (image.compressedSize > getImageTargetBytes(image)) {
    return {
      label: '未达标',
      className: 'bg-orange-500/90 text-white border-orange-400',
    };
  }

  return {
    label: '已达标',
    className: 'bg-emerald-500/90 text-white border-emerald-400',
  };
};

export const resetCompressedResult = (
  image: CompressedImage,
  overrides?: ImageConfigPatch
): CompressedImage => ({
  ...image,
  ...overrides,
  compressedFile: null,
  compressedSize: 0,
  outputWidth: null,
  outputHeight: null,
  outputScalePercent: null,
});
