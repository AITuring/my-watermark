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
import { Menu, ChevronLeft, Edit } from "lucide-react";
import { Icon } from "@iconify/react";
import {
    loadImageData,
    debounce,
    processImage,
    adjustBatchSizeAndConcurrency,
    detectDarkWatermark,
    createMixedWatermark,
} from "./utils";
import { useDeviceDetect } from "@/hooks";
import { ImageType, WatermarkPosition, ImgWithPosition, TextWatermarkConfig, MixedWatermarkConfig } from "./types";
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
    // watermarkUrl 存储当前生效的水印图片URL（可能是上传的，也可能是生成的）
    const [watermarkUrl, setWatermarkUrl] = useState("/logo.png");

    // 模式：image | mixed
    const [watermarkMode, setWatermarkMode] = useState<"image" | "mixed">("image");
    // 存储用户上传的图片水印，以便切换回来时恢复
    const [storedImageWatermarkUrl, setStoredImageWatermarkUrl] = useState("/logo.png");

    // 混合水印配置
    const [mixedWatermarkConfig, setMixedWatermarkConfig] = useState<MixedWatermarkConfig>({
        enabled: true,
        icon: "/logo.png",
        textLine1: "第一行文字",
        textLine2: "第二行文字",
        color: "#000000",
        fontSize: 30,
        gap: 20,
        layout: "horizontal"
    });

    // 监听混合水印配置变化，生成预览图
    useEffect(() => {
        if (watermarkMode === "mixed") {
            const generate = async () => {
                if (!mixedWatermarkConfig.icon) return;
                const url = await createMixedWatermark(mixedWatermarkConfig);
                if (url) setWatermarkUrl(url);
            };
            // Debounce generation? createMixedWatermark is fast enough for canvas
            const timer = setTimeout(generate, 100);
            return () => clearTimeout(timer);
        } else {
            setWatermarkUrl(storedImageWatermarkUrl);
        }
    }, [watermarkMode, mixedWatermarkConfig, storedImageWatermarkUrl]);

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
    // 新增：暗水印开关与强度
    const [darkWatermarkEnabled, setDarkWatermarkEnabled] = useState<boolean>(false);
    const [darkWatermarkStrength, setDarkWatermarkStrength] = useState<number>(0.08);

    // 移动端菜单状态
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    // 移动端当前视图（编辑器/图库）
    const [mobileView, setMobileView] = useState<"editor" | "gallery">(
        "editor"
    );

    // Stack preview URLs for mobile gallery header
    const [stackPreviews, setStackPreviews] = useState<{id: string, url: string}[]>([]);

    useEffect(() => {
        if (images.length === 0) {
            setStackPreviews([]);
            return;
        }

        // Only take top 3 for stack
        const topImages = images.slice(0, 3);
        const urls = topImages.map(img => ({
            id: img.id,
            url: URL.createObjectURL(img.file)
        }));
        setStackPreviews(urls);

        return () => {
            urls.forEach(u => URL.revokeObjectURL(u.url));
        };
    }, [images]);

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
            const url = event.target!.result as string;
            if (watermarkMode === "image") {
                setStoredImageWatermarkUrl(url);
                setWatermarkUrl(url);
            } else {
                setMixedWatermarkConfig((prev) => ({ ...prev, icon: url }));
            }
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
        globalConcurrency = 10,
        textConfig?: TextWatermarkConfig,
        mixedConfig?: MixedWatermarkConfig
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
                        },
                        {
                            enabled: darkWatermarkEnabled,
                            opacity: darkWatermarkStrength, // 0.02 ~ 0.25 推荐区间
                            scale: 0.06,                    // 瓦片尺寸占短边 6%
                            gap: 0.5,                       // 每个瓦片之间留 50% 间隙
                            angle: -30,                     // 斜向平铺
                            blendMode: "multiply",          // 乘法混合，低调但有效
                        },
                        mixedConfig
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
                globalConcurrency,
                undefined, // textConfig placeholder
                watermarkMode === "mixed" ? mixedWatermarkConfig : undefined
            );
        } catch (error) {
            console.error("处理水印失败:", error);
            alert("处理水印失败，请重试。");
            setLoading(false);
        }
    };

    // 使用 debounce 包裹你的事件处理函数
    const handleApplyWatermarkDebounced = debounce(handleApplyWatermark, 500);

    // 暗水印检测（增强可视化预览）
    const visualizeDarkWatermark = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const objUrl = URL.createObjectURL(file);
            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    if (!ctx) throw new Error("Canvas not supported");
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    const factor = 1.6;
                    for (let i = 0; i < data.length; i += 4) {
                        const r = 255 - data[i];
                        const g = 255 - data[i + 1];
                        const b = 255 - data[i + 2];
                        let gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                        gray = Math.max(0, Math.min(255, (gray - 128) * factor + 128));
                        data[i] = gray;
                        data[i + 1] = gray;
                        data[i + 2] = gray;
                    }
                    ctx.putImageData(imageData, 0, 0);
                    const resultUrl = canvas.toDataURL("image/png");
                    URL.revokeObjectURL(objUrl);
                    resolve(resultUrl);
                } catch (err) {
                    URL.revokeObjectURL(objUrl);
                    reject(err);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(objUrl);
                reject(new Error("图片加载失败"));
            };
            img.src = objUrl;
        });
    };

    const handleDetectDarkWatermark = async () => {
        if (!currentImg) {
            alert("请先选择图片进行检测。");
            return;
        }
        try {
            const previewUrl = await visualizeDarkWatermark(currentImg.file);
            const w = window.open();
            if (w) {
                w.document.title = "暗水印检测预览";
                const imgEl = w.document.createElement("img");
                imgEl.src = previewUrl;
                imgEl.style.maxWidth = "100%";
                imgEl.style.height = "auto";
                w.document.body.style.margin = "0";
                w.document.body.appendChild(imgEl);
            } else {
                const link = document.createElement("a");
                link.href = previewUrl;
                link.download = "dark-watermark-detect.png";
                link.click();
            }
        } catch (e) {
            console.error("检测失败:", e);
            alert("检测失败，请重试或更换图片。");
        }
    };

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
                            <div className="group p-6 md:p-8 rounded-3xl text-slate-700 dark:text-slate-200 bg-white/20 dark:bg-black/40 backdrop-blur-xl cursor-pointer flex flex-col items-center hover:bg-white/30 dark:hover:bg-white/10 transition-all duration-500 shadow-2xl border border-white/30 hover:border-white/50 hover:shadow-3xl hover:scale-105 transform">
                                {/* 图片动画容器 */}
                                <div className="relative mb-3 md:mb-4 w-16 h-12 md:w-18 md:h-14">
                                    {/* 底层图片 */}
                                    <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-lg shadow-lg transform transition-all duration-700 ease-out group-hover:translate-x-3 group-hover:translate-y-2 group-hover:rotate-6 group-hover:scale-95">
                                        <div className="w-full h-full rounded-lg overflow-hidden relative">
                                            {/* 图片内容 - 风景 */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-blue-200 to-green-200"></div>
                                            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-green-300 to-transparent"></div>
                                            <div className="absolute bottom-1/3 left-1/4 w-3 h-2 bg-green-400 rounded-full opacity-60"></div>
                                            <div className="absolute bottom-1/4 right-1/3 w-2 h-1.5 bg-green-500 rounded-full opacity-40"></div>
                                        </div>
                                    </div>

                                    {/* 中层图片 */}
                                    <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-600 dark:to-slate-500 rounded-lg shadow-xl transform transition-all duration-600 ease-out group-hover:-translate-x-2 group-hover:translate-y-1 group-hover:-rotate-3 group-hover:scale-105 z-10">
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
                                    <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-white to-slate-100 dark:from-slate-500 dark:to-slate-400 rounded-lg shadow-2xl transform transition-all duration-500 ease-out group-hover:-translate-x-4 group-hover:-translate-y-2 group-hover:-rotate-8 group-hover:scale-110 z-20">
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
                                        <div className="bg-white/90 dark:bg-slate-800/90 rounded-full p-2 shadow-lg backdrop-blur-sm">
                                            <Icon
                                                icon="mdi:plus"
                                                className="h-3 w-3 md:h-4 md:w-4 text-slate-600 dark:text-slate-300"
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

                                <span className="text-base md:text-lg font-light tracking-wide text-slate-700/90 dark:text-slate-200/90 text-center group-hover:text-slate-800 dark:group-hover:text-white transition-colors duration-300">
                                    上传背景图片
                                </span>
                                <span className="text-xs md:text-sm text-slate-600/70 dark:text-slate-400/70 mt-1 md:mt-2 text-center group-hover:text-slate-700/80 dark:group-hover:text-slate-300/80 transition-colors duration-300">
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
            <div className="flex flex-col h-screen bg-background">
                {/* 移动端顶部导航 - 仅在非编辑器模式下显示，或者编辑器有自己的头 */}
                {mobileView !== "editor" && (
                    <div className="flex justify-between items-center p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-sm z-10">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMobileView("editor")}
                            className="group"
                        >
                            <Edit className="h-5 w-5 transition-all duration-300 group-hover:scale-110 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-400" />
                        </Button>
                        <div className="text-center font-medium dark:text-slate-200">
                            图片库
                        </div>
                        <div className="w-10"></div> {/* 占位符 */}
                    </div>
                )}

                {/* 移动端主内容区 */}
                <div className="flex-1 overflow-hidden relative">
                    {mobileView === "editor" && currentImg ? (
                        <MobileWatermarkEditor
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
                            watermarkOpacity={watermarkOpacity}
                            setWatermarkOpacity={setWatermarkOpacity}
                            watermarkBlur={watermarkBlur}
                            setWatermarkBlur={setWatermarkBlur}
                            quality={quality}
                            setQuality={setQuality}
                            darkWatermarkEnabled={darkWatermarkEnabled}
                            setDarkWatermarkEnabled={setDarkWatermarkEnabled}
                            darkWatermarkStrength={darkWatermarkStrength}
                            setDarkWatermarkStrength={setDarkWatermarkStrength}
                            watermarkMode={watermarkMode}
                            setWatermarkMode={setWatermarkMode}
                            mixedWatermarkConfig={mixedWatermarkConfig}
                            setMixedWatermarkConfig={setMixedWatermarkConfig}
                            onWatermarkUpload={handleWatermarkUpload}

                            // New Props for UI control
                            onBack={() => setMobileView("gallery")}
                            stackPreviews={stackPreviews}
                            onGenerate={handleApplyWatermarkDebounced}
                            isGenerating={loading}
                            generateProgress={smoothProgress}
                        />
                    ) : (
                        <MobileImageGallery
                            images={images}
                            setImages={setImages}
                            setImageUploaderVisible={setImageUploaderVisible}
                            setCurrentImg={setCurrentImg}
                            currentImageId={currentImg?.id}
                            onImageSelect={() => setMobileView("editor")}
                            onUpload={async (files) => {
                                const wasEmpty = images.length === 0;
                                await handleImagesUpload(files);
                                if (wasEmpty) {
                                    setMobileView("editor");
                                }
                            }}
                        />
                    )}
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
                                    <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-lg shadow-lg transform transition-all duration-700 ease-out group-hover:translate-x-3 group-hover:translate-y-2 group-hover:rotate-6 group-hover:scale-95">
                                        <div className="w-full h-full rounded-lg overflow-hidden relative">
                                            {/* 图片内容 - 风景 */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-blue-200 to-green-200"></div>
                                            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-green-300 to-transparent"></div>
                                            <div className="absolute bottom-1/3 left-1/4 w-3 h-2 bg-green-400 rounded-full opacity-60"></div>
                                            <div className="absolute bottom-1/4 right-1/3 w-2 h-1.5 bg-green-500 rounded-full opacity-40"></div>
                                        </div>
                                    </div>

                                    {/* 中层图片 */}
                                    <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-600 dark:to-slate-500 rounded-lg shadow-xl transform transition-all duration-600 ease-out group-hover:-translate-x-2 group-hover:translate-y-1 group-hover:-rotate-3 group-hover:scale-105 z-10">
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
                                    <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-white to-slate-100 dark:from-slate-500 dark:to-slate-400 rounded-lg shadow-2xl transform transition-all duration-500 ease-out group-hover:-translate-x-4 group-hover:-translate-y-2 group-hover:-rotate-8 group-hover:scale-110 z-20">
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
            <div className="flex flex-col h-screen justify-between bg-slate-50 dark:bg-slate-950">
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
                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg px-6 py-4">
                    <div className="flex items-center justify-between max-w-[1920px] mx-auto gap-8">
                        {/* 左侧：水印上传与基础设置 */}
                        <div className="flex items-center gap-4 shrink-0">
                            {/* 模式切换 Switch */}
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    混合水印
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm ${watermarkMode === 'mixed' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-600 dark:text-slate-300'}`}>
                                        开启
                                    </span>
                                    <Switch
                                        checked={watermarkMode === "mixed"}
                                        onCheckedChange={(checked) => setWatermarkMode(checked ? "mixed" : "image")}
                                        className="data-[state=checked]:bg-blue-600"
                                    />
                                </div>
                            </div>

                            <div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-700"></div>

                            <div className="relative group">
                                <ImageUploader
                                    onUpload={handleWatermarkUpload}
                                    fileType={watermarkMode === "image" ? "水印图片" : "图标"}
                                    className="w-14 h-14 rounded-lg cursor-pointer overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md bg-slate-50 dark:bg-slate-800"
                                >
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="w-full h-full flex items-center justify-center p-1">
                                                    <img
                                                        src={watermarkMode === "image" ? storedImageWatermarkUrl : mixedWatermarkConfig.icon}
                                                        alt="watermark"
                                                        className="max-w-full max-h-full object-contain group-hover:opacity-80 transition-opacity"
                                                    />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p>点击更换{watermarkMode === "image" ? "水印图片" : "图标"}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </ImageUploader>
                                <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm">
                                    {watermarkMode === "image" ? "水印" : "图标"}
                                </div>
                            </div>

                            <div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-700"></div>

                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    基础设置
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                        背景模糊
                                    </span>
                                    <Switch
                                        checked={watermarkBlur}
                                        onCheckedChange={setWatermarkBlur}
                                        className="scale-90 data-[state=checked]:bg-blue-600"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 中间：滑动控制条 */}
                        <div className="flex items-center gap-8 flex-1 justify-center max-w-5xl">
                            {/* 图片质量 */}
                            <div className="flex-1 min-w-[180px] max-w-[240px] flex flex-col gap-2 group">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                                        <Icon
                                            icon="mdi:quality-high"
                                            className="text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors"
                                        />
                                        图片质量
                                    </div>
                                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                        {Math.round(quality * 100)}%
                                    </span>
                                </div>
                                <Slider
                                    value={[quality]}
                                    onValueChange={(value) =>
                                        setQuality(value[0])
                                    }
                                    max={1}
                                    min={0.1}
                                    step={0.1}
                                    className="w-full py-1"
                                />
                            </div>

                            {/* 水印透明度 */}
                            <div className="flex-1 min-w-[180px] max-w-[240px] flex flex-col gap-2 group">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                                        <Icon
                                            icon="mdi:opacity"
                                            className="text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors"
                                        />
                                        水印透明度
                                    </div>
                                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                        {Math.round(watermarkOpacity * 100)}%
                                    </span>
                                </div>
                                <Slider
                                    value={[watermarkOpacity]}
                                    onValueChange={(value) =>
                                        setWatermarkOpacity(value[0])
                                    }
                                    max={1}
                                    min={0.1}
                                    step={0.1}
                                    className="w-full py-1"
                                />
                            </div>

                            {/* 暗水印 - 仅在非混合模式下显示 */}
                            {watermarkMode !== "mixed" && (
                                <div className="flex-1 min-w-[220px] max-w-[300px] flex flex-col gap-2 p-2 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                <Icon
                                                    icon="mdi:shield-check-outline"
                                                    className={`transition-colors ${
                                                        darkWatermarkEnabled
                                                            ? "text-blue-500"
                                                            : "text-slate-400 dark:text-slate-500"
                                                    }`}
                                                />
                                                暗水印
                                            </div>
                                            <Switch
                                                checked={darkWatermarkEnabled}
                                                onCheckedChange={
                                                    setDarkWatermarkEnabled
                                                }
                                                className="scale-75 data-[state=checked]:bg-blue-600"
                                            />
                                        </div>
                                        <span
                                            className={`text-xs font-mono px-1.5 py-0.5 rounded transition-colors ${
                                                darkWatermarkEnabled
                                                    ? "text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 shadow-sm"
                                                    : "text-slate-300 dark:text-slate-600 bg-transparent"
                                            }`}
                                        >
                                            {Math.round(
                                                darkWatermarkStrength * 100
                                            )}
                                            %
                                        </span>
                                    </div>
                                    <div
                                        className={`transition-opacity duration-200 ${
                                            darkWatermarkEnabled
                                                ? "opacity-100"
                                                : "opacity-40 pointer-events-none"
                                        }`}
                                    >
                                        <Slider
                                            value={[darkWatermarkStrength]}
                                            onValueChange={(value) =>
                                                setDarkWatermarkStrength(value[0])
                                            }
                                            max={0.25}
                                            min={0.02}
                                            step={0.01}
                                            className="w-full py-1"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 混合水印配置 controls */}
                            {watermarkMode === "mixed" && (
                                <div className="flex items-center gap-4 border-l pl-4 border-slate-200 dark:border-slate-700">
                                    <div className="flex flex-col gap-2 w-32">
                                        <input
                                            type="text"
                                            value={mixedWatermarkConfig.textLine1}
                                            onChange={(e) =>
                                                setMixedWatermarkConfig((p) => ({
                                                    ...p,
                                                    textLine1: e.target.value,
                                                }))
                                            }
                                            className="h-7 text-xs px-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none"
                                            placeholder="第一行文字"
                                        />
                                        <input
                                            type="text"
                                            value={mixedWatermarkConfig.textLine2}
                                            onChange={(e) =>
                                                setMixedWatermarkConfig((p) => ({
                                                    ...p,
                                                    textLine2: e.target.value,
                                                }))
                                            }
                                            className="h-7 text-xs px-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none"
                                            placeholder="第二行文字"
                                        />
                                    </div>

                                    {/* 布局切换 */}
                                    <div className="flex flex-col gap-1 items-center">
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">布局</span>
                                        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                                            <button
                                                className={`p-1 rounded-md transition-all ${
                                                    mixedWatermarkConfig.layout !== "vertical"
                                                        ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400"
                                                        : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                                                }`}
                                                onClick={() =>
                                                    setMixedWatermarkConfig((p) => ({
                                                        ...p,
                                                        layout: "horizontal",
                                                    }))
                                                }
                                                title="水平布局"
                                            >
                                                <Icon
                                                    icon="mdi:format-list-bulleted"
                                                    className="w-4 h-4"
                                                />
                                            </button>
                                            <button
                                                className={`p-1 rounded-md transition-all ${
                                                    mixedWatermarkConfig.layout === "vertical"
                                                        ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400"
                                                        : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                                                }`}
                                                onClick={() =>
                                                    setMixedWatermarkConfig((p) => ({
                                                        ...p,
                                                        layout: "vertical",
                                                    }))
                                                }
                                                title="竖直布局"
                                            >
                                                <Icon
                                                    icon="mdi:format-vertical-align-top"
                                                    className="w-4 h-4 transform rotate-90"
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 颜色选择 */}
                                    <div className="flex flex-col gap-1 items-center">
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">颜色</span>
                                        <div className="relative overflow-hidden w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer">
                                            <input
                                                type="color"
                                                value={mixedWatermarkConfig.color}
                                                onChange={(e) =>
                                                    setMixedWatermarkConfig((p) => ({
                                                        ...p,
                                                        color: e.target.value,
                                                    }))
                                                }
                                                className="absolute -top-2 -left-2 w-10 h-10 p-0 border-0 cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    {/* 大小控制 */}
                                    <div className="flex flex-col gap-1 w-24">
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">字体大小</span>
                                        <Slider
                                            value={[mixedWatermarkConfig.fontSize]}
                                            onValueChange={(v) =>
                                                setMixedWatermarkConfig((p) => ({
                                                    ...p,
                                                    fontSize: v[0],
                                                }))
                                            }
                                            min={10}
                                            max={100}
                                            step={1}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 旧的文字水印组件已移除 */}
                        </div>

                        {/* 右侧：操作按钮 */}
                        <div className="flex items-center gap-4 shrink-0">
                            {/* 检测暗水印按钮 - 只有开启且有图时显示，且不在混合模式下 */}
                            {darkWatermarkEnabled && watermarkMode !== "mixed" && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={async () => {
                                                    if (!currentImg) return;
                                                    const wmSrc =
                                                        watermarkColorUrls[
                                                            currentImg.id
                                                        ] || watermarkUrl;
                                                    const { present, score } =
                                                        await detectDarkWatermark(
                                                            currentImg.file,
                                                            wmSrc,
                                                            {
                                                                opacity: darkWatermarkStrength,
                                                                scale: 0.06,
                                                                gap: 0.5,
                                                                angle: -30,
                                                            }
                                                        );
                                                    alert(
                                                        `暗水印检测：${
                                                            present
                                                                ? "检测到"
                                                                : "未检测到"
                                                        }，score=${score.toFixed(
                                                            3
                                                        )}`
                                                    );
                                                }}
                                                disabled={!currentImg}
                                                className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800"
                                            >
                                                <Icon
                                                    icon="mdi:shield-search"
                                                    className="h-5 w-5"
                                                />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>检测当前图片的暗水印</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}

                            <ProgressButton
                                onClick={handleApplyWatermarkDebounced}
                                loading={loading}
                                progress={smoothProgress}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 text-white font-medium px-8 py-6 h-12 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                            >
                                <div className="flex items-center gap-3">
                                    <Icon
                                        icon="ri:magic-line"
                                        className="h-5 w-5"
                                    />
                                    <span>水印生成</span>
                                </div>
                            </ProgressButton>
                        </div>
                    </div>
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
