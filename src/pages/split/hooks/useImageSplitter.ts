import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import type {
  GeneratedResultMode,
  ManualSliceStarts,
  Orientation,
  SplitImage,
} from '@/pages/split/types';
import {
  applyManualStartsToPlan,
  buildAxisSplitImages,
  buildAxisSplitPlan,
  buildGridSplitImages,
  buildTransferFiles,
  exportSplitImagesZip,
  generatePreviewImageUrl,
  revokeGeneratedImageUrls,
} from '@/pages/split/utils';
import { setPendingCropTransfer } from '@/utils/crop-transfer';

export function useImageSplitter() {
  const navigate = useNavigate();
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aspectW, setAspectW] = useState<number>(1);
  const [aspectH, setAspectH] = useState<number>(1);
  const [hvMode, setHvMode] = useState<'ratio' | 'count'>('ratio');
  const [hvRatioW, setHvRatioW] = useState<number>(1);
  const [hvRatioH, setHvRatioH] = useState<number>(1);
  const [hvCount, setHvCount] = useState<number>(1);
  const [overlapPercent, setOverlapPercent] = useState<number>(10);
  const [generatedImages, setGeneratedImages] = useState<SplitImage[]>([]);
  const [generatedMode, setGeneratedMode] = useState<GeneratedResultMode>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [manualSliceStarts, setManualSliceStarts] = useState<ManualSliceStarts>({
    vertical: null,
    horizontal: null,
  });
  const [activePreviewOrientation, setActivePreviewOrientation] = useState<Orientation>('vertical');
  const previewObjectUrlRef = useRef<string | null>(null);
  const generatedImagesRef = useRef<SplitImage[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const baseVerticalPlan = useMemo(
    () =>
      sourceImage
        ? buildAxisSplitPlan(
            'vertical',
            sourceImage.naturalWidth,
            sourceImage.naturalHeight,
            hvMode,
            hvRatioW,
            hvRatioH,
            hvCount,
            overlapPercent
          )
        : null,
    [sourceImage, hvMode, hvRatioW, hvRatioH, hvCount, overlapPercent]
  );

  const baseHorizontalPlan = useMemo(
    () =>
      sourceImage
        ? buildAxisSplitPlan(
            'horizontal',
            sourceImage.naturalWidth,
            sourceImage.naturalHeight,
            hvMode,
            hvRatioW,
            hvRatioH,
            hvCount,
            overlapPercent
          )
        : null,
    [sourceImage, hvMode, hvRatioW, hvRatioH, hvCount, overlapPercent]
  );

  const verticalPlan = useMemo(
    () => applyManualStartsToPlan(baseVerticalPlan, manualSliceStarts.vertical),
    [baseVerticalPlan, manualSliceStarts.vertical]
  );

  const horizontalPlan = useMemo(
    () => applyManualStartsToPlan(baseHorizontalPlan, manualSliceStarts.horizontal),
    [baseHorizontalPlan, manualSliceStarts.horizontal]
  );

  const activePlan = activePreviewOrientation === 'vertical' ? verticalPlan : horizontalPlan;
  const activeTitle = activePreviewOrientation === 'vertical' ? '纵向分列预览' : '横向分行预览';
  const activeIsAdjusted = activePreviewOrientation === 'vertical'
    ? Boolean(manualSliceStarts.vertical)
    : Boolean(manualSliceStarts.horizontal);

  const setGeneratedImagesWithCleanup = useCallback((images: SplitImage[]) => {
    setGeneratedImages((current) => {
      revokeGeneratedImageUrls(current);
      return images;
    });
  }, []);

  useEffect(() => {
    setManualSliceStarts({
      vertical: null,
      horizontal: null,
    });
  }, [sourceImage, hvMode, hvRatioW, hvRatioH, hvCount, overlapPercent]);

  useEffect(() => {
    generatedImagesRef.current = generatedImages;
  }, [generatedImages]);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
      revokeGeneratedImageUrls(generatedImagesRef.current);
    };
  }, []);

  useEffect(() => {
    if (!sourceImage) return;

    setActivePreviewOrientation(
      sourceImage.naturalHeight > sourceImage.naturalWidth * 1.5 ? 'horizontal' : 'vertical'
    );
  }, [sourceImage]);

  useEffect(() => {
    const syncGeneratedPreview = async () => {
      if (isProcessing || !generatedMode || generatedMode === 'grid') return;
      if (!sourceImage || !canvasRef.current || generatedImages.length === 0) return;

      const targetPlan = generatedMode === 'vertical' ? verticalPlan : horizontalPlan;
      if (!targetPlan) return;

      const syncedImages = await buildAxisSplitImages(
        sourceImage,
        canvasRef.current,
        generatedMode,
        targetPlan
      );
      setGeneratedImagesWithCleanup(syncedImages);
    };

    void syncGeneratedPreview();
  }, [
    generatedMode,
    generatedImages.length,
    horizontalPlan,
    isProcessing,
    setGeneratedImagesWithCleanup,
    sourceImage,
    verticalPlan,
  ]);

  const commitManualRegionStarts = useCallback((orientation: Orientation, starts: number[]) => {
    const currentPlan = orientation === 'vertical' ? verticalPlan : horizontalPlan;
    if (!currentPlan) return;

    setManualSliceStarts((prev) => ({
      ...prev,
      [orientation]: starts.slice(0, currentPlan.regions.length),
    }));
  }, [horizontalPlan, verticalPlan]);

  const resetManualRegionStart = useCallback((orientation: Orientation) => {
    setManualSliceStarts((prev) => ({
      ...prev,
      [orientation]: null,
    }));
  }, []);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) return;

    const file = event.target.files[0];
    const originalUrl = URL.createObjectURL(file);
    setPreviewUrl(originalUrl);

    const img = new Image();
    img.src = originalUrl;
    img.onload = async () => {
      setSourceImage(img);
      setGeneratedMode(null);
      setGeneratedImagesWithCleanup([]);

      const nextPreviewUrl = await generatePreviewImageUrl(img, originalUrl);
      if (previewObjectUrlRef.current && previewObjectUrlRef.current !== originalUrl) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
      previewObjectUrlRef.current = nextPreviewUrl === originalUrl ? null : nextPreviewUrl;
      setPreviewUrl(nextPreviewUrl);
    };
  }, [setGeneratedImagesWithCleanup]);

  const handleAxisSplit = useCallback(async (orientation: Orientation) => {
    const plan = orientation === 'vertical' ? verticalPlan : horizontalPlan;

    if (!sourceImage || !canvasRef.current || !plan) return;

    setActivePreviewOrientation(orientation);
    setIsProcessing(true);
    setGeneratedMode(orientation);
    setGeneratedImagesWithCleanup([]);

    if (plan.tileSize <= 0) {
      alert('切片尺寸计算错误');
      setIsProcessing(false);
      return;
    }

    try {
      const newImages = await buildAxisSplitImages(sourceImage, canvasRef.current, orientation, plan);
      setGeneratedImagesWithCleanup(newImages);
    } catch (error) {
      console.error('Error processing images:', error);
      alert('处理图片时出错');
    } finally {
      setIsProcessing(false);
    }
  }, [horizontalPlan, setGeneratedImagesWithCleanup, sourceImage, verticalPlan]);

  const handleVerticalSplit = useCallback(() => {
    void handleAxisSplit('vertical');
  }, [handleAxisSplit]);

  const handleHorizontalSplit = useCallback(() => {
    void handleAxisSplit('horizontal');
  }, [handleAxisSplit]);

  const handleGridSplit = useCallback(async () => {
    if (!sourceImage || !canvasRef.current) return;

    setIsProcessing(true);
    setGeneratedMode('grid');
    setGeneratedImagesWithCleanup([]);

    try {
      const cols = Math.max(1, Math.floor(aspectW));
      const rows = Math.max(1, Math.floor(aspectH));
      const newImages = await buildGridSplitImages(sourceImage, canvasRef.current, cols, rows);
      setGeneratedImagesWithCleanup(newImages);
    } catch (error) {
      console.error('Error processing images:', error);
      alert('处理图片时出错');
    } finally {
      setIsProcessing(false);
    }
  }, [aspectH, aspectW, setGeneratedImagesWithCleanup, sourceImage]);

  const handleExport = useCallback(async () => {
    if (generatedImages.length === 0) return;
    await exportSplitImagesZip(generatedImages);
  }, [generatedImages]);

  const handleSendToWatermark = useCallback(() => {
    if (generatedImages.length === 0) return;

    setPendingCropTransfer('watermark', buildTransferFiles(generatedImages));
    navigate('/watermark');
  }, [generatedImages, navigate]);

  return {
    activeIsAdjusted,
    activePlan,
    activePreviewOrientation,
    activeTitle,
    aspectH,
    aspectW,
    canvasRef,
    commitManualRegionStarts,
    generatedImages,
    handleExport,
    handleFileChange,
    handleGridSplit,
    handleHorizontalSplit,
    handleSendToWatermark,
    handleVerticalSplit,
    horizontalPlan,
    hvCount,
    hvMode,
    hvRatioH,
    hvRatioW,
    isPreviewOpen,
    isProcessing,
    overlapPercent,
    previewIndex,
    previewUrl,
    resetManualRegionStart,
    setAspectH,
    setAspectW,
    setHvCount,
    setHvMode,
    setHvRatioH,
    setHvRatioW,
    setIsPreviewOpen,
    setOverlapPercent,
    setPreviewIndex,
    sourceImage,
    verticalPlan,
  };
}
