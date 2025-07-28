
export default defineAppConfig({
  pages: [
    'pages/index/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#667eea',
    navigationBarTitleText: '中华文物宝库',
    navigationBarTextStyle: 'white',
    backgroundColor: '#f5f5f5'
  },
  tabBar: {
    color: '#666',
    selectedColor: '#667eea',
    backgroundColor: '#fff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '文物',
        iconPath: 'assets/icon-home.png',
        selectedIconPath: 'assets/icon-home-active.png'
      }
    ]
  }
})
