import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { consumePendingCropTransfer, setPendingCropTransfer, type TransferTarget } from '@/utils/crop-transfer';
import { buildCompressedImage, compressImage, exportCompressedImages, forceCompressImage } from '../services';
import type { CompressedImage, ImageConfigPatch } from '../types';
import { getImageTargetBytes, resetCompressedResult } from '../utils';

export const useCompressWorkbench = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState<CompressedImage[]>([]);
  const [targetSizeMB, setTargetSizeMB] = useState(30);
  const [resizePercent, setResizePercent] = useState([100]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionAction, setCompressionAction] = useState<'normal' | 'force' | 'single' | null>(null);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedImageId, setExpandedImageId] = useState<string | null>(null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);

  const normalizedTargetSizeMB = Math.max(targetSizeMB, 0.1);
  const compressedCount = images.filter((image) => image.compressedFile).length;
  const imagesExceedingTarget = images.filter(
    (image) => image.compressedFile && image.compressedSize > getImageTargetBytes(image)
  );
  const totalSavedBytes = images.reduce((sum, image) => {
    if (!image.compressedFile) {
      return sum;
    }

    return sum + Math.max(image.originalSize - image.compressedSize, 0);
  }, 0);

  const syncBatchConfigToImages = useCallback((updates: ImageConfigPatch) => {
    setImages((prev) => prev.map((image) => resetCompressedResult(image, updates)));
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newImages = await Promise.all(
      acceptedFiles.map((file) =>
        buildCompressedImage(file, normalizedTargetSizeMB, Math.round(resizePercent[0]))
      )
    );
    setImages((prev) => [...prev, ...newImages]);
  }, [normalizedTargetSizeMB, resizePercent]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.bmp'],
    },
    multiple: true,
    noClick: images.length > 0,
  });

  useEffect(() => {
    const incomingFiles = consumePendingCropTransfer('compress');
    if (!incomingFiles.length) {
      return;
    }

    void onDrop(incomingFiles);
  }, [onDrop]);

  const applyCompressionResult = useCallback((image: CompressedImage, result: Awaited<ReturnType<typeof compressImage>>) => ({
    ...image,
    compressedFile: result.file,
    compressedSize: result.file.size,
    outputWidth: result.outputWidth,
    outputHeight: result.outputHeight,
    outputScalePercent: result.outputScalePercent,
  }), []);

  const handleBatchCompress = useCallback(async () => {
    if (images.length === 0) return;

    setIsCompressing(true);
    setCompressionAction('normal');
    setActiveImageId(null);
    setCompressionProgress(0);

    const updatedImages = [...images];

    for (let i = 0; i < images.length; i += 1) {
      const image = images[i];
      try {
        const result = await compressImage(image.originalFile, {
          targetSizeMB: image.targetSizeMB,
          resizePercent: image.resizePercent,
        });
        updatedImages[i] = applyCompressionResult(image, result);
      } catch (error) {
        console.error(`压缩图片 ${image.originalFile.name} 失败:`, error);
        updatedImages[i] = image;
      }

      setCompressionProgress(((i + 1) / images.length) * 100);
    }

    setImages(updatedImages);
    setIsCompressing(false);
    setCompressionAction(null);
    setActiveImageId(null);
  }, [applyCompressionResult, images]);

  const handleForceCompressToTarget = useCallback(async () => {
    if (imagesExceedingTarget.length === 0) {
      alert('当前所有图片都已经达到目标体积');
      return;
    }

    setIsCompressing(true);
    setCompressionAction('force');
    setActiveImageId(null);
    setCompressionProgress(0);

    const pendingIds = new Set(imagesExceedingTarget.map((image) => image.id));
    const updatedImages = [...images];
    let processedCount = 0;

    for (let i = 0; i < updatedImages.length; i += 1) {
      const image = updatedImages[i];

      if (!pendingIds.has(image.id)) {
        continue;
      }

      try {
        const result = await forceCompressImage(image.originalFile, image.targetSizeMB);
        updatedImages[i] = applyCompressionResult(image, result);
      } catch (error) {
        console.error(`强制压缩图片 ${image.originalFile.name} 失败:`, error);
      }

      processedCount += 1;
      setCompressionProgress((processedCount / pendingIds.size) * 100);
    }

    setImages(updatedImages);
    setIsCompressing(false);
    setCompressionAction(null);
    setActiveImageId(null);
  }, [applyCompressionResult, images, imagesExceedingTarget]);

  const handleSingleCompress = useCallback(async (id: string) => {
    const image = images.find((item) => item.id === id);
    if (!image) {
      return;
    }

    setIsCompressing(true);
    setCompressionAction('single');
    setActiveImageId(id);
    setCompressionProgress(0);

    try {
      const result = await compressImage(image.originalFile, {
        targetSizeMB: image.targetSizeMB,
        resizePercent: image.resizePercent,
      });

      setImages((prev) =>
        prev.map((item) => (item.id === id ? applyCompressionResult(item, result) : item))
      );
      setCompressionProgress(100);
    } catch (error) {
      console.error(`压缩图片 ${image.originalFile.name} 失败:`, error);
    } finally {
      setIsCompressing(false);
      setCompressionAction(null);
      setActiveImageId(null);
    }
  }, [applyCompressionResult, images]);

  const handleBatchExport = useCallback(async () => {
    setIsExporting(true);

    try {
      await exportCompressedImages(images);
    } finally {
      setIsExporting(false);
    }
  }, [images]);

  const handleRouteTransfer = useCallback((target: TransferTarget) => {
    const files = images
      .map((image) => image.compressedFile)
      .filter((file): file is File => Boolean(file));

    if (!files.length) {
      alert('没有压缩后的图片可发送');
      return;
    }

    setPendingCropTransfer(target, files);
    navigate(target === 'watermark' ? '/watermark' : '/crop');
  }, [images, navigate]);

  const updateImageConfig = useCallback((id: string, config: ImageConfigPatch) => {
    setImages((prev) =>
      prev.map((image) => (image.id === id ? resetCompressedResult(image, config) : image))
    );
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target) {
        URL.revokeObjectURL(target.preview);
      }

      return prev.filter((image) => image.id !== id);
    });
    setExpandedImageId((prev) => (prev === id ? null : prev));
  }, []);

  const clearAllImages = useCallback(() => {
    images.forEach((image) => URL.revokeObjectURL(image.preview));
    setImages([]);
    setExpandedImageId(null);
  }, [images]);

  const toggleExpandedImage = useCallback((id: string) => {
    setExpandedImageId((prev) => (prev === id ? null : id));
  }, []);

  const updateTargetSize = useCallback((value: number) => {
    setTargetSizeMB(value);
    syncBatchConfigToImages({ targetSizeMB: value });
  }, [syncBatchConfigToImages]);

  const updateResizePercent = useCallback((value: number[]) => {
    setResizePercent(value);
    syncBatchConfigToImages({ resizePercent: Math.round(value[0]) });
  }, [syncBatchConfigToImages]);

  return {
    images,
    targetSizeMB,
    resizePercent,
    normalizedTargetSizeMB,
    isCompressing,
    compressionAction,
    compressionProgress,
    isExporting,
    expandedImageId,
    activeImageId,
    compressedCount,
    imagesExceedingTarget,
    totalSavedBytes,
    getRootProps,
    getInputProps,
    isDragActive,
    open,
    handleBatchCompress,
    handleForceCompressToTarget,
    handleSingleCompress,
    handleBatchExport,
    handleRouteTransfer,
    updateImageConfig,
    removeImage,
    clearAllImages,
    toggleExpandedImage,
    updateTargetSize,
    updateResizePercent,
  };
};
