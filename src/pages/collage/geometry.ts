export type Point = [number, number]
const EPS = 1e-7

export function area(points: Point[]): number {
  return Math.abs(points.reduce((sum, [x, y], i) => {
    const next = points[(i + 1) % points.length]
    return sum + x * next[1] - next[0] * y
  }, 0)) / 2
}
export const totalArea = (polygons: Point[][]) => polygons.reduce((sum, polygon) => sum + area(polygon), 0)
export function bounds(polygons: Point[][]): [number, number, number, number] {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const polygon of polygons) for (const [x, y] of polygon) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y)
  }
  return [left, top, right - left, bottom - top]
}
export function clipLine(points: Point[], nx: number, ny: number, offset: number, lower: boolean): Point[] {
  const result: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    const da = nx * a[0] + ny * a[1] - offset, db = nx * b[0] + ny * b[1] - offset
    const insideA = lower ? da <= 0 : da >= 0, insideB = lower ? db <= 0 : db >= 0
    if (insideA) result.push(a)
    if (insideA !== insideB) {
      const t = da / (da - db)
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return result
}
function clipEdges(clip: Point[]) {
  let signed = 0
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length]
    signed += a[0] * b[1] - b[0] * a[1]
  }
  return clip.map((a, i) => {
    const b = clip[(i + 1) % clip.length]
    const nx = b[1] - a[1], ny = a[0] - b[0]
    return { nx, ny, offset: nx * a[0] + ny * a[1], lower: signed > 0 }
  })
}
export function intersection(subject: Point[], clip: Point[]): Point[] {
  let remaining = subject
  for (const edge of clipEdges(clip)) {
    remaining = clipLine(remaining, edge.nx, edge.ny, edge.offset, edge.lower)
    if (remaining.length < 3) return []
  }
  return remaining
}
export function difference(subject: Point[], clip: Point[]): Point[][] {
  let remaining = subject
  const pieces: Point[][] = []
  for (const edge of clipEdges(clip)) {
    const outside = clipLine(remaining, edge.nx, edge.ny, edge.offset, !edge.lower)
    if (outside.length > 2 && area(outside) > EPS) pieces.push(outside)
    remaining = clipLine(remaining, edge.nx, edge.ny, edge.offset, edge.lower)
    if (remaining.length < 3) break
  }
  return pieces
}
