import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = new URL('../public/', import.meta.url);
await mkdir(new URL('textures/', root), { recursive: true });
for (const name of ['sun', 'moon', 'earth']) {
    await sharp(fileURLToPath(new URL(`${name}.jpg`, root))).resize({width: 1024, withoutEnlargement: true}).webp({quality: 85}).toFile(fileURLToPath(new URL(`textures/${name}.webp`, root)));
}
