import type {
  Orientation,
  OverlapRegion,
  PreviewViewportSize,
  SlicePlan,
  SliceRegion,
  SplitImage,
} from '@/pages/split/types';
import { loadJSZip, loadSaveAs } from '@/utils/lazy-deps';

type ZipInstance = {
  file: (name: string, data: Blob | File) => void;
  folder: (name: string) => ZipInstance | undefined;
  generateAsync: (options: { type: 'blob' }) => Promise<Blob>;
};

type ZipConstructor = new () => ZipInstance;

const calculateSlices = (
  orientation: Orientation,
  naturalWidth: number,
  naturalHeight: number,
  mode: 'ratio' | 'count',
  ratioW: number,
  ratioH: number,
  countInput: number,
  overlapPercent: number
) => {
  const axisSize = orientation === 'vertical' ? naturalWidth : naturalHeight;
  const fixedOtherSize = orientation === 'vertical' ? naturalHeight : naturalWidth;
  const ov = Math.min(Math.max(overlapPercent, 0), 90) / 100;

  let tileSize: number;
  let numSlices: number;
  let step: number;

  if (mode === 'ratio') {
    const rW = Math.max(0.1, ratioW);
    const rH = Math.max(0.1, ratioH);

    tileSize = orientation === 'vertical'
      ? Math.floor(fixedOtherSize * (rW / rH))
      : Math.floor(fixedOtherSize * (rH / rW));

    if (tileSize >= axisSize) {
      return { numSlices: 1, tileSize: axisSize, step: 0 };
    }

    const maxStep = Math.floor(tileSize * (1 - ov));
    const safeStep = Math.max(1, maxStep);

    numSlices = Math.ceil((axisSize - tileSize) / safeStep) + 1;
    step = (axisSize - tileSize) / (numSlices - 1);
  } else {
    numSlices = Math.max(1, Math.floor(countInput));
    if (numSlices === 1) {
      tileSize = axisSize;
      step = 0;
    } else {
      const denom = (numSlices - 1) * (1 - ov) + 1;
      tileSize = axisSize / denom;
      step = tileSize * (1 - ov);
    }
  }

  return { numSlices, tileSize: Math.round(tileSize), step };
};

export const clampValue = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const buildPreviewViewportSize = (
  naturalWidth: number,
  naturalHeight: number,
  maxWidth = 1120,
  maxHeight = 1800
): PreviewViewportSize => {
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);

  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
};

export const generatePreviewImageUrl = async (
  image: HTMLImageElement,
  originalUrl: string
) => {
  const { width, height } = buildPreviewViewportSize(image.naturalWidth, image.naturalHeight);

  if (width === image.naturalWidth && height === image.naturalHeight) {
    return originalUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return originalUrl;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.84)
  );
  return blob ? URL.createObjectURL(blob) : originalUrl;
};

export const revokeGeneratedImageUrls = (images: SplitImage[]) => {
  images.forEach((image) => {
    URL.revokeObjectURL(image.url);
  });
};

export const buildOverlapRegions = (regions: SliceRegion[]): OverlapRegion[] => {
  const overlaps: OverlapRegion[] = [];

  for (let i = 1; i < regions.length; i++) {
    const prev = regions[i - 1];
    const current = regions[i];
    const overlapStart = Math.max(prev.start, current.start);
    const overlapEnd = Math.min(prev.end, current.end);

    if (overlapEnd > overlapStart) {
      overlaps.push({
        id: i - 1,
        start: overlapStart,
        end: overlapEnd,
        size: overlapEnd - overlapStart,
        fromSlice: prev.id,
        toSlice: current.id,
      });
    }
  }

  return overlaps;
};

export const buildAxisSplitPlan = (
  orientation: Orientation,
  naturalWidth: number,
  naturalHeight: number,
  mode: 'ratio' | 'count',
  ratioW: number,
  ratioH: number,
  countInput: number,
  overlapPercent: number
): SlicePlan => {
  const { numSlices, tileSize, step } = calculateSlices(
    orientation,
    naturalWidth,
    naturalHeight,
    mode,
    ratioW,
    ratioH,
    countInput,
    overlapPercent
  );

  const axisSize = orientation === 'vertical' ? naturalWidth : naturalHeight;
  const fixedOtherSize = orientation === 'vertical' ? naturalHeight : naturalWidth;
  const safeTileSize = Math.max(1, Math.round(tileSize));

  const regions: SliceRegion[] = [];

  for (let i = 0; i < numSlices; i++) {
    const startPos = i === numSlices - 1 ? axisSize - safeTileSize : i * step;
    const start = Math.max(0, Math.round(startPos));
    const end = i === numSlices - 1 ? axisSize : Math.min(axisSize, start + safeTileSize);
    const size = Math.max(1, end - start);

    regions.push({
      id: i,
      start,
      end,
      size,
      fileName: `split_${String(i + 1).padStart(3, '0')}.jpg`,
    });
  }

  return {
    orientation,
    numSlices,
    tileSize: safeTileSize,
    step,
    axisSize,
    fixedOtherSize,
    regions,
    overlaps: buildOverlapRegions(regions),
  };
};

