import { aspectRatioOptions } from "./constants";
import type { AspectRatio, ImgProp } from "./types";
import {
    loadHtml2Canvas,
    loadImageCompression,
    loadJSZip,
    loadSaveAs,
} from "@/utils/lazy-deps";
import { canUseLocalLargeImageService, getLargeImageAsset, isLargeJpeg, releaseLargeImage } from '@/utils/large-image';

type ZipInstance = {
    file: (name: string, data: Blob | File) => void;
    generateAsync: (options: { type: "blob" }) => Promise<Blob>;
};

type ZipConstructor = new () => ZipInstance;

export const MAX_PUZZLE_IMAGE_SIZE = 200 * 1024 * 1024;

export function findAspectRatioByLabel(label: string): AspectRatio | null {
    if (!label || label === "自适应") {
        return null;
    }

    return aspectRatioOptions.find((ratio) => ratio.label === label) || null;
}

export function getAutoColumnsByContainerRatio(
    currentRatio: number,
    targetRatio: number,
    imageCount: number
) {
    const sqrtCount = Math.sqrt(imageCount);

    if (currentRatio > targetRatio) {
        return Math.min(Math.ceil(sqrtCount * 1.5), 10);
    }

    if (currentRatio < targetRatio) {
        return Math.max(Math.ceil(sqrtCount * 0.7), 1);
    }

    return Math.ceil(sqrtCount);
}

export function getAutoColumnsBySelectedRatio(
    ratioLabel: string,
    imageCount: number
) {
    const sqrtCount = Math.sqrt(imageCount);

    switch (ratioLabel) {
        case "1:1":
            return Math.round(sqrtCount);
        case "4:3":
            return Math.max(Math.round(sqrtCount * 0.7), 1);
        case "3:4":
            return Math.min(Math.round(sqrtCount * 1.3), 10);
        case "16:9":
            return Math.max(Math.round(sqrtCount * 0.5), 1);
        case "9:16":
            return Math.min(Math.round(sqrtCount * 1.6), 10);
        case "2:1":
            return Math.max(Math.round(sqrtCount * 0.4), 1);
        case "1:2":
            return Math.min(Math.round(sqrtCount * 1.8), 10);
        default:
            return Math.round(sqrtCount);
    }
}

export function swapImagesById(
    images: ImgProp[],
    activeId: string,
    overId: string
) {
    const oldIndex = images.findIndex((item) => item.id === activeId);
    const newIndex = images.findIndex((item) => item.id === overId);

    if (oldIndex < 0 || newIndex < 0) {
        return images;
    }

    const nextImages = [...images];
    [nextImages[oldIndex], nextImages[newIndex]] = [
        nextImages[newIndex],
        nextImages[oldIndex],
    ];
    return nextImages;
}

async function loadImageSize(src: string) {
    return new Promise<ImgProp>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            resolve({
                id: src,
                src,
                width: img.width,
                height: img.height,
            });
        };
        img.onerror = () => reject(new Error("无法解码图片预览"));
        img.src = src;
    });
}

export async function processAcceptedFiles(acceptedFiles: File[]) {
    const images: ImgProp[] = [];
    // Bound peak decoder memory: never decode a batch of originals concurrently.
    for (const file of acceptedFiles) {
        const tiff = /\.tiff?$/i.test(file.name) || file.type === 'image/tiff';
        const oversized = await isLargeJpeg(file);
        const local = canUseLocalLargeImageService();
        if (!local && (tiff || oversized || file.size > MAX_PUZZLE_IMAGE_SIZE)) {
            throw new Error('此图片需要本机开发服务处理，请在 localhost 打开 puzzle 后导入');
        }
        let src: string | undefined;
        try {
            const asset = await getLargeImageAsset(file, local && (tiff || file.size > 16 * 1024 * 1024));
            if (asset) {
                const response = await fetch(asset.previewUrl);
                if (!response.ok) throw new Error('读取大图预览失败');
                src = URL.createObjectURL(await response.blob());
            } else {
                const imageCompression = await loadImageCompression();
                const compressed = await imageCompression(file, {
                    maxSizeMB: 2, maxWidthOrHeight: 2048, useWebWorker: true,
                    fileType: "image/jpeg", initialQuality: 0.85,
                });
                src = URL.createObjectURL(compressed);
            }
            images.push(await loadImageSize(src));
        } catch (error) {
            if (src) URL.revokeObjectURL(src);
            for (const image of images) URL.revokeObjectURL(image.src);
            throw error;
        } finally {
            // Puzzle owns its small preview; do not retain GB-sized temporary originals.
            await releaseLargeImage(file);
        }
    }
    return images;
}

