import { getAdaptiveSlots, getArtworkFraction, getSlots, type Crop, type Slot, type TemplateId } from './templates'

export type RenderOptions = {
  template: TemplateId
  columns: number
  rows: number
  gap: number
  background: string
  title: string
  subtitle: string
  crops: Record<number, Crop>
  aspect?: number
  imageAspects?: readonly number[]
  referenceLayout?: boolean
  slots?: readonly Slot[]
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片读取失败，请换用 JPG、PNG 或 WEBP 图片'))
    image.src = src
  })
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, box: number[], crop: Crop, sx: number, sy: number) {
  const [x, y, w, h] = box
  const scale = Math.max(w * sx / image.naturalWidth, h * sy / image.naturalHeight) * crop.zoom
  const sw = w * sx / scale
  const sh = h * sy / scale
  ctx.drawImage(image, (image.naturalWidth - sw) * crop.x / 100, (image.naturalHeight - sh) * crop.y / 100, sw, sh, x, y, w, h)
}

function fitText(ctx: CanvasRenderingContext2D, text: string, width: number, maxSize: number) {
  let size = maxSize
  const family = '"Noto Serif SC", "Songti SC", SimSun, serif'
  ctx.font = `500 ${size}px ${family}`
  while (ctx.measureText(text).width > width && size > 1) ctx.font = `500 ${--size}px ${family}`
}

function beginFrame(canvas: HTMLCanvasElement, count: number, options: RenderOptions, imageAspects: readonly number[]) {
  const mainCtx = canvas.getContext('2d')
  if (!mainCtx) throw new Error('浏览器不支持画布')
  const { width, height } = canvas
  const aspect = options.aspect ?? width / height
  const artworkHeight = height * getArtworkFraction(aspect, Boolean(options.title || options.subtitle), options.template)
  const sx = width / 600, sy = artworkHeight / 1000
  const slots = options.slots ?? (options.referenceLayout
    ? getSlots(options.template, options.columns, options.rows, aspect)
    : getAdaptiveSlots(options.template, count, aspect / (artworkHeight / height), options.columns, options.rows, imageAspects))
  mainCtx.clearRect(0, 0, width, height)
  mainCtx.fillStyle = options.background
  mainCtx.fillRect(0, 0, width, height)
  // The old cover applied opacity to the entire collage, so overlapping covers never accumulate opacity.
  const layer = options.template === 'wall' ? canvas.ownerDocument.createElement('canvas') : undefined
  if (layer) { layer.width = width; layer.height = height }
  const ctx = layer?.getContext('2d') ?? mainCtx
  ctx.save()
  ctx.scale(sx, sy)
  ctx.clip(new Path2D('M0 0H600V1000H0Z'))
  const contours = [...new Set(slots.flatMap(slot => slot.borders ?? []))].sort((a, b) => b.depth - a.depth)
  return { ctx, mainCtx, layer, slots, contours, pathCache: new Map<string, Path2D>(), sx, sy, width, height, artworkHeight, density: Math.min(1, Math.sqrt(8 / Math.max(1, slots.length))) }
}
type Frame = ReturnType<typeof beginFrame>

function cachedPath(frame: Frame, path: string): Path2D {
  let result = frame.pathCache.get(path)
  if (!result) { result = new Path2D(path); frame.pathCache.set(path, result) }
  return result
}
function applyMasks(frame: Frame, region: { clips?: readonly string[]; exclude?: readonly string[] }) {
  for (const path of region.clips ?? []) frame.ctx.clip(cachedPath(frame, path))
  for (const path of region.exclude ?? []) frame.ctx.clip(cachedPath(frame, `M0 0H600V1000H0Z${path}`), 'evenodd')
}

function paintContours(frame: Frame, options: RenderOptions) {
  if (!options.gap) return
  const { ctx } = frame
  for (const contour of frame.contours) {
    ctx.save()
    applyMasks(frame, contour)
    ctx.strokeStyle = options.background
    ctx.lineWidth = options.gap * (contour.depth === 0 ? 1.3 : Math.max(.13, .72 ** contour.depth))
    ctx.stroke(cachedPath(frame, contour.path))
    ctx.restore()
  }
}

