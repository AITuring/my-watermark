import React, { useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Progress } from "antd";

// 添加 OpenCV.js 脚本加载函数
const loadOpenCV = () => {
    return new Promise<void>((resolve, reject) => {
        if ((window as any).cv) {
            resolve();
            return;
        }

        // 设置 Module 对象以捕获 OpenCV 初始化完成事件
        (window as any).Module = {
            onRuntimeInitialized: function () {
                console.log("OpenCV.js 在主线程中初始化完成");
                resolve();
            },
        };

        const script = document.createElement("script");
        script.src = "https://docs.opencv.org/4.5.5/opencv.js";
        script.async = true;
        // script.onload = () => {
        //     // 触发 OpenCV 加载完成事件
        //     const event = new Event('opencv_loaded');
        //     window.dispatchEvent(event);
        //     resolve();
        // };
        script.onerror = () => {
            reject(new Error("OpenCV.js 加载失败"));
        };
        document.body.appendChild(script);

        setTimeout(() => {
            if (!(window as any).cv) {
                reject(new Error("OpenCV.js 加载超时"));
            }
        }, 30000); // 30秒超时
    });
};

const ImageStitching: React.FC = () => {
    const [stitchedImage, setStitchedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [originalImages, setOriginalImages] = useState<string[]>([]);
    const [progressStep, setProgressStep] = useState<string>("");
    const [progressDetail, setProgressDetail] = useState<string>("");
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const workerRef = useRef<Worker | null>(null);
    const cvReady = useRef<boolean>(false);

    // 初始化 OpenCV 和 Worker
    useEffect(() => {
        // 加载 OpenCV.js
        loadOpenCV().then(() => {
            cvReady.current = true;
            console.log("OpenCV.js 已加载");
        });

        // 创建 worker
        const worker = new Worker(
            new URL("./stitchWorker.ts", import.meta.url)
        );

        // 设置 worker 消息处理
        worker.onmessage = (e) => {
            const { type, data } = e.data;

            if (type === "progress") {
                setProgressStep(data.step);
                if (data.percent !== undefined) {
                    setProgressPercent(Math.round(data.percent));
                }
                if (data.detail) {
                    setProgressDetail(data.detail);
                }
            } else if (type === "result") {
                // 在主线程中绘制最终图像
                drawFinalImage(data);
            } else if (type === "error") {
                console.error("Worker 错误:", data);
                alert("拼接失败: " + data);
                setIsProcessing(false);
            }
        };

        workerRef.current = worker;

        // 清理函数
        return () => {
            worker.terminate();
        };
    }, []);

    // 在主线程中绘制最终图像
    const drawFinalImage = async (data: any) => {
        if ((window as any).stitchTimeoutId) {
            clearTimeout((window as any).stitchTimeoutId);
        }

        setProgressStep("绘制最终图像");
        setProgressPercent(80);

        try {
            // 从 Worker 接收全景图像数据
            const { panoramaData, width, height } = data;

            // 创建最终画布
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                throw new Error("无法获取 canvas 上下文");
            }

            // 将图像数据绘制到画布
            ctx.putImageData(panoramaData, 0, 0);

            setProgressStep("完成");
            setProgressPercent(100);

            // 设置拼接结果
            setStitchedImage(canvas.toDataURL());
        } catch (error) {
            console.error("处理拼接结果时出错:", error);
            alert("处理拼接结果失败");
        } finally {
            setIsProcessing(false);
        }
    };

    const onDrop = async (acceptedFiles: File[]) => {
        if (acceptedFiles.length < 2) {
            alert("请至少上传两张图片进行拼接");
            return;
        }

        setIsProcessing(true);
        setProgressStep("准备处理");
        setProgressPercent(0);
        setProgressDetail("");

        try {
            // 保存原始图片用于显示
            const imageUrls = acceptedFiles.map((file) =>
                URL.createObjectURL(file)
            );
            setOriginalImages(imageUrls);

            // 加载图片
            const images: HTMLImageElement[] = [];
            const imagesSizes: { width: number; height: number }[] = [];
            const imagesData: ImageData[] = [];

            // 限制最大尺寸，过大的图像会导致性能问题
            const MAX_DIMENSION = 1200;

            for (let i = 0; i < acceptedFiles.length; i++) {
                setProgressStep("加载图像");
                setProgressPercent((i * 10) / acceptedFiles.length);
                setProgressDetail(`加载图像 ${i + 1}/${acceptedFiles.length}`);

                const file = acceptedFiles[i];
                const img = new Image();

                // 使用 Promise 包装图像加载过程
                await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = () =>
                        reject(new Error(`图像 ${i + 1} 加载失败`));
                    img.src = URL.createObjectURL(file);
                });

                // 检查图像尺寸，如果太大则缩小
                let finalWidth = img.width;
                let finalHeight = img.height;

                if (finalWidth > MAX_DIMENSION || finalHeight > MAX_DIMENSION) {
                    if (finalWidth > finalHeight) {
                        finalHeight = Math.floor(
                            finalHeight * (MAX_DIMENSION / finalWidth)
                        );
                        finalWidth = MAX_DIMENSION;
                    } else {
                        finalWidth = Math.floor(
                            finalWidth * (MAX_DIMENSION / finalHeight)
                        );
                        finalHeight = MAX_DIMENSION;
                    }

                    setProgressDetail(`图像 ${i + 1} 尺寸过大，已自动缩小`);
                }

                images.push(img);

                // 获取图像数据
                const canvas = document.createElement("canvas");
                canvas.width = finalWidth;
                canvas.height = finalHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) throw new Error("无法获取 canvas 上下文");

                // 绘制可能经过缩放的图像
                ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
                const imageData = ctx.getImageData(
                    0,
                    0,
                    finalWidth,
                    finalHeight
                );

                imagesData.push(imageData);
                imagesSizes.push({ width: finalWidth, height: finalHeight });
            }

            // 发送数据到 worker 进行处理
            if (workerRef.current) {
                const timeoutId = setTimeout(() => {
                    if (isProcessing) {
                        alert("处理超时，请尝试使用更小的图片或减少图片数量");
                        handleCancel();
                    }
                }, 60000); // 60秒超时

                // 保存超时 ID 以便在成功时清除
                (window as any).stitchTimeoutId = timeoutId;

                workerRef.current.postMessage({
                    type: "find_matches",
                    data: {
                        imagesData,
                        imagesSizes,
                    },
                });
            } else {
                throw new Error("Worker 未初始化");
            }
        } catch (error) {
            console.error("图像拼接过程中出错:", error);
            alert("拼接失败，请尝试使用更相似的图片");
            setIsProcessing(false);
        }
    };

    // 添加取消处理功能
    const handleCancel = () => {
        if (workerRef.current) {
            workerRef.current.terminate();

            // 重新创建 worker
            const worker = new Worker(
                new URL("./stitchWorker.ts", import.meta.url)
            );
            worker.onmessage = (e) => {
                const { type, data } = e.data;

                if (type === "progress") {
                    setProgressStep(data.step);
                    if (data.percent !== undefined) {
                        setProgressPercent(Math.round(data.percent));
                    }
                    if (data.detail) {
                        setProgressDetail(data.detail);
                    }
                } else if (type === "result") {
                    drawFinalImage(data);
                } else if (type === "error") {
                    console.error("Worker 错误:", data);
                    alert("拼接失败: " + data);
                    setIsProcessing(false);
                }
            };
            workerRef.current = worker;
        }

        setIsProcessing(false);
        setProgressStep("已取消");
        setProgressPercent(0);
    };

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: {
            "image/*": [],
        },
        multiple: true,
    });

    return (
        <div className="flex flex-col items-center p-4 w-full">
            <h1 className="text-2xl font-bold mb-4">图像拼接工具</h1>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
                上传多张有重叠边缘的图片，自动拼接成一张完整图像
            </p>

            <div
                {...getRootProps()}
                className="border-2 border-dashed p-8 rounded-md cursor-pointer w-full max-w-xl text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
                <input {...getInputProps()} />
                <p>拖拽多张图片到这里或者点击选择图片</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    提示：图片边缘应有重叠部分以获得最佳效果
                </p>
            </div>

            {isProcessing && (
                <div className="mt-4 text-center w-full max-w-xl">
                    <p className="mb-2">{progressStep}</p>
                    {progressDetail && (
                        <p className="mb-2 text-sm text-gray-500">
                            {progressDetail}
                        </p>
                    )}
                    <Progress percent={progressPercent} status="active" />
                    <button
                        onClick={handleCancel}
                        className="mt-2 px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                        取消处理
                    </button>
                </div>
            )}

            {originalImages.length > 0 && (
                <div className="mt-6 w-full">
                    <h2 className="text-xl font-semibold mb-2">原始图片</h2>
                    <div className="flex overflow-x-auto gap-2 pb-2">
                        {originalImages.map((src, index) => (
                            <img
                                key={index}
                                src={src}
                                alt={`原始图片 ${index + 1}`}
                                className="max-h-40 object-contain"
                            />
                        ))}
                    </div>
                </div>
            )}

            {stitchedImage && (
                <div className="mt-6 w-full">
                    <h2 className="text-xl font-semibold mb-2">拼接结果</h2>
                    <div className="overflow-auto max-w-full">
                        <img
                            src={stitchedImage}
                            alt="拼接后的图像"
                            className="max-w-full"
                        />
                    </div>
                    <a
                        href={stitchedImage}
                        download="stitched_image.png"
                        className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                        下载拼接图像
                    </a>
                </div>
            )}
        </div>
    );
};

export default ImageStitching;
