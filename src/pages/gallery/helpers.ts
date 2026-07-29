import imageCompression from "browser-image-compression";
import chroma from "chroma-js";
import ColorThief from "colorthief";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { saveAs } from "file-saver";

import { getRandomColor } from "./constants";
import type { AspectRatio, ImgProp } from "./types";

export const prepareImagesFromFiles = async (acceptedFiles: File[]) => {
    const newImages: ImgProp[] = [];
    const compressionOptions = {
        maxSizeMB: 15,
        maxWidthOrHeight: 2560,
        useWebWorker: true,
    };

    await Promise.all(
        acceptedFiles.map(async (file) => {
            const compressedFile = await imageCompression(
                file,
                compressionOptions
            );
            const src = URL.createObjectURL(compressedFile);

            return new Promise<HTMLImageElement>((resolve) => {
                const img = new window.Image();
                img.onload = () => {
                    let extractedColor = getRandomColor();

                    try {
                        const colorThief = new ColorThief();
                        const rgb = colorThief.getColor(img);

                        if (rgb) {
                            extractedColor = chroma(rgb)
                                .darken(2)
                                .desaturate(1)
                                .hex();
                        }
                    } catch (error) {
                        console.warn(
                            "Color extraction failed, falling back to random color",
                            error
                        );
                    }

                    newImages.push({
                        id: src,
                        src,
                        width: img.width,
                        height: img.height,
                        frameColor: extractedColor,
                    });
                    resolve(img);
                };
                img.src = src;
            });
        })
    );

    return newImages;
};

type ExportGalleryImageParams = {
    filesLength: number;
    inputScale: number;
    selectedRatio: AspectRatio | null;
    vignette: boolean;
    overlayBounds: number[];
    outerPadding: number;
    wallColor: string;
};

