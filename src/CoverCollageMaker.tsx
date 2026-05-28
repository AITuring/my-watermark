import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import html2canvas from 'html2canvas'
import { Download, ImagePlus, RotateCcw, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { BOOKS } from '@/assets/wxbooks/books'
import CoverCollage from '@/components/CoverCollage'
import ImageUploader from './ImageUploader'
import './CoverCollageMaker.css'

type UploadedImage = {
  readonly id: string
  readonly name: string
  readonly src: string
}

type PosterPreset = {
  readonly id: 'landscape' | 'portrait' | 'square'
  readonly label: string
  readonly hint: string
  readonly width: number
  readonly height: number
}

const POSTER_PRESETS: readonly PosterPreset[] = [
  { id: 'landscape', label: '横版封面', hint: '1600 x 900', width: 1600, height: 900 },
  { id: 'portrait', label: '竖版海报', hint: '1080 x 1350', width: 1080, height: 1350 },
  { id: 'square', label: '方形卡片', hint: '1200 x 1200', width: 1200, height: 1200 },
] as const

const DEMO_IMAGES = BOOKS.slice(0, 12).map((book) => ({
  id: `demo-${book.bookId}`,
  name: book.title,
  src: book.cover,
}))

function slugifyFileName(value: string) {
  return value
    .trim()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function CoverCollageMaker() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [title, setTitle] = useState('我的图片封面')
  const [subtitle, setSubtitle] = useState('上传照片后自动生成一张有展陈感的拼贴 cover')
  const [presetId, setPresetId] = useState<PosterPreset['id']>('landscape')
  const [isExporting, setIsExporting] = useState(false)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const uploadedUrlsRef = useRef<string[]>([])

  const preset = useMemo(
    () => POSTER_PRESETS.find((item) => item.id === presetId) ?? POSTER_PRESETS[0],
    [presetId],
  )

  const collageImages = uploadedImages.length > 0 ? uploadedImages : DEMO_IMAGES

  useEffect(() => {
    return () => {
      uploadedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      uploadedUrlsRef.current = []
    }
  }, [])

  const handleUpload = (files: File[]) => {
    const nextImages = files.map((file, index) => {
      const src = URL.createObjectURL(file)
      uploadedUrlsRef.current.push(src)

      return {
        id: `${file.name}-${file.lastModified}-${index}`,
        name: file.name,
        src,
      }
    })

    setUploadedImages((current) => [...current, ...nextImages].slice(0, 18))
    toast.success(`已添加 ${nextImages.length} 张图片`)
  }

  const handleRemove = (imageId: string) => {
    setUploadedImages((current) => {
      const target = current.find((item) => item.id === imageId)
      if (target) {
        URL.revokeObjectURL(target.src)
        uploadedUrlsRef.current = uploadedUrlsRef.current.filter((url) => url !== target.src)
      }

      return current.filter((item) => item.id !== imageId)
    })
  }

  const handleReset = () => {
    uploadedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    uploadedUrlsRef.current = []
    setUploadedImages([])
    setTitle('我的图片封面')
    setSubtitle('上传照片后自动生成一张有展陈感的拼贴 cover')
    setPresetId('landscape')
  }

  const handleDownload = async () => {
    if (!previewRef.current) return

    try {
      setIsExporting(true)
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: '#0f0d0b',
        scale: Math.min(window.devicePixelRatio || 2, 3),
        useCORS: true,
      })

      const link = document.createElement('a')
      const fileName = slugifyFileName(title) || 'cover-collage'
      link.download = `${fileName}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      toast.success('封面已导出')
    } catch (error) {
      console.error(error)
      toast.error('导出失败，请稍后重试')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="cover-maker-page">
      <div className="cover-maker-page__glow cover-maker-page__glow--left" />
      <div className="cover-maker-page__glow cover-maker-page__glow--right" />

      <header className="cover-maker-hero">
        <div>
          <span className="cover-maker-kicker">COVER COLLAGE</span>
          <h1 className="cover-maker-title">拼贴封面生成器</h1>
          <p className="cover-maker-desc">
            把 `ReadingNotesCollection` 里那种暗色封面墙提炼成组件，上传任意图片后就能自动生成同风格的 cover 图。
          </p>
        </div>
        <div className="cover-maker-hero__actions">
          <button type="button" className="cover-maker-action" onClick={handleReset}>
            <RotateCcw size={16} />
            重置
          </button>
          <button type="button" className="cover-maker-action cover-maker-action--primary" onClick={handleDownload} disabled={isExporting}>
            <Download size={16} />
            {isExporting ? '导出中...' : '下载封面'}
          </button>
        </div>
      </header>

      <main className="cover-maker-layout">
        <section className="cover-maker-panel">
          <div className="cover-maker-panel__section">
            <div className="cover-maker-panel__header">
              <h2>上传图片</h2>
              <span>最多 18 张，少于 18 张会自动循环铺满</span>
            </div>
            <ImageUploader onUpload={handleUpload} fileType="封面图片" className="cover-maker-upload">
              <div className="cover-maker-upload__inner">
                <div className="cover-maker-upload__icon">
                  <Upload size={22} />
                </div>
                <div>
                  <div className="cover-maker-upload__title">拖拽图片到这里，或点击批量上传</div>
                  <div className="cover-maker-upload__sub">支持 JPG、PNG、WEBP，推荐上传 6 张以上会更有层次</div>
                </div>
              </div>
            </ImageUploader>
          </div>

          <div className="cover-maker-panel__section">
            <div className="cover-maker-panel__header">
              <h2>文字内容</h2>
              <span>标题会直接叠加在封面上</span>
            </div>
            <label className="cover-maker-field">
              <span>标题</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="输入封面标题" />
            </label>
            <label className="cover-maker-field">
              <span>副标题</span>
              <textarea
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                placeholder="输入一行说明文字"
                rows={3}
              />
            </label>
          </div>

          <div className="cover-maker-panel__section">
            <div className="cover-maker-panel__header">
              <h2>输出比例</h2>
              <span>不同平台可选不同画幅</span>
            </div>
            <div className="cover-maker-preset-list">
              {POSTER_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`cover-maker-preset ${item.id === presetId ? 'is-active' : ''}`}
                  onClick={() => setPresetId(item.id)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="cover-maker-panel__section">
            <div className="cover-maker-panel__header">
              <h2>{uploadedImages.length > 0 ? '已上传图片' : '当前示例'}</h2>
              <span>{uploadedImages.length > 0 ? `${uploadedImages.length} 张` : '未上传时使用书籍封面做演示'}</span>
            </div>
            <div className="cover-maker-thumb-grid">
              {collageImages.slice(0, 12).map((image) => (
                <div key={image.id} className="cover-maker-thumb">
                  <img src={image.src} alt={image.name} loading="lazy" />
                  {uploadedImages.length > 0 ? (
                    <button type="button" className="cover-maker-thumb__remove" onClick={() => handleRemove(image.id)} aria-label={`移除 ${image.name}`}>
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <div className="cover-maker-thumb__badge">
                      <ImagePlus size={14} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="cover-maker-preview-panel">
          <div className="cover-maker-preview-panel__header">
            <div>
              <span className="cover-maker-kicker">LIVE PREVIEW</span>
              <h2>实时预览</h2>
            </div>
            <div className="cover-maker-meta-pill">
              {preset.width} x {preset.height}
            </div>
          </div>

          <div
            className="cover-maker-stage-frame"
            style={{ '--poster-aspect-ratio': `${preset.width} / ${preset.height}` } as CSSProperties}
          >
            <div ref={previewRef} className="cover-maker-stage">
              <div className="cover-maker-stage__bg" />
              <div className="cover-maker-stage__grain" />
              <CoverCollage images={collageImages} className="cover-maker-stage__collage" />
              <div className="cover-maker-stage__veil" />
              <div className="cover-maker-stage__content">
                <span className="cover-maker-stage__eyebrow">Curated Image Wall</span>
                <h3>{title}</h3>
                <p>{subtitle}</p>
                <div className="cover-maker-stage__stats">
                  <div>
                    <strong>{uploadedImages.length > 0 ? uploadedImages.length : DEMO_IMAGES.length}</strong>
                    <span>图像来源</span>
                  </div>
                  <div>
                    <strong>{preset.label}</strong>
                    <span>导出比例</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
