import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Progress } from 'antd';

const ImageStitching: React.FC = () => {
    const [stitchedImage, setStitchedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [originalImages, setOriginalImages] = useState<string[]>([]);
    const [progressStep, setProgressStep] = useState<string>('');
    const [progressDetail, setProgressDetail] = useState<string>('');
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const workerRef = useRef<Worker | null>(null);

    // 初始化 worker
    useEffect(() => {
        // 创建 worker
        const worker = new Worker(new URL('./stitchWorker.ts', import.meta.url));

        // 设置 worker 消息处理
        worker.onmessage = (e) => {
            const { type, data } = e.data;

            if (type === 'progress') {
                setProgressStep(data.step);
                if (data.percent !== undefined) {
                    setProgressPercent(Math.round(data.percent));
                }
                if (data.detail) {
                    setProgressDetail(data.detail);
                }
            } else if (type === 'result') {
                // 在主线程中绘制最终图像
                drawFinalImage(data);
            } else if (type === 'error') {
                console.error('Worker 错误:', data);
                alert('拼接失败: ' + data);
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
        const { positions, canvasInfo } = data;
        const { width, height, offsetX, offsetY } = canvasInfo;

        setProgressStep('绘制最终图像');
        setProgressPercent(80);

        // 创建最终画布
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            alert('无法获取 canvas 上下文');
            setIsProcessing(false);
            return;
        }

        // 加载所有图像并绘制
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            setProgressPercent(80 + i * 20 / positions.length);

            // 加载图像
            const img = new Image();
            img.src = originalImages[pos.index];
            await new Promise(resolve => img.onload = resolve);

            // 绘制图像
            ctx.drawImage(
                img,
                0, 0, img.width, img.height,
                pos.x - offsetX, pos.y - offsetY, pos.width * pos.scale, pos.height * pos.scale
            );
        }

        setProgressStep('完成');
        setProgressPercent(100);

        // 设置拼接结果
        setStitchedImage(canvas.toDataURL());
        setIsProcessing(false);
    };

    const onDrop = async (acceptedFiles: File[]) => {
        if (acceptedFiles.length < 2) {
            alert('请至少上传两张图片进行拼接');
            return;
        }

        setIsProcessing(true);
        setProgressStep('准备处理');
        setProgressPercent(0);
        setProgressDetail('');

        try {
            // 保存原始图片用于显示
            const imageUrls = acceptedFiles.map(file => URL.createObjectURL(file));
            setOriginalImages(imageUrls);

            // 加载图片
            const images: HTMLImageElement[] = [];
            const imagesSizes: { width: number, height: number }[] = [];
            const imagesData: ImageData[] = [];

            for (let i = 0; i < acceptedFiles.length; i++) {
                setProgressStep('加载图像');
                setProgressPercent(i * 10 / acceptedFiles.length);
                setProgressDetail(`加载图像 ${i + 1}/${acceptedFiles.length}`);

                const file = acceptedFiles[i];
                const img = new Image();
                img.src = URL.createObjectURL(file);
                await new Promise(resolve => img.onload = resolve);
                images.push(img);

                // 获取图像数据
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('无法获取 canvas 上下文');

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);

                imagesData.push(imageData);
                imagesSizes.push({ width: img.width, height: img.height });
            }

            // 发送数据到 worker 进行处理
            if (workerRef.current) {
                workerRef.current.postMessage({
                    type: 'find_matches',
                    data: {
                        imagesData,
                        imagesSizes
                    }
                });
            } else {
                throw new Error('Worker 未初始化');
            }

        } catch (error) {
            console.error('图像拼接过程中出错:', error);
            alert('拼接失败，请尝试使用更相似的图片');
            setIsProcessing(false);
        }
    };

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: {
            'image/*': []
        },
        multiple: true
    });

    return (
        <div className="flex flex-col items-center p-4 w-full">
            <h1 className="text-2xl font-bold mb-4">图像拼接工具</h1>
            <p className="mb-4 text-gray-600 dark:text-gray-300">上传多张有重叠边缘的图片，自动拼接成一张完整图像</p>

            <div {...getRootProps()} className="border-2 border-dashed p-8 rounded-md cursor-pointer w-full max-w-xl text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <input {...getInputProps()} />
                <p>拖拽多张图片到这里或者点击选择图片</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">提示：图片边缘应有重叠部分以获得最佳效果</p>
            </div>

            {isProcessing && (
                <div className="mt-4 text-center w-full max-w-xl">
                    <p className="mb-2">{progressStep}</p>
                    {progressDetail && <p className="mb-2 text-sm text-gray-500">{progressDetail}</p>}
                    <Progress percent={progressPercent} status="active" />
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