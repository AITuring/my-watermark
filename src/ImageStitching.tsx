import React, { useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Progress } from "antd";

const ImageStitching: React.FC = () => {
    const [stitchedImage, setStitchedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [originalImages, setOriginalImages] = useState<string[]>([]);
    const [progressStep, setProgressStep] = useState<string>("");
    const [progressDetail, setProgressDetail] = useState<string>("");
    const [progressPercent, setProgressPercent] = useState<number>(0);
    // 添加图像尺寸状态
    const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);

    const handleStitchedImage = (base64Image: string, dimensions?: {width: number, height: number}) => {
        setProgressStep("完成");
        setProgressPercent(100);
        setStitchedImage(`data:image/png;base64,${base64Image}`);
        if (dimensions) {
            setImageDimensions(dimensions);
        }
        setIsProcessing(false);
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
        setImageDimensions(null);

        try {
            // 保存原始图片用于显示
            const imageUrls = acceptedFiles.map((file) =>
                URL.createObjectURL(file)
            );
            setOriginalImages(imageUrls);

            // 创建 FormData 对象
            const formData = new FormData();
            acceptedFiles.forEach((file) => {
                formData.append("files", file);
            });

            setProgressStep("上传图像");
            setProgressPercent(20);
            setProgressDetail(`正在上传 ${acceptedFiles.length} 张图像到服务器`);

            // 发送请求到后端 API
            const response = await fetch("http://localhost:8000/stitch", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "拼接失败");
            }

            setProgressStep("处理拼接结果");
            setProgressPercent(80);

            const data = await response.json();
            handleStitchedImage(data.image, data.dimensions);
        } catch (error: any) {
            console.error("图像拼接过程中出错:", error);
            let errorMessage = error.message || "请尝试使用更相似的图片";

            // 提供更具体的错误提示
            if (errorMessage.includes("需要更多图像")) {
                errorMessage = "图像之间没有足够的重叠区域。请尝试使用有更多共同特征的图片，或者增加图片数量。";
            } else if (errorMessage.includes("单应性估计失败")) {
                errorMessage = "无法找到图像之间的对应关系。请确保图像有明显的共同特征。";
            } else if (errorMessage.includes("相机参数调整失败")) {
                errorMessage = "相机参数调整失败。请确保图像是从相似角度拍摄的。";
            }

            alert("拼接失败: " + errorMessage);
            setIsProcessing(false);
        }
    };

    // 添加取消处理功能
    const handleCancel = () => {
        setIsProcessing(false);
        setProgressStep("已取消")
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
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    建议：使用高分辨率图片获得更清晰的拼接效果
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
                    {imageDimensions && (
                        <p className="text-sm text-gray-500 mb-2">
                            图像尺寸: {imageDimensions.width} × {imageDimensions.height} 像素
                        </p>
                    )}
                    <div className="overflow-auto max-w-full border border-gray-200 rounded">
                        <img
                            src={stitchedImage}
                            alt="拼接后的图像"
                            className="max-w-none" // 移除最大宽度限制，保持原始尺寸
                        />
                    </div>
                    <div className="mt-4 flex gap-2">
                        <a
                            href={stitchedImage}
                            download="stitched_image.png"
                            className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors cursor-pointer"
                        >
                            下载拼接图像
                        </a>
                        <button
                            onClick={() => {
                                setStitchedImage(null);
                                setOriginalImages([]);
                                setImageDimensions(null);
                            }}
                            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors cursor-pointer"
                        >
                            清除结果
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageStitching;