import { Buffer } from "node:buffer";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { artifactImageCatalog } from "../src/pages/wenwu/artifactImageCatalog.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const artifactImageDir = path.join(projectRoot, "public/wenwu/artifacts");

const MIME_EXTENSION_MAP = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getFileExtension = (url, contentType) => {
    const normalizedType = contentType?.split(";")[0]?.trim().toLowerCase();
    if (normalizedType && MIME_EXTENSION_MAP[normalizedType]) {
        return MIME_EXTENSION_MAP[normalizedType];
    }

    try {
        const pathname = new URL(url).pathname;
        const extension = path.extname(pathname).replace(".", "").toLowerCase();
        return extension || "jpg";
    } catch {
        return "jpg";
    }
};

const getCachedFileMap = async () => {
    const files = await readdir(artifactImageDir).catch(() => []);
    const cacheMap = new Map();

    for (const fileName of files) {
        const matched = fileName.match(/^(\d+)-/);
        if (!matched) continue;

        const artifactId = Number(matched[1]);
        if (!Number.isFinite(artifactId) || cacheMap.has(artifactId)) continue;

        cacheMap.set(artifactId, fileName);
    }

    return cacheMap;
};

const fetchWikipediaImageUrl = async (title, attempt = 1) => {
    const apiUrl = `https://zh.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=original&titles=${encodeURIComponent(
        title
    )}`;
    const response = await fetch(apiUrl, {
        headers: {
            Accept: "application/json",
            "User-Agent": "my-watermark-image-cache/1.0",
        },
    });

    if (response.status === 429 && attempt < 4) {
        await sleep(attempt * 2500);
        return fetchWikipediaImageUrl(title, attempt + 1);
    }

    if (!response.ok) {
        throw new Error(`wiki ${response.status}`);
    }

    const payload = await response.json();
    const pages = Object.values(payload?.query?.pages || {});
    const page = pages[0];

    if (page?.original?.source) {
        return page.original.source;
    }

    return null;
};

const downloadImage = async (url) => {
    const response = await fetch(url, {
        headers: {
            Accept: "image/*,*/*;q=0.8",
            "User-Agent": "my-watermark-image-cache/1.0",
        },
    });

    if (!response.ok) {
        throw new Error(`image ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
        buffer: Buffer.from(arrayBuffer),
        contentType: response.headers.get("content-type") || undefined,
    };
};

const resolveSourceUrl = async (entry) => {
    if (entry.remoteImage) {
        return entry.remoteImage;
    }

    if (entry.wikipediaTitle) {
        return fetchWikipediaImageUrl(entry.wikipediaTitle);
    }

    return null;
};

const run = async () => {
    await mkdir(artifactImageDir, { recursive: true });

    const cachedFileMap = await getCachedFileMap();
    const entries = Object.values(artifactImageCatalog).sort((a, b) => a.id - b.id);
    const targets = entries.filter(
        (entry) =>
            !entry.localImage &&
            !cachedFileMap.has(entry.id) &&
            (entry.remoteImage || entry.wikipediaTitle)
    );

    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of targets) {
        try {
            const sourceUrl = await resolveSourceUrl(entry);
            if (!sourceUrl) {
                skipped += 1;
                continue;
            }

            const { buffer, contentType } = await downloadImage(sourceUrl);
            const extension = getFileExtension(sourceUrl, contentType);
            const fileName = `${entry.id}-cache.${extension}`;
            const filePath = path.join(artifactImageDir, fileName);

            await writeFile(filePath, buffer);
            downloaded += 1;
            console.log(`downloaded ${entry.id} ${entry.name} -> ${fileName}`);
            await sleep(entry.wikipediaTitle ? 900 : 150);
        } catch (error) {
            failed += 1;
            console.warn(
                `failed ${entry.id} ${entry.name}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    console.log(
        `[wenwu-image-cache] downloaded ${downloaded}, skipped ${skipped}, failed ${failed}`
    );
};

run().catch((error) => {
    console.error("[wenwu-image-cache] cache failed");
    console.error(error);
    process.exitCode = 1;
});
