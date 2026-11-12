import type { Contour, Slot, TemplateId } from './templates'
import { area, bounds, difference, intersection, totalArea, type Point } from './geometry'

type Shape = { path: string; polygon: Point[] }
type Region = Shape & { polygons: Point[][]; clips: string[]; exclude: string[]; borders: Contour[]; depth: number; rootId: string; area: number }
const BOARD: Point[] = [[0, 0], [600, 0], [600, 1000], [0, 1000]]
const EPS = 1e-7
export const MOTIF_COUNTS = { diamond: 7, fan: 10, petal: 7 } as const

function polygon(points: Point[]): Shape {
  return { path: `M${points.map(point => point.join(' ')).join('L')}Z`, polygon: points }
}
// Most of each sector extends beyond the poster or sits underneath the next fan.
// The visible outer arcs follow the reference; the radial edges stay concealed.
function fan(cx: number, cy: number, radius: number): Shape {
  const startAngle = -175 * Math.PI / 180
  const sweep = 170 * Math.PI / 180
  const point = (theta: number): Point => [cx + Math.cos(theta) * radius, cy + Math.sin(theta) * radius]
  const arc = Array.from({ length: 129 }, (_, i) => point(startAngle + sweep * i / 128))
  return {
    path: `M${cx} ${cy}L${arc[0].join(' ')}A${radius} ${radius} 0 0 1 ${arc[128].join(' ')}Z`,
    polygon: [[cx, cy], ...arc],
  }
}
function leaf(x: number, y: number, w: number, h: number): Shape {
  const point = (t: number, side: number): Point => {
    const u = 1 - t
    return [x + w * (.5 * (u ** 3 + t ** 3) + 3 * (side > 0 ? 1.16 : -.16) * (u * u * t + u * t * t)), y + h * (3 * .34 * u * u * t + 3 * .67 * u * t * t + t ** 3)]
  }
  return {
    path: `M${x + w / 2} ${y}C${x + w * 1.16} ${y + h * .34} ${x + w * 1.16} ${y + h * .67} ${x + w / 2} ${y + h}C${x - w * .16} ${y + h * .67} ${x - w * .16} ${y + h * .34} ${x + w / 2} ${y}Z`,
    polygon: [...Array.from({ length: 25 }, (_, i) => point(i / 24, 1)), ...Array.from({ length: 23 }, (_, i) => point((23 - i) / 24, -1))],
  }
}
function diamond(cx: number, cy: number, rx: number, ry: number): Shape {
  return polygon([[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]])
}

// Small sets follow the overlapping silhouettes in the supplied exhibition posters.
function composition(template: TemplateId): { shapes: Shape[]; order: number[] } {
  if (template === 'diamond') return {
    shapes: [polygon(BOARD), polygon([[0, 0], [165, 0], [370, 205], [0, 575]]),
      polygon([[0, 535], [305, 840], [145, 1000], [0, 1000]]),
      polygon([[600, 510], [600, 1000], [110, 1000]]),
      diamond(420, 465, 335, 335), diamond(275, 1010, 300, 300), diamond(105, 425, 205, 205)],
    order: [4, 0, 6, 5, 1, 2, 3],
  }
  if (template === 'fan') return {
    shapes: [polygon(BOARD),
      fan(438.544, 468.734, 444.122), // Upper right: roof.
      fan(-19.923, 491.007, 403.499), // Upper left: figure.
      fan(-78.289, 554.079, 280.237), // Smaller floral fan entering from the left.
      fan(553.036, 601.25, 423.86),   // Large floral fan entering from the right.
      fan(401.214, 808.929, 454.685), // Broad central scene.
      fan(531.667, 965, 400.867),
      fan(-37.73, 1137.237, 543.548),
      fan(-222.81, 1253.164, 527.527),
      fan(576.662, 1181.522, 407.192)],
    // Establish the background and central scene first when fewer images are supplied.
    order: [0, 5, 1, 2, 4, 3, 6, 7, 8, 9],
  }
  return {
    shapes: [polygon(BOARD), leaf(150, -175, 355, 555), leaf(390, -65, 365, 575),
      leaf(-95, 365, 340, 705), leaf(140, 285, 390, 610), leaf(365, 385, 430, 770), leaf(10, 635, 435, 610)],
    order: [4, 0, 5, 6, 1, 2, 3],
  }
}

function intersectAll(polygons: Point[][], shape: Shape): Point[][] {
  return polygons.map(points => intersection(points, shape.polygon)).filter(points => points.length > 2 && area(points) > EPS)
}
function subtractAll(polygons: Point[][], shape: Shape): Point[][] {
  return polygons.flatMap(points => difference(points, shape.polygon))
}

const layoutCache = new Map<string, Slot[]>()
export function getReferenceSlots(template: TemplateId, imageCount?: number): Slot[] {
  const capacity = MOTIF_COUNTS[template as keyof typeof MOTIF_COUNTS]
  const count = template === 'fan' && imageCount !== undefined ? Math.max(0, Math.min(capacity, imageCount)) : capacity
  const cacheKey = `${template}:${count}`
  const cached = layoutCache.get(cacheKey)
  if (cached) return cached
  const { shapes, order } = composition(template)
  const selected = order.slice(0, Math.min(count, shapes.length))
  const regions = selected.map(index => {
    const shape = shapes[index]
    let polygons = intersectAll([BOARD], shape)
    const higher = selected.filter(other => other > index)
    for (const other of higher) polygons = subtractAll(polygons, shapes[other])
    const exclude = higher.map(other => shapes[other].path)
    const border: Contour = { path: shape.path, clips: [], exclude, depth: 0 }
    return { ...shape, polygons, clips: [], exclude, borders: [border], depth: 0, rootId: `${template}-${index}`, area: totalArea(polygons) } satisfies Region
  }).filter(region => region.area > EPS)
  const result = regions.map(region => ({
    path: region.path, box: bounds(region.polygons), clips: region.clips, exclude: region.exclude,
    borders: region.borders, depth: 0, area: region.area, rootId: region.rootId,
  }))
  layoutCache.set(cacheKey, result)
  return result
}
