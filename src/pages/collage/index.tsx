import { useState, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Upload, Download, Grid, Image as ImageIcon, Trash2, ArrowUpDown, RotateCcw, X, RefreshCw, Settings, CheckCircle } from 'lucide-react'
import { Switch } from '@/components/ui/switch.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Slider } from '@/components/ui/slider.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'


// 图片接口定义
interface UploadedImage {
  id: string
  file: File
  src: string
  name: string
}

// 布局接口定义
interface Layout {
  id: string
  name: string
  description: string
  imageCount: number
  gridCols: number
  gridRows: number
  aspectRatio: string
}

// 输出比例选项
interface AspectRatio {
  id: string
  name: string
  ratio: number // 宽/高
  description: string
}

const ASPECT_RATIOS: AspectRatio[] = [
  { id: '1:1', name: '1:1', ratio: 1, description: '正方形' },
  { id: '4:3', name: '4:3', ratio: 4/3, description: '传统照片' },
  { id: '3:4', name: '3:4', ratio: 3/4, description: '竖版照片' },
  { id: '16:9', name: '16:9', ratio: 16/9, description: '宽屏' },
  { id: '9:16', name: '9:16', ratio: 9/16, description: '竖屏' },
  { id: '3:2', name: '3:2', ratio: 3/2, description: '经典比例' },
  { id: '2:3', name: '2:3', ratio: 2/3, description: '竖版经典' },
  { id: '21:9', name: '21:9', ratio: 21/9, description: '超宽屏' },
  { id: '5:4', name: '5:4', ratio: 5/4, description: '中画幅' },
  { id: '4:5', name: '4:5', ratio: 4/5, description: '竖版中画幅' }
]

// 扩展的布局配置，支持2到18张图片
const LAYOUTS: Layout[] = [
  // 2张图片
  {
    id: 'horizontal-2',
    name: '水平拼接',
    description: '2张图片，水平排列',
    imageCount: 2,
    gridCols: 2,
    gridRows: 1,
    aspectRatio: '2:1'
  },
  {
    id: 'vertical-2',
    name: '垂直拼接',
    description: '2张图片，垂直排列',
    imageCount: 2,
    gridCols: 1,
    gridRows: 2,
    aspectRatio: '1:2'
  },
  // 3张图片
  {
    id: 'horizontal-3',
    name: '水平三联',
    description: '3张图片，水平排列',
    imageCount: 3,
    gridCols: 3,
    gridRows: 1,
    aspectRatio: '3:1'
  },
  {
    id: 'vertical-3',
    name: '垂直三联',
    description: '3张图片，垂直排列',
    imageCount: 3,
    gridCols: 1,
    gridRows: 3,
    aspectRatio: '1:3'
  },
  // 4张图片
  {
    id: 'grid-2x2',
    name: '2x2 网格',
    description: '4张图片，2行2列',
    imageCount: 4,
    gridCols: 2,
    gridRows: 2,
    aspectRatio: '1:1'
  },
  {
    id: 'horizontal-4',
    name: '水平四联',
    description: '4张图片，水平排列',
    imageCount: 4,
    gridCols: 4,
    gridRows: 1,
    aspectRatio: '4:1'
  },
  {
    id: 'vertical-4',
    name: '垂直四联',
    description: '4张图片，垂直排列',
    imageCount: 4,
    gridCols: 1,
    gridRows: 4,
    aspectRatio: '1:4'
  },
  // 5张图片
  {
    id: 'grid-5',
    name: '5张拼接',
    description: '5张图片，2行3列布局',
    imageCount: 5,
    gridCols: 3,
    gridRows: 2,
    aspectRatio: '3:2'
  },
  // 6张图片
  {
    id: 'grid-2x3',
    name: '2x3 网格',
    description: '6张图片，2行3列',
    imageCount: 6,
    gridCols: 3,
    gridRows: 2,
    aspectRatio: '3:2'
  },
  {
    id: 'grid-3x2',
    name: '3x2 网格',
    description: '6张图片，3行2列',
    imageCount: 6,
    gridCols: 2,
    gridRows: 3,
    aspectRatio: '2:3'
  },
  {
    id: 'horizontal-6',
    name: '水平六联',
    description: '6张图片，水平排列',
    imageCount: 6,
    gridCols: 6,
    gridRows: 1,
    aspectRatio: '6:1'
  },
  // 8张图片
  {
    id: 'grid-2x4',
    name: '2x4 网格',
    description: '8张图片，2行4列',
    imageCount: 8,
    gridCols: 4,
    gridRows: 2,
    aspectRatio: '2:1'
  },
  {
    id: 'grid-4x2',
    name: '4x2 网格',
    description: '8张图片，4行2列',
    imageCount: 8,
    gridCols: 2,
    gridRows: 4,
    aspectRatio: '1:2'
  },
  // 9张图片
  {
    id: 'grid-3x3',
    name: '3x3 网格',
    description: '9张图片，3行3列',
    imageCount: 9,
    gridCols: 3,
    gridRows: 3,
    aspectRatio: '1:1'
  },
  // 10张图片
  {
    id: 'grid-2x5',
    name: '2x5 网格',
    description: '10张图片，2行5列',
    imageCount: 10,
    gridCols: 5,
    gridRows: 2,
    aspectRatio: '5:2'
  },
  {
    id: 'grid-5x2',
    name: '5x2 网格',
    description: '10张图片，5行2列',
    imageCount: 10,
    gridCols: 2,
    gridRows: 5,
    aspectRatio: '2:5'
  },
  // 12张图片
  {
    id: 'grid-3x4',
    name: '3x4 网格',
    description: '12张图片，3行4列',
    imageCount: 12,
    gridCols: 4,
    gridRows: 3,
    aspectRatio: '4:3'
  },
  {
    id: 'grid-4x3',
    name: '4x3 网格',
    description: '12张图片，4行3列',
    imageCount: 12,
    gridCols: 3,
    gridRows: 4,
    aspectRatio: '3:4'
  },
  // 15张图片
  {
    id: 'grid-3x5',
    name: '3x5 网格',
    description: '15张图片，3行5列',
    imageCount: 15,
    gridCols: 5,
    gridRows: 3,
    aspectRatio: '5:3'
  },
  {
    id: 'grid-5x3',
    name: '5x3 网格',
    description: '15张图片，5行3列',
    imageCount: 15,
    gridCols: 3,
    gridRows: 5,
    aspectRatio: '3:5'
  },
  // 16张图片
  {
    id: 'grid-4x4',
    name: '4x4 网格',
    description: '16张图片，4行4列',
    imageCount: 16,
    gridCols: 4,
    gridRows: 4,
    aspectRatio: '1:1'
  },
  // 18张图片
  {
    id: 'grid-3x6',
    name: '3x6 网格',
    description: '18张图片，3行6列',
    imageCount: 18,
    gridCols: 6,
    gridRows: 3,
    aspectRatio: '2:1'
  },
  {
    id: 'grid-6x3',
    name: '6x3 网格',
    description: '18张图片，6行3列',
    imageCount: 18,
    gridCols: 3,
    gridRows: 6,
    aspectRatio: '1:2'
  }
]

