# Vite + React

This is a [Vite](https://vitejs.dev) project together with React.

[![Edit in CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/github/codesandbox/codesandbox-template-vite-react/main)

[Configuration](https://codesandbox.io/docs/projects/learn/setting-up/tasks) `.codesandbox/tasks.json` has been added to optimize it for [CodeSandbox](https://codesandbox.io/dashboard).

## Resources

- [CodeSandbox — Docs](https://codesandbox.io/docs/learn)
- [CodeSandbox — Discord](https://discord.gg/Ggarp3pX5H)
- [Vite — GitHub](https://github.com/vitejs/vite)
- [Vite — Docs](https://vitejs.dev/guide/)

## 思路
图片上面加水印和添加一层边框再添加水印，流程还是不太一样。不如拆分成两个组件。以后可以扩展成添加水印和添加各种边框。导航栏分开。
## 流程
为了预览，首先缩小原图到尺寸为800，这个比例为`backgroundScale = backgroundFixWidth / backgroundImage.naturalWidth;`，这个比例将不再变化。同时`backgroundImageSize`也固定，不再变化。

初始化水印的尺寸`watermarkInitSize`也需要按这个比例计算：`watermarkInitSize = watermarkImage.naturalWidth * backgroundScale`。`watermarkInitSize`也是一个固定值。

后续可能还要继续调整水印的比例`scale`。这个`scale`是相对于`watermarkInitSize`的比例

然后调整水印位置和大小，调整过程中水印`postion`的位置:`x, y`，大小`scaleX, scaleY`。(这里的x, y是相对于背景图的百分比，scaleX, scaleY是相对于水印的坐标)

调整好水印的位置后，传到父组件里面是水印相对原图的x,y坐标，以及调整过程中水印放大的倍数scaleX，scaleY（一般情况下，这两者是一样的）。

把水印应用到原图上，需要把水印的x,y坐标分别乘以`scale`。

## TODO
- [x] 下载太慢，多图只处理前几个，后面不处理（已经优化，现在下载速度可以接受）
- [x] 挪动水印应该增加辅助线，帮助对齐
- [x] 添加默认方位，比如左上角，方便处理
- [x] 可以删除单图，重新调整其他图水印大小
- [ ] 每个图都可以单独调整水印位置（还在考虑有没有这个必要）
- [ ] 界面优化 （优化了一部分，但依然丑，还需要修改自适应布局）
- [ ] 添加文字水印
- [ ] 可以设置水印的透明度以及水印颜色
- [ ] 可以设置水印的旋转角度
- [ ] 背景图片放大是在预览图宽高范围内放大，不应该超过这个区域
- [ ] 编辑撤销重做
- [ ] 浏览器扩展
- [ ] 可以整个日历todo组件当做封面（功能强大一些，可以同步日历啥的）

