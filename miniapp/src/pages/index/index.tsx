import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import { useEffect } from 'react'
import { AtButton } from 'taro-ui'
import './index.less'

export default function Index () {
  useLoad(() => {
    console.log('Page loaded.')
  })

  useEffect(() => {
    console.log('Component mounted.')
  }, [])

  return (
    <View className='index'>
      <Text>Hello world!</Text>
      <AtButton type='primary'>按钮文案</AtButton>
    </View>
  )
}
