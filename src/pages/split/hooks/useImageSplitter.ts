import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import type {
  GeneratedResultMode,
  ManualSliceStarts,
  Orientation,
  SplitImage,
  SplitSourceItemSummary,
} from '@/pages/split/types';
import {
  applyManualStartsToPlan,
  buildAxisSplitImages,
  buildAxisSplitPlan,
  buildGridSplitPlan,
  buildGridSplitImages,
  buildTransferFiles,
  exportSplitImagesZip,
  exportSplitImagesIndividually,
  generatePreviewImageUrl,
  revokeGeneratedImageUrls,
} from '@/pages/split/utils';
import { setPendingCropTransfer } from '@/utils/crop-transfer';

interface SourceImageItem extends SplitSourceItemSummary {
  image: HTMLImageElement;
  originalUrl: string;
  previewUrl: string;
}

const revokeSourceImageUrls = (items: SourceImageItem[]) => {
  items.forEach((item) => {
    URL.revokeObjectURL(item.originalUrl);
    if (item.previewUrl !== item.originalUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
};

const loadSourceImageItem = async (file: File, index: number): Promise<SourceImageItem> => {
  const originalUrl = URL.createObjectURL(file);
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
    image.src = originalUrl;
  });

  const previewUrl = await generatePreviewImageUrl(image, originalUrl);

  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    image,
    originalUrl,
    previewUrl,
  };
};

