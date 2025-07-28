import { View, Text, Image, ScrollView, Canvas } from '@tarojs/components'
import { useLoad, chooseImage, showToast, navigateBack, createCanvasContext, canvasToTempFilePath, getSystemInfoSync } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { AtButton, AtIcon, AtSlider, AtSwitch, AtBadge, AtActionSheet, AtActionSheetItem } from 'taro-ui'
import './index.less'

// 定义类型
interface ImageType {
  id: string;
  file: any;
  path: string;
  width?: number;
  height?: number;
}

interface WatermarkPosition {
  id: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export default function Watermark() {
  // 水印功能相关状态
  const [images, setImages] = useState<ImageType[]>([])
  const [currentImg, setCurrentImg] = useState<ImageType | null>(null)
  const [watermarkUrl, setWatermarkUrl] = useState('/assets/logo.png')
  const [watermarkPositions, setWatermarkPositions] = useState<WatermarkPosition[]>([])
  const [watermarkBlur, setWatermarkBlur] = useState(true)
  const [imageUploaderVisible, setImageUploaderVisible] = useState(true)
  const [watermarkView, setWatermarkView] = useState<'editor' | 'gallery'>('gallery')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  // 新增状态
  const [canvasSize, setCanvasSize] = useState({ width: 375, height: 500 })
  const [backgroundScale, setBackgroundScale] = useState(1)
  const [showGuideLines, setShowGuideLines] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [actionSheetVisible, setActionSheetVisible] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const canvasRef = useRef<any>(null)

  useLoad(() => {
    console.log('Watermark page loaded.')
    // 获取系统信息设置画布大小
    const systemInfo = getSystemInfoSync()
    setCanvasSize({
      width: systemInfo.windowWidth,
      height: systemInfo.windowHeight * 0.6
    })
  })

  // 处理图片上传
  const handleImagesUpload = async () => {
    try {
      const res = await chooseImage({
        count: 9,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera']
      })

      const newImages = res.tempFiles.map((file, index) => ({
        id: `img_${Date.now()}_${index}`,
        file: file,
        path: file.path,
        width: file.width || 0,
        height: file.height || 0
      }))

      setImages(prev => {
        if (prev.length === 0) {
          setCurrentImg(newImages[0])
          setImageUploaderVisible(false)
          setCurrentImageIndex(0)

          // 初始化水印位置
          setWatermarkPositions(
            newImages.map(img => ({
              id: img.id,
              x: 0.4,
              y: 0.4,
              scaleX: 0.2,
              scaleY: 0.2,
              rotation: 0
            }))
          )

          return newImages
        } else {
          const combinedImages = [...prev, ...newImages]

          // 为新上传的图片初始化水印位置
          const newPositions = newImages.map(img => ({
            id: img.id,
            x: 0.4,
            y: 0.4,
            scaleX: 0.2,
            scaleY: 0.2,
            rotation: 0
          }))

          setWatermarkPositions(prevPositions => [...prevPositions, ...newPositions])

          return combinedImages
        }
      })
    } catch (error) {
      console.error('选择图片失败', error)
    }
  }

  // 处理水印上传
  const handleWatermarkUpload = async () => {
    try {
      const res = await chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera']
      })

      setWatermarkUrl(res.tempFilePaths[0])
    } catch (error) {
      console.error('选择水印失败', error)
    }
  }

  // 处理水印位置变化
  const handleWatermarkTransform = (imageId: string, position: Partial<WatermarkPosition>) => {
    setWatermarkPositions(prev =>
      prev.map(pos => pos.id === imageId ? { ...pos, ...position } : pos)
    )
  }

  // 处理所有水印位置变化
  const handleAllWatermarkTransform = (position: Partial<WatermarkPosition>) => {
    setWatermarkPositions(prev =>
      prev.map(img => ({ ...img, ...position }))
    )
  }

  // 处理图片点击
  const handleImageClick = (image: ImageType, index: number) => {
    setCurrentImg(image)
    setCurrentImageIndex(index)
    setWatermarkView('editor')
  }

  // 处理图片删除
  const handleDeleteImage = (id: string) => {
    const newImages = images.filter(img => img.id !== id)
    setImages(newImages)
    setWatermarkPositions(prev => prev.filter(pos => pos.id !== id))

    if (newImages.length === 0) {
      setImageUploaderVisible(true)
      setCurrentImg(null)
    } else if (id === currentImg?.id) {
      const newIndex = Math.min(currentImageIndex, newImages.length - 1)
      setCurrentImg(newImages[newIndex])
      setCurrentImageIndex(newIndex)
    }
  }

  // 处理水印应用
  const handleApplyWatermark = async () => {
    if (!currentImg) return

    setLoading(true)
    setProgress(0)

    try {
      // 创建画布上下文
      const ctx = createCanvasContext('watermark-canvas', this)
      const position = watermarkPositions.find(pos => pos.id === currentImg.id)

      if (!position) return

      // 绘制背景图片
      ctx.drawImage(currentImg.path, 0, 0, canvasSize.width, canvasSize.height)

      // 计算水印位置和大小
      const watermarkWidth = canvasSize.width * position.scaleX
      const watermarkHeight = canvasSize.height * position.scaleY
      const watermarkX = canvasSize.width * position.x
      const watermarkY = canvasSize.height * position.y

      // 绘制水印
      ctx.save()
      ctx.translate(watermarkX + watermarkWidth / 2, watermarkY + watermarkHeight / 2)
      ctx.rotate(position.rotation * Math.PI / 180)
      ctx.drawImage(watermarkUrl, -watermarkWidth / 2, -watermarkHeight / 2, watermarkWidth, watermarkHeight)
      ctx.restore()

      ctx.draw(false, () => {
        // 导出图片
        canvasToTempFilePath({
          canvasId: 'watermark-canvas',
          success: (res) => {
            setProgress(100)
            setLoading(false)
            showToast({
              title: '水印添加成功',
              icon: 'success'
            })
            console.log('生成的图片路径:', res.tempFilePath)
          },
          fail: (err) => {
            setLoading(false)
            showToast({
              title: '生成失败',
              icon: 'error'
            })
            console.error('生成失败:', err)
          }
        })
      })

    } catch (error) {
      setLoading(false)
      showToast({
        title: '处理失败',
        icon: 'error'
      })
      console.error('处理失败:', error)
    }
  }

  // 处理触摸开始
  const handleTouchStart = (e) => {
    if (!currentImg) return

    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({
      x: touch.clientX,
      y: touch.clientY
    })
  }

  // 处理触摸移动
  const handleTouchMove = (e) => {
    if (!isDragging || !currentImg) return

    const touch = e.touches[0]
    const deltaX = touch.clientX - dragStart.x
    const deltaY = touch.clientY - dragStart.y

    const position = watermarkPositions.find(pos => pos.id === currentImg.id)
    if (!position) return

    const newX = Math.max(0, Math.min(1 - position.scaleX, position.x + deltaX / canvasSize.width))
    const newY = Math.max(0, Math.min(1 - position.scaleY, position.y + deltaY / canvasSize.height))

    handleWatermarkTransform(currentImg.id, { x: newX, y: newY })

    setDragStart({
      x: touch.clientX,
      y: touch.clientY
    })
  }

  // 处理触摸结束
  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // 切换到上一张图片
  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      const newIndex = currentImageIndex - 1
      setCurrentImg(images[newIndex])
      setCurrentImageIndex(newIndex)
    }
  }

  // 切换到下一张图片
  const handleNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      const newIndex = currentImageIndex + 1
      setCurrentImg(images[newIndex])
      setCurrentImageIndex(newIndex)
    }
  }

  // 返回首页
  const handleBackToHome = () => {
    navigateBack()
  }

  // 渲染水印编辑器视图
  const renderWatermarkEditor = () => {
    if (!currentImg) return null

    const position = watermarkPositions.find(pos => pos.id === currentImg.id)
    if (!position) return null

    return (
      <View className='watermark-editor'>
        <View className='editor-header'>
          <View className='editor-title'>水印编辑</View>
          <View className='editor-controls'>
            <AtIcon
              value='chevron-left'
              size='24'
              color={currentImageIndex > 0 ? '#333' : '#ccc'}
              onClick={handlePrevImage}
            />
            <Text className='image-counter'>{currentImageIndex + 1} / {images.length}</Text>
            <AtIcon
              value='chevron-right'
              size='24'
              color={currentImageIndex < images.length - 1 ? '#333' : '#ccc'}
              onClick={handleNextImage}
            />
          </View>
          <View className='editor-actions'>
            <AtIcon
              value='settings'
              size='20'
              color='#333'
              onClick={() => setActionSheetVisible(true)}
            />
          </View>
        </View>

        <View className='editor-canvas-container'>
          <View
            className='editor-canvas'
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Image
              src={currentImg.path}
              mode='aspectFit'
              className='background-image'
            />

            {/* 辅助线 */}
            {showGuideLines && (
              <View className='guide-lines'>
                <View className='guide-line horizontal' style={{ top: '25%' }} />
                <View className='guide-line horizontal' style={{ top: '50%' }} />
                <View className='guide-line horizontal' style={{ top: '75%' }} />
                <View className='guide-line vertical' style={{ left: '25%' }} />
                <View className='guide-line vertical' style={{ left: '50%' }} />
                <View className='guide-line vertical' style={{ left: '75%' }} />
              </View>
            )}

            {/* 水印 */}
            <View
              className='watermark-overlay'
              style={{
                left: `${position.x * 100}%`,
                top: `${position.y * 100}%`,
                width: `${position.scaleX * 100}%`,
                height: `${position.scaleY * 100}%`,
                transform: `rotate(${position.rotation}deg)`
              }}
            >
              <Image
                src={watermarkUrl}
                mode='aspectFit'
                className='watermark-image'
              />
            </View>
          </View>

          {/* 隐藏的画布用于生成最终图片 */}
          <Canvas
            canvasId='watermark-canvas'
            className='hidden-canvas'
            style={{
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
              position: 'absolute',
              left: '-9999px'
            }}
          />
        </View>

        <View className='editor-controls'>
          <View className='control-group'>
            <View className='control-item'>
              <Text className='control-label'>缩放</Text>
              <AtSlider
                value={position.scaleX * 100}
                min={5}
                max={50}
                onChange={(value) => {
                  const scale = value / 100
                  handleWatermarkTransform(currentImg.id, { scaleX: scale, scaleY: scale })
                }}
              />
            </View>

            <View className='control-item'>
              <Text className='control-label'>旋转</Text>
              <AtSlider
                value={position.rotation}
                min={0}
                max={360}
                onChange={(value) => {
                  handleWatermarkTransform(currentImg.id, { rotation: value })
                }}
              />
            </View>

            <View className='control-item'>
              <Text className='control-label'>水平位置</Text>
              <AtSlider
                value={position.x * 100}
                min={0}
                max={100 - position.scaleX * 100}
                onChange={(value) => {
                  handleWatermarkTransform(currentImg.id, { x: value / 100 })
                }}
              />
            </View>

            <View className='control-item'>
              <Text className='control-label'>垂直位置</Text>
              <AtSlider
                value={position.y * 100}
                min={0}
                max={100 - position.scaleY * 100}
                onChange={(value) => {
                  handleWatermarkTransform(currentImg.id, { y: value / 100 })
                }}
              />
            </View>
          </View>

          <View className='quick-actions'>
            <AtButton
              size='small'
              onClick={() => {
                handleWatermarkTransform(currentImg.id, { x: 0.05, y: 0.05 })
              }}
            >
              左上
            </AtButton>
            <AtButton
              size='small'
              onClick={() => {
                handleWatermarkTransform(currentImg.id, { x: 0.95 - position.scaleX, y: 0.05 })
              }}
            >
              右上
            </AtButton>
            <AtButton
              size='small'
              onClick={() => {
                handleWatermarkTransform(currentImg.id, { x: 0.05, y: 0.95 - position.scaleY })
              }}
            >
              左下
            </AtButton>
            <AtButton
              size='small'
              onClick={() => {
                handleWatermarkTransform(currentImg.id, { x: 0.95 - position.scaleX, y: 0.95 - position.scaleY })
              }}
            >
              右下
            </AtButton>
            <AtButton
              size='small'
              onClick={() => {
                handleWatermarkTransform(currentImg.id, { x: 0.5 - position.scaleX / 2, y: 0.5 - position.scaleY / 2 })
              }}
            >
              居中
            </AtButton>
          </View>
        </View>
      </View>
    )
  }

  // 渲染图片库视图
  const renderImageGallery = () => {
    return (
      <View className='image-gallery'>
        <View className='gallery-header'>
          <AtBadge value={images.length}>
            <Text className='gallery-title'>背景图片</Text>
          </AtBadge>
          <View className='gallery-actions'>
            <AtButton
              size='small'
              onClick={() => {
                setImages([])
                setWatermarkPositions([])
                setImageUploaderVisible(true)
                setCurrentImg(null)
              }}
            >
              清空
            </AtButton>
            <AtButton
              size='small'
              type='primary'
              onClick={handleImagesUpload}
            >
              添加
            </AtButton>
          </View>
        </View>

        <ScrollView scrollY className='gallery-grid'>
          {images.length > 0 ? (
            <View className='grid-container'>
              {images.map((image, index) => (
                <View
                  key={image.id}
                  className={`grid-item ${currentImg?.id === image.id ? 'active' : ''}`}
                  onClick={() => handleImageClick(image, index)}
                >
                  <Image
                    src={image.path}
                    mode='aspectFill'
                    className='grid-image'
                  />
                  <View className='grid-item-overlay'>
                    <Text className='grid-item-index'>{index + 1}</Text>
                  </View>
                  <View className='grid-item-actions'>
                    <AtIcon
                      value='trash'
                      size='20'
                      color='#fff'
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteImage(image.id)
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className='empty-gallery'>
              <AtIcon value='image' size='48' color='#ccc' />
              <Text className='empty-text'>请添加背景图片</Text>
            </View>
          )}
        </ScrollView>
      </View>
    )
  }

  // 渲染水印功能页面
  const renderWatermarkPage = () => {
    if (imageUploaderVisible) {
      return (
        <View className='watermark-uploader'>
          <View className='uploader-content'>
            <AtIcon value='image' size='64' color='#ccc' />
            <Text className='uploader-title'>添加背景图片</Text>
            <Text className='uploader-desc'>支持批量上传，最多9张</Text>
            <AtButton type='primary' onClick={handleImagesUpload}>
              选择图片
            </AtButton>
          </View>
        </View>
      )
    }

    return (
      <View className='watermark-container'>
        <View className='watermark-header'>
          <View className='header-left'>
            <AtIcon value='chevron-left' size='24' color='#333' onClick={handleBackToHome} />
            <Text className='watermark-title'>
              {watermarkView === 'editor' ? '水印编辑' : '图片库'}
            </Text>
          </View>
          <AtButton
            size='small'
            onClick={() => setWatermarkView(watermarkView === 'editor' ? 'gallery' : 'editor')}
          >
            {watermarkView === 'editor' ? '图片库' : '编辑器'}
          </AtButton>
        </View>

        <View className='watermark-content'>
          {watermarkView === 'editor' ? renderWatermarkEditor() : renderImageGallery()}
        </View>

        <View className='watermark-footer'>
          <View className='watermark-settings'>
            <View className='watermark-logo' onClick={handleWatermarkUpload}>
              <Image src={watermarkUrl} mode='aspectFit' className='logo-image' />
              <Text className='logo-label'>更换水印</Text>
            </View>

            <View className='watermark-option'>
              <Text className='option-label'>显示辅助线</Text>
              <AtSwitch
                checked={showGuideLines}
                onChange={value => setShowGuideLines(value)}
              />
            </View>

            <View className='watermark-option'>
              <Text className='option-label'>模糊效果</Text>
              <AtSwitch
                checked={watermarkBlur}
                onChange={value => setWatermarkBlur(value)}
              />
            </View>
          </View>

          <AtButton
            type='primary'
            loading={loading}
            onClick={handleApplyWatermark}
            className='apply-button'
            disabled={!currentImg}
          >
            {loading ? `处理中: ${progress}%` : '生成水印图片'}
          </AtButton>
        </View>

        {/* 操作菜单 */}
        <AtActionSheet
          isOpened={actionSheetVisible}
          cancelText='取消'
          onCancel={() => setActionSheetVisible(false)}
          onClose={() => setActionSheetVisible(false)}
        >
          <AtActionSheetItem
            onClick={() => {
              // 应用当前设置到所有图片
              if (currentImg) {
                const currentPosition = watermarkPositions.find(pos => pos.id === currentImg.id)
                if (currentPosition) {
                  handleAllWatermarkTransform({
                    x: currentPosition.x,
                    y: currentPosition.y,
                    scaleX: currentPosition.scaleX,
                    scaleY: currentPosition.scaleY,
                    rotation: currentPosition.rotation
                  })
                }
              }
              setActionSheetVisible(false)
            }}
          >
            应用到所有图片
          </AtActionSheetItem>
          <AtActionSheetItem
            onClick={() => {
              // 重置当前图片水印
              if (currentImg) {
                handleWatermarkTransform(currentImg.id, {
                  x: 0.4,
                  y: 0.4,
                  scaleX: 0.2,
                  scaleY: 0.2,
                  rotation: 0
                })
              }
              setActionSheetVisible(false)
            }}
          >
            重置当前水印
          </AtActionSheetItem>
        </AtActionSheet>
      </View>
    )
  }

  return (
    <View className='watermark-page'>
      {renderWatermarkPage()}
    </View>
  )
}
