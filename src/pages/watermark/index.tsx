import { DEFAULT_FONT_ID, missingFontCharacters } from "./fonts/registry";
import { applyColorToWatermark, extractDominantColors, getAdaptiveWatermarkRenderMetrics, getWatermarkMaximumScale, fitWatermarkPosition } from "@/utils/watermark-editor";
import { analyzeWatermarkCaption, extractWatermarkCaption } from "./filename-watermark";
import { clearCaptionCorrection, getCaptionCorrection, loadCaptionCorrections, saveCaptionCorrections, setCaptionCorrection, type CaptionCorrectionMap } from "./caption-corrections";
import { resolveWatermarkTypography } from './font-selection';
import { getWatermarkLayoutMetrics } from './layout-metrics';
import { createSmartWatermark } from "./smart-watermark";
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
import CaptionReviewDialog, { type CaptionReviewItem } from "@/pages/watermark/components/CaptionReviewDialog";
import {
    DEFAULT_MIXED_WATERMARK_CONFIG,
    DEFAULT_WATERMARK_URL,
    DEFAULT_TRANSPARENT_WATERMARK_URL,
    DEFAULT_COPYRIGHT_STATEMENT,
    applyWatermarkConfigPatch,
    unifyWatermarkFontPatch,
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
import {
    clearFileSession,
    loadFileSession,
    saveFileSession,
} from "@/utils/file-storage";
import { importWithRecovery } from "@/utils/import-recovery";
import { findSmartWatermarkPosition, loadPositionImage } from "./smart-position";
import { PreviewUrlLease, recoverPreviewUrl } from "@/utils/preview-url-lease";

import type {WatermarkDownloadMode} from './export-downloads';
import { TRANSPARENT_WATERMARK_OPACITY, TRANSPARENT_WATERMARK_SCALE } from '@/utils/transparent-watermark';

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
    const editorHeight = isMobile ? window.innerHeight * 0.6 : Math.max(200,window.innerHeight - 350);

    const [currentImg, setCurrentImg] = useState<ImageType | null>(null);
    const [watermarkUrl, setWatermarkUrl] =
        useState<string>(DEFAULT_WATERMARK_URL);
    const [watermarkMode, setWatermarkMode] = useState<"image" | "mixed" | "text">(
        "image"
    );
    const watermarkModeManuallySelected = useRef(false);
    const [storedImageWatermarkUrl, setStoredImageWatermarkUrl] =
        useState<string>(DEFAULT_WATERMARK_URL);
    const [baseWatermarkConfig, setBaseWatermarkConfig] =
        useState<MixedWatermarkConfig>({ ...DEFAULT_MIXED_WATERMARK_CONFIG });
    const [smartEnabled, setSmartEnabled] = useState(true);
    const [previewZoom,setPreviewZoom] = useState(1);
    const [imageTints,setImageTints] = useState<Record<string,string>>({});
    const imageTint = currentImg ? imageTints[currentImg.id] || '' : '';
    const [suggestedColors,setSuggestedColors] = useState<string[]>([]);
    const colorRequest = useRef(0);
    const [settingsPanelOpen,setSettingsPanelOpen] = useState(false);
    const [editScope, setEditScope] = useState<"current" | "all">("current");
    const placementRequest = useRef(0);
    const queuedPlacement = useRef<{imageId:string; placement?:string; scale?:number} | null>(null);
    const exportInFlight = useRef(false);
    const [smartError, setSmartError] = useState("");
    const [fontNotice, setFontNotice] = useState("");
    const [watermarkMaxScale,setWatermarkMaxScale] = useState(12);
    const [smartPending, setSmartPending] = useState(false);
    const [manualConfigs, setManualConfigs] = useState<Record<string, Partial<MixedWatermarkConfig>>>({});
    const [captionCorrections, setCaptionCorrections] = useState<CaptionCorrectionMap>({});
    const [batchReferenceTextHeight, setBatchReferenceTextHeight] = useState<number | undefined>();
    const [automaticStyle, setAutomaticStyle] = useState<Partial<MixedWatermarkConfig>>({});
    const manualPositions = useRef(new Set<string>());
    // A direction change changes the generated image's aspect ratio. Keep a
    // manually chosen position, but adopt the new smart scale so horizontal
    // text does not inherit the narrow vertical column's scale.
    const smartLayouts = useRef<Record<string, MixedWatermarkConfig['layout'] | undefined>>({});
    useEffect(() => { setCaptionCorrections(loadCaptionCorrections()); }, []);

    const handleWatermarkModeChange = (mode: "image" | "mixed" | "text") => {
        watermarkModeManuallySelected.current = true;
        setWatermarkMode(mode);
    };

    useEffect(() => {
        if (!currentImg || watermarkModeManuallySelected.current) return;
        setWatermarkMode(extractWatermarkCaption(currentImg.file.name) ? "text" : "image");
    }, [currentImg?.id]);

    const getCaptionForImage = (image: ImageType | null) => {
        if (!image) return {};
        const extracted = extractWatermarkCaption(image.file.name);
        return extracted
            ? {...extracted, singleLineOrder:'era-first' as const, ...getCaptionCorrection(captionCorrections, image.file.name)}
            : {};
    };
    const desiredConfig = useMemo(() => ({
        ...baseWatermarkConfig,
        ...getCaptionForImage(currentImg),
        ...(editScope === 'all' && batchReferenceTextHeight ? {referenceTextHeight:batchReferenceTextHeight} : {}),
        ...(currentImg ? manualConfigs[currentImg.id] : null),
        ...resolveWatermarkTypography(currentImg?.file.name||'',baseWatermarkConfig,currentImg?manualConfigs[currentImg.id]:{},smartEnabled),
    }), [baseWatermarkConfig, currentImg, manualConfigs, smartEnabled, captionCorrections, editScope, batchReferenceTextHeight]);
    const mixedWatermarkConfig = {...desiredConfig, ...automaticStyle,
        ...(currentImg ? manualConfigs[currentImg.id] : null),
        ...resolveWatermarkTypography(currentImg?.file.name||'',baseWatermarkConfig,currentImg?manualConfigs[currentImg.id]:{},smartEnabled)};
    const configRef = useRef(mixedWatermarkConfig);
    configRef.current = mixedWatermarkConfig;
    const patchWatermarkConfig = (patch:Partial<MixedWatermarkConfig>) => {
        patch=unifyWatermarkFontPatch(patch);
        if (!currentImg) {setBaseWatermarkConfig(prev=>({...prev,...patch}));return;}
        const targets = editScope === "all" ? images : [currentImg];
        setManualConfigs(prev => applyWatermarkConfigPatch(prev, targets.map(image=>image.id), patch));
        const captionPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => key === 'textLine1' || key === 'textLine2')) as Partial<MixedWatermarkConfig>;
        if (Object.keys(captionPatch).length) {
            setCaptionCorrections(previous => {
                let next = previous;
                for (const image of targets) next = setCaptionCorrection(next, image.file.name, captionPatch);
                saveCaptionCorrections(next);
                return next;
            });
        }
    };
    const setMixedWatermarkConfig: React.Dispatch<React.SetStateAction<MixedWatermarkConfig>> = (action) => {
        const next = typeof action === "function" ? action(configRef.current) : action;
        if (!currentImg) { setBaseWatermarkConfig(next); return; }
        const changes: Partial<MixedWatermarkConfig> = {};
        for (const key of Object.keys(next) as (keyof MixedWatermarkConfig)[]) {
            if (next[key] !== configRef.current[key]) Object.assign(changes, {[key]:next[key]});
        }
        Object.assign(changes,unifyWatermarkFontPatch(changes));
        if (Object.keys(changes).length) {
            patchWatermarkConfig(changes);
        }
    };
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
    const [watermarkOpacity, setWatermarkOpacity] = useState(1);
    const [transparentWatermarkEnabled, setTransparentWatermarkEnabled] = useState(false);
    const [transparentWatermarkOpacities, setTransparentWatermarkOpacities] = useState<Record<string, number>>({});
    const [transparentWatermarkScales, setTransparentWatermarkScales] = useState<Record<string, number>>({});
    const [transparentWatermarkPositions, setTransparentWatermarkPositions] = useState<Record<string, {x: number; y: number}>>({});
    const [transparentWatermarkUrl] = useState(DEFAULT_TRANSPARENT_WATERMARK_URL);
    const [transparentWatermarkColor, setTransparentWatermarkColor] = useState('');
    const [transparentWatermarkColorUrl, setTransparentWatermarkColorUrl] = useState(DEFAULT_TRANSPARENT_WATERMARK_URL);
    const [copyrightStatement, setCopyrightStatement] = useState(DEFAULT_COPYRIGHT_STATEMENT);
    const [mobileView, setMobileView] = useState<"editor" | "gallery">(
        "editor"
    );
    const [oversizePrompt, setOversizePrompt] =
        useState<OversizePromptState>(null);
    const [imagesHydrated, setImagesHydrated] = useState(false);

    const dropzoneRef = useRef<HTMLDivElement>(null);
    const previewUrlLeaseRef = useRef(new PreviewUrlLease());
    const oversizeDecisionResolverRef = useRef<
        ((decision: "download" | "compress") => void) | null
    >(null);
    const restoreStartedRef = useRef(false);
    const persistedImagesKeyRef = useRef<string | null>(null);
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
        transparentWatermarkEnabled,
        transparentWatermarkUrl: transparentWatermarkColorUrl,
        transparentWatermarkOpacities,
        transparentWatermarkScales,
        transparentWatermarkPositions,
        copyrightStatement,
        quality,
        resolveWatermark: watermarkMode === "image" ? undefined : async (item) => {
            const image = images.find(candidate => candidate.id === item.id);
            if (!image) throw new Error("图片不存在");
            const config = {...baseWatermarkConfig, ...getCaptionForImage(image),
                ...(editScope === 'all' && batchReferenceTextHeight ? {referenceTextHeight:batchReferenceTextHeight} : {}),
                ...manualConfigs[image.id], ...resolveWatermarkTypography(image.file.name,baseWatermarkConfig,manualConfigs[image.id],smartEnabled),textOnly: watermarkMode === "text"};
            if (smartEnabled) {
                const result = await createSmartWatermark(image, config, manualConfigs[image.id]);
                return {url: result.url, position: manualPositions.current.has(image.id) ? item.position : result.position};
            }
            const {createMixedWatermark} = await import("@/utils/watermark-processing");
            return {url: await createMixedWatermark(config), position:item.position};
        },
        oversizeThresholdBytes: WATERMARK_OVERSIZE_THRESHOLD_BYTES,
        onOversizedFiles: async (files) => {
            await setPendingCropTransfer("compress", files);
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

    const captionReviewItems = useMemo<CaptionReviewItem[]>(() => images.map(image => {
        const analysis = analyzeWatermarkCaption(image.file.name);
        const correction = getCaptionCorrection(captionCorrections, image.file.name);
        const config = {...getCaptionForImage(image), ...manualConfigs[image.id]};
        return {
            id: image.id,
            filename: image.file.name,
            analysis,
            textLine1: config.textLine1 || '',
            textLine2: config.textLine2 || '',
            time: correction?.time ?? analysis.metadata.time,
            place: correction?.place ?? analysis.metadata.place,
            collection: correction?.collection ?? analysis.metadata.collection,
            corrected: Boolean(correction),
        };
    }), [images, captionCorrections, manualConfigs]);
    const captionPendingCount = captionReviewItems.filter(item => !item.corrected && item.analysis.confidence !== 'high').length;
    const saveCaptionReview = (changes: Record<string, {textLine1:string;textLine2:string;time:string;place:string;collection:string}>) => {
        setManualConfigs(previous => {
            const next = {...previous};
            for (const [id, values] of Object.entries(changes)) {
                const item = captionReviewItems.find(candidate => candidate.id === id);
                const photographer = item?.textLine2.split(' / ').slice(1).join(' / ') || '';
                const structuredChanged = item && (values.time!==item.time || values.place!==item.place || values.collection!==item.collection);
                const details = [values.time,values.place,values.collection].filter(Boolean).join('·');
                const textLine2 = structuredChanged ? [details,photographer].filter(Boolean).join(' / ') : values.textLine2;
                next[id] = {...next[id], textLine1:values.textLine1, textLine2};
            }
            return next;
        });
        setCaptionCorrections(previous => {
            let next = previous;
            for (const item of captionReviewItems) {
                const values = changes[item.id];
                if (values) {
                    const photographer = item.textLine2.split(' / ').slice(1).join(' / ');
                    const structuredChanged = values.time!==item.time || values.place!==item.place || values.collection!==item.collection;
                    const details = [values.time,values.place,values.collection].filter(Boolean).join('·');
                    const textLine2 = structuredChanged ? [details,photographer].filter(Boolean).join(' / ') : values.textLine2;
                    next = setCaptionCorrection(next, item.filename, {...values,textLine2});
                }
            }
            saveCaptionCorrections(next);
            return next;
        });
    };
    const clearCaptionReview = (ids: string[]) => {
        const selected = new Set(ids);
        setCaptionCorrections(previous => {
            let next = previous;
            for (const item of captionReviewItems) if (selected.has(item.id)) next = clearCaptionCorrection(next, item.filename);
            saveCaptionCorrections(next);
            return next;
        });
        setManualConfigs(previous => {
            const next = {...previous};
            for (const item of captionReviewItems) if (selected.has(item.id)) {
                const entry = {...(next[item.id] || {})};
                delete entry.textLine1;
                delete entry.textLine2;
                next[item.id] = entry;
            }
            return next;
        });
    };

    useEffect(() => {setWatermarkColorUrls({}); setImageTints({}); colorRequest.current++;}, [watermarkMode,storedImageWatermarkUrl]);
    useEffect(() => { setAutomaticStyle({}); }, [watermarkMode,currentImg?.id]);

    useEffect(() => {
        let cancelled = false;
        setSmartError("");
        if (watermarkMode === "image") {
            setSmartPending(false);
            setWatermarkUrl(storedImageWatermarkUrl);
            if (currentImg) void loadPositionImage(storedImageWatermarkUrl).then(logo=>{
                if(cancelled) return;
                setWatermarkMaxScale(getWatermarkMaximumScale(currentImg.width,currentImg.height,logo));
                setWatermarkPositions(prev=>prev.map(position=>position.id===currentImg.id
                    ? fitWatermarkPosition(currentImg.width,currentImg.height,logo,position):position));
            }).catch(error=>{if(!cancelled)setSmartError(error instanceof Error?error.message:"水印加载失败");});
            return () => {cancelled=true;};
        }
        setSmartPending(true);
        const timer = window.setTimeout(async () => {
            try {
                const { createMixedWatermark } = await importWithRecovery(
                    () => import("@/utils/watermark-processing"),
                    "utils:watermark-processing"
                );
                const config = {...desiredConfig, textOnly: watermarkMode === "text"};
                const result = smartEnabled && currentImg
                    ? await createSmartWatermark(currentImg, config, manualConfigs[currentImg.id]) : null;
                const url = result ? result.url : await createMixedWatermark(config);
                const logo = url ? await loadPositionImage(url) : null;
                if (!cancelled) {
                    setWatermarkColorUrls({});
                    setWatermarkUrl(url);
                    const missing = missingFontCharacters(config.fontId || DEFAULT_FONT_ID,config.textLine1)
                        + missingFontCharacters(config.captionFontId || DEFAULT_FONT_ID,config.textLine2);
                    setFontNotice(missing ? `所选字体缺少「${[...new Set(Array.from(missing))].join("")}」，这些字使用系统宋体补齐。` : "");
                    setAutomaticStyle(result ? {color:result.config.color, layout:result.config.layout} : {});
                    if (logo && currentImg) {
                        const previousLayout = smartLayouts.current[currentImg.id];
                        const layoutChanged = Boolean(result && previousLayout && previousLayout !== result.config.layout);
                        if (result) smartLayouts.current[currentImg.id] = result.config.layout;
                        setWatermarkMaxScale(getWatermarkMaximumScale(currentImg.width,currentImg.height,logo));
                        setWatermarkPositions(prev => prev.map(position => position.id === currentImg.id
                            ? fitWatermarkPosition(currentImg.width,currentImg.height,logo,
                                result && (!manualPositions.current.has(currentImg.id) || layoutChanged)
                                    ? (layoutChanged ? {...position,scaleX:result.position.scaleX,scaleY:result.position.scaleY} : result.position)
                                    : position)
                            : position));
                    }
                }
            } catch (error) {
                console.error("生成文字水印失败", error);
                if (!cancelled) setSmartError(error instanceof Error ? error.message : "无法生成水印，请重试。");
            } finally {
                if (!cancelled) setSmartPending(false);
            }
        }, 100);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [watermarkMode, desiredConfig, storedImageWatermarkUrl, smartEnabled, currentImg, manualConfigs]);

    useEffect(() => {
        const lease = previewUrlLeaseRef.current;
        lease.retain(images.flatMap(image => image.previewUrl ? [image.previewUrl] : []));
        return () => lease.release();
    }, [images]);

    // Recover URLs invalidated by an earlier session/update, preserving IDs and edits.
    useEffect(() => {
        let cancelled = false;
        void Promise.all(images.map(async image => {
            if (!image.previewUrl) return;
            const previewUrl = await recoverPreviewUrl(image.previewUrl, async () => {
                const { createPreviewUrl } = await import("@/utils/image-loading");
                return createPreviewUrl(image.file);
            });
            if (!previewUrl) return;
            if (cancelled) {
                if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
                return;
            }
            const replace = (candidate: ImageType) => candidate.id === image.id
                && candidate.previewUrl === image.previewUrl ? { ...candidate, previewUrl } : candidate;
            setImages(previous => previous.map(replace));
            setCurrentImg(previous => previous ? replace(previous) : previous);
        })).catch(error => {
            if (!cancelled) setSmartError(error instanceof Error ? error.message : "图片预览恢复失败，请重新添加图片。");
        });
        return () => { cancelled = true; };
    }, [images]);

    useEffect(() => {
        return () => {
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

    const handleImagesUpload = async (files: File[]): Promise<boolean> => {
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
                return false;
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
            return true;
        } catch (error) {
            console.error("批量上传图片失败:", error);
            alert(
                error instanceof Error
                    ? error.message
                    : "批量上传失败，请检查图片文件后重试。"
            );
            return false;
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        if (restoreStartedRef.current) return;
        restoreStartedRef.current = true;

        const restoreImages = async () => {
            const incomingFiles = await consumePendingCropTransfer("watermark");
            const files = incomingFiles.length
                ? incomingFiles
                : await loadFileSession("watermark-images");

            if (files.length) {
                const loaded = await handleImagesUpload(files);
                if (!loaded) {
                    await saveFileSession("watermark-images", files);
                }
            }

            setImagesHydrated(true);
        };

        void restoreImages();
    }, []);

    useEffect(() => {
        if (!imagesHydrated) return;
        const files = images.map((image) => image.file);
        const filesKey = files
            .map((file) => `${file.name}:${file.size}:${file.lastModified}:${file.type}`)
            .join("|");
        if (persistedImagesKeyRef.current === filesKey) return;
        persistedImagesKeyRef.current = filesKey;
        void (files.length
            ? saveFileSession("watermark-images", files)
            : clearFileSession("watermark-images"));
    }, [images, imagesHydrated]);

    const handleTextColorChange = (color: string, batch = editScope === "all") => {
        const targets = batch ? images : currentImg ? [currentImg] : [];
        setManualConfigs(prev => {
            const next = {...prev};
            for (const image of targets) {
                const config = {...prev[image.id]};
                if (color === "transparent") delete config.color;
                else config.color = color;
                next[image.id] = config;
            }
            return next;
        });
    };

    const handleTransparentWatermarkColorChange = async (color: string) => {
        if (color === 'transparent') {
            setTransparentWatermarkColor('');
            setTransparentWatermarkColorUrl(transparentWatermarkUrl);
            return;
        }
        try {
            const url = await applyColorToWatermark(transparentWatermarkUrl, color);
            setTransparentWatermarkColor(color);
            setTransparentWatermarkColorUrl(url);
        } catch {
            setSmartError('独立水印颜色更新失败，请重试');
        }
    };

    const currentTransparentWatermarkPosition = currentImg
        ? transparentWatermarkPositions[currentImg.id] || {x: 0.5, y: 0.5}
        : {x: 0.5, y: 0.5};
    const currentTransparentWatermarkOpacity = currentImg
        ? transparentWatermarkOpacities[currentImg.id] ?? TRANSPARENT_WATERMARK_OPACITY
        : TRANSPARENT_WATERMARK_OPACITY;
    const currentTransparentWatermarkScale = currentImg
        ? transparentWatermarkScales[currentImg.id] ?? TRANSPARENT_WATERMARK_SCALE
        : TRANSPARENT_WATERMARK_SCALE;
    const setCurrentTransparentWatermarkOpacity = (value: number) => {
        if (!currentImg) return;
        setTransparentWatermarkOpacities(previous => ({...previous, [currentImg.id]: value}));
    };
    const setCurrentTransparentWatermarkScale = (value: number) => {
        if (!currentImg) return;
        setTransparentWatermarkScales(previous => ({...previous, [currentImg.id]: value}));
    };

    const handleTransparentWatermarkTransform = (position: {x: number; y: number}) => {
        if (!currentImg) return;
        setTransparentWatermarkPositions(previous => ({...previous, [currentImg.id]: position}));
    };


    const handleWatermarkColorChange = (
        imageId: string,
        newWatermarkUrl: string,
        batch: boolean
    ) => {
        setWatermarkColorUrls((prev) => {
            const next = { ...prev };
            const imageIds = batch ? images.map((image) => image.id) : [imageId];
            imageIds.forEach((id) => {
                if (newWatermarkUrl === watermarkUrl) {
                    delete next[id];
                } else {
                    next[id] = newWatermarkUrl;
                }
            });
            return next;
        });
    };

    useEffect(() => {
        let cancelled = false;
        setSuggestedColors([]);
        if (currentImg?.previewUrl) void loadPositionImage(currentImg.previewUrl).then(image => {
            if (!cancelled) setSuggestedColors(extractDominantColors(image,5).map(item=>'#'+[item.r,item.g,item.b].map(channel=>Math.max(0,Math.min(255,channel)).toString(16).padStart(2,'0')).join('')));
        }).catch(()=>{});
        return () => {cancelled=true;};
    }, [currentImg?.previewUrl]);

    const changeImageTint = async (color: string, batch = editScope === 'all') => {
        if (!currentImg) return;
        const request = ++colorRequest.current;
        const imageId = currentImg.id;
        const targetIds = batch ? images.map(image => image.id) : [imageId];
        try {
            const url = color === 'transparent' ? watermarkUrl : await applyColorToWatermark(watermarkUrl,color);
            if (request !== colorRequest.current) return;
            setImageTints(previous => {const next = {...previous}; for (const id of targetIds) {if (color === 'transparent') delete next[id]; else next[id] = color;} return next;});
            handleWatermarkColorChange(imageId,url,batch);
        } catch {setSmartError('水印颜色更新失败，请重试');}
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

            patchWatermarkConfig({icon:url});
        };
        reader.readAsDataURL(files[0]);
    };

    const handleWatermarkTransform = (
        imageId: string,
        position: Omit<WatermarkPosition, "id">
    ) => {
        manualPositions.current.add(imageId);
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
        images.forEach(image => manualPositions.current.add(image.id));
        setWatermarkPositions((prev) =>
            prev.map((img) => ({
                ...position,
                id: img.id,
            }))
        );
    };

    const handlePlacementChange = React.useCallback(async (placement?: string, scale?: number) => {
        if (!currentImg || !watermarkUrl) return;
        if (smartPending) {
            queuedPlacement.current = {
                ...(queuedPlacement.current?.imageId === currentImg.id ? queuedPlacement.current : {}),
                imageId:currentImg.id,
                ...(placement ? {placement} : {}), ...(scale !== undefined ? {scale} : {}),
            };
            return;
        }
        const request = ++placementRequest.current;
        try {
            const logo = await loadPositionImage(watermarkUrl);
            if (request !== placementRequest.current) return;
            const targets = editScope === "all" ? images : [currentImg];
            targets.forEach(image => manualPositions.current.add(image.id));
            const ids = new Set(targets.map(image => image.id));
            const anchors: Record<string,[number,number]> = {
                'top-left':[0,0], 'top-mid':[0.5,0], 'top-right':[1,0],
                'mid-left':[0,0.5], center:[0.5,0.5], 'mid-right':[1,0.5],
                'bottom-left':[0,1], 'bottom-mid':[0.5,1], 'bottom-right':[1,1],
            };
            setWatermarkPositions(prev => prev.map(position => {
                if (!ids.has(position.id)) return position;
                const image = targets.find(image => image.id === position.id)!;
                const nextScale = Math.min(scale ?? position.scaleX,getWatermarkMaximumScale(image.width,image.height,logo));
                const metrics = getAdaptiveWatermarkRenderMetrics(image.width,image.height,logo,nextScale);
                const maxX = Math.max(0,1-metrics.width/image.width), maxY = Math.max(0,1-metrics.height/image.height);
                const anchor = placement ? anchors[placement] : undefined;
                return {...position,scaleX:nextScale,scaleY:nextScale,
                    x:anchor ? anchor[0]*maxX : Math.min(position.x,maxX),
                    y:anchor ? anchor[1]*maxY : Math.min(position.y,maxY)};
            }));
        } catch(error) { setSmartError(error instanceof Error ? error.message : "位置设置失败"); }
    }, [currentImg,watermarkUrl,smartPending,editScope,images]);

    const handleWatermarkScaleChange = (scale:number) => {
        if (watermarkMode !== 'image') {
            patchWatermarkConfig({textScale:Math.max(.1,Math.min(3,scale))});
            return;
        }
        void handlePlacementChange(undefined,scale);
    };

    const handleEditScopeChange = (scope:'current'|'all') => {
        setEditScope(scope);
        if (scope === 'all' && images.length) {
            const heights = images.map(image => getWatermarkLayoutMetrics(image.width,image.height).title).sort((a,b)=>a-b);
            setBatchReferenceTextHeight(heights[Math.floor(heights.length/2)]);
        } else {
            setBatchReferenceTextHeight(undefined);
        }
    };

    useEffect(() => {
        if (smartPending || !queuedPlacement.current) return;
        const queued = queuedPlacement.current;
        queuedPlacement.current = null;
        if (queued.imageId === currentImg?.id) void handlePlacementChange(queued.placement,queued.scale);
    }, [smartPending,currentImg?.id,handlePlacementChange]);

    const handleSmartWatermarkPosition = async (
        imageId: string,
        batch: boolean,
        scale: number
    ) => {
        const targets = batch ? images : images.filter((image) => image.id === imageId);
        const positions: WatermarkPosition[] = [];
        for (const image of targets) {
            try {
                if (!image.previewUrl) throw new Error("图片预览不存在");
                const [photo, logo] = await Promise.all([
                    loadPositionImage(image.previewUrl),
                    loadPositionImage(watermarkColorUrls[image.id] || watermarkUrl),
                ]);
                positions.push(findSmartWatermarkPosition(
                    photo, logo, image.id, scale, image.width, image.height
                ));
            } catch (error) {
                console.error(`智能定位失败: ${image.id}`, error);
            }
        }
        if (!positions.length) throw new Error("图片分析失败，请重试");
        positions.forEach(position => manualPositions.current.add(position.id));
        const byId = new Map(positions.map((position) => [position.id, position]));
        setWatermarkPositions((prev) => prev.map((position) => byId.get(position.id) || position));
        if (positions.length !== targets.length) {
            alert(`${targets.length - positions.length} 张图片未能完成智能定位，请手动调整。`);
        }
    };

    const handleApplyWatermark = async (
        scope: "all" | "current" = "all",
        exportMode: WatermarkDownloadMode = "zip",
    ) => {
        if (exportInFlight.current || smartPending) return;
        if (!watermarkUrl) {
            alert(watermarkMode === "image" ? "请上传水印图片！" : "请输入水印文字，并等待预览生成。");
            return;
        }

        const targetImages = scope === "current"
            ? (currentImg ? [currentImg] : [])
            : images;
        if (!targetImages.length) {
            alert(scope === "current" ? "请先选择要导出的图片。" : "请先上传图片。");
            return;
        }

        const { batchSize, globalConcurrency } =
            adjustBatchSizeAndConcurrency(targetImages);

        exportInFlight.current = true;
        try {
            console.log("水印下载开始！");

            const allImageData = buildImagesWithPositions(
                targetImages,
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
                exportMode
            );
        } catch (error) {
            console.error("处理水印失败:", error);
            alert(error instanceof Error ? error.message : "处理水印失败，请重试。");
        } finally { exportInFlight.current = false; }
    };

    const handleApplyCurrentWatermark = () => handleApplyWatermark("current", "files");
    const handleApplyAllWatermarks = () => handleApplyWatermark("all", "files");
    const handleApplyZipWatermark = () => handleApplyWatermark("all", "zip");

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
                    onUpload={async (files) => {
                        await handleImagesUpload(files);
                    }}
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
                        <div className="flex min-h-0 flex-1 flex-col">
                        {watermarkMode !== "image" && <div className="px-2 pt-1"><CaptionReviewDialog currentFilename={currentImg.file.name} pendingCount={captionPendingCount} items={captionReviewItems} onSave={saveCaptionReview} onClear={clearCaptionReview}/></div>}
                        {watermarkMode !== "image" && <label className="flex items-center gap-2 p-2 text-sm">
                            <input type="checkbox" checked={smartEnabled} onChange={event => setSmartEnabled(event.target.checked)} />智能适配大小、颜色和排版
                        </label>}
                        <MobileWatermarkEditor
                            watermarkUrl={watermarkUrl}
                            backgroundOriginalWidth={currentImg.width}
                            backgroundPreviewUrl={currentImg.previewUrl || ""}
                            currentWatermarkPosition={currentWatermarkPosition}
                            onTransform={(position) =>
                                handleWatermarkTransform(currentImg.id, position)
                            }
                            totalImages={images.length}
                            currentIndex={currentImageIndex}
                            onAllTransform={handleAllWatermarkTransform}
                            onSmartPosition={(batch, scale) =>
                                handleSmartWatermarkPosition(currentImg.id, batch, scale)
                            }
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
                            transparentWatermarkEnabled={transparentWatermarkEnabled}
                            setTransparentWatermarkEnabled={setTransparentWatermarkEnabled}
                            transparentWatermarkUrl={transparentWatermarkColorUrl}
                            transparentWatermarkBaseUrl={transparentWatermarkUrl}
                            transparentWatermarkOpacity={currentTransparentWatermarkOpacity}
                            transparentWatermarkScale={currentTransparentWatermarkScale}
                            transparentWatermarkPosition={currentTransparentWatermarkPosition}
                            onTransparentWatermarkTransform={handleTransparentWatermarkTransform}
                            setTransparentWatermarkOpacity={setCurrentTransparentWatermarkOpacity}
                            setTransparentWatermarkScale={setCurrentTransparentWatermarkScale}
                            transparentWatermarkColor={transparentWatermarkColor}
                            onTransparentWatermarkColorChange={color => void handleTransparentWatermarkColorChange(color)}
                            copyrightStatement={copyrightStatement}
                            setCopyrightStatement={setCopyrightStatement}
                            batchEditing={editScope === "all"}
                            onBatchEditingChange={batch => handleEditScopeChange(batch ? "all" : "current")}
                            watermarkBlur={watermarkBlur}
                            setWatermarkBlur={setWatermarkBlur}
                            quality={quality}
                            setQuality={setQuality}
                            onConfigPatch={patchWatermarkConfig}
                            onAutoColor={() => handleTextColorChange("transparent")}
                            watermarkMode={watermarkMode}
                            setWatermarkMode={handleWatermarkModeChange}
                            mixedWatermarkConfig={mixedWatermarkConfig}
                            setMixedWatermarkConfig={setMixedWatermarkConfig}
                            onWatermarkUpload={handleWatermarkUpload}
                            onBack={() => setMobileView("gallery")}
                            stackPreviews={stackPreviews}
                            onGenerate={handleApplyAllWatermarks}
                            onGenerateCurrent={handleApplyCurrentWatermark}
                            onGenerateZip={handleApplyZipWatermark}
                            isGenerating={loading}
                            generateProgress={smoothProgress}
                        />
                        </div>
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
                    onUpload={async (files) => {
                        await handleImagesUpload(files);
                    }}
                />
            );
        }

        return (
            <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-stone-100 dark:bg-slate-950">
                <div className={`wm-desktop-layout flex min-h-0 flex-1 gap-3 p-3 pb-2 ${settingsPanelOpen ? "has-settings-panel" : ""}`}>
                    {images.length > 0 && (
                        <VerticalCarousel
                            images={images}
                            currentImageId={currentImg?.id}
                            setImages={setImages}
                            setImageUploaderVisible={setImageUploaderVisible}
                            setCurrentImg={setCurrentImg}
                            height={editorHeight}
                        />
                    )}
                    {currentImg && (
                        <WatermarkEditor
                            settingsOpen={settingsPanelOpen}
                            onColorPanelOpenChange={open=>{if(open)setSettingsPanelOpen(false);}}
                            watermarkUrl={watermarkUrl}
                            textConfig={watermarkMode === 'image' ? undefined : {...mixedWatermarkConfig, textOnly: watermarkMode === 'text'}}
                            onTextChange={patchWatermarkConfig}
                            backgroundOriginalWidth={currentImg.width}
                            backgroundPreviewUrl={currentImg.previewUrl || ""}
                            currentWatermarkPosition={currentWatermarkPosition}
                            onTransform={(position) =>
                                handleWatermarkTransform(currentImg.id, position)
                            }
                            onAllTransform={handleAllWatermarkTransform}
                            onSmartPosition={(batch, scale) =>
                                handleSmartWatermarkPosition(currentImg.id, batch, scale)
                            }
                            watermarkColor={
                                watermarkColorUrls[currentImg.id] || ""
                            }
                            selectedColor={watermarkMode === 'image' ? imageTint : mixedWatermarkConfig.color}
                            automaticColor={watermarkMode === 'image' ? !imageTint : !manualConfigs[currentImg.id]?.color}
                            onTintChange={changeImageTint}
                            onTextColorChange={watermarkMode !== "image" ? handleTextColorChange : undefined}
                            onColorChange={(color, batch) =>
                                handleWatermarkColorChange(currentImg.id, color, batch)
                            }
                            previewZoom={previewZoom}
                            onPreviewZoomChange={setPreviewZoom}
                            batchEditing={editScope === "all"}
                            onBatchEditingChange={batch => setEditScope(batch ? "all" : "current")}
                            watermarkBlur={watermarkBlur}
                            watermarkOpacity={watermarkOpacity}
                            onWatermarkOpacityChange={setWatermarkOpacity}
                            transparentWatermarkEnabled={transparentWatermarkEnabled}
                            transparentWatermarkUrl={transparentWatermarkColorUrl}
                            transparentWatermarkBaseUrl={transparentWatermarkUrl}
                            transparentWatermarkOpacity={currentTransparentWatermarkOpacity}
                            transparentWatermarkScale={currentTransparentWatermarkScale}
                            transparentWatermarkPosition={currentTransparentWatermarkPosition}
                            onTransparentWatermarkTransform={handleTransparentWatermarkTransform}
                        />
                    )}
                </div>

                <DesktopToolbar
                    imageTint={imageTint}
                    suggestedColors={suggestedColors}
                    onImageTintChange={color=>void changeImageTint(color)}
                    settingsOpen={settingsPanelOpen}
                    onSettingsOpenChange={setSettingsPanelOpen}
                    editScope={editScope}
                    setEditScope={handleEditScopeChange}
                    imageCount={images.length}
                    currentFilename={currentImg?.file.name || ""}
                    maxScale={watermarkMode === 'image' ? watermarkMaxScale : 3}
                    scale={watermarkMode === 'image' ? (currentWatermarkPosition?.scaleX || 1) : (mixedWatermarkConfig.textScale || 1)}
                    onScaleChange={handleWatermarkScaleChange}
                    onAutoColor={() => handleTextColorChange("transparent")}
                    fontNotice={fontNotice}
                    smartPending={smartPending}
                    smartError={smartError}
                    smartEnabled={smartEnabled}
                    setSmartEnabled={setSmartEnabled}
                    onResetSmart={() => {
                        if (currentImg) {
                            const targets = editScope === "all" ? images : [currentImg];
                            targets.forEach(image => manualPositions.current.delete(image.id));
                            setManualConfigs(prev => {
                                const next = {...prev};
                                targets.forEach(image => {next[image.id] = prev[image.id]?.icon ? {icon:prev[image.id].icon} : {};});
                                return next;
                            });
                            setCaptionCorrections(previous => {
                let next = previous;
                for (const image of targets) next = clearCaptionCorrection(next, image.file.name);
                saveCaptionCorrections(next);
                return next;
            });
                        }
                        setSmartEnabled(true);
                    }}
                    watermarkMode={watermarkMode}
                    setWatermarkMode={handleWatermarkModeChange}
                    storedImageWatermarkUrl={storedImageWatermarkUrl}
                    mixedWatermarkConfig={mixedWatermarkConfig}
                    onConfigPatch={patchWatermarkConfig}
                    onWatermarkUpload={handleWatermarkUpload}
                    watermarkBlur={watermarkBlur}
                    setWatermarkBlur={setWatermarkBlur}
                    quality={quality}
                    setQuality={setQuality}
                    watermarkOpacity={watermarkOpacity}
                    setWatermarkOpacity={setWatermarkOpacity}
                    transparentWatermarkEnabled={transparentWatermarkEnabled}
                    setTransparentWatermarkEnabled={setTransparentWatermarkEnabled}
                    transparentWatermarkOpacity={currentTransparentWatermarkOpacity}
                    setTransparentWatermarkOpacity={setCurrentTransparentWatermarkOpacity}
                    transparentWatermarkScale={currentTransparentWatermarkScale}
                    setTransparentWatermarkScale={setCurrentTransparentWatermarkScale}
                    transparentWatermarkColor={transparentWatermarkColor}
                    onTransparentWatermarkColorChange={color => void handleTransparentWatermarkColorChange(color)}
                    copyrightStatement={copyrightStatement}
                    setCopyrightStatement={setCopyrightStatement}
                    onGenerate={handleApplyAllWatermarks}
                    onGenerateCurrent={handleApplyCurrentWatermark}
                    onGenerateZip={handleApplyZipWatermark}
                    loading={loading}
                    progress={smoothProgress}
                    captionReviewItems={captionReviewItems}
                    captionPendingCount={captionPendingCount}
                    onSaveCaptionReview={saveCaptionReview}
                    onClearCaptionReview={clearCaptionReview}
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
