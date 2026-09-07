export interface SplitImage {
  id: number;
  url: string;
  blob: Blob;
  fileName: string;
}

export interface SliceRegion {
  id: number;
  start: number;
  end: number;
  size: number;
  fileName: string;
}

export interface OverlapRegion {
  id: number;
  start: number;
  end: number;
  size: number;
  fromSlice: number;
  toSlice: number;
}

export interface SlicePlan {
  orientation: 'vertical' | 'horizontal';
  numSlices: number;
  tileSize: number;
  step: number;
  axisSize: number;
  fixedOtherSize: number;
  regions: SliceRegion[];
  overlaps: OverlapRegion[];
}

export type Orientation = 'vertical' | 'horizontal';

export interface GridCropRegion {
  startX: number;
  startY: number;
  width: number;
  height: number;
}

export interface GridCellRegion {
  id: number;
  row: number;
  col: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
  fileName: string;
}

export interface GridSplitPlan {
  cols: number;
  rows: number;
  ratioW: number | null;
  ratioH: number | null;
  overlapPercent: number;
  isRatioApplied: boolean;
  cropRegion: GridCropRegion;
  tileWidth: number;
  tileHeight: number;
  stepX: number;
  stepY: number;
  overlapX: number;
  overlapY: number;
  overlapPercentX: number;
  overlapPercentY: number;
  regions: GridCellRegion[];
}

export interface ManualSliceStarts {
  vertical: number[] | null;
  horizontal: number[] | null;
}

export interface PreviewViewportSize {
  width: number;
  height: number;
}

export type GeneratedResultMode = Orientation | 'grid' | null;
