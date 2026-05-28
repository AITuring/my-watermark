import { useMemo } from 'react'
import type { CSSProperties } from 'react'

import './CoverCollage.css'

export type CoverCollageImage = {
  readonly id: string
  readonly src: string
  readonly alt?: string
}

type CoverLayout = {
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

function fillCollage(images: readonly CoverCollageImage[], maxItems: number) {
  if (images.length === 0) return []

  return Array.from({ length: Math.min(maxItems, COLLAGE_LAYOUTS.length) }, (_, index) => {
    const image = images[index % images.length]
    return {
      ...image,
      id: `${image.id}-${index}`,
    }
  })
}

export function getCoverCollageLayout(count: number) {
  return COLLAGE_LAYOUTS.slice(0, Math.min(count, COLLAGE_LAYOUTS.length))
}

export default function CoverCollage({
  images,
  className = '',
  maxItems = COLLAGE_LAYOUTS.length,
  decorative = true,
}: {
  images: readonly CoverCollageImage[]
  className?: string
  maxItems?: number
  decorative?: boolean
}) {
  const visibleImages = useMemo(() => fillCollage(images, maxItems), [images, maxItems])
  const layout = useMemo(() => getCoverCollageLayout(visibleImages.length), [visibleImages.length])

  return (
    <div className={`cover-collage ${className}`.trim()} {...(decorative ? { 'aria-hidden': 'true' } : {})}>
      <div className="cover-collage__track">
        {visibleImages.map((image, index) => {
          const itemLayout = layout[index]
          return (
            <img
              key={image.id}
              className="cover-collage__item"
              src={image.src}
              alt={decorative ? '' : image.alt || ''}
              loading="lazy"
              style={
                {
                  '--cover-left': itemLayout.left,
                  '--cover-top': itemLayout.top,
                  '--cover-height': itemLayout.height,
                  '--cover-rotate': `${itemLayout.rotate}deg`,
                  '--cover-layer': itemLayout.layer,
                  '--cover-delay': `${index * 55}ms`,
                } as CSSProperties
              }
            />
          )
        })}
      </div>
    </div>
  )
}
