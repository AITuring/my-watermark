export default {
  pages: ["pages/wenwu/index", "pages/index/index"],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#fff",
    navigationBarTitleText: "WeChat",
    navigationBarTextStyle: "black",
  },
  tabBar: {
    color: "#666",
    selectedColor: "#667eea",
    backgroundColor: "#fff",
    list: [
      { pagePath: "pages/wenwu/index", text: "文物" },
      { pagePath: "pages/index/index", text: "其它" }
    ]
  }
};
