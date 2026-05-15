import React, { useState, useRef, ChangeEvent } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { setPendingCropTransfer } from "@/utils/crop-transfer";

interface SplitImage {
  id: number;
  url: string;
  blob: Blob;
  fileName: string;
}

interface SliceRegion {
  id: number;
  start: number;
  end: number;
  size: number;
  fileName: string;
}

interface OverlapRegion {
  id: number;
  start: number;
  end: number;
  size: number;
  fromSlice: number;
  toSlice: number;
}

interface SlicePlan {
  orientation: 'vertical' | 'horizontal';
  numSlices: number;
  tileSize: number;
  step: number;
  axisSize: number;
  fixedOtherSize: number;
  regions: SliceRegion[];
  overlaps: OverlapRegion[];
}

type Orientation = 'vertical' | 'horizontal';

interface ManualSliceStarts {
  vertical: number[] | null;
  horizontal: number[] | null;
}

interface PreviewViewportSize {
  width: number;
  height: number;
}

type GeneratedResultMode = Orientation | 'grid' | null;

// --- Helper: Core Calculation Logic ---
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
    // Protect against 0 or invalid inputs
    const rW = Math.max(0.1, ratioW);
    const rH = Math.max(0.1, ratioH);

    tileSize = orientation === 'vertical'
      ? Math.floor(fixedOtherSize * (rW / rH))
      : Math.floor(fixedOtherSize * (rH / rW));

    // If calculated tile is larger than the image itself, return 1 slice
    if (tileSize >= axisSize) {
      return { numSlices: 1, tileSize: axisSize, step: 0 };
    }

    const maxStep = Math.floor(tileSize * (1 - ov));
    // Ensure step is at least 1px to avoid infinite slices
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

const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const buildPreviewViewportSize = (naturalWidth: number, naturalHeight: number): PreviewViewportSize => {
  const maxWidth = 1120;
  const maxHeight = 1800;
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);

  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
};

const generatePreviewImageUrl = async (image: HTMLImageElement, originalUrl: string) => {
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

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
  return blob ? URL.createObjectURL(blob) : originalUrl;
};

const revokeGeneratedImageUrls = (images: SplitImage[]) => {
  images.forEach((image) => {
    URL.revokeObjectURL(image.url);
  });
};

