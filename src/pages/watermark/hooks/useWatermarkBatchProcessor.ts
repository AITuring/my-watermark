import { useCallback, useState } from "react";
import pLimit from "p-limit";
import confetti from "canvas-confetti";
import { processImage } from "@/utils";
import { ImgWithPosition, MixedWatermarkConfig } from "@/types";
import { useSmoothProgress } from "@/pages/watermark/hooks/useSmoothProgress";

interface UseWatermarkBatchProcessorOptions {
    watermarkUrl: string;
    watermarkColorUrls: Record<string, string>;
    watermarkOpacity: number;
    watermarkBlur: boolean;
    quality: number;
}

export function useWatermarkBatchProcessor({
    watermarkUrl,
    watermarkColorUrls,
    watermarkOpacity,
    watermarkBlur,
    quality,
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

            let completed = false;

            try {
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

                            const { url, name } = await processImage(
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

                            console.log(`图片 ${img.id} 处理完成`, {
                                url: `${url.substring(0, 50)}...`,
                                name,
                            });

                            const sliceName = name.split(".")[0];
                            downloadLink.href = url;
                            downloadLink.download = `${sliceName}-mark.jpeg`;
                            downloadLink.click();
                            generatedDownloadUrls.push(url);

                            const progress =
                                ((i + index + 1) / imgPositionList.length) *
                                100;
                            updateProgressSmoothly(Math.min(progress, 100));
                        })
                    );

                    await Promise.all(tasks);
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }

                setDownloadFinalizing(true);
                const finalizeDelay = Math.min(
                    10000,
                    Math.max(1200, imgPositionList.length * 25)
                );
                await new Promise((resolve) =>
                    setTimeout(resolve, finalizeDelay)
                );
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
