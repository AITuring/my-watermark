import { getLargeImageAsset, processLargeImage, releaseLargeImage } from '@/utils/large-image'
import { loadImage } from './render'

export type CollageImage = {
  id: string
  name: string
  src: string
  image: HTMLImageElement
  file: File
  aspect: number
}

/** Keep small previews in memory; originals are decoded one at a time during export. */
export async function prepareCollageImage(file: File, maxSide = 640): Promise<CollageImage> {
  let original: HTMLImageElement | undefined
  let preview: HTMLImageElement | undefined
  let sourceUrl = ''
  let previewUrl = ''
  const canvas = document.createElement('canvas')
  try {
    const asset = await getLargeImageAsset(file)
    sourceUrl = asset?.previewUrl ?? URL.createObjectURL(file)
    original = await loadImage(sourceUrl)
    const aspect = original.naturalWidth / original.naturalHeight
    const scale = Math.min(1, maxSide / Math.max(original.naturalWidth, original.naturalHeight))
    canvas.width = Math.max(1, Math.round(original.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(original.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('浏览器不支持图片预览')
    ctx.drawImage(original, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error('生成缩略图失败')), 'image/webp', .88))
    previewUrl = URL.createObjectURL(blob)
    preview = await loadImage(previewUrl)
    return { id: crypto.randomUUID(), name: file.name, src: previewUrl, image: preview, file, aspect }
  } catch (error) {
    if (preview) preview.src = ''
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    void releaseLargeImage(file)
    throw error
  } finally {
    if (original) original.src = ''
    if (sourceUrl.startsWith('blob:')) URL.revokeObjectURL(sourceUrl)
    canvas.width = canvas.height = 0
  }
}

export function releaseCollageImage(item: CollageImage) {
  item.image.src = ''
  URL.revokeObjectURL(item.src)
  void releaseLargeImage(item.file)
}

export async function loadCollageOriginal(file: File, maxDimension: number) {
  const asset = await getLargeImageAsset(file)
  let source: Blob = file
  if (asset) {
    const scale = Math.min(1, maxDimension / Math.max(asset.width, asset.height), Math.sqrt(24_000_000 / (asset.width * asset.height)))
    const processed = await processLargeImage(file, {
      width: Math.max(1, Math.round(asset.width * scale)), height: Math.max(1, Math.round(asset.height * scale)), format: 'png',
    })
    if (!processed) throw new Error('大图读取失败')
    source = processed
  }
  const url = URL.createObjectURL(source)
  try {
    const image = await loadImage(url)
    return { image, dispose: () => { image.src = ''; URL.revokeObjectURL(url) } }
  } catch (error) { URL.revokeObjectURL(url); throw error }
}
