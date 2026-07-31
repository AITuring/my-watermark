import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import {
    adjustBatchSizeAndConcurrency,
    debounce,
} from "@/utils/watermark-common";
import { useDeviceDetect } from "@/hooks";
import {
    ImageType,
    MixedWatermarkConfig,
    WatermarkPosition,
} from "@/types";
import { ArrowRight, Download, Edit, Sparkles } from "lucide-react";
import WatermarkEditor from "@/pages/watermark/components/WatermarkEditor";
import MobileWatermarkEditor from "@/pages/watermark/components/MobileWatermarkEditor";
import VerticalCarousel from "@/pages/watermark/components/VerticalCarousel";
import MobileImageGallery from "@/pages/watermark/components/MobileImageGallery";
import WatermarkUploadHero from "@/pages/watermark/components/WatermarkUploadHero";
import DesktopToolbar from "@/pages/watermark/components/DesktopToolbar";
import {
    DEFAULT_MIXED_WATERMARK_CONFIG,
    DEFAULT_WATERMARK_URL,
    buildImagesWithPositions,
    buildWatermarkColorMap,
    buildWatermarkPositions,
    getTopStackPreviews,
} from "@/pages/watermark/helpers";
import { useWatermarkBatchProcessor } from "@/pages/watermark/hooks/useWatermarkBatchProcessor";
import "./watermark.css";
import {
    consumePendingCropTransfer,
    setPendingCropTransfer,
} from "@/utils/crop-transfer";
import { importWithRecovery } from "@/utils/import-recovery";

const WATERMARK_OVERSIZE_THRESHOLD_BYTES = 30 * 1024 * 1024;

type OversizePromptState = {
    files: File[];
    thresholdBytes: number;
    largestFileSizeBytes: number;
} | null;