type OverlayBoundsParams = {
    wrapper: HTMLElement;
    selectedRatio: AspectRatio | null;
    margin: number;
    pageScale: number;
};

export function calculateOverlayBounds({
    wrapper,
    selectedRatio,
    margin,
    pageScale,
}: OverlayBoundsParams) {
    if (!selectedRatio || selectedRatio.width === null) {
        return [];
    }

    const rect = wrapper.getBoundingClientRect();
    const ratio = selectedRatio.width / selectedRatio.height;
    const pageWidth = rect.width;
    const pageHeight = pageWidth / ratio;
    const pageSourceHeight = pageHeight / Math.max(pageScale, 0.1);
    const frames = Array.from(
        wrapper.querySelectorAll(".photo-frame")
    ) as HTMLElement[];
    const bottoms = Array.from(
        new Set(
            frames
                .map((element) => element.getBoundingClientRect().bottom - rect.top)
                .filter((value) => value > 0)
        )
    ).sort((left, right) => left - right);
    const snapTolerance = Math.max(12, margin + 8);
    const pages = Math.max(1, Math.ceil(rect.height / pageSourceHeight));
    const breaks: number[] = [];

    for (let pageIndex = 1; pageIndex < pages; pageIndex += 1) {
        const ideal = pageIndex * pageSourceHeight;
        let snapped = ideal;

        for (let bottomIndex = 0; bottomIndex < bottoms.length; bottomIndex += 1) {
            const bottom = bottoms[bottomIndex];
            if (Math.abs(bottom - ideal) <= snapTolerance) {
                snapped = bottom;
                break;
            }
        }

        breaks.push(Math.min(Math.max(snapped, 0), rect.height));
    }

    return Array.from(new Set(breaks.map((value) => Math.round(value)))).sort(
        (left, right) => left - right
    );
}

type DownloadPuzzleImageParams = {
    filesCount: number;
    inputScale: number;
    selectedRatio: AspectRatio | null;
    overlayBounds: number[];
    pageScale: number;
};

// Check the encoded file, rather than estimating bytes from canvas dimensions.
async function encodePuzzleJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
    for (const quality of [0.88, 0.8, 0.7, 0.6, 0.45]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob) throw new Error('导出图片失败，请降低导出规模');
        if (blob.size <= 100_000_000) return blob;
    }
    throw new Error('压缩后仍超过 100MB，请降低导出规模');
}