function ImageCollage() {
   const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [selectedLayout, setSelectedLayout] = useState<Layout | null>(null)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>(ASPECT_RATIOS[0]) // 默认1:1
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // 间隙控制状态
  const [hasGap, setHasGap] = useState(false)
  const [gapSize, setGapSize] = useState([4])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 根据已上传图片数量获取可用布局
  const availableLayouts = useMemo(() => {
    if (uploadedImages.length === 0) return []
    return LAYOUTS.filter(layout => layout.imageCount === uploadedImages.length)
  }, [uploadedImages.length])

  // 步骤完成状态
  const steps = useMemo(() => {
    return [
      {
        id: 'upload',
        title: '上传图片',
        description: '选择要拼接的图片',
        completed: uploadedImages.length > 0,
        active: uploadedImages.length === 0
      },
      {
        id: 'layout',
        title: '选择布局',
        description: '选择图片排列方式',
        completed: selectedLayout !== null,
        active: uploadedImages.length > 0 && selectedLayout === null
      },
      {
        id: 'ratio',
        title: '设置比例',
        description: '选择输出图片比例',
        completed: selectedAspectRatio !== null,
        active: selectedLayout !== null
      },
      {
        id: 'generate',
        title: '生成下载',
        description: '生成并下载拼接图',
        completed: false,
        active: selectedLayout !== null && selectedAspectRatio !== null
      }
    ]
  }, [uploadedImages.length, selectedLayout, selectedAspectRatio])

  // 处理文件上传
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target?.files || [])
    if (files.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)
    setSelectedLayout(null) // 重置布局选择

    try {
      const imagePromises = files.map(async (file, index) => {
        return new Promise<UploadedImage | null>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            // 更新进度
            const progress = ((index + 1) / files.length) * 100
            setUploadProgress(progress)

            resolve({
              id: Math.random().toString(36).substr(2, 9),
              file,
              src: e.target?.result as string,
              name: file.name
            })
          }
          reader.onerror = () => {
            console.error('读取文件失败:', file.name)
            resolve(null)
          }
          reader.readAsDataURL(file)
        })
      })

      const images = await Promise.all(imagePromises)
      const validImages = images.filter((img): img is UploadedImage => img !== null)

      setUploadedImages(validImages)

    } catch (error) {
      console.error('上传图片时出错:', error)
      alert('上传图片时出错，请重试')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      // 清空文件输入框
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [])

  // 删除图片
  const removeImage = useCallback((imageId: string) => {
    setUploadedImages(prev => {
      const newImages = prev.filter(img => img.id !== imageId)
      // 如果删除后图片数量变化，重置布局选择
      if (newImages.length !== prev.length) {
        setSelectedLayout(null)
      }
      return newImages
    })
  }, [])

  // 清空所有图片
  const clearAllImages = useCallback(() => {
    setUploadedImages([])
    setSelectedLayout(null)
  }, [])

  // 替换图片
  const replaceImage = useCallback(async (index: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        setIsUploading(true)
        setUploadProgress(0)

        try {
          const reader = new FileReader()
          reader.onload = (event) => {
            const newImage: UploadedImage = {
              id: Math.random().toString(36).substr(2, 9),
              file,
              src: event.target?.result as string,
              name: file.name
            }

            setUploadedImages(prev => {
              const newImages = [...prev]
              newImages[index] = newImage
              return newImages
            })

            setUploadProgress(100)
            setTimeout(() => {
              setIsUploading(false)
              setUploadProgress(0)
            }, 500)
          }
          reader.onerror = () => {
            alert('读取文件失败，请重试')
            setIsUploading(false)
            setUploadProgress(0)
          }
          reader.readAsDataURL(file)
        } catch (error) {
          console.error('替换图片时出错:', error)
          alert('替换图片时出错，请重试')
          setIsUploading(false)
          setUploadProgress(0)
        }
      }
    }
    input.click()
  }, [])

  // 拖拽开始
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
  }, [])

  // 拖拽悬停
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  // 拖拽放置
  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) return

    setUploadedImages(prev => {
      const newImages = [...prev]
      const draggedImage = newImages[draggedIndex]
      newImages.splice(draggedIndex, 1)
      newImages.splice(dropIndex, 0, draggedImage)
      return newImages
    })
    setDraggedIndex(null)
  }, [draggedIndex])

  // 生成拼接图片
  const generateCollage = useCallback(async () => {
    if (!selectedLayout || uploadedImages.length === 0 || !selectedAspectRatio) {
      alert('请完成所有设置步骤')
      return
    }

    if (uploadedImages.length !== selectedLayout.imageCount) {
      alert(`当前布局需要 ${selectedLayout.imageCount} 张图片，您有 ${uploadedImages.length} 张`)
      return
    }

    setIsGenerating(true)

    try {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // 根据选择的比例计算画布尺寸
      const baseSize = 1200 // 基础尺寸
      let canvasWidth: number, canvasHeight: number

      if (selectedAspectRatio.ratio >= 1) {
        // 横向或正方形
        canvasWidth = baseSize
        canvasHeight = baseSize / selectedAspectRatio.ratio
      } else {
        // 竖向
        canvasHeight = baseSize
        canvasWidth = baseSize * selectedAspectRatio.ratio
      }

      canvas.width = canvasWidth
      canvas.height = canvasHeight

      // 计算每个图片单元格的尺寸
      const gap = hasGap ? gapSize[0] : 0
      const totalGapWidth = (selectedLayout.gridCols - 1) * gap
      const totalGapHeight = (selectedLayout.gridRows - 1) * gap
      const cellWidth = (canvasWidth - totalGapWidth) / selectedLayout.gridCols
      const cellHeight = (canvasHeight - totalGapHeight) / selectedLayout.gridRows

      // 清空画布
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // 绘制图片
      const drawPromises = uploadedImages.slice(0, selectedLayout.imageCount).map((imageData, index) => {
        return new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => {
            const row = Math.floor(index / selectedLayout.gridCols)
            const col = index % selectedLayout.gridCols
            const x = col * (cellWidth + gap)
            const y = row * (cellHeight + gap)

            // 计算图片和单元格的宽高比
            const imgAspectRatio = img.width / img.height
            const cellAspectRatio = cellWidth / cellHeight

            let sx: number, sy: number, sWidth: number, sHeight: number
            let dx: number, dy: number, dWidth: number, dHeight: number

            // 目标绘制区域
            dx = x
            dy = y
            dWidth = cellWidth
            dHeight = cellHeight

            // 计算源图片裁剪区域，以覆盖目标区域
            if (imgAspectRatio > cellAspectRatio) {
              // 图片比单元格宽，按高度缩放，裁剪左右
              sHeight = img.height
              sWidth = img.height * cellAspectRatio
              sx = (img.width - sWidth) / 2
              sy = 0
            } else {
              // 图片比单元格高，按宽度缩放，裁剪上下
              sWidth = img.width
              sHeight = img.width / cellAspectRatio
              sx = 0
              sy = (img.height - sHeight) / 2
            }

            ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
            resolve()
          }
          img.onerror = () => {
            console.error('绘制图片失败:', imageData.file?.name)
            resolve()
          }
          img.src = imageData.src
        })
      })

      await Promise.all(drawPromises)

      // 下载图片
      const link = document.createElement('a')
      link.download = `collage-${selectedLayout.id}-${selectedAspectRatio.id}-${hasGap ? 'gap' + gapSize[0] : 'nogap'}-${Date.now()}.png`
      link.href = canvas.toDataURL()
      link.click()

    } catch (error) {
      console.error('生成拼接图片失败:', error)
      alert('生成拼接图片失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }, [uploadedImages, selectedLayout, selectedAspectRatio, hasGap, gapSize])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">图片拼接工具</h1>
          <p className="text-gray-600">上传图片，选择布局，设置比例，生成拼接图</p>
          <div className="mt-2">
            <Badge variant="outline" className="text-sm">
              支持 2-18 张图片拼接
            </Badge>
          </div>
        </div>

        {/* 步骤节点 - 只显示未完成的步骤 */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4 md:space-x-8">
            {steps.filter(step => !step.completed).map((step, index, filteredSteps) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                    step.active
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-gray-200 border-gray-300 text-gray-500'
                  }`}>
                    <span className="text-sm font-bold">{index + 1}</span>
                  </div>
                  <div className="mt-2 text-center">
                    <p className={`text-sm font-medium ${
                      step.active ? 'text-gray-800' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 max-w-20">
                      {step.description}
                    </p>
                  </div>
                </div>
                {index < filteredSteps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${
                    step.active ? 'bg-blue-300' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 根据当前步骤显示不同内容 */}
        {uploadedImages.length === 0 ? (
          /* 步骤1：图片上传 */
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-center">
                <Upload className="w-5 h-5" />
                上传图片开始拼接
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-gray-400 transition-colors ${
                  isUploading ? 'pointer-events-none opacity-50' : ''
                }`}
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg text-gray-600 mb-2">
                  {isUploading ? '正在处理图片...' : '点击选择图片或拖拽到此处'}
                </p>
                <p className="text-sm text-gray-500">
                  支持 JPG、PNG 格式，可选择多张图片
                </p>
                {isUploading && (
                  <div className="mt-6">
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-xs text-gray-500 mt-2">
                      处理进度: {Math.round(uploadProgress)}%
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
                aria-label="选择图片文件"
              />
            </CardContent>
          </Card>
        ) : selectedLayout === null ? (
          /* 步骤2：选择布局 */
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 justify-center">
                  <Grid className="w-5 h-5" />
                  选择布局方式
                  <Badge variant="outline">
                    {uploadedImages.length} 张图片
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {availableLayouts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {availableLayouts.map((layout) => (
                      <div
                        key={layout.id}
                        className="p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-300 hover:shadow-md"
                        onClick={() => setSelectedLayout(layout)}
                      >
                        <div className="text-center">
                          <div className="w-16 h-12 mx-auto mb-2 border-2 border-gray-300 rounded grid"
                            style={{
                              gridTemplateColumns: `repeat(${layout.gridCols}, 1fr)`,
                              gridTemplateRows: `repeat(${layout.gridRows}, 1fr)`,
                              gap: '1px'
                            }}>
                            {Array.from({ length: layout.imageCount }).map((_, i) => (
                              <div key={i} className="bg-gray-200 rounded-sm" />
                            ))}
                          </div>
                          <h3 className="font-medium text-sm">{layout.name}</h3>
                          <p className="text-xs text-gray-500">{layout.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    没有适合 {uploadedImages.length} 张图片的布局
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 已上传图片预览 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  已上传图片
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllImages}
                    className="text-red-600 hover:text-red-700 ml-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    重新上传
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {uploadedImages.map((image, index) => (
                    <div
                      key={image.id}
                      className="relative group cursor-move"
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                    >
                      <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 group-hover:border-blue-300 transition-colors">
                        <img
                          src={image.src}
                          alt={image.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-6 h-6 p-0"
                          onClick={() => removeImage(image.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-6 h-6 p-0"
                          onClick={() => replaceImage(index)}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate text-center">{index + 1}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* 步骤3和4：设置和预览 */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：设置区域 */}
            <div className="space-y-6">
              {/* 布局信息 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    已选择布局
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedLayout(null)}
                      className="ml-auto"
                    >
                      重新选择
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-12 border-2 border-gray-300 rounded grid"
                      style={{
                        gridTemplateColumns: `repeat(${selectedLayout.gridCols}, 1fr)`,
                        gridTemplateRows: `repeat(${selectedLayout.gridRows}, 1fr)`,
                        gap: '1px'
                      }}>
                      {Array.from({ length: selectedLayout.imageCount }).map((_, i) => (
                        <div key={i} className="bg-blue-200 rounded-sm" />
                      ))}
                    </div>
                    <div>
                      <h3 className="font-medium">{selectedLayout.name}</h3>
                      <p className="text-sm text-gray-500">{selectedLayout.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 输出设置 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    输出设置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="aspect-ratio" className="text-sm font-medium">
                      输出比例
                    </Label>
                    <Select
                      value={selectedAspectRatio.id}
                      onValueChange={(value) => {
                        const ratio = ASPECT_RATIOS.find(r => r.id === value)
                        if (ratio) setSelectedAspectRatio(ratio)
                      }}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASPECT_RATIOS.map((ratio) => (
                          <SelectItem key={ratio.id} value={ratio.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{ratio.name}</span>
                              <span className="text-xs text-gray-500 ml-2">{ratio.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="gap-toggle"
                      checked={hasGap}
                      onCheckedChange={setHasGap}
                    />
                    <Label htmlFor="gap-toggle" className="text-sm">
                      图片间隙
                    </Label>
                  </div>

                  {hasGap && (
                    <div>
                      <Label className="text-sm text-gray-600">
                        间隙大小: {gapSize[0]}px
                      </Label>
                      <Slider
                        value={gapSize}
                        onValueChange={setGapSize}
                        max={20}
                        min={1}
                        step={1}
                        className="mt-2"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 图片顺序调整 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowUpDown className="w-5 h-5" />
                    调整图片顺序
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {uploadedImages.map((image, index) => (
                      <div
                        key={image.id}
                        className="relative group cursor-move"
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 group-hover:border-blue-300 transition-colors">
                          <img
                            src={image.src}
                            alt={image.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-6 h-6 p-0"
                            onClick={() => replaceImage(index)}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    拖拽图片可调整顺序
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 右侧：预览和生成 */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>实时预览</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* 预览区域 */}
                    <div
                      className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white"
                      style={{
                        aspectRatio: selectedAspectRatio.ratio,
                        maxHeight: '400px'
                      }}
                    >
                      <div
                        className="w-full h-full grid"
                        style={{
                          gridTemplateColumns: `repeat(${selectedLayout.gridCols}, 1fr)`,
                          gridTemplateRows: `repeat(${selectedLayout.gridRows}, 1fr)`,
                          gap: hasGap ? `${gapSize[0]}px` : '0'
                        }}
                      >
                        {Array.from({ length: selectedLayout.imageCount }).map((_, index) => {
                          const image = uploadedImages[index]
                          return (
                            <div key={index} className="bg-gray-100 flex items-center justify-center overflow-hidden relative">
                              {image ? (
                                <img
                                  src={image.src}
                                  alt={image.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="w-8 h-8 text-gray-400" />
                              )}
                              <div className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs rounded px-1">
                                {index + 1}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="text-center space-y-2">
                      <p className="text-sm text-gray-600">
                        输出比例: {selectedAspectRatio.name} ({selectedAspectRatio.description})
                      </p>
                      <p className="text-xs text-gray-500">
                        {hasGap ? `间隙: ${gapSize[0]}px` : '无间隙'}
                      </p>
                    </div>

                    {/* 生成按钮 */}
                    <Button
                      onClick={generateCollage}
                      disabled={isGenerating || uploadedImages.length !== selectedLayout.imageCount}
                      className="w-full"
                      size="lg"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          生成并下载拼接图
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* 隐藏的画布 */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}


export default ImageCollage