const buildOverlapRegions = (regions: SliceRegion[]): OverlapRegion[] => {
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

const buildAxisSplitPlan = (
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

const applyManualStartsToPlan = (plan: SlicePlan | null, manualStarts: number[] | null): SlicePlan | null => {
  if (!plan || !manualStarts || manualStarts.length !== plan.regions.length) {
    return plan;
  }

  const regions = plan.regions.map((region, index) => {
    const start = clampValue(Math.round(manualStarts[index]), 0, plan.axisSize - region.size);
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

const getSliceColor = (index: number, alpha: number) =>
  `hsla(${(index * 53 + 12) % 360}, 85%, 52%, ${alpha})`;

interface AxisSplitPreviewProps {
  title: string;
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  plan: SlicePlan;
  isAdjusted: boolean;
  onCommitStarts?: (starts: number[]) => void;
  onReset?: () => void;
}

const AxisSplitPreview = React.memo((props: AxisSplitPreviewProps) => {
  const { title, imageUrl, naturalWidth, naturalHeight, plan, isAdjusted, onCommitStarts, onReset } = props;
  const viewportSize = React.useMemo(
    () => buildPreviewViewportSize(naturalWidth, naturalHeight),
    [naturalWidth, naturalHeight]
  );
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    regionIndex: number;
    origin: number;
    initialStart: number;
    axisPixels: number;
    minStart: number;
    maxStart: number;
    baseStarts: number[];
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingStartRef = useRef<number | null>(null);
  const [activeRegionId, setActiveRegionId] = useState<number | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<number | null>(null);
  const [draftStarts, setDraftStarts] = useState<number[]>(() => plan.regions.map((region) => region.start));
  const draftStartsRef = useRef<number[]>(plan.regions.map((region) => region.start));

  const isVertical = plan.orientation === 'vertical';
  const axisCursor = isVertical ? 'cursor-ew-resize' : 'cursor-ns-resize';
  const draftPlan = React.useMemo(
    () => applyManualStartsToPlan(plan, draftStarts) ?? plan,
    [plan, draftStarts]
  );
  const axisLabel = draftPlan.orientation === 'vertical' ? '宽度切片' : '高度切片';
  const otherDimension = draftPlan.orientation === 'vertical' ? `${draftPlan.tileSize} x ${naturalHeight}` : `${naturalWidth} x ${draftPlan.tileSize}`;
  const hasHoveredRegion = hoveredRegionId !== null;

  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!dragStateRef.current) {
      const nextStarts = plan.regions.map((region) => region.start);
      draftStartsRef.current = nextStarts;
      setDraftStarts(nextStarts);
    }
  }, [plan]);

  const handleRegionPointerDown = (event: React.PointerEvent<HTMLDivElement>, region: SliceRegion, index: number) => {
    if (!onCommitStarts) return;

    const frameRect = previewFrameRef.current?.getBoundingClientRect();
    if (!frameRect) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const baseStarts = draftStartsRef.current.slice();
    const minStart = index === 0 ? 0 : baseStarts[index - 1];
    const maxStartByBounds = plan.axisSize - region.size;
    const maxStartByOrder = index === plan.regions.length - 1 ? maxStartByBounds : baseStarts[index + 1];

    dragStateRef.current = {
      pointerId: event.pointerId,
      regionIndex: index,
      origin: isVertical ? event.clientX : event.clientY,
      initialStart: baseStarts[index] ?? region.start,
      axisPixels: isVertical ? frameRect.width : frameRect.height,
      minStart,
      maxStart: Math.min(maxStartByBounds, maxStartByOrder),
      baseStarts,
    };

    setActiveRegionId(region.id);
  };

  const handleRegionPointerMove = (event: React.PointerEvent<HTMLDivElement>, index: number) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId || dragState.regionIndex !== index) {
      return;
    }

    const currentAxisPoint = isVertical ? event.clientX : event.clientY;
    const deltaPixels = currentAxisPoint - dragState.origin;
    const deltaInImage = (deltaPixels / Math.max(1, dragState.axisPixels)) * plan.axisSize;
    pendingStartRef.current = dragState.initialStart + deltaInImage;

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        const latestDragState = dragStateRef.current;
        if (pendingStartRef.current !== null && latestDragState) {
          const nextStarts = latestDragState.baseStarts.slice();
          nextStarts[index] = clampValue(
            Math.round(pendingStartRef.current),
            latestDragState.minStart,
            latestDragState.maxStart
          );
          draftStartsRef.current = nextStarts;
          setDraftStarts(nextStarts);
        }
        pendingStartRef.current = null;
        rafRef.current = null;
      });
    }
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      const latestDragState = dragStateRef.current;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      let nextStarts = draftStartsRef.current;

      if (pendingStartRef.current !== null && latestDragState) {
        nextStarts = latestDragState.baseStarts.slice();
        nextStarts[latestDragState.regionIndex] = clampValue(
          Math.round(pendingStartRef.current),
          latestDragState.minStart,
          latestDragState.maxStart
        );
        draftStartsRef.current = nextStarts;
        setDraftStarts(nextStarts);
        pendingStartRef.current = null;
      }

      onCommitStarts?.(nextStarts);
      dragStateRef.current = null;
      setActiveRegionId(null);
    }
  };

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500">
            {axisLabel}，预计 {plan.numSlices} 块，单块约 {otherDimension}px
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
            {draftPlan.overlaps.length > 0 ? `重叠区域 ${draftPlan.overlaps.length} 处` : '无重叠'}
          </div>
          {isAdjusted && onReset && (
            <Button type="button" variant="outline" size="sm" onClick={onReset} className="h-8 rounded-full px-3 text-xs">
              恢复自动切片
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-xs text-slate-600">
        拖拽彩色切片区域可微调位置，切片尺寸保持不变，导出时会直接使用当前预览中的位置。
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Original</div>
          <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 pb-2 [contain:layout_paint_style]">
            <div
              className="overflow-hidden"
              style={{ width: viewportSize.width, height: viewportSize.height }}
            >
              <img src={imageUrl} alt={`${title} 原图`} className="block h-full w-full object-fill" loading="lazy" decoding="async" draggable={false} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Preview</div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border border-slate-400 bg-white" />
                切片区域
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-400/80" />
                重叠区域
              </span>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-950/5 pb-2 [contain:layout_paint_style]">
            <div
              ref={previewFrameRef}
              className="relative overflow-hidden"
              style={{ width: viewportSize.width, height: viewportSize.height }}
            >
              <img src={imageUrl} alt={`${title} 预览`} className="block h-full w-full select-none object-fill" loading="lazy" decoding="async" draggable={false} />

              <div className="absolute inset-0">
                {draftPlan.regions.map((region, index) => {
                  const isHovered = hoveredRegionId === region.id;
                  const isActive = activeRegionId === region.id;
                  const isDimmed = hasHoveredRegion && !isHovered;
                  const layoutStyle = isVertical
                    ? {
                        left: `${(region.start / draftPlan.axisSize) * 100}%`,
                        width: `${(region.size / draftPlan.axisSize) * 100}%`,
                        top: 0,
                        height: '100%',
                      }
                    : {
                        top: `${(region.start / draftPlan.axisSize) * 100}%`,
                        height: `${(region.size / draftPlan.axisSize) * 100}%`,
                        left: 0,
                        width: '100%',
                      };

                  return (
                    <div
                      key={region.id}
                      className={`absolute overflow-hidden transition-[opacity,box-shadow,transform,filter] duration-150 ${axisCursor}`}
                      style={{
                        ...layoutStyle,
                        backgroundColor: getSliceColor(index, 0.08),
                        backgroundImage: `linear-gradient(180deg, ${getSliceColor(index, 0.14)}, transparent 24%), repeating-linear-gradient(${index % 2 === 0 ? '135deg' : '45deg'}, ${getSliceColor(index, 0.12)} 0 10px, transparent 10px 22px)`,
                        border: `2px solid ${getSliceColor(index, 0.95)}`,
                        boxShadow: isActive || isHovered
                          ? `0 0 0 4px ${getSliceColor(index, 0.2)}, inset 0 0 0 1px rgba(255,255,255,0.9)`
                          : `inset 0 0 0 1px rgba(255,255,255,0.72)`,
                        zIndex: isActive || isHovered ? 5 : 2,
                        opacity: isDimmed ? 0.26 : 1,
                        filter: isDimmed ? 'saturate(0.68)' : 'saturate(1)',
                        transform: isHovered ? 'scale(1.002)' : undefined,
                      }}
                      onPointerEnter={() => setHoveredRegionId(region.id)}
                      onPointerLeave={() => setHoveredRegionId((current) => (current === region.id ? null : current))}
                      onPointerDown={(event) => handleRegionPointerDown(event, region, index)}
                      onPointerMove={(event) => handleRegionPointerMove(event, index)}
                      onPointerUp={stopDragging}
                      onPointerCancel={stopDragging}
                    >
                      <div
                        className={`absolute ${isVertical ? 'bottom-0 top-0 w-[3px]' : 'left-0 right-0 h-[3px]'}`}
                        style={{
                          [isVertical ? 'left' : 'top']: 0,
                          backgroundColor: getSliceColor(index, 0.95),
                        }}
                      />
                      <div
                        className={`absolute ${isVertical ? 'bottom-0 top-0 w-[3px]' : 'left-0 right-0 h-[3px]'}`}
                        style={{
                          [isVertical ? 'right' : 'bottom']: 0,
                          backgroundColor: getSliceColor(index, 0.95),
                        }}
                      />
                      <div className="absolute left-2 top-2 rounded-full border border-white/60 bg-slate-950/82 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                        切片 {String(index + 1).padStart(2, '0')}
                      </div>
                      <div className="absolute left-2 bottom-2 rounded-full border border-white/70 bg-white/88 px-2.5 py-1 text-[10px] font-medium text-slate-800 shadow-sm">
                        {region.size}px
                      </div>
                      <div className={`absolute ${isVertical ? 'bottom-3 left-1/2 -translate-x-1/2' : 'right-3 top-1/2 -translate-y-1/2'}`}>
                        <div className={`rounded-full border border-slate-200 bg-white/92 px-2 py-1 text-[10px] font-medium text-slate-700 shadow-sm ${axisCursor}`}>
                          {isVertical ? '左右拖动' : '上下拖动'}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="pointer-events-none absolute inset-0">
                  {draftPlan.overlaps.map((overlap) => {
                    const isRelatedToHovered =
                      hoveredRegionId !== null &&
                      (draftPlan.regions[overlap.fromSlice]?.id === hoveredRegionId ||
                        draftPlan.regions[overlap.toSlice]?.id === hoveredRegionId);
                    const overlapDimmed = hasHoveredRegion && !isRelatedToHovered;
                    const overlapStyle = isVertical
                      ? {
                          left: `${(overlap.start / draftPlan.axisSize) * 100}%`,
                          width: `${(overlap.size / draftPlan.axisSize) * 100}%`,
                          top: 0,
                          height: '100%',
                        }
                      : {
                          top: `${(overlap.start / draftPlan.axisSize) * 100}%`,
                          height: `${(overlap.size / draftPlan.axisSize) * 100}%`,
                          left: 0,
                          width: '100%',
                        };

                    return (
                      <div
                        key={`${overlap.fromSlice}-${overlap.toSlice}`}
                        className="absolute"
                        style={{
                          ...overlapStyle,
                          backgroundColor: 'rgba(249, 115, 22, 0.14)',
                          border: '2px dashed rgba(234, 88, 12, 0.95)',
                          backgroundImage: 'repeating-linear-gradient(135deg, rgba(251, 146, 60, 0.62) 0 12px, rgba(251, 146, 60, 0.06) 12px 24px)',
                          zIndex: isRelatedToHovered ? 6 : 4,
                          opacity: overlapDimmed ? 0.16 : isRelatedToHovered ? 1 : 0.82,
                          boxShadow: isRelatedToHovered ? '0 0 0 3px rgba(251, 146, 60, 0.18)' : undefined,
                          transition: 'opacity 150ms ease, box-shadow 150ms ease',
                        }}
                      >
                        <div className="absolute left-2 top-2 rounded-full border border-orange-200/70 bg-orange-500/92 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
                          重叠 {overlap.fromSlice + 1}-{overlap.toSlice + 1}
                        </div>
                        <div className="absolute bottom-2 right-2 rounded-full border border-white/70 bg-white/90 px-2 py-1 text-[10px] font-medium text-orange-700 shadow-sm">
                          {overlap.size}px
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {draftPlan.regions.map((region, index) => (
          <div
            key={region.id}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-700 shadow-sm"
            style={{
              boxShadow: `inset 0 0 0 1px ${getSliceColor(index, 0.22)}`,
              borderColor: getSliceColor(index, 0.45),
              backgroundColor: getSliceColor(index, 0.08),
              opacity: hasHoveredRegion && hoveredRegionId !== region.id ? 0.45 : 1,
              transform: hoveredRegionId === region.id ? 'translateY(-1px)' : undefined,
              transition: 'opacity 150ms ease, transform 150ms ease',
            }}
          >
            第 {index + 1} 块: {region.size}px
          </div>
        ))}
      </div>
    </div>
  );
});

const ImageSplitter: React.FC = () => {
  // --- State Management ---
  const navigate = useNavigate();
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 网格比例配置
  const [aspectW, setAspectW] = useState<number>(1);
  const [aspectH, setAspectH] = useState<number>(1);

  // 水平/竖直配置
  const [hvMode, setHvMode] = useState<'ratio' | 'count'>('ratio');
  const [hvRatioW, setHvRatioW] = useState<number>(1);
  const [hvRatioH, setHvRatioH] = useState<number>(1);
  const [hvCount, setHvCount] = useState<number>(1);

  // 重叠率 (0-100)
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

  const baseVerticalPlan = React.useMemo(
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

  const baseHorizontalPlan = React.useMemo(
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

  React.useEffect(() => {
    setManualSliceStarts({
      vertical: null,
      horizontal: null,
    });
  }, [sourceImage, hvMode, hvRatioW, hvRatioH, hvCount, overlapPercent]);

  React.useEffect(() => {
    generatedImagesRef.current = generatedImages;
  }, [generatedImages]);

  React.useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
      revokeGeneratedImageUrls(generatedImagesRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!sourceImage) return;
    setActivePreviewOrientation(
      sourceImage.naturalHeight > sourceImage.naturalWidth * 1.5 ? 'horizontal' : 'vertical'
    );
  }, [sourceImage]);

  const setGeneratedImagesWithCleanup = React.useCallback((images: SplitImage[]) => {
    setGeneratedImages((current) => {
      revokeGeneratedImageUrls(current);
      return images;
    });
  }, []);

  const buildAxisSplitImages = React.useCallback(async (orientation: Orientation, plan: SlicePlan) => {
    if (!sourceImage || !canvasRef.current) return null;

    const newImages: SplitImage[] = [];

    for (let i = 0; i < plan.regions.length; i++) {
      const region = plan.regions[i];
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) continue;

      if (orientation === 'vertical') {
        canvas.width = region.size;
        canvas.height = plan.fixedOtherSize;
        ctx.drawImage(
          sourceImage,
          region.start, 0, region.size, plan.fixedOtherSize,
          0, 0, region.size, plan.fixedOtherSize
        );
      } else {
        canvas.width = plan.fixedOtherSize;
        canvas.height = region.size;
        ctx.drawImage(
          sourceImage,
          0, region.start, plan.fixedOtherSize, region.size,
          0, 0, plan.fixedOtherSize, region.size
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
  }, [sourceImage]);

  const verticalPlan = React.useMemo(
    () => applyManualStartsToPlan(baseVerticalPlan, manualSliceStarts.vertical),
    [baseVerticalPlan, manualSliceStarts.vertical]
  );

  const horizontalPlan = React.useMemo(
    () => applyManualStartsToPlan(baseHorizontalPlan, manualSliceStarts.horizontal),
    [baseHorizontalPlan, manualSliceStarts.horizontal]
  );

  const commitManualRegionStarts = (orientation: Orientation, starts: number[]) => {
    const currentPlan = orientation === 'vertical' ? verticalPlan : horizontalPlan;
    if (!currentPlan) return;

    setManualSliceStarts((prev) => {
      const safeStarts = starts.slice(0, currentPlan.regions.length);

      return {
        ...prev,
        [orientation]: safeStarts,
      };
    });
  };

  const resetManualRegionStart = (orientation: Orientation) => {
    setManualSliceStarts((prev) => ({
      ...prev,
      [orientation]: null,
    }));
  };

  // --- 1. 处理图片上传 ---
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
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
    }
  };

  // --- 2. 水平/竖直切割（可选比例或数量，支持重叠） ---
  const handleAxisSplit = async (orientation: Orientation) => {
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
      const newImages = await buildAxisSplitImages(orientation, plan);
      if (!newImages) {
        throw new Error('处理图片时出错');
      }

      setGeneratedImagesWithCleanup(newImages);
    } catch (error) {
      console.error('Error processing images:', error);
      alert('处理图片时出错');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerticalSplit = async () => handleAxisSplit('vertical');
  const handleHorizontalSplit = async () => handleAxisSplit('horizontal');

  const activePlan = activePreviewOrientation === 'vertical' ? verticalPlan : horizontalPlan;
  const activeTitle = activePreviewOrientation === 'vertical' ? '纵向分列预览' : '横向分行预览';
  const activeIsAdjusted = activePreviewOrientation === 'vertical'
    ? Boolean(manualSliceStarts.vertical)
    : Boolean(manualSliceStarts.horizontal);

  const handleGridSplit = async () => {
    if (!sourceImage || !canvasRef.current) return;
    setIsProcessing(true);
    setGeneratedMode('grid');
    setGeneratedImagesWithCleanup([]);
    const { naturalWidth, naturalHeight } = sourceImage;
    const cols = Math.max(1, Math.floor(aspectW));
    const rows = Math.max(1, Math.floor(aspectH));
    const baseTileWidth = Math.floor(naturalWidth / cols);
    const baseTileHeight = Math.floor(naturalHeight / rows);
    const newImages: SplitImage[] = [];
    try {
      let index = 0;
      for (let r = 0; r < rows; r++) {
        const startY = r * baseTileHeight;
        const tileHeight = r === rows - 1 ? naturalHeight - startY : baseTileHeight;
        for (let c = 0; c < cols; c++) {
          const startX = c * baseTileWidth;
          const tileWidth = c === cols - 1 ? naturalWidth - startX : baseTileWidth;
          const canvas = canvasRef.current;
          canvas.width = tileWidth;
          canvas.height = tileHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(sourceImage, startX, startY, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
            if (blob) {
              const url = URL.createObjectURL(blob);
              index += 1;
              const fileName = `split_${String(index).padStart(3, '0')}.jpg`;
              newImages.push({ id: index - 1, url, blob, fileName });
            }
          }
        }
      }
      setGeneratedImagesWithCleanup(newImages);
    } catch (error) {
      console.error("Error processing images:", error);
      alert("处理图片时出错");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 3. 导出 Zip ---
  const handleExport = async () => {
    if (generatedImages.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder("split_images");
    generatedImages.forEach((img) => {
      if (folder) folder.file(img.fileName, img.blob);
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "split_images.zip");
  };

  const handleSendToWatermark = () => {
    if (generatedImages.length === 0) return;

    const files = generatedImages.map((image, index) => {
      const baseName = image.fileName.replace(/\.[^.]+$/, '');
      const fileExtension = image.fileName.split('.').pop() || 'jpg';
      return new File(
        [image.blob],
        `${baseName}.${fileExtension}`,
        {
          type: image.blob.type || 'image/jpeg',
          lastModified: Date.now() + index,
        }
      );
    });

    setPendingCropTransfer('watermark', files);
    navigate('/watermark');
  };

  React.useEffect(() => {
    const syncGeneratedPreview = async () => {
      if (isProcessing || !generatedMode || generatedMode === 'grid') return;
      if (generatedImages.length === 0) return;

      const targetPlan = generatedMode === 'vertical' ? verticalPlan : horizontalPlan;
      if (!targetPlan) return;

      const syncedImages = await buildAxisSplitImages(generatedMode, targetPlan);
      if (syncedImages) {
        setGeneratedImagesWithCleanup(syncedImages);
      }
    };

    void syncGeneratedPreview();
  }, [
    generatedMode,
    generatedImages.length,
    verticalPlan,
    horizontalPlan,
    buildAxisSplitImages,
    setGeneratedImagesWithCleanup,
    isProcessing,
  ]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">长图智能切片</h2>
        <p className="text-sm text-slate-500 mt-1">水平/竖直切割（重叠可选）与按比例网格切分</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>切片设置</CardTitle>
          <CardDescription>上传图片后选择切割方式</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">1. 上传长图</label>
              <input
                type="file"
                accept="image/*"
                aria-label="上传要切片的长图"
                title="上传要切片的长图"
                onChange={handleFileChange}
                className="block text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">2. 水平/竖直切割</label>
              <div className="flex items-center gap-3">
                <Select value={hvMode} onValueChange={(v) => setHvMode(v as 'ratio' | 'count')}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="选择模式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ratio">按比例</SelectItem>
                    <SelectItem value="count">按数量</SelectItem>
                  </SelectContent>
                </Select>
                {hvMode === 'ratio' ? (
                  <>
                    <input type="number" value={hvRatioW} min={1} aria-label="切片比例宽度" title="切片比例宽度" onChange={(e) => setHvRatioW(Number(e.target.value))} className="w-20 h-9 rounded-md border border-input px-3 text-sm" />
                    <span className="font-bold">:</span>
                    <input type="number" value={hvRatioH} min={1} aria-label="切片比例高度" title="切片比例高度" onChange={(e) => setHvRatioH(Number(e.target.value))} className="w-20 h-9 rounded-md border border-input px-3 text-sm" />
                  </>
                ) : (
                  <input type="number" value={hvCount} min={1} aria-label="切片数量" title="切片数量" onChange={(e) => setHvCount(Number(e.target.value))} className="w-24 h-9 rounded-md border border-input px-3 text-sm" />
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">重叠比例 (%)</span>
                <input type="number" value={overlapPercent} min={0} max={90} aria-label="重叠比例" title="重叠比例" onChange={(e) => setOverlapPercent(Number(e.target.value))} className="w-24 h-9 rounded-md border border-input px-3 text-sm" />
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex flex-col gap-1">
                  <Button
                    onClick={handleVerticalSplit}
                    disabled={!sourceImage || isProcessing}
                    variant={activePreviewOrientation === 'vertical' ? 'default' : 'outline'}
                    className={`h-9 ${sourceImage && sourceImage.naturalWidth > sourceImage.naturalHeight * 1.5 ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                  >
                    {isProcessing ? '生成中...' : '纵向分列 (切宽度)'}
                  </Button>
                  {verticalPlan && (
                    <span className="text-[10px] text-slate-500 text-center">
                      预计 {verticalPlan.numSlices} 张 ({verticalPlan.tileSize}x{sourceImage?.naturalHeight})
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <Button
                    onClick={handleHorizontalSplit}
                    disabled={!sourceImage || isProcessing}
                    variant={activePreviewOrientation === 'horizontal' ? 'default' : 'outline'}
                    className={`h-9 ${sourceImage && sourceImage.naturalHeight > sourceImage.naturalWidth * 1.5 ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                  >
                    {isProcessing ? '生成中...' : '横向分行 (切高度)'}
                  </Button>
                  {horizontalPlan && (
                    <span className="text-[10px] text-slate-500 text-center">
                      预计 {horizontalPlan.numSlices} 张 ({sourceImage?.naturalWidth}x{horizontalPlan.tileSize})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">3. 按比例网格 (列 : 行)</label>
              <div className="flex items-center gap-3">
                <input type="number" value={aspectW} min={1} aria-label="网格列数" title="网格列数" onChange={(e) => setAspectW(Number(e.target.value))} className="w-20 h-9 rounded-md border border-input px-3 text-sm" />
                <span className="font-bold">:</span>
                <input type="number" value={aspectH} min={1} aria-label="网格行数" title="网格行数" onChange={(e) => setAspectH(Number(e.target.value))} className="w-20 h-9 rounded-md border border-input px-3 text-sm" />
                <span className="text-xs text-slate-500">切片之间不重叠</span>
                <Button onClick={handleGridSplit} disabled={!sourceImage || isProcessing} className="ml-auto h-9">
                  {isProcessing ? '生成中...' : '按比例网格切割'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 隐藏 Canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {previewUrl && sourceImage && activePlan && (
        <Card className="mb-6 overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]">
          <CardHeader>
            <CardTitle>实时切片预览</CardTitle>
            <CardDescription>当前仅显示已选方向的预览与微调结果，橙色斜纹表示重叠区域</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AxisSplitPreview
              title={activeTitle}
              imageUrl={previewUrl}
              naturalWidth={sourceImage.naturalWidth}
              naturalHeight={sourceImage.naturalHeight}
              plan={activePlan}
              isAdjusted={activeIsAdjusted}
              onCommitStarts={(starts) => commitManualRegionStarts(activePreviewOrientation, starts)}
              onReset={() => resetManualRegionStart(activePreviewOrientation)}
            />
          </CardContent>
        </Card>
      )}

      {generatedImages.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">成功生成 {generatedImages.length} 张切片</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSendToWatermark} variant="outline">
                转到水印
              </Button>
              <Button onClick={handleExport} variant="outline">下载全部 (.zip)</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {generatedImages.map((img, i) => (
                <div
                  key={img.id}
                  className="rounded-lg border bg-white shadow-sm overflow-hidden cursor-pointer hover:bg-slate-50 transition"
                  onClick={() => { setPreviewIndex(i); setIsPreviewOpen(true); }}
                >
                  <div className="relative">
                    <img src={img.url} alt={img.fileName} className="w-full h-auto block" />
                    <div className="absolute bottom-0 right-0 bg-black/50 text-white text-xs px-2 py-1">{i + 1}</div>
                  </div>
                  <div className="px-3 py-2 text-xs text-slate-600 text-center">{img.fileName}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>生成图预览</DialogTitle>
            <DialogDescription>{previewIndex !== null ? generatedImages[previewIndex]?.fileName : ''}</DialogDescription>
          </DialogHeader>
          {previewIndex !== null && generatedImages[previewIndex] && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border">
                <img src={generatedImages[previewIndex].url} alt={generatedImages[previewIndex].fileName} className="max-h-[70vh] w-auto mx-auto" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPreviewIndex((idx) => (idx !== null ? Math.max(0, idx - 1) : null))} disabled={(previewIndex ?? 0) <= 0}>上一张</Button>
                  <Button variant="outline" onClick={() => setPreviewIndex((idx) => (idx !== null ? Math.min(generatedImages.length - 1, idx + 1) : null))} disabled={(previewIndex ?? 0) >= generatedImages.length - 1}>下一张</Button>
                </div>
                <Button onClick={() => previewIndex !== null && saveAs(generatedImages[previewIndex].blob, generatedImages[previewIndex].fileName)}>下载此图</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageSplitter;
