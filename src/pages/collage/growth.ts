import type { Slot } from './templates'
import { clipLine, type Point } from './geometry'

export type GrowingTemplateId = 'triangle' | 'honeycomb' | 'orbit'
const polygon = (points: Point[]) => `M${points.map(p => p.map(v => Number(v.toFixed(4))).join(' ')).join('L')}Z`
const area = (points: Point[]) => Math.abs(points.reduce((sum, p, i) => {
  const q = points[(i + 1) % points.length]
  return sum + p[0] * q[1] - q[0] * p[1]
}, 0)) / 2

function toSlot(points: Point[], physicalHeight: number, index: number): Slot {
  const logical = points.map(([x, y]): Point => [x, y / physicalHeight * 1000])
  const xs = logical.map(p => p[0]), ys = logical.map(p => p[1])
  const left = Math.max(0, Math.min(...xs)), top = Math.max(0, Math.min(...ys))
  const right = Math.min(600, Math.max(...xs)), bottom = Math.min(1000, Math.max(...ys))
  const visible = clipToBoard(logical, 1000)
  return { path: polygon(logical), box: [left, top, right - left, bottom - top], area: area(visible), rootId: `photo-${index}` }
}

// The altitude of any right triangle produces two triangles similar to the parent.
// Each split adds exactly one photo; the silhouette never changes as n changes.
function triangles(count: number, aspect: number): Slot[] {
  const height = 600 / aspect
  if (count === 1) return [toSlot([[0, 0], [1230, 0], [0, height * 2.05]], height, 0)]
  const pieces: Point[][] = [[[0, 0], [600, 0], [0, height]], [[600, height], [0, height], [600, 0]]]
  while (pieces.length < count) {
    let index = 0
    for (let i = 1; i < pieces.length; i++) if (area(pieces[i]) > area(pieces[index]) + 1e-6) index = i
    const [a, b, c] = pieces[index]
    const dx = c[0] - b[0], dy = c[1] - b[1]
    const t = ((a[0] - b[0]) * dx + (a[1] - b[1]) * dy) / (dx * dx + dy * dy)
    const foot: Point = [b[0] + t * dx, b[1] + t * dy]
    pieces.splice(index, 1, [foot, a, b], [foot, c, a])
  }
  return pieces.sort((a, b) => area(b) - area(a)).map((points, i) => toSlot(points, height, i))
}

function clipToBoard(points: Point[], height: number): Point[] {
  let result = points
  for (const [nx, ny, edge] of [[-1, 0, 0], [1, 0, 600], [0, -1, 0], [0, 1, height]]) {
    result = clipLine(result, nx, ny, edge, true)
  }
  return result
}

type Cell = { center: Point; polygon: Point[] }
const cellCache = new Map<string, Cell[]>()
function centroid(points: Point[]): Point {
  let sum = 0, x = 0, y = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    const cross = a[0] * b[1] - b[0] * a[1]
    sum += cross; x += (a[0] + b[0]) * cross; y += (a[1] + b[1]) * cross
  }
  return [x / (3 * sum), y / (3 * sum)]
}

// The cells partition the whole poster. Circumscribing each cell guarantees full
// coverage, including its four corners; no fixed-radius packing can guarantee this.
function coveringCells(count: number, aspect: number): Cell[] {
  const key = `${count}:${aspect}`
  const cached = cellCache.get(key)
  if (cached) return cached
  const height = 600 / aspect
  const board: Point[] = [[0, 0], [600, 0], [600, height], [0, height]]
  const rows = Math.max(1, Math.min(count, Math.round(Math.sqrt(count * Math.sqrt(3) / (1.5 * aspect)))))
  let seeds: Point[] = []
  for (let row = 0; row < rows; row++) {
    const amount = Math.floor((row + 1) * count / rows) - Math.floor(row * count / rows)
    const shift = amount > 1 ? (row % 2 ? -.22 : .22) : 0
    for (let col = 0; col < amount; col++) seeds.push([(col + .5 + shift) * 600 / amount, (row + .5) * height / rows])
  }
  const partition = () => seeds.map((center, i) => {
    let points = board
    for (let j = 0; j < seeds.length; j++) {
      if (i === j) continue
      const other = seeds[j]
      points = clipLine(points, other[0] - center[0], other[1] - center[1],
        (other[0] ** 2 + other[1] ** 2 - center[0] ** 2 - center[1] ** 2) / 2, true)
    }
    return { center, polygon: points }
  })
  // Relax a staggered lattice to keep regions compact and their sizes gradual.
  for (let i = 0; i < 32; i++) seeds = partition().map(cell => centroid(cell.polygon))
  const cells = partition()
  if (cellCache.size >= 48) cellCache.delete(cellCache.keys().next().value)
  cellCache.set(key, cells)
  return cells
}

