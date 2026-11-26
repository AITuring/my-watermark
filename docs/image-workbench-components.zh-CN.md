# 图片工作台公共组件

图片工具共享布局、文件选择、图片视图和下载机制，各页面保留自己的全分辨率处理算法与业务配置。

## 入口与职责

| 能力 | 所属实现 | 接入页面 |
| --- | --- | --- |
| 工作台页头 | `src/components/image-workbench/ImageWorkbench.tsx` 中的 `ImageWorkbenchHeader` | 马赛克、压缩 |
| 两栏／三栏与窄屏切换 | 同文件的 `ImageWorkbenchPanels` | 马赛克、裁切、EXIF、压缩、批量工作台 |
| 图片列表、选择、移除、上传与弹窗预览 | `src/components/ImageAssetPicker.tsx` | 水印、马赛克 |
| 滑杆、数值与标签 | `src/components/SliderNumberField.tsx` | 相册、马赛克、压缩、拼版 |
| 设置分组 | `src/components/SettingsSection.tsx` | 相册、马赛克 |
| 上传空状态布局 | `src/components/image-workbench/UploadEmptyState.tsx` | 马赛克、EXIF、压缩、水印 |
| 弹窗浏览原图／结果 | `src/components/ImagePreview.tsx` | 图片选择器、相册、Google 相册、拼版、切图 |
| DOM 精细编辑视口 | `src/components/image-workbench/ImageViewport.tsx` | 马赛克 |
| 缩放控件 | `src/components/image-workbench/PreviewZoomControl.tsx` | 马赛克、水印 |
| 缩略导航 | `src/components/image-workbench/PreviewMinimap.tsx` | 马赛克、水印、裁切 |
| 三种导出方式菜单 | `src/components/image-workbench/ImageExportMenu.tsx` | 马赛克、水印、切图 |
| 导出状态与防重入 | `src/hooks/useImageExport.ts` | 马赛克、切图 |
| 文件输出、重名、ZIP、逐张下载与进度 | `src/utils/image-export/index.ts` | 马赛克、水印、切图、裁切、压缩、批量工作台、色温统一、拼版、年度相册、图片拼贴 |

旧水印路径保留少量转导出以兼容已有调用者；新调用直接引用公共实现。水印与裁切的画布仍保留各自的渲染与交互引擎，通过公共导航组件适配，不改变原图坐标语义。并非所有业务页面都需要三栏布局。

## 布局

`ImageWorkbenchPanels` 接收 `images`、`editor`、`settings` 三个 React 插槽，`images` 和 `settings` 可省略；支持自定义面板标签。桌面显示传入的两栏或三栏，窄屏通过三个可键盘操作的按钮切换。

可以传入 `activePanel` 和 `onPanelChange` 控制选择；选择一张图片后，页面可切回 `editor`。未传入时由组件管理当前面板。`gridClassName` 只配置尺寸，工具本身不再复制断点、显示／隐藏和面板 ID 逻辑。

组件不克隆、不移动到 Portal，也不会因切换面板卸载内容。隐藏画布需要通过 ResizeObserver 处理零尺寸，重新显示后计算布局；裁切页忽略隐藏时的零尺寸，保留用户已经调整的缩放。

## 上传与图片列表

`UploadEmptyState` 负责插图宽度、居中、标题层级、说明、按钮和拖放提示。页面传入 `illustration`、`title`、`description`、`actions`，可选 `hint`、`footer` 与 `isDragActive`。文件对话框、文件夹权限和文件读取继续由页面管理。

`ImageAssetPicker` 支持 `grid`、原有整幅缩略图 `list` 及紧凑行 `rows`。数据使用 `ImageType`，不同工具通过映射提供 `id`、`file`、`previewUrl`、`width`、`height`，业务数据不要塞进公共组件。行模式可用 `renderDetails` 提供区域数量或处理状态。

图片选择、预览和删除是独立按钮。预览统一打开 `ImagePreview`，不能把删除按钮嵌套在选择按钮内部。

## 浏览与精细编辑

查看原图或结果使用 `ImagePreview`，避免在业务页复制弹窗、旋转、翻转和切图逻辑。

DOM 编辑使用 `ImageViewport`：传入源图、原始宽高和编辑覆盖层。组件负责适应、100%–500% 缩放、鼠标位置缩放、平移和 minimap；覆盖层位于随图片缩放的坐标容器内。

覆盖层尺寸和位置用原图的归一化坐标。需要自行处理拖拽的元素标记 `data-image-interaction`，这样拖动选框不会触发画面平移。拖拽的屏幕像素增量除以当前显示图片尺寸，不能除以缩放前尺寸。`onViewChange` 返回缩放和原图归一化中心，可用于将新增区域放在当前视野。

视口变化只影响预览。导出渲染函数必须读取原图与业务区域，不能截图预览 DOM。裁切和旋转从保留的 File 解码，不依赖可能已失效的预览 URL；临时 URL 在处理结束后释放。

Konva 或基于滚动条的编辑器可直接使用公共 `PreviewZoomControl`、`PreviewMinimap` 和坐标工具；不必为了复用 UI 替换渲染引擎。

## 导出

页面生成 `ImageExportFile = { data: Blob | File, name: string }`。

- `exportImages(items, render, options)`：逐项调用全分辨率渲染方法并导出，避免同时解码所有原图。
- `downloadExportFiles(files, options)`：已有输出文件时使用同一服务。
- `useImageExport({ items, current, render, archiveName, folder })`：提供 `loading`、`progress`、`run(mode)`，拒绝并行重复任务；页面处理提示或错误。

`mode` 为 `current`、`files` 或 `zip`。当前模式只处理传入项目的第一项；Hook 用 `current` 指定当前项。ZIP 模式即使只有一张也输出 ZIP。需要保留旧版单图行为的调用方显式传 `singleFileAsFile: true`。

服务统一清理文件名中的路径分隔符与控制字符，为重复名称添加后缀，避免 ZIP 内覆盖文件。可用 `folder` 指定单层归档目录。逐张下载带间隔；ZIP 使用 STORE，进度由渲染与打包共同组成。失败时抛出错误，不把失败任务显示为 100%。部分逐张下载已经交给浏览器的文件无法撤回。

导出时快照源列表。不要在页面中再直接构造 JSZip、另外维护一套重名规则或逐张下载循环。导出菜单只负责交互，不应承载图像处理代码。

## 验证

```sh
npx tsc --noEmit
node --test scripts/test-image-export.mjs scripts/test-crop-image-source.mjs scripts/test-watermark-downloads.mjs scripts/test-watermark-preview-zoom.mjs scripts/test-watermark-minimap.mjs
```

测试覆盖归档内容、同名文件、路径清理、单图 ZIP、空任务、失败与进度，以及全景／竖图的缩放和 minimap 坐标。浏览器验收另行检查上传、图片切换、区域拖拽、面板切换、实际下载和夜间配色。
