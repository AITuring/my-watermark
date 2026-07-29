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

export interface ManualSliceStarts {
  vertical: number[] | null;
  horizontal: number[] | null;
}

export interface PreviewViewportSize {
  width: number;
  height: number;
}

export type GeneratedResultMode = Orientation | 'grid' | null;
