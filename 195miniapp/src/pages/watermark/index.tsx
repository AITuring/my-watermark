// ... existing code ...
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Button, ScrollView, Slider, Switch, Image, Canvas } from '@tarojs/components';
import { processImageMini } from '@/utils/watermark-mini';

type ImgItem = { id: string; path: string; width?: number; height?: number };
type Position = { x: number; y: number; scale: number; rotation: number };

const Page: React.FC = () => {
  const [images, setImages] = useState<ImgItem[]>([]);
  const [results, setResults] = useState<string[]>([]);
  const [watermarkPath, setWatermarkPath] = useState<string>('');
  const [position, setPosition] = useState<Position>({ x: 0.5, y: 0.5, scale: 1, rotation: 0 });
  const [opacity, setOpacity] = useState<number>(0.8);
  const [quality, setQuality] = useState<number>(92); // 0..100
  const [blurBg, setBlurBg] = useState<boolean>(false); // 先占位，后续实现
  const [processing, setProcessing] = useState<boolean>(false);

  // 选择背景图片（支持多选）
  const chooseImages = async () => {
    const res = await Taro.chooseImage({ count: 9, sizeType: ['original'], sourceType: ['album', 'camera'] });
    const paths = res.tempFilePaths || [];
    const items: ImgItem[] = await Promise.all(paths.map(async (p, idx) => {
      const info = await Taro.getImageInfo({ src: p });
      return { id: `${Date.now()}-${idx}`, path: p, width: info.width, height: info.height };
    }));
    setImages(items);
    setResults([]);
  };

  // 选择水印图片（单选）
  const chooseWatermark = async () => {
    const res = await Taro.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album', 'camera'] });
    const p = res.tempFilePaths?.[0];
    if (p) setWatermarkPath(p);
  };

  const handleBatchApply = async () => {
    if (!watermarkPath) {
      Taro.showToast({ title: '请先选择水印图片', icon: 'none' });
      return;
    }
    if (images.length === 0) {
      Taro.showToast({ title: '请先选择背景图片', icon: 'none' });
      return;
    }
    setProcessing(true);
    try {
      const out: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];

        // 暂不实现 blurBg（后续用小程序 2D Canvas 或后端）
        const temp = await processImageMini({
          imagePath: img.path,
          watermarkPath,
          position: {
            x: position.x,
            y: position.y,
            scaleX: position.scale,
            scaleY: position.scale,
            rotation: position.rotation,
          },
          opacity,
          quality: Math.max(0, Math.min(1, quality / 100)),
          canvasId: 'wm-canvas',
        });
        out.push(temp);
        // 简单进度提示
        Taro.showLoading({ title: `生成中 ${i + 1}/${images.length}` });
      }
      setResults(out);
      Taro.hideLoading();
      Taro.showToast({ title: `生成完成 ${out.length} 张`, icon: 'success' });
    } catch (e) {
      Taro.hideLoading();
      Taro.showToast({ title: '生成失败，请重试', icon: 'none' });
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  const saveToAlbum = async (path: string) => {
    try {
      await Taro.saveImageToPhotosAlbum({ filePath: path });
      Taro.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (e) {
      Taro.showToast({ title: '保存失败，检查权限', icon: 'none' });
      console.error(e);
    }
  };

  return (
    <ScrollView scrollY style={{ height: '100vh' }}>
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>小程序水印（移动端）</Text>

        <View style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <Button onClick={chooseImages} disabled={processing}>选择背景图</Button>
          <Button onClick={chooseWatermark} disabled={processing}>选择水印图</Button>
        </View>

        <View style={{ marginTop: 12 }}>
          <Text>位置 X: {(position.x * 100).toFixed(0)}%</Text>
          <Slider min={0} max={100} value={position.x * 100}
            onChange={e => setPosition(p => ({ ...p, x: (e.detail.value as number) / 100 }))} />
          <Text>位置 Y: {(position.y * 100).toFixed(0)}%</Text>
          <Slider min={0} max={100} value={position.y * 100}
            onChange={e => setPosition(p => ({ ...p, y: (e.detail.value as number) / 100 }))} />
          <Text>缩放: {position.scale.toFixed(2)}x</Text>
          <Slider min={50} max={300} value={position.scale * 100}
            onChange={e => setPosition(p => ({ ...p, scale: (e.detail.value as number) / 100 }))} />
          <Text>旋转: {position.rotation}°</Text>
          <Slider min={-180} max={180} value={position.rotation}
            onChange={e => setPosition(p => ({ ...p, rotation: e.detail.value as number }))} />
          <Text>透明度: {Math.round(opacity * 100)}%</Text>
          <Slider min={0} max={100} value={opacity * 100}
            onChange={e => setOpacity((e.detail.value as number) / 100)} />
          <Text>图片质量: {quality}%</Text>
          <Slider min={50} max={100} value={quality}
            onChange={e => setQuality(e.detail.value as number)} />
          <View style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Text>背景模糊（占位）：</Text>
            <Switch checked={blurBg} onChange={e => setBlurBg(!!e.detail.value)} />
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <Button type="primary" onClick={handleBatchApply} disabled={processing || !watermarkPath || images.length === 0}>
            {processing ? '生成中...' : '应用水印并导出（批量）'}
          </Button>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: 'bold' }}>预览（原图）</Text>
          <ScrollView scrollX style={{ whiteSpace: 'nowrap', marginTop: 8 }}>
            {images.map(img => (
              <Image key={img.id} src={img.path} mode="aspectFit" style={{ width: '45vw', height: '45vw', marginRight: 8 }} />
            ))}
          </ScrollView>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: 'bold' }}>生成结果</Text>
          {results.length === 0 && <Text>暂未生成</Text>}
          {results.map((p, idx) => (
            <View key={idx} style={{ marginTop: 8 }}>
              <Image src={p} mode="widthFix" style={{ width: '100%' }} />
              <View style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button onClick={() => saveToAlbum(p)}>保存到相册</Button>
                <Button onClick={() => Taro.previewImage({ urls: [p] })}>预览大图</Button>
              </View>
            </View>
          ))}
        </View>

        {/* 隐藏的 2D Canvas，用于绘制与导出 */}
        <Canvas
            type="2d"
            id="wm-canvas"
            canvasId="wm-canvas"
            style={{ width: 1, height: 1, position: 'absolute', left: -9999, top: -9999 }}
        />
      </View>
    </ScrollView>
  );
};

export default Page;
