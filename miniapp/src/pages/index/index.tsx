import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { AtButton, AtIcon } from 'taro-ui'
import './index.less'

export default function Index() {
  // 状态管理
  const [currentTab, setCurrentTab] = useState(0)
  const [animateIn, setAnimateIn] = useState(false)
  const [features] = useState([
    { 
      icon: 'image', 
      title: '批量添加水印', 
      desc: '一键为多张图片添加专业水印' 
    },
    { 
      icon: 'edit', 
      title: '自定义位置', 
      desc: '灵活调整水印大小和位置' 
    },
    { 
      icon: 'star', 
      title: '高清导出', 
      desc: '保持原图质量，快速处理' 
    },
    { 
      icon: 'sketch', 
      title: '多种效果', 
      desc: '支持透明度和模糊效果' 
    }
  ])

  useLoad(() => {
    console.log('Page loaded.')
  })

  useEffect(() => {
    // 页面加载后触发入场动画
    setTimeout(() => {
      setAnimateIn(true)
    }, 100)
  }, [])

  // 切换标签页
  const handleTabChange = (index) => {
    setCurrentTab(index)
  }

  return (
    <View className='index-container'>
      {/* 毛玻璃背景 */}
      <View className='glass-background'>
        <View className='glass-overlay'></View>
        <View className='glass-gradient'></View>
        <View className='floating-circles'>
          {[...Array(5)].map((_, i) => (
            <View key={i} className={`floating-circle circle-${i + 1}`}></View>
          ))}
        </View>
      </View>

      {/* 头部区域 */}
      <View className={`header ${animateIn ? 'animate-in' : ''}`}>
        <Image 
          className='logo' 
          src='/assets/logo.png' 
          mode='aspectFit'
        />
        <Text className='app-title'>水印大师</Text>
        <Text className='app-slogan'>专业的图片水印工具</Text>
      </View>

      {/* 特性展示 */}
      <View className={`features-section ${animateIn ? 'animate-in' : ''}`}>
        <Text className='section-title'>核心功能</Text>
        <View className='features-grid'>
          {features.map((feature, index) => (
            <View 
              key={index} 
              className='feature-card'
              style={{animationDelay: `${0.1 + index * 0.1}s`}}
            >
              <View className='feature-icon-wrapper'>
                <AtIcon value={feature.icon} size='28' color='#6366f1'></AtIcon>
              </View>
              <Text className='feature-title'>{feature.title}</Text>
              <Text className='feature-desc'>{feature.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 示例展示 */}
      <View className={`examples-section ${animateIn ? 'animate-in' : ''}`}>
        <Text className='section-title'>效果展示</Text>
        <Swiper
          className='examples-swiper'
          indicatorColor='#ddd'
          indicatorActiveColor='#6366f1'
          circular
          indicatorDots
          autoplay
        >
          {[1, 2, 3].map(item => (
            <SwiperItem key={item}>
              <View className='example-item'>
                <Image 
                  className='example-image' 
                  src={`/assets/example-${item}.jpg`} 
                  mode='aspectFill'
                />
              </View>
            </SwiperItem>
          ))}
        </Swiper>
      </View>

      {/* 底部操作区 */}
      <View className={`action-section ${animateIn ? 'animate-in' : ''}`}>
        <AtButton type='primary' className='start-button'>开始使用</AtButton>
        <View className='tabs'>
          {['功能介绍', '使用教程', '关于我们'].map((tab, index) => (
            <Text 
              key={index} 
              className={`tab-item ${currentTab === index ? 'active' : ''}`}
              onClick={() => handleTabChange(index)}
            >
              {tab}
            </Text>
          ))}
        </View>
      </View>
    </View>
  )
}