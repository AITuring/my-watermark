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
  localSourceId?: string;
}

export interface SplitLoadingStatus {
  title: string;
  detail: string;
  completed?: number;
  total?: number;
}

const revokeSourceImageUrls = (items: SourceImageItem[]) => {
  items.forEach((item) => {
    if (item.localSourceId) {
      void fetch(`/__local_split/item/${item.localSourceId}`, { method: 'DELETE' });
      return;
    }
    URL.revokeObjectURL(item.originalUrl);
    if (item.previewUrl !== item.originalUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
};

const MAX_BROWSER_IMAGE_PIXELS = 80_000_000;
const MAX_BROWSER_IMAGE_SIDE = 16_384;

const readJpegSize = async (file: File): Promise<{ width: number; height: number } | null> => {
  if (!/\.(jpe?g)$/i.test(file.name) && file.type !== 'image/jpeg') return null;
  const bytes = new DataView(await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer());
  if (bytes.byteLength < 4 || bytes.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.byteLength) {
    if (bytes.getUint8(offset) !== 0xff) return null;
    const marker = bytes.getUint8(offset + 1);
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.byteLength) break;
    const length = bytes.getUint16(offset);
    if (length < 2 || offset + length > bytes.byteLength) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.getUint16(offset + 3), width: bytes.getUint16(offset + 5) };
    }
    offset += length;
  }
  return null;
};

const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('无法读取图片预览'));
  image.src = url;
});

const importLargeJpegLocally = async (
  file: File,
  index: number,
  onStatus: (status: SplitLoadingStatus) => void
): Promise<SourceImageItem> => {
  const result = await new Promise<{ id: string; width: number; height: number; previewUrl: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/__local_split/import');
    request.setRequestHeader('Content-Type', 'image/jpeg');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onStatus({ title: '正在传入原图', detail: `${file.name} · 已传输 ${Math.round(event.loaded / event.total * 100)}%`,
          completed: event.loaded, total: event.total });
      }
    };
    request.upload.onload = () => onStatus({ title: '正在生成预览', detail: `${file.name} · 原图已传入，正在读取尺寸与缩略图` });
    request.onerror = () => reject(new Error('本地大图处理服务不可用。请通过本机 Vite 服务打开应用。'));
    request.onload = () => {
      let payload: { id?: string; width?: number; height?: number; previewUrl?: string; error?: string } = {};
      try { payload = JSON.parse(request.responseText); } catch { /* handled below */ }
      if (request.status < 200 || request.status >= 300 || !payload.id || !payload.previewUrl || !payload.width || !payload.height) {
        reject(new Error(payload.error || '本地大图服务未启用。请通过本机 Vite 服务打开应用。'));
        return;
      }
      resolve(payload as { id: string; width: number; height: number; previewUrl: string });
    };
    request.send(file);
  });
  try {
    const image = await loadImage(result.previewUrl);
    return {
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      fileName: file.name,
      naturalWidth: result.width,
      naturalHeight: result.height,
      image,
      originalUrl: result.previewUrl,
      previewUrl: result.previewUrl,
      localSourceId: result.id,
    };
  } catch (error) {
    void fetch(`/__local_split/item/${result.id}`, { method: 'DELETE' });
    throw error;
  }
};

const loadSourceImageItem = async (file: File, index: number, onStatus: (status: SplitLoadingStatus) => void): Promise<SourceImageItem> => {
  const jpegSize = await readJpegSize(file);
  const oversize = jpegSize && (
    jpegSize.width * jpegSize.height > MAX_BROWSER_IMAGE_PIXELS ||
    Math.max(jpegSize.width, jpegSize.height) > MAX_BROWSER_IMAGE_SIDE
  );
  if (oversize) return importLargeJpegLocally(file, index, onStatus);
  onStatus({ title: '正在读取图片', detail: file.name });
  const originalUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
      image.src = originalUrl;
    });

    onStatus({ title: '正在生成预览', detail: file.name });
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
  } catch (error) {
    URL.revokeObjectURL(originalUrl);
    throw error;
  }
};

