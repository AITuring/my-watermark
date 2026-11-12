import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, DragEvent } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Check, Download, GripVertical, ImagePlus, RotateCcw, Shuffle, Trash2, Upload, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import ImageUploader from '@/components/ImageUploader'
import { getAdaptiveSlots, getArtworkFraction, isGrowingTemplate, MOTIF_COUNTS, COVER_COLLAGE_LIMIT, RATIOS, TEMPLATES, TEMPLATE_GROUPS, type Crop, type TemplateId } from './templates'
import { hitSlot, loadImage, renderCollage, renderCollageExport, type RenderOptions } from './render'
import { prepareCollageImage, releaseCollageImage, loadCollageOriginal, type CollageImage } from './assets'
import './collage.css'

const DEMO_SOURCES = [
  '/song-paintings/thumbnails/volume-1/1-1-8-8b504e3fea-preview.webp',
  '/song-paintings/thumbnails/volume-1/1-1-13-a3d01ff4b2-preview.webp',
  '/song-paintings/thumbnails/volume-1/1-2-22-45ad9a3fe0-preview.webp',
  '/song-paintings/thumbnails/volume-1/1-1-2-0e3c6cd69c-preview.webp',
  '/song-paintings/thumbnails/volume-1/1-1-10-8d319f73d7-preview.webp',
  '/song-paintings/thumbnails/volume-1/1-1-15-7160c06ead-preview.webp',
  '/song-paintings/thumbnails/volume-1/1-2-24-7b483b9668-preview.webp',
  '/song-paintings/thumbnails/volume-1/1-3-35-05ec919553-preview.webp',
  '/song-paintings/thumbnails/volume-1/1-2-27-fafd07ac4b-preview.webp',
]
const DEFAULT_CROP: Crop = { x: 50, y: 50, zoom: 1 }
const INITIAL_TITLE = '山水之间'
const INITIAL_SUBTITLE = '丹青有意 · 拼贴成景'
const MAX_IMAGES = 30
const IMAGE_ROW_HEIGHT = 46
const VISIBLE_IMAGE_ROWS = 14

function TemplatePreview({ id, images, count, aspect }: { id: TemplateId; images: HTMLImageElement[]; count: number; aspect: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) renderCollage(ref.current, images, {
      template: id, columns: 3, rows: 3, gap: 2, background: id === 'wall' ? '#0f0d0b' : '#eee7d8', title: id === 'wall' ? '山水之间' : '', subtitle: '', crops: {}, referenceLayout: true,
      ...(isGrowingTemplate(id) ? { aspect, slots: getAdaptiveSlots(id, count || 12, aspect) } : {}),
    })
  }, [id, images, count, aspect])
  return <canvas ref={ref} width={Math.round(200 * Math.min(1, aspect))} height={Math.round(200 * Math.min(1, 1 / aspect))} style={{ aspectRatio: aspect }} aria-hidden="true" />
}