const Watermark: React.FC = () => {
    const navigate = useNavigate();
    const [images, setImages] = useState<ImageType[]>([]);
    const deviceType = useDeviceDetect();
    const isMobile = deviceType === "mobile";
    const editorHeight = window.innerHeight * (isMobile ? 0.6 : 0.8);

    const [currentImg, setCurrentImg] = useState<ImageType | null>(null);
    const [watermarkUrl, setWatermarkUrl] =
        useState<string>(DEFAULT_WATERMARK_URL);
    const [watermarkMode, setWatermarkMode] = useState<"image" | "mixed">(
        "image"
    );
    const [storedImageWatermarkUrl, setStoredImageWatermarkUrl] =
        useState<string>(DEFAULT_WATERMARK_URL);
    const [mixedWatermarkConfig, setMixedWatermarkConfig] =
        useState<MixedWatermarkConfig>({ ...DEFAULT_MIXED_WATERMARK_CONFIG });
    const [watermarkPositions, setWatermarkPositions] = useState<
        WatermarkPosition[]
    >([]);
    const [watermarkColorUrls, setWatermarkColorUrls] = useState<
        Record<string, string>
    >({});
    const [uploading, setUploading] = useState(false);
    const [imageUploaderVisible, setImageUploaderVisible] = useState(true);
    const [quality, setQuality] = useState(0.95);
    const [watermarkBlur, setWatermarkBlur] = useState(true);
    const [watermarkOpacity, setWatermarkOpacity] = useState(0.8);
    const [mobileView, setMobileView] = useState<"editor" | "gallery">(
        "editor"
    );
    const [oversizePrompt, setOversizePrompt] =
        useState<OversizePromptState>(null);

    const dropzoneRef = useRef<HTMLDivElement>(null);
    const managedPreviewUrlsRef = useRef<Set<string>>(new Set());
    const oversizeDecisionResolverRef = useRef<
        ((decision: "download" | "compress") => void) | null
    >(null);
    const {
        loading,
        downloadFinalizing,
        smoothProgress,
        downloadImagesWithWatermarkBatch,
    } = useWatermarkBatchProcessor({
        watermarkUrl,
        watermarkColorUrls,
        watermarkOpacity,
        watermarkBlur,
        quality,
        oversizeThresholdBytes: WATERMARK_OVERSIZE_THRESHOLD_BYTES,
        onOversizedFiles: (files) => {
            setPendingCropTransfer("compress", files);
            navigate("/compress");
        },
        confirmOversizedFiles: async (payload) => {
            setOversizePrompt(payload);
            return await new Promise<"download" | "compress">((resolve) => {
                oversizeDecisionResolverRef.current = resolve;
            });
        },
    });

    const stackPreviews = useMemo(
        () => getTopStackPreviews(images),
        [images]
    );

    const currentWatermarkPosition = currentImg
        ? watermarkPositions.find((pos) => pos.id === currentImg.id)
        : undefined;
    const currentImageIndex = currentImg
        ? images.findIndex((img) => img.id === currentImg.id)
        : -1;

    useEffect(() => {
        if (watermarkMode === "mixed") {
            const generate = async () => {
                if (!mixedWatermarkConfig.icon) return;
                const { createMixedWatermark } = await importWithRecovery(
                    () => import("@/utils/watermark-processing"),
                    "utils:watermark-processing"
                );
                const url = await createMixedWatermark(mixedWatermarkConfig);
                if (url) {
                    setWatermarkUrl(url);
                }
            };

            const timer = window.setTimeout(generate, 100);
            return () => window.clearTimeout(timer);
        }

        setWatermarkUrl(storedImageWatermarkUrl);
    }, [watermarkMode, mixedWatermarkConfig, storedImageWatermarkUrl]);

    useEffect(() => {
        const nextUrls = new Set(
            images
                .map((img) => img.previewUrl)
                .filter((url): url is string => Boolean(url))
        );

        managedPreviewUrlsRef.current.forEach((url) => {
            if (!nextUrls.has(url)) {
                URL.revokeObjectURL(url);
            }
        });

        managedPreviewUrlsRef.current = nextUrls;
    }, [images]);

    useEffect(() => {
        return () => {
            managedPreviewUrlsRef.current.forEach((url) => {
                URL.revokeObjectURL(url);
            });
            managedPreviewUrlsRef.current.clear();
            if (oversizeDecisionResolverRef.current) {
                oversizeDecisionResolverRef.current("download");
                oversizeDecisionResolverRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (images.length === 0) {
            setImageUploaderVisible(true);
        }
    }, [images]);

    const handleImagesUpload = async (files: File[]) => {
        setUploading(true);
        try {
            const { loadImageData } = await importWithRecovery(
                () => import("@/utils/watermark-processing"),
                "utils:watermark-processing"
            );
            const { images: uploadImages, failedFiles } = await loadImageData(
                files
            );

            if (uploadImages.length === 0) {
                alert("没有可用的图片被读取，请检查文件格式后重试。");
                return;
            }

            const newPositions = buildWatermarkPositions(uploadImages);
            const newColors = buildWatermarkColorMap(uploadImages);
            setWatermarkColorUrls((prev) => ({ ...prev, ...newColors }));

            setImages((prevImages) => {
                if (prevImages.length === 0) {
                    setCurrentImg(uploadImages[0]);
                    setImageUploaderVisible(false);
                    setWatermarkPositions(newPositions);
                    return uploadImages;
                }

                setWatermarkPositions((prev) => [...prev, ...newPositions]);
                return [...prevImages, ...uploadImages];
            });

            if (failedFiles.length > 0) {
                const summary =
                    failedFiles.length > 3
                        ? `${failedFiles.slice(0, 3).join("、")} 等 ${
                              failedFiles.length
                          } 张`
                        : failedFiles.join("、");

                alert(
                    `已导入 ${uploadImages.length} 张图片，跳过 ${failedFiles.length} 张不支持或读取失败的图片：${summary}`
                );
            }
        } catch (error) {
            console.error("批量上传图片失败:", error);
            alert(
                error instanceof Error
                    ? error.message
                    : "批量上传失败，请检查图片文件后重试。"
            );
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        const incomingFiles = consumePendingCropTransfer("watermark");
        if (!incomingFiles.length) return;
        void handleImagesUpload(incomingFiles);
    }, []);

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
            const url = event.target?.result as string;
            if (watermarkMode === "image") {
                setStoredImageWatermarkUrl(url);
                setWatermarkUrl(url);
                return;
            }

            setMixedWatermarkConfig((prev) => ({ ...prev, icon: url }));
        };
        reader.readAsDataURL(files[0]);
    };

    const handleWatermarkTransform = (
        imageId: string,
        position: Omit<WatermarkPosition, "id">
    ) => {
        setWatermarkPositions((prev) =>
            prev.map((pos) =>
                pos.id === imageId ? { ...pos, ...position } : pos
            )
        );
        console.log(watermarkPositions, "watermarkPositions");
    };

    const handleAllWatermarkTransform = (
        position: Omit<WatermarkPosition, "id">
    ) => {
        setWatermarkPositions((prev) =>
            prev.map((img) => ({
                ...position,
                id: img.id,
            }))
        );
    };

    const handleApplyWatermark = async () => {
        if (!watermarkUrl) {
            alert("请上传水印图片！");
            return;
        }

        const { batchSize, globalConcurrency } =
            adjustBatchSizeAndConcurrency(images);

        try {
            console.log("水印下载开始！");

            const allImageData = buildImagesWithPositions(
                images,
                watermarkPositions
            ).map((img) => {
                const found = watermarkPositions.some(
                    (pos) => pos.id === img.id
                );
                console.log(`图片 ${img.id} 的位置参数:`, {
                    found,
                    position: img.position,
                });
                return img;
            });

            console.log("allimageData", allImageData);

            await downloadImagesWithWatermarkBatch(
                allImageData,
                batchSize,
                globalConcurrency,
                watermarkMode === "mixed" ? mixedWatermarkConfig : undefined
            );
        } catch (error) {
            console.error("处理水印失败:", error);
            alert("处理水印失败，请重试。");
        }
    };

    const handleApplyWatermarkDebounced = debounce(handleApplyWatermark, 500);

    const resolveOversizeDecision = (decision: "download" | "compress") => {
        oversizeDecisionResolverRef.current?.(decision);
        oversizeDecisionResolverRef.current = null;
        setOversizePrompt(null);
    };

    const formatSizeInMB = (bytes: number) =>
        `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

    const renderMobileUI = () => {
        if (imageUploaderVisible) {
            return (
                <WatermarkUploadHero
                    mobile
                    dropzoneRef={dropzoneRef}
                    onUpload={handleImagesUpload}
                />
            );
        }

        return (
            <div className="flex flex-col h-screen bg-background">
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
                        <div className="w-10" />
                    </div>
                )}

                <div className="flex-1 overflow-hidden relative">
                    {mobileView === "editor" && currentImg ? (
                        <MobileWatermarkEditor
                            watermarkUrl={watermarkUrl}
                            backgroundPreviewUrl={currentImg.previewUrl || ""}
                            currentWatermarkPosition={currentWatermarkPosition}
                            onTransform={(position) =>
                                handleWatermarkTransform(currentImg.id, position)
                            }
                            totalImages={images.length}
                            currentIndex={currentImageIndex}
                            onAllTransform={handleAllWatermarkTransform}
                            onPrevImage={() => {
                                if (currentImageIndex > 0) {
                                    setCurrentImg(images[currentImageIndex - 1]);
                                }
                            }}
                            onNextImage={() => {
                                if (currentImageIndex < images.length - 1) {
                                    setCurrentImg(images[currentImageIndex + 1]);
                                }
                            }}
                            watermarkOpacity={watermarkOpacity}
                            setWatermarkOpacity={setWatermarkOpacity}
                            watermarkBlur={watermarkBlur}
                            setWatermarkBlur={setWatermarkBlur}
                            quality={quality}
                            setQuality={setQuality}
                            watermarkMode={watermarkMode}
                            setWatermarkMode={setWatermarkMode}
                            mixedWatermarkConfig={mixedWatermarkConfig}
                            setMixedWatermarkConfig={setMixedWatermarkConfig}
                            onWatermarkUpload={handleWatermarkUpload}
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

    const renderDesktopUI = () => {
        if (imageUploaderVisible) {
            return (
                <WatermarkUploadHero
                    dropzoneRef={dropzoneRef}
                    onUpload={handleImagesUpload}
                />
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
                            backgroundPreviewUrl={currentImg.previewUrl || ""}
                            currentWatermarkPosition={currentWatermarkPosition}
                            onTransform={(position) =>
                                handleWatermarkTransform(currentImg.id, position)
                            }
                            onAllTransform={handleAllWatermarkTransform}
                            watermarkColor={
                                watermarkColorUrls[currentImg.id] || ""
                            }
                            onColorChange={(color) =>
                                handleWatermarkColorChange(currentImg.id, color)
                            }
                            watermarkOpacity={watermarkOpacity}
                        />
                    )}
                </div>

                <DesktopToolbar
                    watermarkMode={watermarkMode}
                    setWatermarkMode={setWatermarkMode}
                    storedImageWatermarkUrl={storedImageWatermarkUrl}
                    mixedWatermarkConfig={mixedWatermarkConfig}
                    setMixedWatermarkConfig={setMixedWatermarkConfig}
                    onWatermarkUpload={handleWatermarkUpload}
                    watermarkBlur={watermarkBlur}
                    setWatermarkBlur={setWatermarkBlur}
                    quality={quality}
                    setQuality={setQuality}
                    watermarkOpacity={watermarkOpacity}
                    setWatermarkOpacity={setWatermarkOpacity}
                    onGenerate={handleApplyWatermarkDebounced}
                    loading={loading}
                    progress={smoothProgress}
                />
            </div>
        );
    };

    return (
        <div className="relative w-screen h-screen">
            {(uploading || loading || downloadFinalizing) && (
                <div className="absolute inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center px-4">
                    <div className="bg-white/90 dark:bg-slate-900/90 rounded-xl shadow-xl border border-white/30 px-6 py-5 min-w-[260px]">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {uploading
                                    ? "正在读取图片，请稍候..."
                                    : downloadFinalizing
                                    ? "已提交下载任务，浏览器仍在写入文件..."
                                    : `正在处理图片 ${Math.round(
                                          smoothProgress
                                      )}%`}
                            </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {uploading
                                ? "大批量上传时会短暂占用性能"
                                : downloadFinalizing
                                ? "请查看浏览器下载列表中的进度"
                                : "请不要关闭当前页面"}
                        </div>
                    </div>
                </div>
            )}

            {imageUploaderVisible && <div className="watermarkBg" />}
            <div>{isMobile ? renderMobileUI() : renderDesktopUI()}</div>
            <Dialog
                open={Boolean(oversizePrompt)}
                onOpenChange={(open) => {
                    if (!open && oversizePrompt) {
                        resolveOversizeDecision("download");
                    }
                }}
            >
                <DialogContent className="[&>button]:hidden">
                    <div className="overflow-hidden rounded-[32px] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))] shadow-[0_30px_120px_rgba(15,23,42,0.22)] backdrop-blur-xl">
                        <div className="relative overflow-hidden px-7 pb-6 pt-7">
                            <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_58%)]" />
                            <div className="relative space-y-5">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/15">
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-2">
                                        <DialogTitle className="text-xl font-semibold text-slate-900">
                                            导出结果偏大
                                        </DialogTitle>
                                        <DialogDescription className="text-sm leading-6 text-slate-600">
                                            {oversizePrompt
                                                ? oversizePrompt.files.length === 1
                                                    ? `这张图生成后约 ${formatSizeInMB(
                                                          oversizePrompt.largestFileSizeBytes
                                                      )}，已经超过 ${formatSizeInMB(
                                                          oversizePrompt.thresholdBytes
                                                      )}。`
                                                    : `${oversizePrompt.files.length} 张图片超过 ${formatSizeInMB(
                                                          oversizePrompt.thresholdBytes
                                                      )}，最大约 ${formatSizeInMB(
                                                          oversizePrompt.largestFileSizeBytes
                                                      )}。`
                                                : ""}
                                        </DialogDescription>
                                    </div>
                                </div>

                                <div className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">接下来怎么处理</span>
                                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                                            大图更建议先压缩
                                        </span>
                                    </div>
                                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                                                继续下载
                                            </span>
                                            <ArrowRight className="h-4 w-4 text-slate-400" />
                                            <span>保留当前结果，直接下载原始导出图</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-slate-900 px-3 py-1 font-medium text-white">
                                                发送到压缩
                                            </span>
                                            <ArrowRight className="h-4 w-4 text-slate-400" />
                                            <span>跳转到压缩页，把图片压小后再下载或发布</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-12 rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                        onClick={() =>
                                            resolveOversizeDecision("download")
                                        }
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        继续下载
                                    </Button>
                                    <Button
                                        type="button"
                                        className="h-12 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                                        onClick={() =>
                                            resolveOversizeDecision("compress")
                                        }
                                    >
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        发送到压缩
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Watermark;
