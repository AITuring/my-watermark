# 人物分类：浏览器本地识别

页面：`/people-sort`。默认使用 ONNX Runtime Web 1.23.2 的 WebAssembly 后端，在独立 Web Worker 中运行 YuNet + SFace，不需要 Python 服务、后端 API 或跨源隔离。照片与人脸特征不会发送到服务器。当前没有启用 WebGPU。

## 使用与部署

正常启动网站（`npm run dev`）即可。在页面选择包含 JPEG/PNG/WebP 的文件夹，可包含子文件夹；等待识别后调整分组、命名并分类导出原图。

第一次使用加载约 48 MB 模型与运行资源。两个模型使用 Cache Storage 缓存，缓存不可用时仍可在线加载；缓存前和每次读取后均验证固定 SHA-256。WASM 与运行 JS 由 Vite 作为带内容哈希的静态资源输出。页面没有宣称完整离线应用支持，浏览器清理缓存后需要重新加载资源。

部署需同时发布 `dist/assets` 中的 Worker、ONNX Runtime `.mjs` / `.wasm` 和 `dist/models/people-sort/onnx` 中的模型。`.mjs` 使用 JavaScript MIME，`.wasm` 使用 `application/wasm`。需 HTTPS 或 localhost，支持 Worker、OffscreenCanvas、WASM SIMD、createImageBitmap 的现代浏览器。模型按路由内的用户操作懒加载，首页不下载模型。

浏览器 Face API 保留为可选旧引擎，需先清空照片才能切换，避免混用特征空间。停止识别会终止 ONNX Worker；未处理图片仍进入待确认。离开页面会释放 Worker、推理会话和图片 URL。导出使用原始 File 内容，不重新编码。

## 模型与算法

使用 OpenCV Zoo 的 YuNet `face_detection_yunet_2023mar.onnx`（约 227 KB）和 SFace `face_recognition_sface_2021dec.onnx`（约 37 MB），随静态站点提供，固定哈希与许可证位于 `public/models/people-sort/onnx`。YuNet 目录提供 MIT 许可证，SFace 目录提供 Apache 2.0 许可证。

- https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
- https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface

YuNet 输入为原始 BGR NCHW，按 640×640 等比缩放并补黑边。解码多步长输出后进行 NMS；全图没有人脸时增加重叠局部扫描。最大人脸面积需达到第二张的 4 倍才判断为主体。使用原图主体区域二次检测五个关键点，以最小二乘相似变换对齐到 SFace 的 112×112 模板。SFace 输入为原始 RGB NCHW，图内已含归一化，输出 128 维特征做 L2 归一化后分组。默认距离阈值 0.95；它不是对真实相册的准确率保证。

算法约定参考 OpenCV：
- https://github.com/opencv/opencv/blob/4.x/modules/objdetect/src/face_detect.cpp
- https://github.com/opencv/opencv/blob/4.x/modules/objdetect/src/face_recognize.cpp
- https://onnxruntime.ai/docs/tutorials/web/deploy.html

## 人工参考

进入人物组，勾选身份已确认的清晰照片，点击“将所选设为参考”，再点击“用参考照片匹配待确认”。仅匹配有可用人脸特征的待确认照片；使用最近最多三张参考的平均距离，与次优人物距离过近时保留待确认。重新分组或导入新批次会清除参考标记。

没有人体外观、衣服或背影识别。单张上限 64 MB、90 MP；大批量照片仍建议分批，浏览器导出 ZIP 受可用内存限制。

## 开发验证

```sh
npx tsc --noEmit
node scripts/test-people-sort.mjs
node scripts/test-people-onnx.mjs
```

`backend/people_service.py` 和模型下载脚本保留作开发对照工具，页面不调用它们。需要重新取得模型时，可运行 `npm run people:setup`，随后把校验通过的模型同步到 `public/models/people-sort/onnx`。后端实现和浏览器实现使用同一组模型，但插值和推理后端的数值可能略有差异。
