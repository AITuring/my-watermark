export type CoverLayout = {
  readonly left: number
  readonly top: number
  readonly height: number
  readonly rotate: number
  readonly layer: number
}

const COLLAGE_LAYOUTS: readonly CoverLayout[] = [
  { left: 8, top: 18, height: 20, rotate: -8, layer: 1 },
  { left: 23, top: 16, height: 28, rotate: 6, layer: 2 },
  { left: 37, top: 18, height: 22, rotate: -4, layer: 1 },
  { left: 53, top: 15, height: 31, rotate: 8, layer: 3 },
  { left: 67, top: 18, height: 21, rotate: -9, layer: 1 },
  { left: 82, top: 17, height: 27, rotate: 4, layer: 2 },
  { left: 12, top: 46, height: 24, rotate: -6, layer: 2 },
  { left: 28, top: 49, height: 30, rotate: 7, layer: 3 },
  { left: 44, top: 47, height: 22, rotate: -5, layer: 2 },
  { left: 58, top: 50, height: 28, rotate: 3, layer: 3 },
  { left: 74, top: 48, height: 23, rotate: -7, layer: 2 },
  { left: 89, top: 47, height: 30, rotate: 5, layer: 1 },
  { left: 10, top: 78, height: 21, rotate: -5, layer: 1 },
  { left: 24, top: 81, height: 29, rotate: 4, layer: 2 },
  { left: 40, top: 79, height: 24, rotate: -3, layer: 1 },
  { left: 56, top: 82, height: 31, rotate: 6, layer: 3 },
  { left: 72, top: 80, height: 22, rotate: -8, layer: 2 },
  { left: 86, top: 82, height: 29, rotate: 5, layer: 1 },
] as const

export const COVER_COLLAGE_LIMIT = COLLAGE_LAYOUTS.length

export function getCoverCollageLayout(count: number) {
  return COLLAGE_LAYOUTS.slice(0, Math.min(count, COLLAGE_LAYOUTS.length))
}
