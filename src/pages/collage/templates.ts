import { getReferenceSlots, MOTIF_COUNTS } from './motifs'
import { getGrowingSlots, type GrowingTemplateId } from './growth'
import { getCoverWallSlots, COVER_COLLAGE_LIMIT } from './cover-wall'
export { MOTIF_COUNTS } from './motifs'
export { COVER_COLLAGE_LIMIT } from './cover-wall'

export type TemplateId = GrowingTemplateId | 'diamond' | 'fan' | 'petal' | 'mosaic' | 'grid' | 'wall'
export type Contour = { path: string; clips: readonly string[]; exclude: readonly string[]; depth: number }
export type Slot = { path: string; box: [number, number, number, number]; rotation?: number; clips?: readonly string[]; exclude?: readonly string[]; borders?: readonly Contour[]; depth?: number; area?: number; rootId?: string; imageIndex?: number; shadow?: boolean }
export type Crop = { x: number; y: number; zoom: number }
export type Template = { id: TemplateId; name: string; caption: string; group: 'growing' | 'reference' | 'basic' }

export const TEMPLATE_GROUPS = [
  { id: 'growing', name: '自适应构图' },
  { id: 'reference', name: '原图构图' },
  { id: 'basic', name: '基础排版' },
] as const
export const isGrowingTemplate = (id: TemplateId): id is GrowingTemplateId => ['triangle', 'honeycomb', 'orbit'].includes(id)

export const TEMPLATES: Template[] = [
  { id: 'triangle', name: '三角分形', caption: '相似三角递归分割 · 满版构图', group: 'growing' },
  { id: 'honeycomb', name: '六边花窗', caption: '六边形延展 · 满版交织', group: 'growing' },
  { id: 'orbit', name: '圆形星簇', caption: '圆形相叠 · 铺满画幅', group: 'growing' },
  { id: 'diamond', name: '菱形斜拼', caption: '大菱格交叠 · 7 个固定区域', group: 'reference' },
  { id: 'fan', name: '叠扇成景', caption: '大扇交叠 · 原图满版构图', group: 'reference' },
  { id: 'petal', name: '花叶相叠', caption: '花叶交错 · 7 个固定区域', group: 'reference' },
  { id: 'mosaic', name: '错落长格', caption: '长短相间的画卷', group: 'basic' },
  { id: 'grid', name: '规则网格', caption: '整齐排列，自由分格', group: 'basic' },
  { id: 'wall', name: '封面墙', caption: '经典错落封面 · 18 位疏朗展陈', group: 'basic' },
]

export const RATIOS = [
  { id: '3:5', label: '展览长幅', w: 3, h: 5 },
  { id: '1:1', label: '方形', w: 1, h: 1 },
  { id: '4:3', label: '横版照片', w: 4, h: 3 },
  { id: '3:4', label: '竖版照片', w: 3, h: 4 },
  { id: '16:9', label: '横版封面', w: 16, h: 9 },
  { id: '9:16', label: '竖屏', w: 9, h: 16 },
  { id: '3:2', label: '经典横幅', w: 3, h: 2 },
  { id: '2:3', label: '经典竖幅', w: 2, h: 3 },
  { id: '21:9', label: '超宽屏', w: 21, h: 9 },
  { id: '5:4', label: '横版中画幅', w: 5, h: 4 },
  { id: '4:5', label: '竖版中画幅', w: 4, h: 5 },
]

const rect = (x: number, y: number, w: number, h: number): Slot => ({
  path: `M${x} ${y}h${w}v${h}h${-w}Z`, box: [x, y, w, h],
})

// All paths use a 600 × 1000 artboard. Preview, hit testing and export share them.
export function getSlots(template: TemplateId, columns = 3, rows = 3, aspect = .6): Slot[] {
  if (isGrowingTemplate(template)) return getGrowingSlots(template, 12, aspect)
  if (template in MOTIF_COUNTS) return getReferenceSlots(template)
  if (template === 'mosaic') return [
    rect(0, 0, 205, 580), rect(205, 0, 190, 230), rect(395, 0, 205, 580),
    rect(0, 580, 205, 420), rect(205, 230, 190, 530), rect(395, 580, 205, 420),
    rect(205, 760, 190, 240),
  ]
  if (template === 'wall') return getCoverWallSlots(COVER_COLLAGE_LIMIT, aspect)
  return Array.from({ length: columns * rows }, (_, i) =>
    rect((i % columns) * 600 / columns, Math.floor(i / columns) * 1000 / rows, 600 / columns, 1000 / rows))
}

// Distribute items evenly so a final row/column never contains a lone tiny cell.
function distribute(count: number, groups: number): number[] {
  return Array.from({ length: groups }, (_, i) => Math.floor(count / groups) + (i < count % groups ? 1 : 0))
}

function chooseGroups(count: number, aspect: number, target: number, byColumn = false): number[] {
  let best = [count]
  let bestScore = Infinity
  for (let groups = 1; groups <= count; groups++) {
    const small = Math.floor(count / groups)
    const larger = count % groups
    const scoreFor = (items: number) => {
      const cellAspect = byColumn ? aspect * items / groups : aspect * groups / items
      return Math.log(cellAspect / target) ** 2
    }
    const score = ((groups - larger) * small * scoreFor(small) + larger * (small + 1) * scoreFor(small + 1)) / count
    if (score < bestScore) { bestScore = score; best = distribute(count, groups) }
  }
  return best
}

/** The same motif geometry drives examples, preview, hit testing and full-resolution export. */
export function getAdaptiveSlots(template: TemplateId, count: number, aspect = .6, columns = 0, rows = 0, imageAspects: readonly number[] = []): Slot[] {
  count = Math.max(0, Math.floor(count))
  if (!count) return []
  if (isGrowingTemplate(template)) return getGrowingSlots(template, count, aspect)
  if (template in MOTIF_COUNTS) return getReferenceSlots(template, count)
  if (template === 'wall') return getCoverWallSlots(count, aspect)
  if (count === 1) return [rect(0, 0, 600, 1000)]
  if (template === 'mosaic') {
    const groups = chooseGroups(count, aspect, .6, true)
    const width = 600 / groups.length
    let index = 0
    return groups.flatMap((amount, column) => {
      const weights = Array.from({ length: amount }, (_, i) => Math.max(.55, Math.min(1.8, 1 / (imageAspects[index + i] || .8))))
      const total = weights.reduce((sum, value) => sum + value, 0)
      let y = 0
      return weights.map(weight => {
        const height = weight / total * 1000
        const slot = rect(column * width, y, width, height)
        y += height; index++
        return slot
      })
    })
  }
  const medianAspect = [...imageAspects].sort((a, b) => a - b)[Math.floor(imageAspects.length / 2)] || 1
  const target = Math.max(.65, Math.min(1.5, medianAspect))
  const rowCounts = template === 'grid' && (columns > 0 || rows > 0)
    ? distribute(count, Math.min(count, columns > 0 ? Math.ceil(count / columns) : rows))
    : chooseGroups(count, aspect, target)
  const rowHeight = 1000 / rowCounts.length
  return rowCounts.flatMap((amount, row) => Array.from({ length: amount }, (_, column) => {
    const cellWidth = 600 / amount
    return rect(column * cellWidth, row * rowHeight, cellWidth, rowHeight)
  }))
}

export function getArtworkFraction(aspect: number, hasText: boolean, template?: TemplateId): number {
  if (template === 'wall') return 1
  return hasText ? 1 - Math.min(.16, aspect * .22) : 1
}
