import { COVER_COLLAGE_LIMIT, getCoverCollageLayout } from '../../components/cover-collage-layout'
import type { Slot } from './templates'

export { COVER_COLLAGE_LIMIT }

/** Original cover composition: eighteen staggered covers, with the source order and layer order kept separate. */
export function getCoverWallSlots(count: number, aspect = .6): Slot[] {
  if (!count) return []
  return getCoverCollageLayout(COVER_COLLAGE_LIMIT).map((item, index) => {
    const h = item.height * 10, w = h * .72 * .6 / aspect
    const x = item.left * 6 - w / 2, y = item.top * 10 - h / 2
    const rx = Math.min(3, w / 4), ry = rx * aspect / .6
    return {
      path: `M${x + rx} ${y}H${x + w - rx}Q${x + w} ${y} ${x + w} ${y + ry}V${y + h - ry}Q${x + w} ${y + h} ${x + w - rx} ${y + h}H${x + rx}Q${x} ${y + h} ${x} ${y + h - ry}V${y + ry}Q${x} ${y} ${x + rx} ${y}Z`,
      box: [x, y, w, h] as Slot['box'], rotation: item.rotate, imageIndex: index % Math.min(count, COVER_COLLAGE_LIMIT),
      shadow: true, layer: item.layer, rootId: `cover-${index}`,
    }
  }).sort((a, b) => a.layer - b.layer)
}