export const exportGalleryImage = async ({
    filesLength,
    inputScale,
    selectedRatio,
    vignette,
    overlayBounds,
    outerPadding,
    wallColor,
}: ExportGalleryImageParams) => {
    if (filesLength === 0) {
        throw new Error("请选择图片");
    }

    const target =
        document.getElementById("container") ||
        document.getElementById("tilt-wrapper") ||
        document.getElementById("gallery");

    if (!target) {
        throw new Error("导出目标不存在");
    }

    const originalCanvas = await html2canvas(target, {
        scale: inputScale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        onclone: (clonedDoc) => {
            const container = clonedDoc.getElementById(
                "container"
            ) as HTMLElement | null;
            const wrapper = clonedDoc.getElementById(
                "tilt-wrapper"
            ) as HTMLElement | null;

            if (container) {
                container.style.overflow = "visible";
            }
            if (wrapper) {
                wrapper.style.overflow = "visible";
            }

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
                        })
                )
            );
        },
    });

    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = originalCanvas.width;
    fullCanvas.height = originalCanvas.height;
    const fctx = fullCanvas.getContext("2d");

    if (!fctx) {
        throw new Error("无法创建导出画布");
    }

    fctx.drawImage(originalCanvas, 0, 0);

    if (!selectedRatio || selectedRatio.width === null) {
        if (vignette) {
            const g = fctx.createRadialGradient(
                fullCanvas.width / 2,
                fullCanvas.height / 2,
                Math.min(fullCanvas.width, fullCanvas.height) * 0.45,
                fullCanvas.width / 2,
                fullCanvas.height / 2,
                Math.max(fullCanvas.width, fullCanvas.height) * 0.6
            );
            g.addColorStop(0, "rgba(0,0,0,0)");
            g.addColorStop(1, "rgba(0,0,0,0.35)");
            fctx.fillStyle = g;
            fctx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
        }

        const blob = await new Promise<Blob | null>((resolve) => {
            fullCanvas.toBlob(resolve, "image/png");
        });

        if (!blob) {
            throw new Error("导出图片失败");
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "album-long.png";
        link.click();
        URL.revokeObjectURL(url);
        return { exportedCount: 1, isZip: false };
    }

    const ratio = selectedRatio.width / selectedRatio.height;
    const pageW = fullCanvas.width;
    const pageH = Math.max(1, Math.round(pageW / ratio));

    const containerEl = document.getElementById("container");
    const wrapperEl = document.getElementById("tilt-wrapper");
    let wrapperOffsetTop = 0;

    if (containerEl && wrapperEl) {
        const cRect = containerEl.getBoundingClientRect();
        const wRect = wrapperEl.getBoundingClientRect();
        wrapperOffsetTop = wRect.top - cRect.top;
    }

    const breaksCss =
        overlayBounds && overlayBounds.length > 0 ? overlayBounds : [];
    const boundaries = [
        0,
        ...breaksCss.map((value) =>
            Math.round((value + wrapperOffsetTop) * inputScale)
        ),
        fullCanvas.height,
    ];

    const zip = new JSZip();
    const pagePadding = Math.round(outerPadding * inputScale);
    const files: { name: string; blob: Blob }[] = [];

    for (let i = 1; i < boundaries.length; i += 1) {
        const prev = boundaries[i - 1];
        const end = boundaries[i];
        const sliceH = Math.max(0, end - prev);
        const page = document.createElement("canvas");
        page.width = pageW;
        page.height = pageH;
        const pctx = page.getContext("2d");

        if (!pctx) {
            throw new Error("无法创建分页导出画布");
        }

        pctx.imageSmoothingEnabled = true;
        pctx.imageSmoothingQuality = "high";
        pctx.fillStyle = wallColor;
        pctx.fillRect(0, 0, pageW, pageH);

        if (sliceH > 0) {
            const destY = i === 1 ? 0 : pagePadding;
            pctx.drawImage(
                fullCanvas,
                0,
                prev,
                fullCanvas.width,
                sliceH,
                0,
                destY,
                pageW,
                sliceH
            );
        }

        if (vignette) {
            const g = pctx.createRadialGradient(
                pageW / 2,
                pageH / 2,
                Math.min(pageW, pageH) * 0.45,
                pageW / 2,
                pageH / 2,
                Math.max(pageW, pageH) * 0.6
            );
            g.addColorStop(0, "rgba(0,0,0,0)");
            g.addColorStop(1, "rgba(0,0,0,0.35)");
            pctx.fillStyle = g;
            pctx.fillRect(0, 0, pageW, pageH);
        }

        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

        const blob =
            "convertToBlob" in page
                ? await (page as HTMLCanvasElement & {
                      convertToBlob: (options: { type: string }) => Promise<Blob>;
                  }).convertToBlob({ type: "image/png" })
                : await new Promise<Blob | null>((resolve) =>
                      page.toBlob(resolve, "image/png")
                  );

        if (blob) {
            files.push({
                name: `album-${selectedRatio.label}-${files.length + 1}.png`,
                blob,
            });
        }
    }

    files.forEach((file) => {
        zip.file(file.name, file.blob);
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `album-${selectedRatio.label}-${files.length}p.zip`);

    return { exportedCount: files.length, isZip: true };
};

export const getIdealColumnsFromContainer = ({
    containerWidth,
    containerHeight,
    selectedRatio,
    imageCount,
}: {
    containerWidth: number;
    containerHeight: number;
    selectedRatio: AspectRatio | null;
    imageCount: number;
}) => {
    if (
        !selectedRatio?.width ||
        !containerWidth ||
        !containerHeight ||
        !imageCount
    ) {
        return null;
    }

    const currentRatio = containerWidth / containerHeight;
    const targetRatio = selectedRatio.width / selectedRatio.height;
    const sqrtCount = Math.sqrt(imageCount);

    if (currentRatio > targetRatio) {
        return Math.min(Math.ceil(sqrtCount * 1.5), 10);
    }

    if (currentRatio < targetRatio) {
        return Math.max(Math.ceil(sqrtCount * 0.7), 1);
    }

    return Math.ceil(sqrtCount);
};

export const getColumnsForRatioLabel = ({
    selectedRatio,
    imageCount,
}: {
    selectedRatio: AspectRatio | null;
    imageCount: number;
}) => {
    if (!selectedRatio?.width || !imageCount) {
        return null;
    }

    const sqrtCount = Math.sqrt(imageCount);

    switch (selectedRatio.label) {
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
};

export const calculateOverlayPagination = ({
    selectedRatio,
    outerPadding,
    pageScale,
}: {
    selectedRatio: AspectRatio | null;
    outerPadding: number;
    pageScale: number;
}) => {
    const wrapper = document.getElementById("tilt-wrapper") as HTMLElement | null;
    const container = document.getElementById("container") as HTMLElement | null;

    if (!wrapper || !container) {
        return { estimatedPages: 1, overlayBounds: [] as number[] };
    }

    if (!selectedRatio || selectedRatio.width === null) {
        return { estimatedPages: 1, overlayBounds: [] as number[] };
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const ratio = selectedRatio.width / selectedRatio.height;
    const pageW = containerRect.width;
    const pageH = pageW / ratio;
    const pageSourceH = pageH / Math.max(pageScale, 0.1);
    const wrapperOffsetTop = wrapperRect.top - containerRect.top;
    const frames = Array.from(
        wrapper.querySelectorAll(".photo-frame")
    ) as HTMLElement[];
    const framePositions = frames
        .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top - containerRect.top,
                bottom: rect.bottom - containerRect.top,
            };
        })
        .sort((a, b) => a.top - b.top);

    const breaks: number[] = [];
    let currentY = 0;
    const totalHeight = containerRect.height;
    const pagePadding = outerPadding;

    while (currentY < totalHeight) {
        const usableH =
            pageSourceH - (currentY === 0 ? pagePadding : 2 * pagePadding);
        const idealBottom = currentY + usableH;

        if (idealBottom >= totalHeight) {
            break;
        }

        const findSafeCut = (targetY: number): number => {
            const crossing = framePositions.filter(
                (position) =>
                    position.top < targetY && position.bottom > targetY
            );

            if (crossing.length === 0) {
                return targetY;
            }

            const highestCrossingTop = Math.min(
                ...crossing.map((position) => position.top)
            );
            const newTarget = highestCrossingTop - 20;

            if (newTarget <= currentY) {
                return currentY;
            }

            return findSafeCut(newTarget);
        };

        let splitPoint = findSafeCut(idealBottom);

        if (splitPoint <= currentY) {
            splitPoint = idealBottom;
        }

        if (splitPoint <= currentY + 1) {
            splitPoint = currentY + usableH;
        }

        breaks.push(splitPoint);
        currentY = splitPoint;
    }

    const overlayBounds = Array.from(
        new Set(breaks.map((value) => Math.round(value - wrapperOffsetTop)))
    ).sort((a, b) => a - b);

    return {
        estimatedPages: overlayBounds.length + 1,
        overlayBounds,
    };
};