export async function downloadPuzzleImage({
    filesCount,
    inputScale,
    selectedRatio,
    overlayBounds,
    pageScale,
}: DownloadPuzzleImageParams) {
    if (filesCount === 0) {
        throw new Error("请选择图片");
    }

    const target =
        document.getElementById("tilt-wrapper") ||
        document.getElementById("gallery") ||
        document.getElementById("container");

    if (!target) {
        throw new Error("未找到可导出的画布");
    }

    const html2canvas = await loadHtml2Canvas();
    const bounds = target.getBoundingClientRect();
    const width = Math.max(1, target.scrollWidth, bounds.width);
    const height = Math.max(1, target.scrollHeight, bounds.height);
    const exportScale = Math.min(inputScale, 16384 / width, 16384 / height,
        Math.sqrt(32_000_000 / (width * height)));
    const originalCanvas = await html2canvas(target, {
        scale: exportScale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (clonedDoc) => {
            const container = clonedDoc.getElementById("container") as HTMLElement | null;
            const wrapper = clonedDoc.getElementById("tilt-wrapper") as HTMLElement | null;
            if (container) {
                container.style.overflow = "visible";
            }
            if (wrapper) {
                wrapper.style.overflow = "visible";
            }
            clonedDoc
                .querySelectorAll(".interactive-overlay, .interactive-actions")
                .forEach((node) => {
                    (node as HTMLElement).style.display = "none";
                });

            const images = clonedDoc.getElementsByTagName("img");
            return Promise.all(
                Array.from(images).map(
                    (img) =>
                        new Promise((resolve) => {
                            if (img.complete) {
                                resolve(null);
                                return;
                            }

                            img.onload = () => resolve(null);
                            img.onerror = () => {
                                console.error(
                                    "Image failed to load in cloned doc:",
                                    img.src
                                );
                                resolve(null);
                            };
                            setTimeout(() => {
                                resolve(null);
                            }, 3000);
                        })
                )
            );
        },
    });

    const padding = 0;
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = originalCanvas.width + padding * 2;
    fullCanvas.height = originalCanvas.height + padding * 2;
    const context = fullCanvas.getContext("2d");

    if (!context) {
        throw new Error("导出画布初始化失败");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
    context.drawImage(originalCanvas, padding, padding);

    if (!selectedRatio || selectedRatio.width === null) {
        const blob = await encodePuzzleJpeg(fullCanvas);

        if (!blob) {
            throw new Error("导出图片失败");
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "album-long.jpeg";
        link.click();
        URL.revokeObjectURL(url);

        return { pageCount: 1 };
    }

    const ratio = selectedRatio.width / selectedRatio.height;
    const pageWidth = fullCanvas.width;
    const pageHeight = Math.max(1, Math.round(pageWidth / ratio));
    const pageSourceHeight = Math.max(
        1,
        Math.round(pageHeight / Math.max(pageScale, 0.1))
    );
    const breaksCss = overlayBounds.length > 0 ? overlayBounds : [];
    const boundaries = [
        0,
        ...breaksCss.map((value) => Math.round(padding + value * exportScale)),
        fullCanvas.height,
    ];
    const JSZip = (await loadJSZip()) as ZipConstructor;
    const saveAs = await loadSaveAs();
    const zip = new JSZip();
    const files: { name: string; blob: Blob }[] = [];

    for (let index = 1; index < boundaries.length; index += 1) {
        const prev = boundaries[index - 1];
        const end = boundaries[index];
        const sliceHeight = Math.max(0, end - prev);
        const page = document.createElement("canvas");
        page.width = pageWidth;
        page.height = pageHeight;
        const pageContext = page.getContext("2d");

        if (!pageContext) {
            throw new Error("分页导出失败");
        }

        pageContext.imageSmoothingEnabled = true;
        pageContext.imageSmoothingQuality = "high";
        pageContext.fillStyle = "#ffffff";
        pageContext.fillRect(0, 0, pageWidth, pageHeight);

        if (sliceHeight > 0) {
            const scaleFactor = pageHeight / Math.max(pageSourceHeight, 1);
            const drawHeight = Math.min(
                pageHeight,
                Math.round(sliceHeight * scaleFactor)
            );
            const drawY = Math.round((pageHeight - drawHeight) / 2);
            pageContext.drawImage(
                fullCanvas,
                0,
                prev,
                fullCanvas.width,
                sliceHeight,
                0,
                drawY,
                pageWidth,
                drawHeight
            );
        }

        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

        const blob = await encodePuzzleJpeg(page);

        if (blob) {
            files.push({
                name: `album-${selectedRatio.label}-${files.length + 1}.jpeg`,
                blob,
            });
        }
    }

    files.forEach((file) => {
        zip.file(file.name, file.blob);
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `album-${selectedRatio.label}-${files.length}p.zip`);

    return { pageCount: files.length };
}
