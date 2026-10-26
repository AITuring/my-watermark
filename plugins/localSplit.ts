import { randomUUID } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Plugin } from 'vite';
import sharp from 'sharp';

type Source = { path: string; width: number; height: number; preview: Buffer;
  lastCrop?: { key: string; data: Buffer }; lastAccess: number };
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_CROP_PIXELS = 120_000_000;

export function localSplitPlugin(): Plugin {
  const sources = new Map<string, Source>();
  let rootPromise: Promise<string> | null = null;
  const getRoot = () => {
    rootPromise ??= fs.mkdtemp(path.join(tmpdir(), 'my-watermark-split-'));
    return rootPromise;
  };

  return {
    name: 'local-large-image-split',
    configureServer(server) {
      const cleanupTimer = setInterval(() => {
        const expired = Date.now() - 30 * 60 * 1000;
        for (const [id, source] of sources) {
          if (source.lastAccess < expired) {
            sources.delete(id);
            void fs.rm(source.path, { force: true });
          }
        }
      }, 5 * 60 * 1000);
      cleanupTimer.unref();
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (!url.pathname.startsWith('/__local_split/')) return next();
        const sendError = (status: number, message: string) => {
          res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: message }));
        };

        const client = req.socket.remoteAddress || '';
        const origin = req.headers.origin;
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(client) ||
            (origin && !['localhost', '127.0.0.1'].includes(new URL(origin).hostname))) {
          return sendError(403, '本地大图服务仅允许本机页面访问');
        }

        try {
          if (url.pathname === '/__local_split/import' && req.method === 'POST') {
            const length = Number(req.headers['content-length'] || 0);
            if (length > MAX_UPLOAD_BYTES) return sendError(413, '文件超过本地处理上限');
            const root = await getRoot();
            const id = randomUUID();
            const filePath = path.join(root, `${id}.jpg`);
            let received = 0;
            const limiter = new Transform({
              transform(chunk: Buffer, _encoding, callback) {
                received += chunk.length;
                callback(received > MAX_UPLOAD_BYTES ? new Error('文件超过本地处理上限') : null, chunk);
              },
            });
            try {
              await pipeline(req, limiter, createWriteStream(filePath));
              const metadata = await sharp(filePath, { limitInputPixels: false }).metadata();
              if (!metadata.width || !metadata.height || metadata.format !== 'jpeg') {
                throw new Error('本地大图通道仅支持 JPEG');
              }
              const preview = await sharp(filePath, { limitInputPixels: false })
                .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 }).toBuffer();
              sources.set(id, { path: filePath, width: metadata.width, height: metadata.height,
                preview, lastAccess: Date.now() });
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ id, width: metadata.width, height: metadata.height,
                previewUrl: `/__local_split/preview/${id}` }));
            } catch (error) {
              await fs.rm(filePath, { force: true });
              throw error;
            }
            return;
          }

          const match = url.pathname.match(/^\/__local_split\/(preview|crop|item|process|composite)\/([a-f0-9-]+)$/);
          if (!match) return sendError(404, '未找到本地大图接口');
          const [, action, id] = match;
          const source = sources.get(id);
          if (!source) return sendError(404, '原图会话已失效，请重新导入');
          source.lastAccess = Date.now();

          if (action === 'preview' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
            res.end(source.preview);
            return;
          }
          if (action === 'item' && req.method === 'DELETE') {
            sources.delete(id);
            await fs.rm(source.path, { force: true });
            res.writeHead(204);
            res.end();
            return;
          }
          if (action === 'process' && req.method === 'POST') {
            let body = '';
            for await (const chunk of req) {
              body += chunk.toString();
              if (body.length > 8192) return sendError(413, '处理参数过大');
            }
            const options = JSON.parse(body) as {
              crop?: { x: number; y: number; width: number; height: number };
              rotate?: number; width?: number; height?: number; quality?: number;
              format?: 'jpeg' | 'png' | 'webp';
              mosaic?: Array<{ x: number; y: number; width: number; height: number; blockSize: number }>;
            };
            const angle = options.rotate ?? 0;
            if (![0, 90, 180, 270, -90].includes(angle)) return sendError(400, '不支持的旋转角度');
            const rotatedWidth = Math.abs(angle) % 180 === 90 ? source.height : source.width;
            const rotatedHeight = Math.abs(angle) % 180 === 90 ? source.width : source.height;
            const crop = options.crop;
            if (crop && (![crop.x, crop.y, crop.width, crop.height].every(Number.isInteger) ||
              crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 ||
              crop.x + crop.width > rotatedWidth || crop.y + crop.height > rotatedHeight)) {
              return sendError(400, '裁切范围超出原图');
            }
            const width = options.width;
            const height = options.height;
            if ((width !== undefined && (!Number.isInteger(width) || width <= 0 || width > 65535)) ||
              (height !== undefined && (!Number.isInteger(height) || height <= 0 || height > 65535))) {
              return sendError(400, '输出尺寸无效');
            }
            const quality = options.quality ?? 90;
            if (!Number.isFinite(quality) || quality < 1 || quality > 100) return sendError(400, '输出质量无效');
            const format = options.format ?? 'jpeg';
            if (!['jpeg', 'png', 'webp'].includes(format)) return sendError(400, '输出格式无效');
            const outputWidth = width ?? (crop?.width ?? rotatedWidth);
            const outputHeight = height ?? (crop?.height ?? rotatedHeight);
            if (outputWidth * outputHeight > 600_000_000) return sendError(400, '输出像素超过处理上限');
            if (options.mosaic) {
              if (options.mosaic.length > 64 || angle || crop || width || height) {
                return sendError(400, '马赛克处理参数无效');
              }
              const layers: Array<{ input: Buffer; left: number; top: number }> = [];
              for (const region of options.mosaic) {
                if (![region.x, region.y, region.width, region.height, region.blockSize].every(Number.isInteger) ||
                    region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0 ||
                    region.blockSize <= 0 || region.x + region.width > source.width ||
                    region.y + region.height > source.height) return sendError(400, '马赛克区域无效');
                const small = await sharp(source.path, { limitInputPixels: false })
                  .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
                  .resize({ width: Math.max(1, Math.round(region.width / region.blockSize)),
                    height: Math.max(1, Math.round(region.height / region.blockSize)), fit: 'fill' })
                  .png().toBuffer();
                const pixelated = await sharp(small).resize({ width: region.width, height: region.height,
                  kernel: 'nearest', fit: 'fill' }).png().toBuffer();
                layers.push({ input: pixelated, left: region.x, top: region.y });
              }
              let processor = sharp(source.path, { limitInputPixels: false }).composite(layers);
              if (format === 'png') processor = processor.png();
              else if (format === 'webp') processor = processor.webp({ quality });
              else processor = processor.jpeg({ quality, chromaSubsampling: '4:4:4' });
              res.writeHead(200, { 'Content-Type': `image/${format}`, 'Cache-Control': 'no-store' });
              await pipeline(processor, res);
              return;
            }
            let processor = sharp(source.path, { limitInputPixels: false });
            if (angle) processor = processor.rotate(angle);
            if (crop) processor = processor.extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height });
            if (width || height) processor = processor.resize({ width, height, fit: 'fill' });
            if (format === 'png') processor = processor.png();
            else if (format === 'webp') processor = processor.webp({ quality });
            else processor = processor.jpeg({ quality, chromaSubsampling: '4:4:4' });
            res.writeHead(200, { 'Content-Type': `image/${format}`, 'Cache-Control': 'no-store' });
            await pipeline(processor, res);
            return;
          }
          if (action === 'composite' && req.method === 'POST') {
            const left = Number(url.searchParams.get('x'));
            const top = Number(url.searchParams.get('y'));
            const quality = Number(url.searchParams.get('quality') || 95);
            const blur = url.searchParams.get('blur') === '1';
            if (![left, top].every(Number.isInteger) || left < 0 || top < 0 ||
              !Number.isFinite(quality) || quality < 1 || quality > 100) {
              return sendError(400, '水印参数无效');
            }
            const chunks: Buffer[] = [];
            let length = 0;
            for await (const chunk of req) {
              length += chunk.length;
              if (length > 32 * 1024 * 1024) return sendError(413, '水印图层过大');
              chunks.push(chunk);
            }
            const overlay = Buffer.concat(chunks);
            const overlayMeta = await sharp(overlay).metadata();
            if (!overlayMeta.width || !overlayMeta.height ||
              left + overlayMeta.width > source.width || top + overlayMeta.height > source.height) {
              return sendError(400, '水印位置超出原图');
            }
            const layers: Array<{ input: Buffer; left: number; top: number }> = [];
            if (blur) {
              const patch = await sharp(source.path, { limitInputPixels: false })
                .extract({ left, top, width: overlayMeta.width, height: overlayMeta.height })
                .blur(20).png().toBuffer();
              layers.push({ input: patch, left, top });
            }
            layers.push({ input: overlay, left, top });
            res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
            await pipeline(sharp(source.path, { limitInputPixels: false })
              .composite(layers).jpeg({ quality, chromaSubsampling: '4:4:4' }), res);
            return;
          }
          if (action === 'crop' && req.method === 'GET') {
            const left = Number(url.searchParams.get('x'));
            const top = Number(url.searchParams.get('y'));
            const width = Number(url.searchParams.get('w'));
            const height = Number(url.searchParams.get('h'));
            if (![left, top, width, height].every(Number.isInteger) ||
                left < 0 || top < 0 || width <= 0 || height <= 0 ||
                left + width > source.width || top + height > source.height ||
                width * height > MAX_CROP_PIXELS) {
              return sendError(400, '切片范围超出原图或单张切片过大');
            }
            const preview = url.searchParams.get('preview') === '1';
            const cropKey = `${left}:${top}:${width}:${height}`;
            const cached = preview && source.lastCrop?.key === cropKey ? source.lastCrop.data : null;
            const pipeline = cached
              ? sharp(cached)
              : sharp(source.path, { limitInputPixels: false }).extract({ left, top, width, height });
            if (preview) pipeline.resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true });
            const result = await pipeline.jpeg(preview
              ? { quality: 82 }
              : { quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
            if (preview) source.lastCrop = undefined;
            else source.lastCrop = { key: cropKey, data: result };
            res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
            res.end(result);
            return;
          }
          sendError(405, '不支持的请求方法');
        } catch (error) {
          console.error('Local split service:', error);
          if (!res.headersSent) sendError(500, error instanceof Error ? error.message : '本地处理失败');
        }
      });

      server.httpServer?.on('close', async () => {
        clearInterval(cleanupTimer);
        if (rootPromise) await fs.rm(await rootPromise, { recursive: true, force: true });
      });
    },
  };
}