export function useImageSplitter() {
  const navigate = useNavigate();
  const [sourceItems, setSourceItems] = useState<SourceImageItem[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [aspectW, setAspectW] = useState<number>(1);
  const [aspectH, setAspectH] = useState<number>(1);
  const [gridRatioW, setGridRatioW] = useState<number | null>(null);
  const [gridRatioH, setGridRatioH] = useState<number | null>(null);
  const [hvMode, setHvMode] = useState<'ratio' | 'count'>('ratio');
  const [hvRatioW, setHvRatioW] = useState<number>(1);
  const [hvRatioH, setHvRatioH] = useState<number>(1);
  const [hvCount, setHvCount] = useState<number>(1);
  const [hvCountReduction, setHvCountReduction] = useState<number>(0);
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
  const sourceItemsRef = useRef<SourceImageItem[]>([]);
  const generatedImagesRef = useRef<SplitImage[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeSource = useMemo(
    () => sourceItems.find((item) => item.id === activeSourceId) ?? sourceItems[0] ?? null,
    [activeSourceId, sourceItems]
  );
  const sourceImage = activeSource?.image ?? null;
  const sourceFileName = activeSource?.fileName ?? '';
  const previewUrl = activeSource?.previewUrl ?? null;
  const sourceImageSummaries = useMemo<SplitSourceItemSummary[]>(
    () => sourceItems.map(({ id, fileName, naturalWidth, naturalHeight }) => ({
      id,
      fileName,
      naturalWidth,
      naturalHeight,
    })),
    [sourceItems]
  );

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
            overlapPercent,
            hvCountReduction,
            sourceFileName
          )
        : null,
    [sourceImage, hvMode, hvRatioW, hvRatioH, hvCount, overlapPercent, hvCountReduction, sourceFileName]
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
            overlapPercent,
            hvCountReduction,
            sourceFileName
          )
        : null,
    [sourceImage, hvMode, hvRatioW, hvRatioH, hvCount, overlapPercent, hvCountReduction, sourceFileName]
  );

  const verticalPlan = useMemo(
    () => applyManualStartsToPlan(baseVerticalPlan, manualSliceStarts.vertical),
    [baseVerticalPlan, manualSliceStarts.vertical]
  );

  const horizontalPlan = useMemo(
    () => applyManualStartsToPlan(baseHorizontalPlan, manualSliceStarts.horizontal),
    [baseHorizontalPlan, manualSliceStarts.horizontal]
  );
  const gridPlan = useMemo(
    () =>
      sourceImage
        ? buildGridSplitPlan(
            sourceImage.naturalWidth,
            sourceImage.naturalHeight,
            aspectW,
            aspectH,
            gridRatioW,
            gridRatioH,
            overlapPercent,
            sourceFileName
          )
        : null,
    [aspectH, aspectW, gridRatioH, gridRatioW, overlapPercent, sourceFileName, sourceImage]
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
    sourceItemsRef.current = sourceItems;
  }, [sourceItems]);

  useEffect(() => {
    if (!activeSourceId && sourceItems.length > 0) {
      setActiveSourceId(sourceItems[0].id);
      return;
    }

    if (activeSourceId && !sourceItems.some((item) => item.id === activeSourceId)) {
      setActiveSourceId(sourceItems[0]?.id ?? null);
    }
  }, [activeSourceId, sourceItems]);

  useEffect(() => {
    setManualSliceStarts({
      vertical: null,
      horizontal: null,
    });
  }, [activeSourceId, hvMode, hvRatioW, hvRatioH, hvCount, hvCountReduction, overlapPercent, sourceItems.length]);

  useEffect(() => {
    generatedImagesRef.current = generatedImages;
  }, [generatedImages]);

  useEffect(() => {
    return () => {
      revokeSourceImageUrls(sourceItemsRef.current);
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
      if (isProcessing || !generatedMode || generatedMode === 'grid' || sourceItems.length !== 1) return;
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
    sourceItems.length,
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
    if (!event.target.files?.length) return;

    const files = Array.from(event.target.files);
    void (async () => {
      try {
        const nextSourceItems = await Promise.all(files.map((file, index) => loadSourceImageItem(file, index)));
        revokeSourceImageUrls(sourceItemsRef.current);
        setSourceItems(nextSourceItems);
        setActiveSourceId(nextSourceItems[0]?.id ?? null);
        setGeneratedMode(null);
        setGeneratedImagesWithCleanup([]);
      } catch (error) {
        console.error('Error loading source images:', error);
        alert('读取图片时出错');
      }
    })();
  }, [setGeneratedImagesWithCleanup]);

  const handleActiveSourceChange = useCallback((id: string) => {
    setActiveSourceId(id);
  }, []);

  const handleAxisSplit = useCallback(async (orientation: Orientation) => {
    if (sourceItems.length === 0 || !canvasRef.current) return;

    setActivePreviewOrientation(orientation);
    setIsProcessing(true);
    setGeneratedMode(orientation);
    setGeneratedImagesWithCleanup([]);

    try {
      const nextImages: SplitImage[] = [];
      let nextId = 0;

      for (const item of sourceItems) {
        let plan = buildAxisSplitPlan(
          orientation,
          item.image.naturalWidth,
          item.image.naturalHeight,
          hvMode,
          hvRatioW,
          hvRatioH,
          hvCount,
          overlapPercent,
          hvCountReduction,
          item.fileName
        );

        if (sourceItems.length === 1 && item.id === activeSourceId) {
          plan = applyManualStartsToPlan(
            plan,
            orientation === 'vertical' ? manualSliceStarts.vertical : manualSliceStarts.horizontal
          ) ?? plan;
        }

        if (plan.tileSize <= 0) {
          throw new Error(`切片尺寸计算错误：${item.fileName}`);
        }

        const itemImages = await buildAxisSplitImages(item.image, canvasRef.current, orientation, plan);
        nextImages.push(...itemImages.map((image) => ({ ...image, id: nextId++ })));
      }

      setGeneratedImagesWithCleanup(nextImages);
    } catch (error) {
      console.error('Error processing images:', error);
      alert('处理图片时出错');
    } finally {
      setIsProcessing(false);
    }
  }, [
    activeSourceId,
    hvCount,
    hvCountReduction,
    hvMode,
    hvRatioH,
    hvRatioW,
    manualSliceStarts.horizontal,
    manualSliceStarts.vertical,
    overlapPercent,
    setGeneratedImagesWithCleanup,
    sourceItems,
  ]);

  const handleVerticalSplit = useCallback(() => {
    void handleAxisSplit('vertical');
  }, [handleAxisSplit]);

  const handleHorizontalSplit = useCallback(() => {
    void handleAxisSplit('horizontal');
  }, [handleAxisSplit]);

  const handleGridSplit = useCallback(async () => {
    if (sourceItems.length === 0 || !canvasRef.current) return;

    setIsProcessing(true);
    setGeneratedMode('grid');
    setGeneratedImagesWithCleanup([]);

    try {
      const cols = Math.max(1, Math.floor(aspectW));
      const rows = Math.max(1, Math.floor(aspectH));
      const nextImages: SplitImage[] = [];
      let nextId = 0;

      for (const item of sourceItems) {
        const itemImages = await buildGridSplitImages(
          item.image,
          canvasRef.current,
          cols,
          rows,
          gridRatioW,
          gridRatioH,
          overlapPercent,
          item.fileName
        );
        nextImages.push(...itemImages.map((image) => ({ ...image, id: nextId++ })));
      }

      setGeneratedImagesWithCleanup(nextImages);
    } catch (error) {
      console.error('Error processing images:', error);
      alert('处理图片时出错');
    } finally {
      setIsProcessing(false);
    }
  }, [aspectH, aspectW, gridRatioH, gridRatioW, overlapPercent, setGeneratedImagesWithCleanup, sourceItems]);

  const handleExportZip = useCallback(async () => {
    if (generatedImages.length === 0) return;
    await exportSplitImagesZip(generatedImages);
  }, [generatedImages]);

  const handleBatchDownload = useCallback(async () => {
    if (generatedImages.length === 0) return;
    await exportSplitImagesIndividually(generatedImages);
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
    gridPlan,
    gridRatioH,
    gridRatioW,
    handleActiveSourceChange,
    handleBatchDownload,
    handleExportZip,
    handleFileChange,
    handleGridSplit,
    handleHorizontalSplit,
    handleSendToWatermark,
    handleVerticalSplit,
    horizontalPlan,
    hvCount,
    hvCountReduction,
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
    setGridRatioH,
    setGridRatioW,
    setHvCount,
    setHvCountReduction,
    setHvMode,
    setHvRatioH,
    setHvRatioW,
    setIsPreviewOpen,
    setOverlapPercent,
    setPreviewIndex,
    sourceImageSummaries,
    sourceFileName,
    sourceImage,
    sourceItemsCount: sourceItems.length,
    activeSourceId,
    verticalPlan,
  };
}
