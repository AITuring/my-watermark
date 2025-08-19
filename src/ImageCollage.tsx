import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Upload, Download, Grid, Image as ImageIcon, Trash2, ArrowUpDown, RotateCcw } from 'lucide-react'

// 扩展的布局配置，支持2到18张图片
const LAYOUTS = [
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
  const [selectedLayout, setSelectedLayout] = useState(LAYOUTS[0])
  const [uploadedImages, setUploadedImages] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [draggedIndex, setDraggedIndex] = useState(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)

  // 处理文件上传
  const handleFileUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files)
    const maxFiles = selectedLayout.imageCount

    // 如果选择的图片数量超过当前布局需要的数量，只取前N张
    const filesToProcess = files.slice(0, maxFiles)

    if (files.length > maxFiles) {
      alert(`当前布局需要 ${maxFiles} 张图片，已自动选择前 ${maxFiles} 张`)
    }

    if (filesToProcess.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const imagePromises = filesToProcess.map(async (file, index) => {
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            // 更新进度
            const progress = ((index + 1) / filesToProcess.length) * 100
            setUploadProgress(progress)

            resolve({
              id: Math.random().toString(36).substr(2, 9),
              file,
              src: e.target.result,
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
      const validImages = images.filter(img => img !== null)

      setUploadedImages(prev => {
        const newImages = [...prev, ...validImages]
        return newImages.slice(0, maxFiles)
      })

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
  }, [selectedLayout.imageCount])

  // 删除图片
  const removeImage = useCallback((imageId) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId))
  }, [])

  // 清空所有图片
  const clearAllImages = useCallback(() => {
    setUploadedImages([])
  }, [])

  // 替换图片
  const replaceImage = useCallback(async (index) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (file) {
        setIsUploading(true)
        setUploadProgress(0)

        try {
          const reader = new FileReader()
          reader.onload = (event) => {
            const newImage = {
              id: Math.random().toString(36).substr(2, 9),
              file,
              src: event.target.result,
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
  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
  }, [])

  // 拖拽悬停
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  // 拖拽放置
  const handleDrop = useCallback((e, dropIndex) => {
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
    if (uploadedImages.length === 0) {
      alert('请先上传图片')
      return
    }

    if (uploadedImages.length < selectedLayout.imageCount) {
      alert(`当前布局需要 ${selectedLayout.imageCount} 张图片，您只上传了 ${uploadedImages.length} 张`)
      return
    }

    setIsGenerating(true)

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      // 设置画布尺寸
      const cellSize = 300 // 每个单元格的尺寸
      const canvasWidth = selectedLayout.gridCols * cellSize
      const canvasHeight = selectedLayout.gridRows * cellSize

      canvas.width = canvasWidth
      canvas.height = canvasHeight

      // 清空画布
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // 绘制图片
      const drawPromises = uploadedImages.slice(0, selectedLayout.imageCount).map((imageData, index) => {
        return new Promise((resolve) => {
          const img = new Image()
          img.onload = () => {
            const row = Math.floor(index / selectedLayout.gridCols)
            const col = index % selectedLayout.gridCols
            const x = col * cellSize
            const y = row * cellSize

            // 计算图片和单元格的宽高比
            const imgAspectRatio = img.width / img.height
            const cellAspectRatio = cellSize / cellSize // 单元格是正方形，宽高比为1

            let sx, sy, sWidth, sHeight; // source coordinates and dimensions
            let dx, dy, dWidth, dHeight; // destination coordinates and dimensions

            // 目标绘制区域始终是整个单元格
            dx = x;
            dy = y;
            dWidth = cellSize;
            dHeight = cellSize;

            // 计算源图片裁剪区域，以覆盖目标区域
            if (imgAspectRatio > cellAspectRatio) {
              // 图片比单元格宽，按高度缩放，裁剪左右
              sHeight = img.height;
              sWidth = img.height * cellAspectRatio;
              sx = (img.width - sWidth) / 2;
              sy = 0;
            } else {
              // 图片比单元格高，按宽度缩放，裁剪上下
              sWidth = img.width;
              sHeight = img.width / cellAspectRatio;
              sx = 0;
              sy = (img.height - sHeight) / 2;
            }

            ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
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
      link.download = `collage-${selectedLayout.id}-${Date.now()}.png`
      link.href = canvas.toDataURL()
      link.click()

    } catch (error) {
      console.error('生成拼接图片失败:', error)
      alert('生成拼接图片失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }, [uploadedImages, selectedLayout])

  // 按图片数量分组布局
  const groupedLayouts = LAYOUTS.reduce((acc, layout) => {
    const count = layout.imageCount
    if (!acc[count]) acc[count] = []
    acc[count].push(layout)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">图片拼接工具</h1>
          <p className="text-gray-600">选择布局，上传图片，拖拽排序，一键生成拼接图</p>
          <div className="mt-2">
            <Badge variant="outline" className="text-sm">
              支持 2-18 张图片拼接
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* 左侧：布局选择和图片上传 */}
          <div className="space-y-6">
            {/* 布局选择 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Grid className="w-5 h-5" />
                  选择布局
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {Object.entries(groupedLayouts).map(([count, layouts]) => (
                    <div key={count}>
                      <h4 className="font-medium text-sm text-gray-700 mb-2">
                        {count} 张图片
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                        {layouts.map((layout) => (
                          <div
                            key={layout.id}
                            className={`p-3 border-2 rounded-lg cursor-pointer transition-all text-sm ${
                              selectedLayout.id === layout.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => {
                              setSelectedLayout(layout)
                              setUploadedImages([])
                            }}
                          >
                            <div className="font-medium">{layout.name}</div>
                            <div className="text-xs text-gray-500 mt-1">{layout.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 图片上传 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  上传图片
                  <Badge variant="outline">
                    {uploadedImages.length}/{selectedLayout.imageCount}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div
                    className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors ${
                      isUploading ? 'pointer-events-none opacity-50' : ''
                    }`}
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                  >
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">
                      {isUploading ? '正在处理图片...' : '点击选择图片'}
                    </p>
                    <p className="text-sm text-gray-500">
                      支持 JPG、PNG 格式，需要 {selectedLayout.imageCount} 张图片
                    </p>
                    {isUploading && (
                      <div className="mt-4">
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
                  />

                  {uploadedImages.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        已上传 {uploadedImages.length} 张图片
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllImages}
                        className="text-red-600 hover:text-red-700"
                        disabled={isUploading}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        清空
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 生成按钮 */}
            <Button
              onClick={generateCollage}
              disabled={uploadedImages.length < selectedLayout.imageCount || isGenerating || isUploading}
              className="w-full h-12 text-lg"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  生成中...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  生成并下载拼接图
                </>
              )}
            </Button>
          </div>

          {/* 右侧：图片预览和排序 */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  图片预览和排序
                  {uploadedImages.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      <ArrowUpDown className="w-3 h-3 mr-1" />
                      可拖拽排序
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {uploadedImages.length > 0 ? (
                  <div className="space-y-4">
                    <div
                      className="grid gap-2 p-4 bg-gray-50 rounded-lg"
                      style={{
                        gridTemplateColumns: `repeat(${selectedLayout.gridCols}, 1fr)`,
                        aspectRatio: selectedLayout.aspectRatio
                      }}
                    >
                      {Array.from({ length: selectedLayout.imageCount }).map((_, index) => {
                        const image = uploadedImages[index]

                        return (
                          <div
                            key={index}
                            className={`relative border-2 rounded-lg overflow-hidden aspect-square group ${
                              image ? 'cursor-move border-solid border-blue-300 bg-white' : 'border-dashed border-gray-300 bg-gray-100'
                            } ${draggedIndex === index ? 'opacity-50' : ''}`}
                            draggable={!!image && !isUploading}
                            onDragStart={(e) => image && !isUploading && handleDragStart(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index)}
                          >
                            {image ? (
                              <>
                                {/* 使用最简单的图片显示方式 */}
                                <div
                                  className="w-full h-full bg-cover bg-center bg-no-repeat"
                                  style={{
                                    backgroundImage: `url(${image.src})`,
                                    backgroundColor: '#f3f4f6'
                                  }}
                                />

                                {/* 悬停操作按钮 */}
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                                    <button
                                      onClick={() => !isUploading && replaceImage(index)}
                                      className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs hover:bg-blue-600 disabled:opacity-50"
                                      title="替换图片"
                                      disabled={isUploading}
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => !isUploading && removeImage(image.id)}
                                      className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs hover:bg-red-600 disabled:opacity-50"
                                      title="删除图片"
                                      disabled={isUploading}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* 序号标识 */}
                                <div className="absolute top-2 left-2 bg-blue-500 text-white text-sm px-2 py-1 rounded-full font-medium shadow-lg">
                                  {index + 1}
                                </div>

                                {/* 文件名显示 */}
                                <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded truncate">
                                  {image.name}
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                  <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                                  <div className="text-sm font-medium">位置 {index + 1}</div>
                                  <div className="text-xs">等待上传</div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="text-sm text-gray-600 text-center space-y-1">
                      {uploadedImages.length < selectedLayout.imageCount ? (
                        <p>还需要上传 {selectedLayout.imageCount - uploadedImages.length} 张图片</p>
                      ) : (
                        <p className="text-green-600 font-medium">图片已准备就绪，可以生成拼接图了！</p>
                      )}
                      <p className="text-xs text-gray-500">
                        💡 提示：可以拖拽图片调整顺序，点击图片可替换或删除
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>请先上传图片</p>
                    <p className="text-sm mt-2">当前布局需要 {selectedLayout.imageCount} 张图片</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 隐藏的画布用于生成图片 */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}

export default ImageCollage