// Keep every source readable after the small overlaps needed for full-bleed coverage.
// Work on a coarse ownership map; the actual masks remain exact circles/hexagons.
function paintOrder(shapes: Point[][], height: number): number[] {
  const count = shapes.length, order = shapes.map((_, i) => i)
  if (count < 3) return order
  const width = Math.round(160 * Math.min(1, 600 / height)), rows = Math.round(160 * Math.min(1, height / 600))
  const members = new Uint32Array(width * rows)
  shapes.forEach((points, index) => {
    const top = Math.max(0, Math.floor(Math.min(...points.map(p => p[1])) / height * rows))
    const bottom = Math.min(rows, Math.ceil(Math.max(...points.map(p => p[1])) / height * rows))
    for (let row = top; row < bottom; row++) {
      const y = (row + .5) / rows * height, crossings: number[] = []
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length]
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) crossings.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]))
      }
      if (crossings.length < 2) continue
      const left = Math.max(0, Math.ceil(Math.min(...crossings) / 600 * width - .5))
      const right = Math.min(width, Math.floor(Math.max(...crossings) / 600 * width - .5) + 1)
      for (let col = left; col < right; col++) members[row * width + col] |= 1 << index
    }
  })
  const average = members.length / count
  const evaluate = (candidate: number[]) => {
    const ranks = new Uint8Array(count), visible = new Uint32Array(count)
    candidate.forEach((shape, rank) => { ranks[shape] = rank })
    for (let mask of members) {
      let owner = -1, rank = -1
      while (mask) {
        const i = 31 - Math.clz32(mask & -mask)
        if (ranks[i] > rank) { owner = i; rank = ranks[i] }
        mask &= mask - 1
      }
      if (owner >= 0) visible[owner]++
    }
    const cost = visible.reduce((sum, value) => sum + Math.max(0, .42 - value / average) ** 2, 0)
    return { visible, cost }
  }
  let current = order, score = evaluate(order)
  for (let pass = 0; pass < 10 && score.cost > 1e-6; pass++) {
    const priorities = current.filter(i => score.visible[i] < average * .42).sort((a, b) => score.visible[a] - score.visible[b]).slice(0, 4)
    let next = current, best = score
    for (const shape of priorities) {
      const from = current.indexOf(shape)
      for (let to = from + 1; to < count; to++) {
        const candidate = [...current]
        candidate.splice(from, 1); candidate.splice(to, 0, shape)
        const result = evaluate(candidate)
        if (result.cost < best.cost - 1e-6) { next = candidate; best = result }
      }
    }
    if (next === current) break
    current = next; score = best
  }
  return current
}

function hexagons(count: number, aspect: number): Slot[] {
  const height = 600 / aspect, bleed = Math.min(600, height) * .004
  const normals: Point[] = Array.from({ length: 6 }, (_, i) => [Math.cos(i * Math.PI / 3), Math.sin(i * Math.PI / 3)])
  const shapes = coveringCells(count, aspect).map(cell => {
    const [x, y] = cell.center
    const apothem = Math.max(...cell.polygon.flatMap(p => normals.map(([nx, ny]) => (p[0] - x) * nx + (p[1] - y) * ny))) + bleed
    const radius = apothem / Math.cos(Math.PI / 6)
    const points: Point[] = Array.from({ length: 6 }, (_, i) => {
      const angle = Math.PI / 6 + i * Math.PI / 3
      return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]
    })
    return { points, radius }
  })
  shapes.sort((a, b) => b.radius - a.radius)
  return paintOrder(shapes.map(shape => shape.points), height).map((index, i) => toSlot(shapes[index].points, height, i))
}

function orbits(count: number, aspect: number): Slot[] {
  const height = 600 / aspect, bleed = Math.min(600, height) * .004
  const circles = coveringCells(count, aspect).map(cell => ({
    x: cell.center[0], y: cell.center[1],
    r: Math.max(...cell.polygon.map(p => Math.hypot(p[0] - cell.center[0], p[1] - cell.center[1]))) + bleed,
  })).sort((a, b) => b.r - a.r)
  const outlines = circles.map(({ x, y, r }) => Array.from({ length: 96 }, (_, j): Point => [x + Math.cos(j * Math.PI / 48) * r, y + Math.sin(j * Math.PI / 48) * r]))
  return paintOrder(outlines, height).map((index, i) => {
    const { x, y, r } = circles[index]
    const cy = y / height * 1000, ry = r / height * 1000
    const left = Math.max(0, x - r), top = Math.max(0, cy - ry)
    const right = Math.min(600, x + r), bottom = Math.min(1000, cy + ry)
    const outline: Point[] = Array.from({ length: 96 }, (_, j) => [x + Math.cos(j * Math.PI / 48) * r, cy + Math.sin(j * Math.PI / 48) * ry])
    return {
      path: `M${x - r} ${cy}A${r} ${ry} 0 1 0 ${x + r} ${cy}A${r} ${ry} 0 1 0 ${x - r} ${cy}Z`,
      box: [left, top, right - left, bottom - top], area: area(clipToBoard(outline, 1000)), rootId: `photo-${i}`,
    }
  })
}

const cache = new Map<string, Slot[]>()
export function getGrowingSlots(template: GrowingTemplateId, count: number, aspect: number): Slot[] {
  if (!count) return []
  const key = `${template}:${count}:${aspect}`
  const cached = cache.get(key)
  if (cached) return cached
  const result = template === 'triangle' ? triangles(count, aspect) : template === 'honeycomb' ? hexagons(count, aspect) : orbits(count, aspect)
  if (cache.size >= 48) cache.delete(cache.keys().next().value)
  cache.set(key, result)
  return result
}
