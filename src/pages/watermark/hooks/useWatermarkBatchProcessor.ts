import { useCallback, useState } from "react";
import pLimit from "p-limit";
import confetti from "canvas-confetti";
import { ImgWithPosition, MixedWatermarkConfig } from "@/types";
import { useSmoothProgress } from "@/pages/watermark/hooks/useSmoothProgress";
import { importWithRecovery } from "@/utils/import-recovery";

interface UseWatermarkBatchProcessorOptions {
    watermarkUrl: string;
    watermarkColorUrls: Record<string, string>;
    watermarkOpacity: number;
    watermarkBlur: boolean;
    quality: number;
    oversizeThresholdBytes?: number;
    onOversizedFiles?: (files: File[]) => void;
    confirmOversizedFiles?: (payload: {
        files: File[];
        thresholdBytes: number;
        largestFileSizeBytes: number;
    }) => Promise<"download" | "compress">;
}

const DEFAULT_OVERSIZE_THRESHOLD_BYTES = 30 * 1024 * 1024;

function getDownloadExtension(mimeType: string): string {
    if (mimeType === "image/webp") {
        return "webp";
    }
    return "jpg";
}

export function useWatermarkBatchProcessor({
    watermarkUrl,
    watermarkColorUrls,
    watermarkOpacity,
    watermarkBlur,
    quality,
    oversizeThresholdBytes = DEFAULT_OVERSIZE_THRESHOLD_BYTES,
    onOversizedFiles,
    confirmOversizedFiles,
}: UseWatermarkBatchProcessorOptions) {
    const [loading, setLoading] = useState(false);
    const [downloadFinalizing, setDownloadFinalizing] = useState(false);
    const { smoothProgress, updateProgressSmoothly, resetProgress } =
        useSmoothProgress();

    const downloadImagesWithWatermarkBatch = useCallback(
        async (
            imgPositionList: ImgWithPosition[],
            batchSize = 5,
            globalConcurrency = 10,
            mixedConfig?: MixedWatermarkConfig
        ) => {
            const limit = pLimit(globalConcurrency);
            const downloadLink = document.createElement("a");
            const generatedDownloadUrls: string[] = [];
            const watermarkImageCache = new Map<
                string,
                Promise<HTMLImageElement>
            >();
            const oversizedFiles: File[] = [];
            let downloadedCount = 0;

            setLoading(true);
            downloadLink.style.display = "none";
            document.body.appendChild(downloadLink);
            resetProgress();

            console.log("开始批量处理，参数：", {
                watermarkOpacity,
                watermarkBlur,
                quality,
                watermarkUrl,
                imgPostionListLength: imgPositionList.length,
            });

            const getWatermarkImage = (
                src: string
            ): Promise<HTMLImageElement> => {
                const cached = watermarkImageCache.get(src);
                if (cached) {
                    return cached;
                }

                const promise = new Promise<HTMLImageElement>(
                    (resolve, reject) => {
                        const image = new Image();
                        image.onload = () => resolve(image);
                        image.onerror = (error) => {
                            watermarkImageCache.delete(src);
                            reject(error);
                        };
                        image.src = src;
                    }
                );

                watermarkImageCache.set(src, promise);
                return promise;
            };

            const triggerDownload = (file: File) => {
                const url = URL.createObjectURL(file);
                downloadLink.href = url;
                downloadLink.download = file.name;
                downloadLink.click();
                generatedDownloadUrls.push(url);
                downloadedCount += 1;
            };

            let completed = false;

            try {
                const { processImage } = await importWithRecovery(
                    () => import("@/utils/watermark-processing"),
                    "utils:watermark-processing"
                );
                for (let i = 0; i < imgPositionList.length; i += batchSize) {
                    const batch = imgPositionList.slice(i, i + batchSize);

                    const tasks = batch.map((img, index) =>
                        limit(async () => {
                            console.log(`开始处理图片 ${img.id}`, {
                                watermarkColorUrl: watermarkColorUrls[img.id],
                                position: img.position,
                                watermarkOpacity,
                                watermarkBlur,
                                quality,
                            });

                            const { file, position } = img;
                            const watermarkSrc =
                                watermarkColorUrls[img.id] || watermarkUrl;

                            let watermarkImg: HTMLImageElement;
                            try {
                                watermarkImg = await getWatermarkImage(
                                    watermarkSrc
                                );
                                console.log(`水印图像加载成功: ${img.id}`, {
                                    width: watermarkImg.width,
                                    height: watermarkImg.height,
                                    src: watermarkImg.src,
                                });
                            } catch (error) {
                                console.error(
                                    `图片 ${img.id} 的水印加载失败:`,
                                    error
                                );
                                throw new Error(`图片 ${img.id} 的水印加载失败`);
                            }

                            console.log("调用 processImage，参数：", {
                                fileName: file.name,
                                position,
                                watermarkBlur,
                                quality,
                                watermarkOpacity,
                            });

                            const { blob, name, mimeType } = await processImage(
                                file,
                                watermarkImg,
                                position,
                                watermarkBlur,
                                quality,
                                watermarkOpacity,
                                (progress) => {
                                    console.log(
                                        `图片 ${img.id} 处理进度: ${progress}%`
                                    );
                                },
                                mixedConfig
                            );

                            const sliceName = name.split(".")[0];
                            const outputFile = new File(
                                [blob],
                                `${sliceName}-mark.${getDownloadExtension(
                                    mimeType
                                )}`,
                                { type: mimeType }
                            );

                            console.log(`图片 ${img.id} 处理完成`, {
                                size: outputFile.size,
                                name,
                            });

                            if (outputFile.size > oversizeThresholdBytes) {
                                oversizedFiles.push(outputFile);
                            } else {
                                triggerDownload(outputFile);
                            }

                            const progress =
                                ((i + index + 1) / imgPositionList.length) *
                                100;
                            updateProgressSmoothly(Math.min(progress, 100));
                        })
                    );

                    await Promise.all(tasks);
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }

                if (oversizedFiles.length > 0) {
                    setLoading(false);
                    const largestOversizedFile = oversizedFiles.reduce(
                        (largest, current) =>
                            current.size > largest.size ? current : largest,
                        oversizedFiles[0]
                    );
                    const decision = confirmOversizedFiles
                        ? await confirmOversizedFiles({
                              files: oversizedFiles,
                              thresholdBytes: oversizeThresholdBytes,
                              largestFileSizeBytes:
                                  largestOversizedFile.size,
                          })
                        : "download";

                    if (decision === "download") {
                        oversizedFiles.forEach(triggerDownload);
                    } else if (onOversizedFiles) {
                        onOversizedFiles(oversizedFiles);
                    }
                }

                if (downloadedCount > 0) {
                    setDownloadFinalizing(true);
                    const finalizeDelay = Math.min(
                        10000,
                        Math.max(1200, imgPositionList.length * 25)
                    );
                    await new Promise((resolve) =>
                        setTimeout(resolve, finalizeDelay)
                    );
                }
                completed = true;
            } finally {
                setDownloadFinalizing(false);
                if (downloadLink.parentNode) {
                    downloadLink.parentNode.removeChild(downloadLink);
                }
                generatedDownloadUrls.forEach((url) => URL.revokeObjectURL(url));
                watermarkImageCache.clear();
                setLoading(false);
                window.setTimeout(() => {
                    resetProgress();
                }, 500);
            }

            if (completed) {
                confetti({
                    particleCount: 600,
                    spread: 360,
                });
            }
        },
        [
            quality,
            resetProgress,
            confirmOversizedFiles,
            onOversizedFiles,
            oversizeThresholdBytes,
            updateProgressSmoothly,
            watermarkBlur,
            watermarkColorUrls,
            watermarkOpacity,
            watermarkUrl,
        ]
    );

    return {
        loading,
        downloadFinalizing,
        smoothProgress,
        downloadImagesWithWatermarkBatch,
    };
}
