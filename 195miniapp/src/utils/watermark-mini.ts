import Taro from '@tarojs/taro';

interface WatermarkPosition {
  x: number;       // 0..1，按背景宽度归一化
  y: number;       // 0..1，按背景高度归一化
  scaleX: number;  // 相对于标准尺寸的缩放
  scaleY: number;  // 相对于标准尺寸的缩放
  rotation: number; // 角度
}

interface ProcessOptions {
  imagePath: string;
  watermarkPath: string;
  position: WatermarkPosition;
  opacity: number; // 0..1
  quality: number; // 0..1
  canvasId?: string; // 页面中的 Canvas id，默认 'wm-canvas'
}

/**
 * 在小程序端使用 2D Canvas 绘制水印并导出临时图片。
 * 需在页面上渲染 <Canvas type="2d" id="wm-canvas" />
 */
export async function processImageMini(opts: ProcessOptions): Promise<string> {
  const {
    imagePath,
    watermarkPath,
    position,
    opacity = 1,
    quality = 0.92,
    canvasId = 'wm-canvas',
  } = opts;

  // 获取背景图片信息
  const bgInfo = await Taro.getImageInfo({ src: imagePath });

  // 先尝试 2D Canvas
  let use2D = true;
  let canvasNode: any;
  try {
    canvasNode = await new Promise((resolve, reject) => {
      Taro.createSelectorQuery()
        .select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec(res => {
          const item = res && res[0];
          if (item && item.node) {
            resolve(item.node);
          } else {
            reject(new Error('2D Canvas 不可用'));
          }
        });
    });
  } catch (err) {
    use2D = false;
  }

  if (use2D && canvasNode) {
    const ctx = canvasNode.getContext('2d');
    canvasNode.width = bgInfo.width;
    canvasNode.height = bgInfo.height;

    const bg = canvasNode.createImage();
    const wm = canvasNode.createImage();

    await new Promise<void>((resolve, reject) => {
      bg.onload = () => resolve();
      bg.onerror = reject;
      bg.src = imagePath;
    });
    await new Promise<void>((resolve, reject) => {
      wm.onload = () => resolve();
      wm.onerror = reject;
      wm.src = watermarkPath;
    });

    ctx.clearRect(0, 0, bgInfo.width, bgInfo.height);
    ctx.drawImage(bg, 0, 0, bgInfo.width, bgInfo.height);

    const minDim = Math.min(bgInfo.width, bgInfo.height);
    const standardWatermarkW = minDim * 0.1;
    const wmW = standardWatermarkW * (position.scaleX || 1);
    const wmH = (wm.height / wm.width) * wmW * (position.scaleY || 1);
    const cx = position.x * bgInfo.width;
    const cy = position.y * bgInfo.height;
    const rad = (position.rotation || 0) * Math.PI / 180;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cx, cy);
    ctx.rotate(rad);
    ctx.drawImage(wm, -wmW / 2, -wmH / 2, wmW, wmH);
    ctx.restore();

    const result = await Taro.canvasToTempFilePath({
      canvas: canvasNode,
      width: bgInfo.width,
      height: bgInfo.height,
      destWidth: bgInfo.width,
      destHeight: bgInfo.height,
      fileType: 'jpg',
      quality,
    });
    return result.tempFilePath;
  }

  // 普通 Canvas 回退（部分平台不支持透明度）
  const ctx = Taro.createCanvasContext(canvasId);
  const minDim = Math.min(bgInfo.width, bgInfo.height);
  const standardWatermarkW = minDim * 0.1;
  const wmW = standardWatermarkW * (position.scaleX || 1);
  const wmH = wmW; // 回退版本按方形估算（因为无法提前获取水印图片尺寸）
  const cx = position.x * bgInfo.width;
  const cy = position.y * bgInfo.height;
  const rad = (position.rotation || 0) * Math.PI / 180;

  ctx.clearRect(0, 0, bgInfo.width, bgInfo.height);
  ctx.drawImage(imagePath, 0, 0, bgInfo.width, bgInfo.height);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad);
  // 普通 Canvas 无透明度时降级为不透明
  ctx.drawImage(watermarkPath, -wmW / 2, -wmH / 2, wmW, wmH);
  ctx.restore();

  await new Promise<void>(resolve => ctx.draw(false, resolve));

  const res = await Taro.canvasToTempFilePath({
    canvasId,
    width: bgInfo.width,
    height: bgInfo.height,
    destWidth: bgInfo.width,
    destHeight: bgInfo.height,
    fileType: 'jpg',
    quality,
  });
  return res.tempFilePath;
}
