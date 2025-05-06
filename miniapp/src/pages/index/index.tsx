import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components'
import { useLoad, navigateTo } from '@tarojs/taro'
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
    console.log('切换标签页', index)
    setCurrentTab(index)
    // 根据选择的标签页进行跳转
    if (index === 1) {
      // 跳转到水印功能页面
      navigateTo({
        url: '/pages/watermark/index'
      })
    } else if (index === 2) {
      // 跳转到使用教程页面
      navigateTo({
        url: '/pages/tutorial/index'
      })
    } else if (index === 3) {
      // 跳转到关于我们页面
      navigateTo({
        url: '/pages/about/index'
      })
    }
  }

  return (
    <View className='index-container'>

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

      {/* 底部操作区 */}
      <View className={`action-section ${animateIn ? 'animate-in' : ''}`}>
        <View className='tabs'>
          {['功能介绍', '水印添加', '使用教程', '关于我们'].map((tab, index) => (
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
