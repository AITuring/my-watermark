import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import BackgroundGradientAnimation from "@/components/BackgroundGradientAnimation";
import ChineseWaveBackground from "./components/ChineseWaveBackground";
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
    const [quality, setQuality] = useState<number>(1);
    // 水印背景模糊
    const [watermarkBlur, setWatermarkBlur] = useState<boolean>(true);
    // 水印透明度
    const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.8);

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
                        x: 0.5,
                        y: 0.5,
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
                    x: 0.5,
                    y: 0.5,
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

    // console.log("watermarkPosition", watermarkPositions);

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

        // 添加调试信息
        console.log("开始批量处理，参数：", {
            watermarkOpacity,
            watermarkBlur,
            quality,
            watermarkUrl,
            imgPostionListLength: imgPostionList.length
        });

        // 按照 batchSize 分批处理
        for (let i = 0; i < imgPostionList.length; i += batchSize) {
            const batch = imgPostionList.slice(i, i + batchSize);

            const tasks = batch.map((img, index) =>
                limit(async () => {
                    console.log(
                        `开始处理图片 ${img.id}`,
                        {
                            watermarkColorUrl: watermarkColorUrls[img.id],
                            position: img.position,
                            watermarkOpacity,
                            watermarkBlur,
                            quality
                        }
                    );
                    const { file, position } = img;

                    // 创建并加载水印图像
                    const watermarkImg = new Image();
                    try {
                        await new Promise((resolve, reject) => {
                            watermarkImg.onload = () => {
                                console.log(`水印图像加载成功: ${img.id}`, {
                                    width: watermarkImg.width,
                                    height: watermarkImg.height,
                                    src: watermarkImg.src
                                });
                                resolve(watermarkImg);
                            };
                            watermarkImg.onerror = (e) => {
                                console.error("水印图像加载失败:", e);
                                reject(new Error("水印图像加载失败"));
                            };
                            watermarkImg.src =
                                watermarkColorUrls[img.id] || watermarkUrl;
                        });
                    } catch (error) {
                        console.error(`图片 ${img.id} 的水印加载失败:`, error);
                        throw new Error(`图片 ${img.id} 的水印加载失败`);
                    }

                    // 开始处理图片时先更新一个中间进度状态
                    const startProgress =
                        ((i + index) / imgPostionList.length) * 100;

                    console.log(`调用 processImage，参数：`, {
                        fileName: file.name,
                        position,
                        watermarkBlur,
                        quality,
                        watermarkOpacity
                    });

                    const { url, name } = await processImage(
                        file,
                        watermarkImg,
                        position,
                        watermarkBlur,
                        quality,
                        watermarkOpacity,
                        (progress) => {
                            // 单个图片的进度回调
                            const overallProgress =
                                ((i + index + progress / 100) / imgPostionList.length) * 100;
                            console.log(`图片 ${img.id} 处理进度: ${progress}%`);
                        }
                    );

                    console.log(`图片 ${img.id} 处理完成`, { url: url.substring(0, 50) + '...', name });

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

            const allimageData: ImgWithPosition[] = images.map((img) => {
                const position = watermarkPositions.find(
                    (pos) => pos.id === img.id
                );
                // 如果找不到对应的 position，使用默认值
                const defaultPosition = {
                    id: img.id,
                    x: 0.5, // 改为居中
                    y: 0.5, // 改为居中
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                };

                const finalPosition = position || defaultPosition;

                // 添加调试日志
                console.log(`图片 ${img.id} 的位置参数:`, {
                    found: !!position,
                    position: finalPosition
                });

                return {
                    id: img.id,
                    file: img.file,
                    position: finalPosition,
                };
            });

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
                <ChineseWaveBackground>
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                        <ImageUploader
                            ref={dropzoneRef}
                            onUpload={handleImagesUpload}
                            fileType="背景"
                        >
                            <div className="group p-6 md:p-8 rounded-3xl text-slate-700 bg-white/20 backdrop-blur-xl cursor-pointer flex flex-col items-center hover:bg-white/30 transition-all duration-500 shadow-2xl border border-white/30 hover:border-white/50 hover:shadow-3xl hover:scale-105 transform">
                                {/* 图片动画容器 */}
                                <div className="relative mb-3 md:mb-4 w-16 h-12 md:w-18 md:h-14">
                                    {/* 底层图片 */}
                                    <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-slate-200 to-slate-300 rounded-lg shadow-lg transform transition-all duration-700 ease-out group-hover:translate-x-3 group-hover:translate-y-2 group-hover:rotate-6 group-hover:scale-95">
                                        <div className="w-full h-full rounded-lg overflow-hidden relative">
                                            {/* 图片内容 - 风景 */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-blue-200 to-green-200"></div>
                                            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-green-300 to-transparent"></div>
                                            <div className="absolute bottom-1/3 left-1/4 w-3 h-2 bg-green-400 rounded-full opacity-60"></div>
                                            <div className="absolute bottom-1/4 right-1/3 w-2 h-1.5 bg-green-500 rounded-full opacity-40"></div>
                                        </div>
                                    </div>

                                    {/* 中层图片 */}
                                    <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg shadow-xl transform transition-all duration-600 ease-out group-hover:-translate-x-2 group-hover:translate-y-1 group-hover:-rotate-3 group-hover:scale-105 z-10">
                                        <div className="w-full h-full rounded-lg overflow-hidden relative">
                                            {/* 图片内容 - 城市 */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-orange-200 to-yellow-200"></div>
                                            <div className="absolute bottom-0 left-0 w-2 h-3 bg-gray-400 opacity-70"></div>
                                            <div className="absolute bottom-0 left-2 w-1.5 h-4 bg-gray-500 opacity-60"></div>
                                            <div className="absolute bottom-0 right-2 w-2 h-2.5 bg-gray-400 opacity-80"></div>
                                            <div className="absolute top-1/4 right-1/4 w-4 h-1 bg-yellow-300 rounded-full opacity-60"></div>
                                        </div>
                                    </div>

                                    {/* 顶层图片 */}
                                    <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-white to-slate-100 rounded-lg shadow-2xl transform transition-all duration-500 ease-out group-hover:-translate-x-4 group-hover:-translate-y-2 group-hover:-rotate-8 group-hover:scale-110 z-20">
                                        <div className="w-full h-full rounded-lg overflow-hidden relative">
                                            {/* 图片内容 - 山景 */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-blue-100 to-purple-100"></div>
                                            <div className="absolute bottom-0 left-0 right-0 h-2/3">
                                                <svg
                                                    className="w-full h-full text-purple-300/60"
                                                    fill="currentColor"
                                                    viewBox="0 0 100 60"
                                                >
                                                    <path d="M0 60 L20 30 L40 45 L60 20 L80 35 L100 15 L100 60 Z" />
                                                </svg>
                                            </div>
                                            <div className="absolute top-1/4 right-1/3 w-3 h-1 bg-yellow-200 rounded-full opacity-80"></div>
                                        </div>
                                    </div>

                                    {/* 上传指示器 */}
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 delay-300 z-30">
                                        <div className="bg-white/90 rounded-full p-2 shadow-lg backdrop-blur-sm">
                                            <Icon
                                                icon="mdi:plus"
                                                className="h-3 w-3 md:h-4 md:w-4 text-slate-600"
                                            />
                                        </div>
                                    </div>

                                    {/* 新图片飞入效果 */}
                                    <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transform translate-y-6 rotate-12 group-hover:translate-y-0 group-hover:rotate-0 transition-all duration-800 delay-400 z-30">
                                        <div className="w-4 h-3 md:w-5 md:h-4 bg-gradient-to-br from-pink-200 to-pink-300 rounded-md shadow-lg border border-white/40 overflow-hidden">
                                            <div className="w-full h-full bg-gradient-to-b from-pink-100 to-rose-200 relative">
                                                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-pink-200/30"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute -top-2 -right-6 opacity-0 group-hover:opacity-100 transform translate-y-8 rotate-45 group-hover:translate-y-0 group-hover:rotate-12 transition-all duration-900 delay-500 z-30">
                                        <div className="w-3 h-2.5 md:w-4 md:h-3 bg-gradient-to-br from-emerald-200 to-emerald-300 rounded-md shadow-lg border border-white/40 overflow-hidden">
                                            <div className="w-full h-full bg-gradient-to-b from-emerald-100 to-teal-200 relative">
                                                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-emerald-200/30"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <span className="text-base md:text-lg font-light tracking-wide text-slate-700/90 text-center group-hover:text-slate-800 transition-colors duration-300">
                                    上传背景图片
                                </span>
                                <span className="text-xs md:text-sm text-slate-600/70 mt-1 md:mt-2 text-center group-hover:text-slate-700/80 transition-colors duration-300">
                                    支持 JPG、PNG 格式
                                </span>

                                {/* 移动端优化的触摸提示 */}
                                <div className="mt-2 md:hidden">
                                    <span className="text-xs text-slate-500/60 group-hover:text-slate-600/80 transition-colors duration-300">
                                        轻触上传
                                    </span>
                                </div>
                            </div>
                        </ImageUploader>
                    </div>
                </ChineseWaveBackground>
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
                            watermarkOpacity={watermarkOpacity} // 传递透明度
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
                <ChineseWaveBackground>
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                        <ImageUploader
                            ref={dropzoneRef}
                            onUpload={handleImagesUpload}
                            fileType="背景"
                        >
                            <div className="group p-6 md:p-8 rounded-3xl text-slate-700 bg-white/20 backdrop-blur-xl cursor-pointer flex flex-col items-center hover:bg-white/30 transition-all duration-500 shadow-2xl border border-white/30 hover:border-white/50 hover:shadow-3xl hover:scale-105 transform">
                                {/* 图片动画容器 */}
                                <div className="relative mb-3 md:mb-4 w-16 h-12 md:w-18 md:h-14">
                                    {/* 底层图片 */}
                                    <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-slate-200 to-slate-300 rounded-lg shadow-lg transform transition-all duration-700 ease-out group-hover:translate-x-3 group-hover:translate-y-2 group-hover:rotate-6 group-hover:scale-95">
                                        <div className="w-full h-full rounded-lg overflow-hidden relative">
                                            {/* 图片内容 - 风景 */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-blue-200 to-green-200"></div>
                                            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-green-300 to-transparent"></div>
                                            <div className="absolute bottom-1/3 left-1/4 w-3 h-2 bg-green-400 rounded-full opacity-60"></div>
                                            <div className="absolute bottom-1/4 right-1/3 w-2 h-1.5 bg-green-500 rounded-full opacity-40"></div>
                                        </div>
                                    </div>

                                    {/* 中层图片 */}
                                    <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg shadow-xl transform transition-all duration-600 ease-out group-hover:-translate-x-2 group-hover:translate-y-1 group-hover:-rotate-3 group-hover:scale-105 z-10">
                                        <div className="w-full h-full rounded-lg overflow-hidden relative">
                                            {/* 图片内容 - 城市 */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-orange-200 to-yellow-200"></div>
                                            <div className="absolute bottom-0 left-0 w-2 h-3 bg-gray-400 opacity-70"></div>
                                            <div className="absolute bottom-0 left-2 w-1.5 h-4 bg-gray-500 opacity-60"></div>
                                            <div className="absolute bottom-0 right-2 w-2 h-2.5 bg-gray-400 opacity-80"></div>
                                            <div className="absolute top-1/4 right-1/4 w-4 h-1 bg-yellow-300 rounded-full opacity-60"></div>
                                        </div>
                                    </div>

                                    {/* 顶层图片 */}
                                    <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-white to-slate-100 rounded-lg shadow-2xl transform transition-all duration-500 ease-out group-hover:-translate-x-4 group-hover:-translate-y-2 group-hover:-rotate-8 group-hover:scale-110 z-20">
                                        <div className="w-full h-full rounded-lg overflow-hidden relative">
                                            {/* 图片内容 - 自然山景 */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-sky-200 via-blue-100 to-emerald-100"></div>
                                            {/* 远山层 */}
                                            <div className="absolute bottom-0 left-0 right-0 h-3/4">
                                                <svg
                                                    className="w-full h-full text-slate-300/40"
                                                    fill="currentColor"
                                                    viewBox="0 0 100 60"
                                                >
                                                    <path d="M0 60 L15 45 L25 50 L35 35 L50 40 L65 25 L80 30 L100 20 L100 60 Z" />
                                                </svg>
                                            </div>

                                            {/* 中山层 */}
                                            <div className="absolute bottom-0 left-0 right-0 h-2/3">
                                                <svg
                                                    className="w-full h-full text-emerald-400/50"
                                                    fill="currentColor"
                                                    viewBox="0 0 100 60"
                                                >
                                                    <path d="M0 60 L20 40 L35 45 L50 30 L70 35 L85 25 L100 30 L100 60 Z" />
                                                </svg>
                                            </div>

                                            {/* 近山层 */}
                                            {/* <div className="absolute bottom-0 left-0 right-0 h-1/2">
                                                <svg
                                                    className="w-full h-full text-green-500/60"
                                                    fill="currentColor"
                                                    viewBox="0 0 100 60"
                                                >
                                                    <path d="M0 60 L25 45 L40 50 L55 35 L75 40 L90 30 L100 35 L100 60 Z" />
                                                </svg>
                                            </div> */}

                                            {/* 太阳 */}
                                            <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-gradient-to-br from-yellow-200 to-orange-200 rounded-full opacity-90 shadow-sm"></div>

                                            {/* 云朵 */}
                                            {/* <div className="absolute top-1/3 left-1/4 w-3 h-1 bg-white/60 rounded-full opacity-70"></div>
                                            <div className="absolute top-1/3 left-1/3 w-2 h-0.5 bg-white/50 rounded-full opacity-60"></div> */}
                                        </div>
                                    </div>

                                    {/* 上传指示器 */}
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 delay-300 z-30">
                                        <div className="bg-white/90 rounded-full p-2 shadow-lg backdrop-blur-sm">
                                            <Icon
                                                icon="mdi:plus"
                                                className="h-3 w-3 md:h-4 md:w-4 text-slate-600"
                                            />
                                        </div>
                                    </div>

                                    {/* 新图片飞入效果 */}
                                    <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transform translate-y-6 rotate-12 group-hover:translate-y-0 group-hover:rotate-0 transition-all duration-800 delay-400 z-30">
                                        <div className="w-4 h-3 md:w-5 md:h-4 bg-gradient-to-br from-pink-200 to-pink-300 rounded-md shadow-lg border border-white/40 overflow-hidden">
                                            <div className="w-full h-full bg-gradient-to-b from-pink-100 to-rose-200 relative">
                                                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-pink-200/30"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute -top-2 -right-6 opacity-0 group-hover:opacity-100 transform translate-y-8 rotate-45 group-hover:translate-y-0 group-hover:rotate-12 transition-all duration-900 delay-500 z-30">
                                        <div className="w-3 h-2.5 md:w-4 md:h-3 bg-gradient-to-br from-emerald-200 to-emerald-300 rounded-md shadow-lg border border-white/40 overflow-hidden">
                                            <div className="w-full h-full bg-gradient-to-b from-emerald-100 to-teal-200 relative">
                                                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-emerald-200/30"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <span className="text-base md:text-lg font-light tracking-wide text-slate-700/90 text-center group-hover:text-slate-800 transition-colors duration-300">
                                    上传背景图片
                                </span>
                                <span className="text-xs md:text-sm text-slate-600/70 mt-1 md:mt-2 text-center group-hover:text-slate-700/80 transition-colors duration-300">
                                    支持 JPG、PNG 格式
                                </span>
                            </div>
                        </ImageUploader>
                    </div>
                </ChineseWaveBackground>
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
                            watermarkOpacity={watermarkOpacity} // 传递透明度
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

                    {/* 图片质量控制 */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center text-sm font-medium">
                                图片质量
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Icon
                                                icon="ic:outline-help"
                                                className="w-4 h-4 ml-2 cursor-help text-gray-500"
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>调整输出图片的质量，数值越高质量越好但文件越大</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <span className="text-sm text-gray-600">
                                {Math.round(quality * 100)}%
                            </span>
                        </div>
                        <div className="px-3">
                            <Slider
                                value={[quality]}
                                onValueChange={(value) => setQuality(value[0])}
                                max={1}
                                min={0.1}
                                step={0.1}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>低质量 (10%)</span>
                                <span>高质量 (100%)</span>
                            </div>
                        </div>
                    </div>

                    {/* 水印透明度控制 */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center text-sm font-medium">
                                水印透明度
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Icon
                                                icon="ic:outline-help"
                                                className="w-4 h-4 ml-2 cursor-help text-gray-500"
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>调整水印的透明度，数值越低越透明</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <span className="text-sm text-gray-600">
                                {Math.round(watermarkOpacity * 100)}%
                            </span>
                        </div>
                        <div className="px-3">
                            <Slider
                                value={[watermarkOpacity]}
                                onValueChange={(value) => setWatermarkOpacity(value[0])}
                                max={1}
                                min={0.1}
                                step={0.1}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>透明 (10%)</span>
                                <span>不透明 (100%)</span>
                            </div>
                        </div>
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
