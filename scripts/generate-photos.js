import { fetchImageUrls } from 'google-photos-album-image-url-fetch';
import fs from 'fs-extra';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

// 仅当脚本里使用了 __dirname/__filename 时需要这些两行：
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//替换为你的 Google 相册公开分享链接
const ALBUM_URL = 'https://photos.app.goo.gl/AVLfPxN4LQbtUUaM9';

async function generate() {
  console.log('📸 开始抓取 Google 相册数据...');

  try {
    // 1. 抓取数据
    const photos = await fetchImageUrls(ALBUM_URL);

    // 2. 转换数据格式，生成不同尺寸的直链
    // Google Photos 的 URL 末尾加上 =wXXX-hXXX 可以获取指定尺寸
    const formattedPhotos = photos.map((photo) => {
      const ratio = photo.width / photo.height;
      return {
        src: `${photo.url}`, // 大图用于灯箱或查看
        width: photo.width,
        height: photo.height,
        // 生成响应式 srcSet，react-photo-album 会自动使用
        srcSet: [
            { src: `${photo.url}=w500`, width: 500, height: Math.round(500 / ratio) },
            { src: `${photo.url}=w800`, width: 800, height: Math.round(800 / ratio) },
            { src: `${photo.url}=w1600`, width: 1600, height: Math.round(1600 / ratio) },
        ]
      };
    });

    // 3. 写入到 src 目录下，以便 React 可以 import
    const outputPath = path.join(__dirname, '../src/photos.json');
    await fs.outputJson(outputPath, formattedPhotos, { spaces: 2 });

    console.log(`✅ 成功抓取 ${formattedPhotos.length} 张照片，已保存至 src/photos.json`);

  } catch (error) {
    console.error('❌ 抓取失败:', error);
    // 如果抓取失败，不应该中断构建，但可以写入空数组防止前端报错
    // process.exit(1); // 如果希望失败则停止构建，取消注释这行
  }
}

generate();
