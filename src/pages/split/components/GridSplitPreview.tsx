import React, { useRef, useState } from 'react';

import type { GridSplitPlan } from '@/pages/split/types';
import { buildPreviewViewportSize, getSliceColor } from '@/pages/split/utils';

interface GridSplitPreviewProps {
  title: string;
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  plan: GridSplitPlan;
}

const formatRatio = (width: number, height: number) => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  let a = safeWidth;
  let b = safeHeight;

  while (b !== 0) {
    const temp = a % b;
    a = b;
    b = temp;
  }

  const gcd = Math.max(1, a);
  return `${safeWidth / gcd}:${safeHeight / gcd}`;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const GridSplitPreview = React.memo((props: GridSplitPreviewProps) => {
  const { title, imageUrl, naturalWidth, naturalHeight, plan } = props;
  const previewStageMeasureRef = useRef<HTMLDivElement>(null);
  const [previewStageWidth, setPreviewStageWidth] = useState(0);
  const [hoveredRegionId, setHoveredRegionId] = useState<number | null>(null);
  const availableStageWidth = previewStageWidth > 0 ? Math.max(220, previewStageWidth - 28) : 960;
  const previewViewportSize = React.useMemo(
    () => buildPreviewViewportSize(naturalWidth, naturalHeight, availableStageWidth, 460),
    [naturalWidth, naturalHeight, availableStageWidth]
  );
  const originalViewportSize = React.useMemo(
    () => buildPreviewViewportSize(naturalWidth, naturalHeight, availableStageWidth, 220),
    [naturalWidth, naturalHeight, availableStageWidth]
  );
  const originalPreviewShellHeight = React.useMemo(
    () => Math.max(140, originalViewportSize.height + 16),
    [originalViewportSize.height]
  );
  const widths = React.useMemo(() => plan.regions.map((region) => region.width), [plan.regions]);
  const heights = React.useMemo(() => plan.regions.map((region) => region.height), [plan.regions]);
  const widthMin = widths.length > 0 ? Math.min(...widths) : 0;
  const widthMax = widths.length > 0 ? Math.max(...widths) : 0;
  const heightMin = heights.length > 0 ? Math.min(...heights) : 0;
  const heightMax = heights.length > 0 ? Math.max(...heights) : 0;
  const hoveredRegion = React.useMemo(
    () => plan.regions.find((region) => region.id === hoveredRegionId) ?? null,
    [hoveredRegionId, plan.regions]
  );
  const hasHoveredRegion = hoveredRegion !== null;
  const sourceRatioText = React.useMemo(
    () => formatRatio(naturalWidth, naturalHeight),
    [naturalWidth, naturalHeight]
  );
  const tileRatioText = React.useMemo(
    () => formatRatio(plan.tileWidth, plan.tileHeight),
    [plan.tileHeight, plan.tileWidth]
  );
  const targetTileRatioText =
    plan.ratioW && plan.ratioH ? formatRatio(plan.ratioW, plan.ratioH) : `沿用均分 ${tileRatioText}`;
  const totalCountText = `${plan.cols} x ${plan.rows} = ${plan.regions.length} 张`;

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
            <span>网格 {totalCountText}</span>
            <span>外框 {naturalWidth} x {naturalHeight}</span>
            <span>单张约 {plan.tileWidth} x {plan.tileHeight}</span>
            <span>单张实际比例 {tileRatioText}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-background/75 px-2.5 py-1">
            目标单张比例 {targetTileRatioText}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-background/75 px-2.5 py-1">
            设定重叠 {plan.overlapPercent}%
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-background/75 px-2.5 py-1">
            横向实际重叠 {formatPercent(plan.overlapPercentX)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-background/75 px-2.5 py-1">
            纵向实际重叠 {formatPercent(plan.overlapPercentY)}
          </span>
        </div>
      </div>

      <div className="grid gap-3 xl:min-h-[760px] xl:grid-rows-[auto_minmax(0,1fr)]">
        <div className="rounded-2xl border border-border/70 bg-muted/16 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-foreground">原图外框</div>
              <p className="text-[11px] text-muted-foreground">
                规则网格会始终贴合原图四边，内部通过重叠来满足单张比例与张数。
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] text-muted-foreground">
              <div className="rounded-full bg-background/75 px-2 py-0.5">
                原图 {naturalWidth} x {naturalHeight}
              </div>
              <div className="rounded-full bg-background/75 px-2 py-0.5">
                原图比例 {sourceRatioText}
              </div>
            </div>
          </div>
          <div
            className="flex items-center justify-center overflow-hidden rounded-xl bg-background/72 p-2"
            style={{ height: originalPreviewShellHeight }}
          >
            <div
              className="relative max-w-full overflow-hidden rounded-lg bg-background/65"
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
              <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-primary/90" />
              <div className="pointer-events-none absolute left-2 top-2 rounded-full border border-border/70 bg-background/92 px-2 py-1 text-[10px] font-medium text-foreground shadow-sm backdrop-blur-sm">
                外框固定 {naturalWidth} x {naturalHeight}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/14 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">分块示意图</div>
              <p className="text-[11px] text-muted-foreground">
                每块都贴合原图外框布局；重叠只发生在内部，不再裁掉外圈内容。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <div className="rounded-full bg-background/75 px-2 py-0.5">
                预览 {previewViewportSize.width} x {previewViewportSize.height}
              </div>
              <div className="rounded-full bg-background/75 px-2 py-0.5">
                单块约 {widthMin === widthMax ? widthMin : `${widthMin}-${widthMax}`} x{' '}
                {heightMin === heightMax ? heightMin : `${heightMin}-${heightMax}`}
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-xl border border-border/60 bg-background/55 p-3 text-[11px] text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
            <div>外框尺寸 {naturalWidth} x {naturalHeight}</div>
            <div>目标单张比例 {targetTileRatioText}</div>
            <div>横向重叠 {Math.round(plan.overlapX)}px / {formatPercent(plan.overlapPercentX)}</div>
            <div>纵向重叠 {Math.round(plan.overlapY)}px / {formatPercent(plan.overlapPercentY)}</div>
          </div>

          <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl bg-background/68 p-2 [contain:layout_paint_style] xl:min-h-[440px]">
            <div
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

              <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-primary/95 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75)]" />
              <div className="pointer-events-none absolute left-2 top-2 rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[10px] font-medium text-foreground shadow-sm backdrop-blur-sm">
                原图外框固定，内部可重叠
              </div>

              <div className="absolute inset-0">
                {plan.regions.map((region, index) => (
                  <div
                    key={region.id}
                    className="absolute overflow-hidden transition-[opacity,transform,box-shadow,filter] duration-150"
                    style={{
                      left: `${(region.startX / naturalWidth) * 100}%`,
                      top: `${(region.startY / naturalHeight) * 100}%`,
                      width: `${(region.width / naturalWidth) * 100}%`,
                      height: `${(region.height / naturalHeight) * 100}%`,
                      backgroundColor: getSliceColor(index, 0.1),
                      backgroundImage: `linear-gradient(180deg, ${getSliceColor(index, 0.16)}, transparent 28%), repeating-linear-gradient(${index % 2 === 0 ? '135deg' : '45deg'}, ${getSliceColor(index, 0.12)} 0 10px, transparent 10px 20px)`,
                      border: `2px solid ${getSliceColor(index, 0.95)}`,
                      boxShadow:
                        hoveredRegionId === region.id
                          ? `0 0 0 4px ${getSliceColor(index, 0.22)}, inset 0 0 0 1px rgba(255,255,255,0.9)`
                          : hoveredRegion?.row === region.row || hoveredRegion?.col === region.col
                            ? `0 0 0 2px ${getSliceColor(index, 0.14)}, inset 0 0 0 1px rgba(255,255,255,0.8)`
                            : 'inset 0 0 0 1px rgba(255,255,255,0.72)',
                      opacity: !hasHoveredRegion
                        ? 1
                        : hoveredRegionId === region.id
                          ? 1
                          : hoveredRegion?.row === region.row || hoveredRegion?.col === region.col
                            ? 0.82
                            : 0.28,
                      filter:
                        hasHoveredRegion &&
                        hoveredRegionId !== region.id &&
                        hoveredRegion?.row !== region.row &&
                        hoveredRegion?.col !== region.col
                          ? 'saturate(0.65)'
                          : 'saturate(1)',
                      transform: hoveredRegionId === region.id ? 'scale(1.012)' : undefined,
                      zIndex:
                        hoveredRegionId === region.id
                          ? 6
                          : hoveredRegion?.row === region.row || hoveredRegion?.col === region.col
                            ? 5
                            : 3,
                    }}
                    onPointerEnter={() => setHoveredRegionId(region.id)}
                    onPointerLeave={() => setHoveredRegionId((current) => (current === region.id ? null : current))}
                  >
                    <div className="absolute left-2 top-2 rounded-full border border-background/25 bg-foreground/80 px-2 py-1 text-[10px] font-semibold text-background shadow-sm backdrop-blur-sm">
                      {region.row + 1}-{region.col + 1}
                    </div>
                    <div className="absolute bottom-2 right-2 rounded-full border border-border/70 bg-background/90 px-2 py-1 text-[10px] font-medium text-foreground shadow-sm backdrop-blur-sm">
                      {region.width} x {region.height}
                    </div>
                    {hoveredRegionId === region.id && (
                      <div className="absolute bottom-2 left-2 rounded-full border border-border/70 bg-background/92 px-2 py-1 text-[10px] font-medium text-foreground shadow-sm backdrop-blur-sm">
                        第 {region.row + 1} 行第 {region.col + 1} 列
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {plan.regions.map((region, index) => (
              <div
                key={region.id}
                className="rounded-full border border-border/70 bg-muted/55 px-3 py-1 text-[11px] text-foreground shadow-sm"
                style={{
                  boxShadow: `inset 0 0 0 1px ${getSliceColor(index, 0.22)}`,
                  borderColor: getSliceColor(index, 0.45),
                  backgroundColor: getSliceColor(index, 0.08),
                  opacity: !hasHoveredRegion
                    ? 1
                    : hoveredRegionId === region.id
                      ? 1
                      : hoveredRegion?.row === region.row || hoveredRegion?.col === region.col
                        ? 0.84
                        : 0.42,
                  transform: hoveredRegionId === region.id ? 'translateY(-1px)' : undefined,
                  transition: 'opacity 150ms ease, transform 150ms ease, box-shadow 150ms ease',
                }}
                onPointerEnter={() => setHoveredRegionId(region.id)}
                onPointerLeave={() => setHoveredRegionId((current) => (current === region.id ? null : current))}
              >
                第 {region.row + 1} 行第 {region.col + 1} 列: {region.width} x {region.height}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

GridSplitPreview.displayName = 'GridSplitPreview';