function paintSlot(frame: Frame, slot: Slot, index: number, image: HTMLImageElement | undefined, options: RenderOptions, selected = false) {
  const { ctx, sx, sy, density } = frame
  const { box, rotation = 0 } = slot
  const [x, y, w, h] = box
  const path = cachedPath(frame, slot.path)
  ctx.save()
  if (rotation) {
    ctx.translate(x + w / 2, y + h / 2)
    ctx.scale(1 / sx, 1 / sy)
    ctx.rotate(rotation * Math.PI / 180)
    ctx.scale(sx, sy)
    ctx.translate(-x - w / 2, -y - h / 2)
  }
  applyMasks(frame, slot)
  if (selected) {
    ctx.strokeStyle = '#bb4c32'
    ctx.lineWidth = Math.max(.6, 5 * density)
    ctx.stroke(path)
  } else {
    if (slot.shadow && image) {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,.45)'
      ctx.shadowBlur = frame.height * .035
      ctx.shadowOffsetY = frame.height * .014
      ctx.fillStyle = options.background
      ctx.fill(path)
      ctx.restore()
    }
    ctx.save()
    ctx.clip(path)
    if (image) drawCover(ctx, image, box, options.crops[index] ?? { x: 50, y: 50, zoom: 1 }, sx, sy)
    ctx.restore()
    if (options.gap > 0) {
      ctx.strokeStyle = options.template === 'wall' ? 'rgba(255,255,255,.08)' : options.background
      ctx.lineWidth = options.template === 'wall' ? options.gap * .45 : options.gap * (slot.depth === undefined ? density : Math.max(.13, .72 ** slot.depth))
      ctx.stroke(path)
    }
  }
  ctx.restore()
}