export default function ImageCollage() {
  const [template, setTemplate] = useState<TemplateId>('triangle')
  const [templateGroup, setTemplateGroup] = useState<(typeof TEMPLATE_GROUPS)[number]['id']>('growing')
  const [demoImages, setDemoImages] = useState<HTMLImageElement[]>([])
  const [uploaded, setUploaded] = useState<CollageImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 })
  const [exportProgress, setExportProgress] = useState({ completed: 0, total: 0 })
  const [imageScrollTop, setImageScrollTop] = useState(0)
  const [title, setTitle] = useState(INITIAL_TITLE)
  const [subtitle, setSubtitle] = useState(INITIAL_SUBTITLE)
  const [textVisibility, setTextVisibility] = useState<Partial<Record<TemplateId, boolean>>>({})
  const showText = textVisibility[template] ?? template === 'wall'
  const setShowText = (value: boolean) => setTextVisibility(current => ({ ...current, [template]: value }))
  const [ratioId, setRatioId] = useState('3:5')
  const [longEdge, setLongEdge] = useState(2400)
  const [format, setFormat] = useState('png')
  const [columns, setColumns] = useState(0)
  const [rows, setRows] = useState(0)
  const [gap, setGap] = useState(2)
  const [backgrounds, setBackgrounds] = useState<Partial<Record<TemplateId, string>>>({})
  const [cropSets, setCropSets] = useState<Partial<Record<TemplateId, Record<string, Crop>>>>({})
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [replaceId, setReplaceId] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const assetsRef = useRef<CollageImage[]>([])
  const operationRef = useRef(0)
  const uploadLock = useRef(false)
  const exportControllerRef = useRef<AbortController | null>(null)

  const images = uploaded
  const fixedCount = MOTIF_COUNTS[template as keyof typeof MOTIF_COUNTS]
  const templateCapacity = fixedCount ?? (template === 'wall' ? COVER_COLLAGE_LIMIT : MAX_IMAGES)
  const usedImages = useMemo(() => uploaded.slice(0, templateCapacity), [uploaded, templateCapacity])
  const background = backgrounds[template] ?? (template === 'wall' ? '#0f0d0b' : '#eee7d8')
  const decodedImages = useMemo(() => usedImages.map(item => item.image), [usedImages])
  const imageAspects = useMemo(() => usedImages.map(item => item.aspect), [usedImages])
  const ratio = RATIOS.find(item => item.id === ratioId) ?? RATIOS[0]
  const width = Math.round(longEdge * Math.min(1, ratio.w / ratio.h))
  const height = Math.round(longEdge * Math.min(1, ratio.h / ratio.w))
  const artworkFraction = getArtworkFraction(ratio.w / ratio.h, showText && Boolean(title || subtitle), template)
  const artworkAspect = ratio.w / ratio.h / artworkFraction
  const slots = useMemo(() => getAdaptiveSlots(template, usedImages.length, artworkAspect, columns, rows, imageAspects), [template, usedImages.length, artworkAspect, columns, rows, imageAspects])
  const crops = useMemo(() => Object.fromEntries(usedImages.map((image, i) => [i, cropSets[template]?.[image.id] ?? DEFAULT_CROP])), [cropSets, template, usedImages])
  const activeCrop = selectedSlot === null ? DEFAULT_CROP : crops[selectedSlot] ?? DEFAULT_CROP
  const activeTemplate = TEMPLATES.find(item => item.id === template)!
  const renderOptions = useMemo<RenderOptions>(() => ({
    template, columns, rows, gap, background, title: showText ? title : '', subtitle: showText ? subtitle : '', crops, aspect: ratio.w / ratio.h, imageAspects, slots,
  }), [template, columns, rows, gap, background, title, subtitle, showText, crops, ratio, imageAspects, slots])
  const visibleStart = Math.min(Math.max(0, images.length - VISIBLE_IMAGE_ROWS), Math.max(0, Math.floor(imageScrollTop / IMAGE_ROW_HEIGHT) - 3))

  useEffect(() => {
    let cancelled = false
    void Promise.all(DEMO_SOURCES.map(loadImage)).then(items => {
      if (!cancelled) setDemoImages(items)
    }).catch(() => {
      if (!cancelled) toast.error('模板缩略图加载失败，可上传图片继续使用')
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => {
    operationRef.current++
    exportControllerRef.current?.abort()
    assetsRef.current.forEach(releaseCollageImage)
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return
    try {
      if (decodedImages.length) {
        renderCollage(canvasRef.current, decodedImages, renderOptions, selectedSlot ?? undefined)
      } else {
        const canvas = canvasRef.current
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      }
      setPreviewError('')
    } catch {
      setPreviewError('预览绘制失败，请重新选择图片')
    }
  }, [decodedImages, renderOptions, selectedSlot, ratioId])

  const handleUpload = async (files: File[], targetId?: string) => {
    if (uploadLock.current || isExporting) return
    const capacity = targetId ? 1 : templateCapacity - assetsRef.current.length
    if (capacity <= 0) { toast.info(`当前模板最多放入 ${templateCapacity} 张图片，可移除素材或切换模板`); return }
    if (files.length > capacity) toast.info(`当前模板最多放入 ${templateCapacity} 张图片，本次添加前 ${capacity} 张`)
    const selected = files.slice(0, capacity)
    const nextCount = assetsRef.current.length + (targetId ? 0 : selected.length)
    const previewMaxSide = Math.max(48, Math.min(640, Math.floor(Math.sqrt(24_000_000 / Math.max(1, nextCount)))))
    const operation = ++operationRef.current
    uploadLock.current = true
    setIsUploading(true)
    setUploadProgress({ completed: 0, total: selected.length })
    const accepted: CollageImage[] = []
    let failed = 0
    for (const file of selected) {
      try {
        const item = await prepareCollageImage(file, previewMaxSide)
        if (operation !== operationRef.current) { releaseCollageImage(item); break }
        accepted.push(item)
      } catch {
        failed++
      }
      if (operation === operationRef.current) setUploadProgress({ completed: accepted.length + failed, total: selected.length })
    }
    if (operation === operationRef.current) {
      if (targetId && accepted[0]) {
        const old = assetsRef.current.find(item => item.id === targetId)
        assetsRef.current = assetsRef.current.map(item => item.id === targetId ? accepted[0] : item)
        if (old) releaseCollageImage(old)
      } else assetsRef.current = [...assetsRef.current, ...accepted]
      setUploaded([...assetsRef.current])
      if (accepted.length) toast.success(targetId ? '图片已替换' : `已添加 ${accepted.length} 张图片`)
      if (failed) toast.error(`${failed} 张图片无法读取，请换用 JPG、PNG 或 WEBP`)
    } else accepted.forEach(releaseCollageImage)
    uploadLock.current = false
    setIsUploading(false)
  }

  const removeImage = (id: string) => {
    const image = assetsRef.current.find(item => item.id === id)
    assetsRef.current = assetsRef.current.filter(item => item.id !== id)
    setUploaded([...assetsRef.current])
    setSelectedSlot(null)
    if (image) releaseCollageImage(image)
  }

  const reorder = (from: number, to: number) => {
    if (isUploading || isExporting) return
    if (to < 0 || to >= images.length || from === to) return
    const next = [...images]
    next.splice(to, 0, next.splice(from, 1)[0])
    assetsRef.current = next
    setUploaded(next)
  }

  const shuffle = () => {
    const next = [...images]
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[next[i], next[j]] = [next[j], next[i]]
    }
    assetsRef.current = next
    setUploaded(next)
  }

  const reset = () => {
    operationRef.current++
    assetsRef.current.forEach(releaseCollageImage)
    assetsRef.current = []
    setUploaded([])
    setTemplate('triangle'); setTemplateGroup('growing'); setTitle(INITIAL_TITLE); setSubtitle(INITIAL_SUBTITLE)
    setTextVisibility({}); setRatioId('3:5'); setGap(2); setBackgrounds({})
    setColumns(0); setRows(0); setCropSets({}); setSelectedSlot(null)
    setLongEdge(2400); setFormat('png')
  }

  const updateCrop = (key: keyof Crop, value: number) => {
    if (selectedSlot === null || !images[selectedSlot]) return
    const id = images[selectedSlot].id
    setCropSets(current => ({ ...current, [template]: { ...current[template], [id]: { ...activeCrop, [key]: value } } }))
  }

  const download = async () => {
    if (!decodedImages.length || exportControllerRef.current) return
    const controller = new AbortController()
    exportControllerRef.current = controller
    const canvas = document.createElement('canvas')
    setIsExporting(true)
    setExportProgress({ completed: 0, total: usedImages.length })
    try {
      await document.fonts.ready
      canvas.width = width
      canvas.height = height
      await renderCollageExport(canvas, usedImages, renderOptions, loadCollageOriginal, (completed, total) => setExportProgress({ completed, total }), controller.signal)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        value => value ? resolve(value) : reject(new Error('生成失败')), `image/${format}`, .95))
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `${title.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 60) || '图片拼贴'}-${activeTemplate.name}-${width}x${height}.${format === 'jpeg' ? 'jpg' : 'png'}`
      link.href = url
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(`已导出 ${width} × ${height} 图片`)
    } catch { if (!controller.signal.aborted) toast.error('导出失败，请减小尺寸后重试') }
    finally { canvas.width = canvas.height = 0; exportControllerRef.current = null; setIsExporting(false) }
  }

  return (
    <div className="collage-app">
      <header className="collage-header">
        <div className="collage-heading">
          <Link to="/" className="collage-back" aria-label="返回应用库"><ArrowLeft size={20} /></Link>
          <div><div className="collage-eyebrow">THE COLLAGE STUDIO</div><h1>图片拼贴<span>以图为材，自成一景。</span></h1></div>
        </div>
        <div className="collage-header-actions">
          <button className="collage-button collage-reset" onClick={reset} disabled={isUploading || isExporting}><RotateCcw size={15} />重置</button>
          <button className="collage-button collage-button-primary" onClick={download} disabled={isExporting || isUploading || !images.length || !!previewError} aria-label={isExporting ? `正在导出 ${exportProgress.completed} / ${exportProgress.total} 张图片` : undefined}>
            <Download size={16} />{isExporting ? `导出 ${Math.round(exportProgress.completed / Math.max(1, exportProgress.total) * 100)}%` : '导出图片'}
          </button>
        </div>
      </header>

      <main className="collage-workspace">
        <aside className="collage-controls" aria-label="拼贴设置">
          <section className="collage-section">
            <div className="collage-section-title"><h2><span>01</span>选择模板</h2><span>随时切换</span></div>
            <div className="collage-template-groups" role="group" aria-label="模板类型">
              {TEMPLATE_GROUPS.map(group => <button key={group.id} aria-pressed={templateGroup === group.id} onClick={() => {
                setTemplateGroup(group.id); setTemplate(TEMPLATES.find(item => item.group === group.id)!.id); setSelectedSlot(null)
              }}>{group.name}</button>)}
            </div>
            <div className="collage-template-list">
              {TEMPLATES.filter(item => item.group === templateGroup).map((item, index) => (
                <button key={item.id} className={`collage-template ${template === item.id ? 'is-active' : ''}`} onClick={() => { setTemplate(item.id); setSelectedSlot(null) }} aria-pressed={template === item.id}>
                  <div className="collage-template-art"><TemplatePreview id={item.id} images={demoImages} count={usedImages.length} aspect={isGrowingTemplate(item.id) ? artworkAspect : item.id === 'wall' ? 16 / 9 : .6} />{template === item.id && <span className="collage-template-check"><Check size={11} /></span>}</div>
                  <strong>{item.name}</strong><span>{String(index + 1).padStart(2, '0')}</span>
                </button>
              ))}
            </div>
            {templateGroup === 'growing' && <p className="collage-template-hint">1–30 张自动满版构图，图形延展到画幅边缘并自然裁切。</p>}
            {template === 'wall' && <div className="collage-cover-preset"><p className="collage-template-hint">沿用原版 18 位错落布局，少于 18 张时循环铺陈。</p><button className="collage-text-button" onClick={() => { setRatioId('16:9'); setShowText(true); setBackgrounds(current => ({ ...current, wall: '#0f0d0b' })) }}>经典横版封面 · 16:9</button></div>}
            {template === 'grid' && <div className="collage-pair collage-grid-controls">
              <label>每行最多<select value={columns} onChange={e => { setColumns(Number(e.target.value)); setRows(0); setSelectedSlot(null) }}><option value={0}>自动排布</option>{Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} 张</option>)}</select></label>
              <label>行数<select value={rows} onChange={e => { setRows(Number(e.target.value)); setColumns(0); setSelectedSlot(null) }}><option value={0}>自动适配</option>{Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} 行</option>)}</select></label>
            </div>}
          </section>

          <section className="collage-section">
            <div className="collage-section-title"><h2><span>02</span>图片素材</h2><span>{usedImages.length} / {templateCapacity} 张</span></div>
            <div className={isUploading || isExporting ? 'collage-upload is-busy' : 'collage-upload'} aria-busy={isUploading}>
              <ImageUploader onUpload={files => void handleUpload(files)}>
                <div className="collage-upload-content"><Upload size={19} /><strong>{isUploading ? `正在读取 ${uploadProgress.completed} / ${uploadProgress.total} 张…` : '点击上传，或将图片拖到这里'}</strong><span>JPG / PNG / WEBP · 当前模板最多 {templateCapacity} 张</span></div>
              </ImageUploader>
            </div>
            {fixedCount && <p className="collage-template-hint">{template === 'fan' ? `首张铺满底图，其余扇面交错叠加，最多 ${fixedCount} 张。` : `按顺序填入 ${fixedCount} 个固定区域，空余区域保留底色。`}</p>}
            {images.length > templateCapacity && <p className="collage-template-hint">当前使用前 {templateCapacity} 张，其余 {images.length - templateCapacity} 张保留在素材中，可排序替换。</p>}
            <div className="collage-image-list" role="list" aria-label="已上传图片" tabIndex={images.length ? 0 : -1} onScroll={e => setImageScrollTop(e.currentTarget.scrollTop)}>
              <div style={{ height: images.length * IMAGE_ROW_HEIGHT, position: 'relative' }}><div style={{ position: 'absolute', top: visibleStart * IMAGE_ROW_HEIGHT, left: 0, right: 0 }}>
              {images.slice(visibleStart, visibleStart + VISIBLE_IMAGE_ROWS).map((image, offset) => { const i = visibleStart + offset; return <div key={image.id} className={`collage-image-row ${dragIndex === i ? 'is-dragging' : ''} ${i >= templateCapacity ? 'is-unused' : ''}`} role="listitem" aria-posinset={i + 1} aria-setsize={images.length} draggable={!isUploading && !isExporting}
                onDragStart={(e: DragEvent) => { setDragIndex(i); e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move' }}
                onDragEnd={() => setDragIndex(null)} onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (dragIndex !== null) reorder(dragIndex, i); setDragIndex(null) }}>
                <GripVertical size={13} className="collage-grip" /><img src={image.src} alt="" draggable={false} /><span className="collage-image-number">{String(i + 1).padStart(2, '0')}</span><span className="collage-image-name" title={image.name}>{image.name}</span>{i >= templateCapacity && <span className="collage-unused-label">备用</span>}
                <div className="collage-image-actions">
                  <button aria-label={`上移第 ${i + 1} 张图片`} disabled={i === 0 || isUploading || isExporting} onClick={() => reorder(i, i - 1)}><ArrowUp size={13} /></button>
                  <button aria-label={`下移第 ${i + 1} 张图片`} disabled={i === images.length - 1 || isUploading || isExporting} onClick={() => reorder(i, i + 1)}><ArrowDown size={13} /></button>
                  <button aria-label={`替换第 ${i + 1} 张图片`} disabled={isUploading || isExporting} onClick={() => { setReplaceId(image.id); replaceRef.current?.click() }}><ImagePlus size={13} /></button><button aria-label={`移除第 ${i + 1} 张图片`} disabled={isUploading || isExporting} onClick={() => removeImage(image.id)}><X size={13} /></button>
                </div>
              </div> })}</div></div>
            </div>
            <input ref={replaceRef} type="file" accept="image/*" hidden onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (e.target.files?.[0] && replaceId) void handleUpload([e.target.files[0]], replaceId)
              e.target.value = ''
            }} />
            {uploaded.length > 0 && <div className="collage-material-footer"><span>可拖动排序，也可使用上下箭头</span><button onClick={shuffle} disabled={images.length < 2 || isUploading || isExporting}><Shuffle size={13} />打乱</button>
              <button disabled={isUploading || isExporting} onClick={() => { assetsRef.current.forEach(releaseCollageImage); assetsRef.current = []; setUploaded([]); setSelectedSlot(null); setCropSets({}) }} aria-label="清空上传图片"><Trash2 size={13} /></button>
            </div>}
          </section>

          <section className="collage-section">
            <div className="collage-section-title"><h2><span>03</span>画面设置</h2></div>
            <div className="collage-pair"><label>画幅比例<select value={ratioId} onChange={e => setRatioId(e.target.value)}>{RATIOS.map(item => <option key={item.id} value={item.id}>{item.id} · {item.label}</option>)}</select></label><label>底色<input type="color" value={background} onChange={e => setBackgrounds(current => ({ ...current, [template]: e.target.value }))} /></label></div>
            <label className="collage-range"><span>分隔线<output>{gap}</output></span><input aria-label="分隔线宽度" type="range" min="0" max="20" value={gap} onChange={e => setGap(Number(e.target.value))} /></label>
            <label className="collage-checkbox"><input type="checkbox" checked={showText} onChange={e => setShowText(e.target.checked)} />添加标题与副标题</label>
            {showText && <div className="collage-text-fields"><label>标题<input value={title} maxLength={40} placeholder="输入标题，也可留空" onChange={e => setTitle(e.target.value)} /></label><label>副标题<input value={subtitle} maxLength={80} placeholder="为这张拼贴写一句话" onChange={e => setSubtitle(e.target.value)} /></label></div>}
            <div className="collage-pair collage-export-fields"><label>导出长边<select value={longEdge} onChange={e => setLongEdge(Number(e.target.value))}>{[1600, 2400, 3600, 4800].map(n => <option key={n} value={n}>{n} px</option>)}</select></label><label>文件格式<select value={format} onChange={e => setFormat(e.target.value)}><option value="png">PNG</option><option value="jpeg">JPG</option></select></label></div>
          </section>
        </aside>

        <section className="collage-preview" aria-label="实时预览">
          <div className="collage-preview-bar"><div><span className="collage-status-dot" />实时预览<span className="collage-preview-separator">/</span><strong>{activeTemplate.name}</strong></div><span>{width} × {height} px</span></div>
          <div className="collage-stage">
            <div className="collage-poster-wrap" style={{ '--collage-ratio': ratio.w / ratio.h } as CSSProperties}>
              <canvas ref={canvasRef} width={Math.round(1000 * Math.min(1, ratio.w / ratio.h))} height={Math.round(1000 * Math.min(1, ratio.h / ratio.w))}
                aria-label={`${activeTemplate.name}拼贴预览，点击画面选择图片区域`} onClick={e => {
                  if (!images.length) return
                  const bounds = e.currentTarget.getBoundingClientRect()
                  const y = (e.clientY - bounds.top) / bounds.height / artworkFraction
                  const hit = y > 1 ? null : hitSlot(slots, (e.clientX - bounds.left) / bounds.width * 600, y * 1000, artworkAspect)
                  const source = hit === null ? null : slots[hit].imageIndex ?? hit
                  setSelectedSlot(source !== null && source < usedImages.length ? source : null)
                }} />
              {!images.length && <div className="collage-preview-empty">上传图片，开始你的拼贴</div>}
              {previewError && <div className="collage-preview-empty" role="alert">{previewError}</div>}
            </div>
          </div>
          <div className="collage-preview-caption"><span>{activeTemplate.caption}</span><span>{usedImages.length ? fixedCount ? `已放入 ${usedImages.length} / ${fixedCount} 张` : template === 'wall' ? `${usedImages.length} 张素材 · 18 位循环铺陈` : `${usedImages.length} 张图片 · 全部参与排布` : '等待上传'}</span></div>
          <div className="collage-crop-panel">
            <div className="collage-crop-heading"><div><h2>调整画面</h2><p>{images.length ? '点击预览，或输入图片序号调整取景。' : '上传图片后可调整各区域取景。'}</p></div><label className="collage-slot-select"><span className="sr-only">选择图片区域</span><input aria-label="选择图片区域" type="number" min={1} max={Math.min(slots.length, usedImages.length) || 1} placeholder="图片序号" disabled={!images.length} value={selectedSlot === null ? '' : selectedSlot + 1} onChange={e => setSelectedSlot(e.target.value === '' ? null : Math.max(0, Math.min(usedImages.length - 1, Number(e.target.value) - 1)))} /></label></div>
            {images.length > 0 && selectedSlot !== null && <div className="collage-crop-fields">
              {([{ key: 'zoom', label: '放大', min: 1, max: 3, step: .05 }, { key: 'x', label: '水平取景', min: 0, max: 100, step: 1 }, { key: 'y', label: '垂直取景', min: 0, max: 100, step: 1 }] as const).map(control => <label className="collage-range" key={control.key}><span>{control.label}<output>{control.key === 'zoom' ? `${activeCrop.zoom.toFixed(2)}×` : `${activeCrop[control.key]}%`}</output></span><input aria-label={control.label} type="range" min={control.min} max={control.max} step={control.step} value={activeCrop[control.key]} onChange={e => updateCrop(control.key, Number(e.target.value))} /></label>)}
              <button className="collage-text-button" onClick={() => setCropSets(current => ({ ...current, [template]: { ...current[template], [images[selectedSlot].id]: DEFAULT_CROP } }))}><RotateCcw size={13} />重置取景</button>
            </div>}
          </div>
          <p className="collage-privacy">图片在本地浏览器中合成 · 导出不包含选区边框</p>
        </section>
      </main>
    </div>
  )
}
