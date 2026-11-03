import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const source = new URL('../public/wenwu/artifacts/', import.meta.url);
const output = new URL('../public/wenwu/thumbnails/', import.meta.url);
await mkdir(output, { recursive: true });
const manifest = {};
for (const name of (await readdir(source)).filter(name => /\.(png|jpe?g|webp)$/i.test(name)).sort()) {
    const bytes = await sharp(fileURLToPath(new URL(name, source))).rotate().resize(640, 640, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const filename = `${name.replace(/\.[^.]+$/, '')}-${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}.webp`;
    await writeFile(new URL(filename, output), bytes);
    manifest[name] = filename;
}
await writeFile(new URL('../src/pages/wenwu/artifactThumbnails.json', import.meta.url), JSON.stringify(manifest, null, 2)+'\n');
console.log(`Generated ${Object.keys(manifest).length} thumbnails; originals preserved.`);
