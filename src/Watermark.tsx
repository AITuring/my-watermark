import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import BackgroundGradientAnimation from "@/components/BackgroundGradientAnimation";
import { Menu } from "lucide-react";
import { Icon } from "@iconify/react";
import {
    loadImageData,
    debounce,
    processImage,
    adjustBatchSizeAndConcurrency,
} from "./utils";
import { useDeviceDetect } from "@/hooks";
import { ImageType, WatermarkPosition, ImgWithPosition } from "./types";
import ImageUploader from "./ImageUploader";
import WatermarkEditor from "./WatermarkEditor";
import MobileWatermarkEditor from "./MobileWatermarkEditor";
import VerticalCarousel from "./VerticalCarousel";
import MobileImageGallery from "./MobileImageGallery";
import pLimit from "p-limit";
import confetti from "canvas-confetti";
import "./watermark.css";

interface ProgressButtonProps {
    onClick: () => void;
    loading: boolean;
    progress: number;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
}

const ProgressButton: React.FC<ProgressButtonProps> = ({
    onClick,
    loading,
    progress,
    children,
    className = "",
    disabled = false,
}) => {
    return (
        <Button
            onClick={onClick}
            size="lg"
            disabled={loading || disabled}
            className={`relative overflow-hidden ${className}`}
        >
            {loading ? (
                <>
                    <div
                        className="absolute inset-0 bg-blue-600"
                        style={{
                            width: `${progress}%`,
                            transition: "width 0.3s ease",
                        }}
                    ></div>
                    <span className="relative z-10 flex items-center">
                        图片生成中: {Math.round(progress)}%
                    </span>
                </>
            ) : (
                children
            )}
        </Button>
    );
};

