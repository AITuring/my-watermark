import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useLoad, chooseImage, showToast, navigateBack } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { AtButton, AtIcon, AtSlider, AtSwitch, AtBadge } from 'taro-ui'
import './index.less'

// 定义类型
interface ImageType {
  id: string;
  file: any;
  path: string;
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

  useLoad(() => {
    console.log('Watermark page loaded.')
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
        path: file.path
      }))

      setImages(prev => {
        if (prev.length === 0) {
          setCurrentImg(newImages[0])
          setImageUploaderVisible(false)

          // 初始化水印位置
          setWatermarkPositions(
            newImages.map(img => ({
              id: img.id,
              x: 50,
              y: 50,
              scaleX: 1,
              scaleY: 1,
              rotation: 0
            }))
          )

          return newImages
        } else {
          const combinedImages = [...prev, ...newImages]

          // 为新上传的图片初始化水印位置
          const newPositions = newImages.map(img => ({
            id: img.id,
            x: 50,
            y: 50,
            scaleX: 1,
            scaleY: 1,
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
  const handleWatermarkTransform = (imageId, position) => {
    setWatermarkPositions(prev =>
      prev.map(pos => pos.id === imageId ? { ...pos, ...position } : pos)
    )
  }

  // 处理所有水印位置变化
  const handleAllWatermarkTransform = (position) => {
    setWatermarkPositions(prev =>
      prev.map(img => ({ ...position, id: img.id }))
    )
  }

  // 处理图片点击
  const handleImageClick = (image: ImageType) => {
    setCurrentImg(image)
    setWatermarkView('editor')
  }

  // 处理图片删除
  const handleDeleteImage = (id: string) => {
    const newImages = images.filter(img => img.id !== id)
    setImages(newImages)

    if (newImages.length === 0) {
      setImageUploaderVisible(true)
      setCurrentImg(null)
    } else if (id === currentImg?.id) {
      setCurrentImg(newImages[0])
    }
  }

  // 处理水印应用
  const handleApplyWatermark = () => {
    setLoading(true)
    setProgress(0)

    // 模拟进度
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer)
          setLoading(false)
          showToast({
            title: '水印添加成功',
            icon: 'success'
          })
          return 100
        }
        return prev + 5
      })
    }, 100)
  }

  // 返回首页
  const handleBackToHome = () => {
    navigateBack()
  }

  // 渲染水印编辑器视图
  const renderWatermarkEditor = () => {
    if (!currentImg) return null

    const position = watermarkPositions.find(pos => pos.id === currentImg.id)

    return (
      <View className='watermark-editor'>
        <View className='editor-header'>
          <View className='editor-title'>水印编辑</View>
          <View className='editor-controls'>
            <AtIcon value='chevron-left' size='24' color='#333' onClick={() => {
              const currentIndex = images.findIndex(img => img.id === currentImg.id)
              if (currentIndex > 0) {
                setCurrentImg(images[currentIndex - 1])
              }
            }} />
            <Text className='image-counter'>{images.findIndex(img => img.id === currentImg.id) + 1} / {images.length}</Text>
            <AtIcon value='chevron-right' size='24' color='#333' onClick={() => {
              const currentIndex = images.findIndex(img => img.id === currentImg.id)
              if (currentIndex < images.length - 1) {
                setCurrentImg(images[currentIndex + 1])
              }
            }} />
          </View>
        </View>

        <View className='editor-canvas'>
          <Image
            src={currentImg.path}
            mode='aspectFit'
            className='background-image'
          />
          <View
            className='watermark-overlay'
            style={{
              left: `${position?.x || 50}px`,
              top: `${position?.y || 50}px`,
              transform: `scale(${position?.scaleX || 1}, ${position?.scaleY || 1}) rotate(${position?.rotation || 0}deg)`
            }}
          >
            <Image
              src={watermarkUrl}
              mode='aspectFit'
              className='watermark-image'
            />
          </View>
        </View>

        <View className='editor-controls'>
          <View className='control-item'>
            <Text className='control-label'>缩放</Text>
            <AtSlider
              value={position?.scaleX ? position.scaleX * 50 : 50}
              min={10}
              max={100}
              onChange={(value) => {
                const scale = value / 50
                handleWatermarkTransform(currentImg.id, { scaleX: scale, scaleY: scale })
              }}
            />
          </View>

          <View className='control-item'>
            <Text className='control-label'>旋转</Text>
            <AtSlider
              value={position?.rotation || 0}
              min={0}
              max={360}
              onChange={(value) => {
                handleWatermarkTransform(currentImg.id, { rotation: value })
              }}
            />
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
                  onClick={() => handleImageClick(image)}
                >
                  <Image
                    src={image.path}
                    mode='aspectFill'
                    className='grid-image'
                  />
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
          <AtButton type='primary' onClick={handleImagesUpload}>
            上传背景图片
          </AtButton>
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
              <Text className='logo-label'>水印</Text>
            </View>

            <View className='watermark-option'>
              <Text className='option-label'>模糊</Text>
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
          >
            {loading ? `处理中: ${progress}%` : '水印生成'}
          </AtButton>
        </View>
      </View>
    )
  }

  return (
    <View className='watermark-page'>
      {renderWatermarkPage()}
    </View>
  )
}