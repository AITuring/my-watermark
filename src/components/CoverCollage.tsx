import { useMemo } from 'react'
import type { CSSProperties } from 'react'

import { getCoverCollageLayout, COVER_COLLAGE_LIMIT } from './cover-collage-layout'
export { getCoverCollageLayout } from './cover-collage-layout'
import './CoverCollage.css'

export type CoverCollageImage = {
  readonly id: string
  readonly src: string
  readonly alt?: string
}

function fillCollage(images: readonly CoverCollageImage[], maxItems: number) {
  if (images.length === 0) return []

  return Array.from({ length: Math.min(maxItems, COVER_COLLAGE_LIMIT) }, (_, index) => {
    const image = images[index % images.length]
    return {
      ...image,
      id: `${image.id}-${index}`,
    }
  })
}

export default function CoverCollage({
  images,
  className = '',
  maxItems = COVER_COLLAGE_LIMIT,
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