export const applyManualStartsToPlan = (
  plan: SlicePlan | null,
  manualStarts: number[] | null
): SlicePlan | null => {
  if (!plan || !manualStarts || manualStarts.length !== plan.regions.length) {
    return plan;
  }

  const regions = plan.regions.map((region, index) => {
    const start = clampValue(
      Math.round(manualStarts[index]),
      0,
      plan.axisSize - region.size
    );
    const end = Math.min(plan.axisSize, start + region.size);

    return {
      ...region,
      start,
      end,
      size: end - start,
    };
  });

  return {
    ...plan,
    regions,
    overlaps: buildOverlapRegions(regions),
  };
};

export const getSliceColor = (index: number, alpha: number) =>
  `hsla(${(index * 53 + 12) % 360}, 85%, 52%, ${alpha})`;

export const buildAxisSplitImages = async (
  sourceImage: HTMLImageElement,
  canvas: HTMLCanvasElement,
  orientation: Orientation,
  plan: SlicePlan
) => {
  const newImages: SplitImage[] = [];

  for (let i = 0; i < plan.regions.length; i++) {
    const region = plan.regions[i];
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      continue;
    }

    if (orientation === 'vertical') {
      canvas.width = region.size;
      canvas.height = plan.fixedOtherSize;
      ctx.drawImage(
        sourceImage,
        region.start,
        0,
        region.size,
        plan.fixedOtherSize,
        0,
        0,
        region.size,
        plan.fixedOtherSize
      );
    } else {
      canvas.width = plan.fixedOtherSize;
      canvas.height = region.size;
      ctx.drawImage(
        sourceImage,
        0,
        region.start,
        plan.fixedOtherSize,
        region.size,
        0,
        0,
        plan.fixedOtherSize,
        region.size
      );
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.95)
    );

    if (blob) {
      newImages.push({
        id: i,
        url: URL.createObjectURL(blob),
        blob,
        fileName: region.fileName,
      });
    }
  }

  return newImages;
};

export const buildGridSplitImages = async (
  sourceImage: HTMLImageElement,
  canvas: HTMLCanvasElement,
  cols: number,
  rows: number
) => {
  const { naturalWidth, naturalHeight } = sourceImage;
  const baseTileWidth = Math.floor(naturalWidth / cols);
  const baseTileHeight = Math.floor(naturalHeight / rows);
  const newImages: SplitImage[] = [];

  let index = 0;
  for (let r = 0; r < rows; r++) {
    const startY = r * baseTileHeight;
    const tileHeight = r === rows - 1 ? naturalHeight - startY : baseTileHeight;
    for (let c = 0; c < cols; c++) {
      const startX = c * baseTileWidth;
      const tileWidth = c === cols - 1 ? naturalWidth - startX : baseTileWidth;
      canvas.width = tileWidth;
      canvas.height = tileHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        continue;
      }

      ctx.drawImage(
        sourceImage,
        startX,
        startY,
        tileWidth,
        tileHeight,
        0,
        0,
        tileWidth,
        tileHeight
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.95)
      );

      if (blob) {
        index += 1;
        newImages.push({
          id: index - 1,
          url: URL.createObjectURL(blob),
          blob,
          fileName: `split_${String(index).padStart(3, '0')}.jpg`,
        });
      }
    }
  }

  return newImages;
};

export const exportSplitImagesZip = async (images: SplitImage[]) => {
  const JSZip = (await loadJSZip()) as ZipConstructor;
  const saveAs = await loadSaveAs();
  const zip = new JSZip();
  const folder = zip.folder('split_images');

  images.forEach((image) => {
    folder?.file(image.fileName, image.blob);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'split_images.zip');
};

export const buildTransferFiles = (images: SplitImage[]) =>
  images.map((image, index) => {
    const baseName = image.fileName.replace(/\.[^.]+$/, '');
    const fileExtension = image.fileName.split('.').pop() || 'jpg';

    return new File([image.blob], `${baseName}.${fileExtension}`, {
      type: image.blob.type || 'image/jpeg',
      lastModified: Date.now() + index,
    });
  });
