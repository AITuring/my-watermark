// Keep originals for reuse; ship display-sized icons to the catalogue UI.
import { readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
let before = 0, after = 0;
for (const group of ['era', 'wenwu-type']) {
    const source = new URL(`../src/assets/${group}/`, import.meta.url);
    const output = new URL('thumbnails/', source);
    await mkdir(output, { recursive: true });
    for (const file of (await readdir(source)).filter(name => name.endsWith('.png')).sort()) {
        const input = new URL(file, source);
        const bytes = await sharp(fileURLToPath(input)).resize(96, 96, { fit: 'inside', withoutEnlargement: true }).webp({ lossless: true }).toBuffer();
        await writeFile(new URL(file.replace(/\.png$/, '.webp'), output), bytes);
        before += (await stat(input)).size;
        after += bytes.length;
    }
}
console.log(JSON.stringify({ before, after, saved: before - after }));
