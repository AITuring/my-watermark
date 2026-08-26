import React, { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { SlicePlan, SliceRegion } from '@/pages/split/types';
import {
  applyManualStartsToPlan,
  buildPreviewViewportSize,
  clampValue,
  getSliceColor,
} from '@/pages/split/utils';

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

export const AxisSplitPreview = React.memo((props: AxisSplitPreviewProps) => {
  const { title, imageUrl, naturalWidth, naturalHeight, plan, isAdjusted, onCommitStarts, onReset } = props;
  const previewStageMeasureRef = useRef<HTMLDivElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const [previewStageWidth, setPreviewStageWidth] = useState(0);
  const availableStageWidth = previewStageWidth > 0 ? Math.max(220, previewStageWidth - 28) : 960;
  const previewViewportSize = React.useMemo(
    () => buildPreviewViewportSize(naturalWidth, naturalHeight, availableStageWidth, 460),
    [naturalWidth, naturalHeight, availableStageWidth]
  );
  const originalViewportSize = React.useMemo(
    () => buildPreviewViewportSize(naturalWidth, naturalHeight, availableStageWidth, 220),
    [naturalWidth, naturalHeight, availableStageWidth]
  );
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
  const [draftStarts, setDraftStarts] = useState<number[]>(() =>
    plan.regions.map((region) => region.start)
  );
  const draftStartsRef = useRef<number[]>(plan.regions.map((region) => region.start));

  const isVertical = plan.orientation === 'vertical';
  const axisCursor = isVertical ? 'cursor-ew-resize' : 'cursor-ns-resize';
  const draftPlan = React.useMemo(
    () => applyManualStartsToPlan(plan, draftStarts) ?? plan,
    [plan, draftStarts]
  );
  const axisLabel = draftPlan.orientation === 'vertical' ? '宽度切片' : '高度切片';
  const otherDimension = draftPlan.orientation === 'vertical'
    ? `${draftPlan.tileSize} x ${naturalHeight}`
    : `${naturalWidth} x ${draftPlan.tileSize}`;
  const hasHoveredRegion = hoveredRegionId !== null;

  React.useEffect(() => {
    const element = previewStageMeasureRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setPreviewStageWidth(entry.contentRect.width);
      }
    });

    setPreviewStageWidth(element.clientWidth);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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

  const handleRegionPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    region: SliceRegion,
    index: number
  ) => {
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

  const handleRegionPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
    index: number
  ) => {
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
    <div className="space-y-3" ref={previewStageMeasureRef}>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 bg-muted/18 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">Preview</div>
            <div className="text-base font-semibold text-foreground">{title}</div>
          </div>
          <div className="hidden h-9 w-px bg-border/70 sm:block" />
          <div className="hidden flex-wrap items-center gap-3 text-[11px] text-muted-foreground sm:flex">
            <span>{axisLabel}</span>
            <span>预计 {plan.numSlices} 块</span>
            <span>单块约 {otherDimension}px</span>
            <span>{draftPlan.overlaps.length > 0 ? `重叠 ${draftPlan.overlaps.length} 处` : '无重叠'}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-background/75 px-2.5 py-1">
            <span className="h-2.5 w-2.5 rounded-full border border-border bg-background" />
            切片区域
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-background/75 px-2.5 py-1">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-400/80" />
            重叠区域
          </span>
          {isAdjusted && onReset && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              className="h-8 rounded-full px-3 text-[11px]"
            >
              恢复自动切片
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 xl:min-h-[760px] xl:grid-rows-[220px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-border/70 bg-muted/16 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-foreground">原图</div>
              <p className="text-[11px] text-muted-foreground">按原图比例展示，用来确认整体内容和构图。</p>
            </div>
            <div className="rounded-full bg-background/75 px-2 py-0.5 text-[10px] text-muted-foreground">
              原图 {naturalWidth} x {naturalHeight}
            </div>
          </div>
          <div className="flex h-[160px] items-center justify-center overflow-hidden rounded-xl bg-background/72 p-2 sm:h-[172px] xl:h-[176px]">
            <div
              className="max-w-full overflow-hidden rounded-lg bg-background/65"
              style={{ width: originalViewportSize.width, height: originalViewportSize.height }}
            >
              <img
                src={imageUrl}
                alt={`${title} 原图`}
                className="block h-full w-full object-contain"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/14 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">分块示意图</div>
              <p className="text-[11px] text-muted-foreground">拖拽彩色区域可微调切片位置，导出直接使用当前预览。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <div className="rounded-full bg-background/75 px-2 py-0.5">
                预览 {previewViewportSize.width} x {previewViewportSize.height}
              </div>
              <div className="rounded-full bg-background/75 px-2 py-0.5">
                {draftPlan.overlaps.length > 0 ? `重叠区域 ${draftPlan.overlaps.length} 处` : '无重叠'}
              </div>
            </div>
          </div>

          <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl bg-background/68 p-2 [contain:layout_paint_style] xl:min-h-[440px]">
            <div
              ref={previewFrameRef}
              className="relative max-w-full overflow-hidden rounded-xl bg-background/72 shadow-sm shadow-black/5"
              style={{ width: previewViewportSize.width, height: previewViewportSize.height }}
            >
              <img
                src={imageUrl}
                alt={`${title} 预览`}
                className="block h-full w-full select-none object-contain"
                loading="lazy"
                decoding="async"
                draggable={false}
              />

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
                          : 'inset 0 0 0 1px rgba(255,255,255,0.72)',
                        zIndex: isActive || isHovered ? 5 : 2,
                        opacity: isDimmed ? 0.26 : 1,
                        filter: isDimmed ? 'saturate(0.68)' : 'saturate(1)',
                        transform: isHovered ? 'scale(1.002)' : undefined,
                      }}
                      onPointerEnter={() => setHoveredRegionId(region.id)}
                      onPointerLeave={() =>
                        setHoveredRegionId((current) => (current === region.id ? null : current))
                      }
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
                      <div className="absolute left-2 top-2 rounded-full border border-background/25 bg-foreground/80 px-2.5 py-1 text-[11px] font-semibold text-background shadow-sm backdrop-blur-sm">
                        切片 {String(index + 1).padStart(2, '0')}
                      </div>
                      <div className="absolute left-2 bottom-2 rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[10px] font-medium text-foreground shadow-sm backdrop-blur-sm">
                        {region.size}px
                      </div>
                      <div className={`absolute ${isVertical ? 'bottom-3 left-1/2 -translate-x-1/2' : 'right-3 top-1/2 -translate-y-1/2'}`}>
                        <div className={`rounded-full border border-border/70 bg-background/92 px-2 py-1 text-[10px] font-medium text-foreground shadow-sm backdrop-blur-sm ${axisCursor}`}>
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
                          boxShadow: isRelatedToHovered
                            ? '0 0 0 3px rgba(251, 146, 60, 0.18)'
                            : undefined,
                          transition: 'opacity 150ms ease, box-shadow 150ms ease',
                        }}
                      >
                        <div className="absolute left-2 top-2 rounded-full border border-orange-200/70 bg-orange-500/92 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
                          重叠 {overlap.fromSlice + 1}-{overlap.toSlice + 1}
                        </div>
                        <div className="absolute bottom-2 right-2 rounded-full border border-border/70 bg-background/90 px-2 py-1 text-[10px] font-medium text-orange-700 shadow-sm backdrop-blur-sm">
                          {overlap.size}px
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {draftPlan.regions.map((region, index) => (
              <div
                key={region.id}
                className="rounded-full border border-border/70 bg-muted/55 px-3 py-1 text-[11px] text-foreground shadow-sm"
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
      </div>
    </div>
  );
});

AxisSplitPreview.displayName = 'AxisSplitPreview';