const Watermark: React.FC = () => {
    const [images, setImages] = useState<ImageType[]>([]);
    const deviceType = useDeviceDetect(); // 获取设备类型
    const isMobile = deviceType === "mobile";

    const editorHeight = window.innerHeight * (isMobile ? 0.6 : 0.8);

    // 当前照片
    const [currentImg, setCurrentImg] = useState<ImageType | null>();
    const [watermarkUrl, setWatermarkUrl] = useState("/logo.png");

    const [watermarkPositions, setWatermarkPositions] = useState<
        WatermarkPosition[]
    >([]);

    // 水印颜色状态数组，为每张图片存储对应的颜色base64地址
    const [watermarkColorUrls, setWatermarkColorUrls] = useState<{
        [key: string]: string;
    }>({});

    const dropzoneRef = useRef(null);

    const [loading, setLoading] = useState(false);
    // 图片处理进度
    const [imgProgress, setImgProgress] = useState<number>(0);
    // 第一步：上传图片
    const [imageUploaderVisible, setImageUploaderVisible] = useState(true);

    // 图片质量
    const [quality, setQuality] = useState<number>(0.9);
    // 水印背景模糊
    const [watermarkBlur, setWatermarkBlur] = useState<boolean>(true);

    // 移动端菜单状态
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    // 移动端当前视图（编辑器/图库）
    const [mobileView, setMobileView] = useState<"editor" | "gallery">(
        "editor"
    );

    // 添加平滑进度状态
    const [smoothProgress, setSmoothProgress] = useState<number>(0);
    const progressRef = useRef<number>(0);
    const animationRef = useRef<number | null>(null);

    // 平滑更新进度的函数
    const updateProgressSmoothly = (targetProgress: number) => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }

        const animate = () => {
            const currentProgress = progressRef.current;
            const diff = targetProgress - currentProgress;

            // 如果差距很小或已达到目标，直接设置为目标值
            if (Math.abs(diff) < 0.5) {
                progressRef.current = targetProgress;
                setSmoothProgress(targetProgress);
                return;
            }

            // 否则平滑过渡 (每次更新约5%的差距)
            const newProgress = currentProgress + diff * 0.05;
            progressRef.current = newProgress;
            setSmoothProgress(newProgress);

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);
    };

    // 在组件卸载时清理动画
    useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (images.length === 0) {
            setImageUploaderVisible(true);
        }
    }, [images]);

    const handleImagesUpload = async (files: File[]) => {
        const uploadImages = await loadImageData(files);
        setImages((prevImages) => {
            // 如果之前没有图片，直接设置
            if (prevImages.length === 0) {
                setCurrentImg(uploadImages[0]);
                setImageUploaderVisible(false);

                // 初始化水印位置
                setWatermarkPositions(
                    uploadImages.map((img) => ({
                        id: img.id,
                        x: 0,
                        y: 0,
                        scaleX: 1,
                        scaleY: 1,
                        rotation: 0,
                    }))
                );

                // 初始化水印颜色（默认为空，表示使用原始颜色）
                const newColors = {};
                uploadImages.forEach((img) => {
                    newColors[img.id] = "";
                });
                setWatermarkColorUrls((prev) => ({ ...prev, ...newColors }));

                return uploadImages;
            } else {
                // 如果已有图片，合并新上传的图片
                const newImages = [...prevImages, ...uploadImages];

                // 为新上传的图片初始化水印位置
                const newPositions = uploadImages.map((img) => ({
                    id: img.id,
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                }));

                // 初始化水印颜色（默认为空，表示使用原始颜色）
                const newColors = {};
                uploadImages.forEach((img) => {
                    newColors[img.id] = "";
                });
                setWatermarkColorUrls((prev) => ({ ...prev, ...newColors }));

                setWatermarkPositions((prev) => [...prev, ...newPositions]);

                return newImages;
            }
        });
    };

    // 更新水印颜色
    const handleWatermarkColorChange = (
        imageId: string,
        newWatermarkUrl: string
    ) => {

        setWatermarkColorUrls((prev) => ({
            ...prev,
            [imageId]: newWatermarkUrl,
        }));
    };

    const handleWatermarkUpload = (files: File[]) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            setWatermarkUrl(event.target!.result as string);
        };
        reader.readAsDataURL(files[0]);
    };

    const handleWatermarkTransform = (
        imageId,
        position: {
            x: number;
            y: number;
            scaleX: number;
            scaleY: number;
            rotation: number;
        }
    ) => {
        setWatermarkPositions((prev) =>
            prev.map((pos) =>
                pos.id === imageId ? { ...pos, ...position } : pos
            )
        );
        console.log(watermarkPositions, "watermarkPositions");
    };

    const handleAllWatermarkTransform = (position: {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        rotation: number;
    }) => {
        setWatermarkPositions((prev) =>
            prev.map((img) => {
                return { ...position, id: img.id };
            })
        );
    };

    console.log("watermarkPosition", watermarkPositions);

    async function downloadImagesWithWatermarkBatch(
        imgPostionList,
        batchSize = 5,
        globalConcurrency = 10
    ) {
        const limit = pLimit(globalConcurrency);
        const downloadLink = document.createElement("a");
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);

        // 重置进度
        setImgProgress(0);
        progressRef.current = 0;
        setSmoothProgress(0);

        // 按照 batchSize 分批处理
        for (let i = 0; i < imgPostionList.length; i += batchSize) {
            const batch = imgPostionList.slice(i, i + batchSize); // 当前批次的图片

            const tasks = batch.map((img, index) =>
                limit(async () => {
                    console.log(`开始处理图片 ${img.id}`, watermarkColorUrls[img.id]);
                    const { file, position } = img;

                    // 创建并加载水印图像
                    const watermarkImg = new Image();
                    try {
                        await new Promise((resolve, reject) => {
                            watermarkImg.onload = resolve;
                            watermarkImg.onerror = (e) => {
                                console.error("水印图像加载失败:", e);
                                reject(new Error("水印图像加载失败"));
                            };
                            watermarkImg.src =
                                watermarkColorUrls[img.id] || '/logo.png';
                        });
                    } catch (error) {
                        console.error(`图片 ${img.id} 的水印加载失败:`, error);
                        throw new Error(`图片 ${img.id} 的水印加载失败`);
                    }
                    // 开始处理图片时先更新一个中间进度状态
                    const startProgress =
                        ((i + index) / imgPostionList.length) * 100;
                    const { url, name } = await processImage(
                        file,
                        watermarkImg,
                        position,
                        watermarkBlur,
                        quality
                    );
                    const sliceName = name.split(".")[0];
                    downloadLink.href = url;
                    downloadLink.download = `${sliceName}-mark.jpeg`;
                    downloadLink.click();
                    URL.revokeObjectURL(url);

                    // 图片处理完成后更新最终进度
                    const progress =
                        ((i + index + 1) / imgPostionList.length) * 100;
                    setImgProgress(Math.min(progress, 100));
                    updateProgressSmoothly(Math.min(progress, 100));
                })
            );

            // 等待当前批次完成
            await Promise.all(tasks);

            // 加一点延时，避免占用过高资源
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        document.body.removeChild(downloadLink);
        setLoading(false);
        confetti({
            particleCount: 600,
            spread: 360,
        });

        // 确保进度条完成后再重置
        setTimeout(() => {
            setImgProgress(0);
            setSmoothProgress(0);
            progressRef.current = 0;
        }, 500);
    }

    const handleApplyWatermark = async () => {
        if (!watermarkUrl) {
            alert("请上传水印图片！");
            return;
        }
        setLoading(true);
        const { batchSize, globalConcurrency } =
            adjustBatchSizeAndConcurrency(images);

        try {
            console.log("水印下载开始！");

            const allimageData: ImgWithPosition[] = images.map((img) => ({
                id: img.id,
                file: img.file,
                position: watermarkPositions.find((pos) => pos.id === img.id)!,
            }));

            console.log("allimageData", allimageData);
            await downloadImagesWithWatermarkBatch(
                allimageData,
                batchSize,
                globalConcurrency
            );
        } catch (error) {
            console.error("处理水印失败:", error);
            alert("处理水印失败，请重试。");
            setLoading(false);
        }
    };

    // 使用 debounce 包裹你的事件处理函数
    const handleApplyWatermarkDebounced = debounce(handleApplyWatermark, 500);

    // 渲染移动端界面
    const renderMobileUI = () => {
        if (imageUploaderVisible) {
            return (
                <BackgroundGradientAnimation>
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                        <ImageUploader
                            ref={dropzoneRef}
                            onUpload={handleImagesUpload}
                            fileType="背景"
                        >
                            <div className="p-4 rounded-lg text-white text-xl font-medium bg-blue-500/90 backdrop-blur-sm cursor-pointer flex flex-col items-center hover:bg-blue-600 transition-all duration-300 shadow-lg hover:shadow-blue-300/30">
                                上传背景图片
                            </div>
                        </ImageUploader>
                    </div>
                </BackgroundGradientAnimation>
            );
        }

        return (
            <div className="flex flex-col h-screen">
                {/* 移动端顶部导航 */}
                <div className="flex justify-between items-center p-3 bg-white/90 backdrop-blur-sm shadow-sm">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                    <div className="text-center font-medium">
                        {mobileView === "editor" ? "水印编辑" : "图片库"}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                setMobileView(
                                    mobileView === "editor"
                                        ? "gallery"
                                        : "editor"
                                )
                            }
                        >
                            {mobileView === "editor" ? "图片库" : "编辑器"}
                        </Button>
                    </div>
                </div>

                {/* 移动端主内容区 */}
                <div className="flex-1 overflow-hidden">
                    {mobileView === "editor" && currentImg ? (
                        <MobileWatermarkEditor
                            watermarkUrl={watermarkUrl}
                            backgroundImageFile={currentImg.file}
                            currentWatermarkPosition={watermarkPositions.find(
                                (pos) => pos.id === currentImg.id
                            )}
                            onTransform={(position) => {
                                console.log(
                                    "position",
                                    position,
                                    currentImg.id
                                );
                                handleWatermarkTransform(
                                    currentImg.id,
                                    position
                                );
                            }}
                            totalImages={images.length}
                            currentIndex={images.findIndex(
                                (img) => img.id === currentImg.id
                            )}
                            onAllTransform={handleAllWatermarkTransform}
                            onPrevImage={() => {
                                const currentIndex = images.findIndex(
                                    (img) => img.id === currentImg.id
                                );
                                if (currentIndex > 0) {
                                    const prevImg = images[currentIndex - 1];
                                    setCurrentImg(prevImg);
                                }
                            }}
                            onNextImage={() => {
                                const currentIndex = images.findIndex(
                                    (img) => img.id === currentImg.id
                                );
                                if (currentIndex < images.length - 1) {
                                    const nextImg = images[currentIndex + 1];
                                    setCurrentImg(nextImg);
                                }
                            }}
                        />
                    ) : (
                        <MobileImageGallery
                            images={images}
                            setImages={setImages}
                            setImageUploaderVisible={setImageUploaderVisible}
                            setCurrentImg={setCurrentImg}
                            currentImageId={currentImg?.id}
                            onImageSelect={() => setMobileView("editor")}
                        />
                    )}
                </div>

                {/* 移动端底部工具栏 */}
                <div className="p-3 border-t bg-white/90 backdrop-blur-sm">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-baseline gap-6">
                            <div className="relative group">
                                <ImageUploader
                                    onUpload={handleWatermarkUpload}
                                    fileType="水印"
                                    className="w-12 h-12 rounded-md cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors duration-200"
                                >
                                    <div className="w-full h-full flex items-center justify-center">
                                        <img
                                            src={watermarkUrl}
                                            alt="watermark"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    </div>
                                </ImageUploader>
                                <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs px-1 rounded-sm">
                                    水印
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-sm">模糊</span>
                                <Switch
                                    checked={watermarkBlur}
                                    onCheckedChange={setWatermarkBlur}
                                    className="data-[state=checked]:bg-blue-500"
                                />
                            </div>
                            <ProgressButton
                                onClick={handleApplyWatermarkDebounced}
                                loading={loading}
                                progress={smoothProgress}
                                className="bg-blue-500 hover:bg-blue-600 shadow-md transition-all duration-200"
                            >
                                <Icon
                                    icon="mdi:image-filter-center-focus"
                                    className="mr-2 h-5 w-5"
                                />
                                水印生成
                            </ProgressButton>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // 渲染桌面端界面
    const renderDesktopUI = () => {
        if (imageUploaderVisible) {
            return (
                <BackgroundGradientAnimation>
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                        <ImageUploader
                            ref={dropzoneRef}
                            onUpload={handleImagesUpload}
                            fileType="背景"
                        >
                            <div className="p-6 rounded-lg text-white text-2xl font-medium bg-blue-500/90 backdrop-blur-sm cursor-pointer flex flex-col items-center hover:bg-blue-600 transition-all duration-300 shadow-lg hover:shadow-blue-300/30">
                                上传背景图片
                            </div>
                        </ImageUploader>
                    </div>
                </BackgroundGradientAnimation>
            );
        }

        return (
            <div className="flex flex-col h-screen justify-between">
                <div className="flex p-4 justify-between gap-2">
                    {images.length > 0 && (
                        <VerticalCarousel
                            images={images}
                            setImages={setImages}
                            setImageUploaderVisible={setImageUploaderVisible}
                            setCurrentImg={setCurrentImg}
                            height={editorHeight}
                        />
                    )}
                    {watermarkUrl && currentImg && (
                        <WatermarkEditor
                            watermarkUrl={watermarkUrl}
                            backgroundImageFile={currentImg.file}
                            currentWatermarkPosition={watermarkPositions.find(
                                (pos) => pos.id === currentImg.id
                            )}
                            onTransform={(position) => {
                                handleWatermarkTransform(
                                    currentImg.id,
                                    position
                                );
                            }}
                            onAllTransform={(position) => {
                                handleAllWatermarkTransform(position);
                            }}
                            watermarkColor={
                                watermarkColorUrls[currentImg.id] || ""
                            }
                            onColorChange={(color) =>
                                handleWatermarkColorChange(currentImg.id, color)
                            }
                        />
                    )}
                </div>
                <div className="flex items-baseline backdrop-blur-lg shadow-inner p-4 border-t border-gray-200 dark:border-gray-800 gap-10">
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <ImageUploader
                                onUpload={handleWatermarkUpload}
                                fileType="水印"
                                className="w-16 h-16 rounded-md cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors duration-200"
                            >
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="w-full h-full flex items-center justify-center">
                                                <img
                                                    src={watermarkUrl}
                                                    alt="watermark"
                                                    className="max-w-full max-h-full object-contain group-hover:opacity-80 transition-opacity"
                                                />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>点击上传水印图片</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </ImageUploader>
                            <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs px-1 rounded-sm">
                                水印
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3 px-4 py-2">
                            <div className="flex items-center">
                                <Switch
                                    checked={watermarkBlur}
                                    onCheckedChange={setWatermarkBlur}
                                    className="data-[state=checked]:bg-blue-500"
                                />
                            </div>
                            <div className="flex items-center text-sm font-medium">
                                水印背景模糊
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Icon
                                                icon="ic:outline-help"
                                                className="w-4 h-4 ml-2 cursor-help text-gray-500"
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>开启后水印周围有一层高斯模糊</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                    </div>

                    {/* <Button
                        onClick={handleApplyWatermarkDebounced}
                        size="lg"
                        disabled={loading}
                        className="bg-blue-500 hover:bg-blue-600 px-6 shadow-md transition-all duration-200 hover:translate-y-[-2px]"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                处理中...
                            </>
                        ) : (
                            <>
                                <Icon
                                    icon="mdi:image-filter-center-focus"
                                    className="mr-2 h-5 w-5"
                                />
                                水印生成
                            </>
                        )}
                    </Button> */}
                    <ProgressButton
                        onClick={handleApplyWatermarkDebounced}
                        loading={loading}
                        progress={smoothProgress}
                        className="bg-blue-500 hover:bg-blue-600 shadow-md transition-all duration-200"
                    >
                        <Icon
                            icon="mdi:image-filter-center-focus"
                            className="mr-2 h-5 w-5"
                        />
                        水印生成
                    </ProgressButton>
                </div>
            </div>
        );
    };

    return (
        <div className="relative w-screen h-screen">
            {imageUploaderVisible ? <div className="watermarkBg"></div> : <></>}
            <div>{isMobile ? renderMobileUI() : renderDesktopUI()}</div>
        </div>
    );
};

export default Watermark;