function finishFrame(frame: Frame, options: RenderOptions) {
  const { mainCtx: ctx, width, height, artworkHeight } = frame
  frame.ctx.restore()
  if (options.template === 'wall') {
    const glow = ctx.createRadialGradient(width * .5, height * .34, 0, width * .5, height * .34, Math.max(width, height) * .65)
    glow.addColorStop(0, 'rgba(139,94,60,.22)')
    glow.addColorStop(1, 'rgba(139,94,60,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, width, height)
    ctx.save()
    ctx.globalAlpha = .28
    ctx.drawImage(frame.layer!, 0, 0)
    ctx.restore()
    frame.layer!.width = frame.layer!.height = 0
    const veil = ctx.createLinearGradient(0, 0, 0, height)
    veil.addColorStop(0, 'rgba(15,13,11,.12)')
    veil.addColorStop(1, 'rgba(15,13,11,.6)')
    ctx.fillStyle = veil
    ctx.fillRect(0, 0, width, artworkHeight)
    if (options.title || options.subtitle) {
      const padding = width * .05
      ctx.save()
      ctx.fillStyle = '#f8f1e7'
      ctx.textBaseline = 'alphabetic'
      if (options.title) {
        fitText(ctx, options.title, width * .78, Math.min(width * .065, height * .14))
        ctx.fillText(options.title, padding, height * (options.subtitle ? .78 : .87))
      }
      if (options.subtitle) {
        ctx.fillStyle = 'rgba(248,241,231,.66)'
        fitText(ctx, options.subtitle, width * .76, Math.min(width * .022, height * .045))
        ctx.fillText(options.subtitle, padding, height * .88)
      }
      ctx.restore()
    }
    return
  }
  if (options.title || options.subtitle) {
    const panelHeight = height - artworkHeight
    const padding = width * .04
    ctx.save()
    ctx.fillStyle = options.background
    ctx.fillRect(0, artworkHeight, width, panelHeight)
    ctx.fillStyle = '#34382e'
    ctx.textBaseline = 'middle'
    if (options.title) {
      fitText(ctx, options.title, width - padding * 2, Math.min(width * .06, panelHeight * .36))
      ctx.fillText(options.title, padding, artworkHeight + panelHeight * (options.subtitle ? .38 : .5))
    }
    if (options.subtitle) {
      fitText(ctx, options.subtitle, width - padding * 2, Math.min(width * .022, panelHeight * .16))
      ctx.fillText(options.subtitle, padding, artworkHeight + panelHeight * (options.title ? .76 : .5))
    }
    ctx.restore()
  }
}

export function renderCollage(canvas: HTMLCanvasElement, images: HTMLImageElement[], options: RenderOptions, selectedSlot?: number) {
  const frame = beginFrame(canvas, images.length, options, options.imageAspects ?? images.map(image => image.naturalWidth / image.naturalHeight))
  const imageAt = (i: number) => options.referenceLayout ? images[i % images.length] : images[i]
  frame.slots.forEach((slot, i) => {
    const source = slot.imageIndex ?? i
    paintSlot(frame, slot, source, imageAt(source), options)
  })
  paintContours(frame, options)
  if (options.template === 'wall') {
    finishFrame(frame, options)
    if (selectedSlot !== undefined) {
      frame.ctx = frame.mainCtx
      frame.ctx.save()
      frame.ctx.scale(frame.sx, frame.sy)
      frame.ctx.clip(new Path2D('M0 0H600V1000H0Z'))
      frame.slots.forEach((slot, i) => {
        if ((slot.imageIndex ?? i) === selectedSlot) paintSlot(frame, slot, selectedSlot, undefined, options, true)
      })
      frame.ctx.restore()
    }
    return
  }
  if (selectedSlot !== undefined && frame.slots[selectedSlot]) {
    paintSlot(frame, frame.slots[selectedSlot], selectedSlot, undefined, options, true)
    if (!frame.slots[selectedSlot].borders) frame.slots.slice(selectedSlot + 1).forEach((slot, i) => paintSlot(frame, slot, selectedSlot + 1 + i, imageAt(selectedSlot + 1 + i), options))
  }
  finishFrame(frame, options)
}

/** Decode and release each original in turn; a large batch never retains all full-size originals. */
export async function renderCollageExport(
  canvas: HTMLCanvasElement,
  images: { file: File; aspect: number }[],
  options: RenderOptions,
  loadOriginal: (file: File, maxDimension: number) => Promise<{ image: HTMLImageElement; dispose: () => void }>,
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal,
) {
  const frame = beginFrame(canvas, images.length, options, images.map(image => image.aspect))
  const jobs = frame.slots.map((slot, index) => ({ slot, source: slot.imageIndex ?? index })).filter(job => job.source < images.length)
  try {
    for (let i = 0; i < jobs.length; i++) {
      if (signal?.aborted) throw new DOMException('导出已取消', 'AbortError')
      const { slot, source } = jobs[i]
      const [, , w, h] = slot.box
      const sourceAspect = images[source].aspect
      const neededDimension = Math.ceil(Math.max(w * frame.sx / sourceAspect, h * frame.sy) * Math.max(sourceAspect, 1) * (options.crops[source]?.zoom ?? 1))
      const original = await loadOriginal(images[source].file, neededDimension)
      try {
        if (signal?.aborted) throw new DOMException('导出已取消', 'AbortError')
        paintSlot(frame, slot, source, original.image, options)
      } finally { original.dispose() }
      onProgress?.(i + 1, jobs.length)
      // Let progress paint and keep large exports responsive.
      if (i % 4 === 3) await new Promise<void>(resolve => window.setTimeout(resolve, 0))
    }
  } finally { paintContours(frame, options); finishFrame(frame, options) }
}

export function hitSlot(slots: readonly Slot[], x: number, y: number, aspect: number): number | null {
  const ctx = document.createElement('canvas').getContext('2d')
  const sx = aspect / 600, sy = 1 / 1000
  for (let i = slots.length - 1; i >= 0; i--) {
    const { box: [bx, by, w, h], rotation = 0 } = slots[i]
    const angle = -rotation * Math.PI / 180
    const dx = (x - bx - w / 2) * sx, dy = (y - by - h / 2) * sy
    const px = (dx * Math.cos(angle) - dy * Math.sin(angle)) / sx + bx + w / 2
    const py = (dx * Math.sin(angle) + dy * Math.cos(angle)) / sy + by + h / 2
    if (ctx?.isPointInPath(new Path2D(slots[i].path), px, py)
      && (slots[i].clips ?? []).every(path => ctx.isPointInPath(new Path2D(path), px, py))
      && !(slots[i].exclude ?? []).some(path => ctx.isPointInPath(new Path2D(path), px, py))) return i
  }
  return null
}