const buildLocalSplitImages = async (
  sourceId: string,
  regions: Array<{ x: number; y: number; width: number; height: number; fileName: string }>,
  onProgress?: (completed: number, total: number) => void
): Promise<SplitImage[]> => {
  const images: SplitImage[] = [];
  try {
    for (const [index, region] of regions.entries()) {
      const query = new URLSearchParams({
        x: String(region.x), y: String(region.y),
        w: String(region.width), h: String(region.height),
      });
      const response = await fetch(`/__local_split/crop/${sourceId}?${query}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || `第 ${index + 1} 张切片生成失败`);
      }
      const blob = await response.blob();
      const previewResponse = await fetch(`/__local_split/crop/${sourceId}?${query}&preview=1`);
      if (!previewResponse.ok) throw new Error(`第 ${index + 1} 张切片预览生成失败`);
      const previewBlob = await previewResponse.blob();
      images.push({ id: index, url: URL.createObjectURL(blob),
        previewUrl: URL.createObjectURL(previewBlob), blob, fileName: region.fileName });
      onProgress?.(index + 1, regions.length);
    }
    return images;
  } catch (error) {
    revokeGeneratedImageUrls(images);
    throw error;
  }
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
  const [isImporting, setIsImporting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<SplitLoadingStatus | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [manualSliceStarts, setManualSliceStarts] = useState<ManualSliceStarts>({
    vertical: null,
    horizontal: null,
  });
  const [activePreviewOrientation, setActivePreviewOrientation] = useState<Orientation>('vertical');
  const sourceItemsRef = useRef<SourceImageItem[]>([]);
  const generatedImagesRef = useRef<SplitImage[]>([]);
  const lastPlanSignatureRef = useRef('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeSource = useMemo(
    () => sourceItems.find((item) => item.id === activeSourceId) ?? sourceItems[0] ?? null,
    [activeSourceId, sourceItems]
  );
  const sourceImage = activeSource?.image ?? null;
  const sourceNaturalWidth = activeSource?.naturalWidth;
  const sourceNaturalHeight = activeSource?.naturalHeight;
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
      activeSource
        ? buildAxisSplitPlan(
            'vertical',
            activeSource.naturalWidth,
            activeSource.naturalHeight,
            hvMode,
            hvRatioW,
            hvRatioH,
            hvCount,
            overlapPercent,
            hvCountReduction,
            sourceFileName
          )
        : null,
    [activeSource, hvMode, hvRatioW, hvRatioH, hvCount, overlapPercent, hvCountReduction, sourceFileName]
  );

  const baseHorizontalPlan = useMemo(
    () =>
      activeSource
        ? buildAxisSplitPlan(
            'horizontal',
            activeSource.naturalWidth,
            activeSource.naturalHeight,
            hvMode,
            hvRatioW,
            hvRatioH,
            hvCount,
            overlapPercent,
            hvCountReduction,
            sourceFileName
          )
        : null,
    [activeSource, hvMode, hvRatioW, hvRatioH, hvCount, overlapPercent, hvCountReduction, sourceFileName]
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
      activeSource
        ? buildGridSplitPlan(
            activeSource.naturalWidth,
            activeSource.naturalHeight,
            aspectW,
            aspectH,
            gridRatioW,
            gridRatioH,
            overlapPercent,
            sourceFileName
          )
        : null,
    [aspectH, aspectW, gridRatioH, gridRatioW, overlapPercent, sourceFileName, activeSource]
  );

  const activePlan = activePreviewOrientation === 'vertical' ? verticalPlan : horizontalPlan;
  const planSignature = JSON.stringify({
    sourceId: activeSourceId,
    vertical: verticalPlan?.regions.map(({ start, size }) => [start, size]),
    horizontal: horizontalPlan?.regions.map(({ start, size }) => [start, size]),
    grid: gridPlan?.regions.map(({ startX, startY, width, height }) => [startX, startY, width, height]),
  });
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
    if (lastPlanSignatureRef.current !== planSignature) {
      lastPlanSignatureRef.current = planSignature;
      if (activeSource?.localSourceId && generatedImages.length > 0) {
        setGeneratedImagesWithCleanup([]);
        setGeneratedMode(null);
      }
    }
  }, [activeSource, generatedImages.length, planSignature, setGeneratedImagesWithCleanup]);

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
    if (!activeSource) return;

    setActivePreviewOrientation(
      activeSource.naturalHeight > activeSource.naturalWidth * 1.5 ? 'horizontal' : 'vertical'
    );
  }, [activeSource]);

  useEffect(() => {
    const syncGeneratedPreview = async () => {
      if (isProcessing || !generatedMode || generatedMode === 'grid' || sourceItems.length !== 1 || activeSource?.localSourceId) return;
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
    activeSource,
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
    setIsImporting(true);
    setLoadingStatus({ title: '准备导入图片', detail: `共 ${files.length} 张` });
    void (async () => {
      try {
        const nextSourceItems: SourceImageItem[] = [];
        try {
          for (const [index, file] of files.entries()) {
            const item = await loadSourceImageItem(file, index, (status) => setLoadingStatus({
              ...status, detail: files.length > 1 ? `第 ${index + 1}/${files.length} 张 · ${status.detail}` : status.detail,
            }));
            nextSourceItems.push(item);
            setLoadingStatus({ title: '正在导入图片', detail: `已完成 ${index + 1}/${files.length} 张`, completed: index + 1, total: files.length });
          }
        } catch (error) {
          revokeSourceImageUrls(nextSourceItems);
          throw error;
        }
        revokeSourceImageUrls(sourceItemsRef.current);
        setSourceItems(nextSourceItems);
        setActiveSourceId(nextSourceItems[0]?.id ?? null);
        setGeneratedMode(null);
        setGeneratedImagesWithCleanup([]);
      } catch (error) {
        console.error('Error loading source images:', error);
        alert(error instanceof Error ? error.message : '读取图片时出错');
      } finally {
        setIsImporting(false);
        setLoadingStatus(null);
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
    setLoadingStatus({ title: '准备生成切片', detail: `共 ${sourceItems.length} 张原图` });
    setGeneratedMode(orientation);
    setGeneratedImagesWithCleanup([]);

    try {
      const nextImages: SplitImage[] = [];
      let nextId = 0;

      for (const [sourceIndex, item] of sourceItems.entries()) {
        let plan = buildAxisSplitPlan(
          orientation,
          item.naturalWidth,
          item.naturalHeight,
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

        const onProgress = (completed: number, total: number) => setLoadingStatus({
          title: orientation === 'vertical' ? '正在生成纵向切片' : '正在生成横向切片',
          detail: `原图 ${sourceIndex + 1}/${sourceItems.length} · 切片 ${completed}/${total}`,
          completed, total,
        });
        onProgress(0, plan.regions.length);

        const itemImages = item.localSourceId
          ? await buildLocalSplitImages(item.localSourceId, plan.regions.map((region) => ({
              x: orientation === 'vertical' ? Math.round(region.start) : 0,
              y: orientation === 'horizontal' ? Math.round(region.start) : 0,
              width: orientation === 'vertical' ? Math.round(region.size) : item.naturalWidth,
              height: orientation === 'horizontal' ? Math.round(region.size) : item.naturalHeight,
              fileName: region.fileName,
            })), onProgress)
          : await buildAxisSplitImages(item.image, canvasRef.current, orientation, plan, onProgress);
        nextImages.push(...itemImages.map((image) => ({ ...image, id: nextId++ })));
      }

      setGeneratedImagesWithCleanup(nextImages);
    } catch (error) {
      console.error('Error processing images:', error);
      alert(error instanceof Error ? error.message : '处理图片时出错');
    } finally {
      setIsProcessing(false);
      setLoadingStatus(null);
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
    setLoadingStatus({ title: '准备生成网格切片', detail: `共 ${sourceItems.length} 张原图` });
    setGeneratedMode('grid');
    setGeneratedImagesWithCleanup([]);

    try {
      const cols = Math.max(1, Math.floor(aspectW));
      const rows = Math.max(1, Math.floor(aspectH));
      const nextImages: SplitImage[] = [];
      let nextId = 0;

      for (const [sourceIndex, item] of sourceItems.entries()) {
        const onProgress = (completed: number, total: number) => setLoadingStatus({
          title: '正在生成网格切片',
          detail: `原图 ${sourceIndex + 1}/${sourceItems.length} · 切片 ${completed}/${total}`,
          completed, total,
        });
        onProgress(0, buildGridSplitPlan(item.naturalWidth, item.naturalHeight, cols, rows,
          gridRatioW, gridRatioH, overlapPercent, item.fileName).regions.length);
        const itemImages = item.localSourceId
          ? await buildLocalSplitImages(item.localSourceId,
              buildGridSplitPlan(item.naturalWidth, item.naturalHeight, cols, rows,
                gridRatioW, gridRatioH, overlapPercent, item.fileName).regions.map((region) => ({
                  x: Math.round(region.startX), y: Math.round(region.startY),
                  width: Math.round(region.width), height: Math.round(region.height),
                  fileName: region.fileName,
                })), onProgress)
          : await buildGridSplitImages(
              item.image,
              canvasRef.current,
              cols,
              rows,
              gridRatioW,
              gridRatioH,
              overlapPercent,
              item.fileName,
              onProgress
            );
        nextImages.push(...itemImages.map((image) => ({ ...image, id: nextId++ })));
      }

      setGeneratedImagesWithCleanup(nextImages);
    } catch (error) {
      console.error('Error processing images:', error);
      alert(error instanceof Error ? error.message : '处理图片时出错');
    } finally {
      setIsProcessing(false);
      setLoadingStatus(null);
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

  const handleSendToWatermark = useCallback(async () => {
    if (generatedImages.length === 0) return;

    await setPendingCropTransfer('watermark', buildTransferFiles(generatedImages));
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
    isImporting,
    loadingStatus,
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
    sourceNaturalWidth,
    sourceNaturalHeight,
    sourceItemsCount: sourceItems.length,
    activeSourceId,
    verticalPlan,
  };
}
