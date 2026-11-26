import { DEFAULT_FONT_ID, missingFontCharacters } from "./fonts/registry";
import { applyColorToWatermark, extractDominantColors, getAdaptiveWatermarkRenderMetrics, getWatermarkMaximumScale, fitWatermarkPosition } from "@/utils/watermark-editor";
import { analyzeWatermarkCaption, extractWatermarkCaption } from "./filename-watermark";
import { clearCaptionCorrection, getCaptionCorrection, loadCaptionCorrections, saveCaptionCorrections, setCaptionCorrection, type CaptionCorrectionMap } from "./caption-corrections";
import { resolveWatermarkTypography, suggestWatermarkFont } from './font-selection';
import { getWatermarkLineModel } from './watermark-lines';
import { rebaseTextWatermarkScale } from './layout-metrics';
import { createSmartWatermark, createSizedTextWatermark } from "./smart-watermark";
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
// Fields that hold the watermark's words. They always belong to the current image only
// and are remembered per filename.
const TEXT_CONTENT_KEYS = ['textLine1', 'textLine2', 'singleLineText', 'promoteEra'] as const;
/** Changing the title or caption means a hand-typed one-line text must follow them again. */
function withLineReset(patch: Partial<MixedWatermarkConfig>): Partial<MixedWatermarkConfig> {
    return ('textLine1' in patch || 'textLine2' in patch) && !('singleLineText' in patch) ? {...patch, singleLineText: undefined} : patch;
}

type OversizePromptState = {
    files: File[];
    thresholdBytes: number;
    largestFileSizeBytes: number;
} | null;
type WatermarkMode = "image" | "mixed" | "text";

const Watermark: React.FC = () => {
    const navigate = useNavigate();
    const [images, setImages] = useState<ImageType[]>([]);
    const deviceType = useDeviceDetect();
    const isMobile = deviceType === "mobile";
    const editorHeight = isMobile ? window.innerHeight * 0.6 : Math.max(200,window.innerHeight - 350);

    const [currentImg, setCurrentImg] = useState<ImageType | null>(null);
    const [watermarkUrl, setWatermarkUrl] =
        useState<string>(DEFAULT_WATERMARK_URL);
    const [watermarkMode, setWatermarkMode] = useState<WatermarkMode>(
        "image"
    );
    // Per-image choices made while the scope is "current".
    const [watermarkModes, setWatermarkModes] = useState<Record<string, WatermarkMode>>({});
    // The one type chosen while the scope is "all"; null keeps the filename-based default.
    const [batchWatermarkMode, setBatchWatermarkMode] = useState<WatermarkMode | null>(null);
    // Image-mode material: one batch default plus images given their own in "current" scope.
    const [storedImageWatermarkUrl, setStoredImageWatermarkUrl] =
        useState<string>(DEFAULT_WATERMARK_URL);
    const [imageWatermarkUrls, setImageWatermarkUrls] = useState<Record<string, string>>({});
    const [baseWatermarkConfig, setBaseWatermarkConfig] =
        useState<MixedWatermarkConfig>({ ...DEFAULT_MIXED_WATERMARK_CONFIG });
    const smartEnabled = true;
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
    const [automaticStyle, setAutomaticStyle] = useState<Partial<MixedWatermarkConfig>>({});
    const manualPositions = useRef(new Set<string>());
    const generatedTextScales = useRef(new Map<string,number>());
    useEffect(() => { setCaptionCorrections(loadCaptionCorrections()); }, []);

    const resolveImageMaterial = (imageId: string) => imageWatermarkUrls[imageId] ?? storedImageWatermarkUrl;
    const currentImageMaterial = currentImg ? resolveImageMaterial(currentImg.id) : storedImageWatermarkUrl;

    const resolveImageWatermarkMode = (image: ImageType): WatermarkMode =>
        watermarkModes[image.id]
            ?? batchWatermarkMode
            ?? (extractWatermarkCaption(image.file.name) ? "mixed" : "image");

    // "All" makes every image, including ones added later, use one type;
    // "current" only sets the type of the image being edited.
    const handleWatermarkModeChange = (mode: WatermarkMode) => {
        if (editScope === "all") {
            setBatchWatermarkMode(mode);
            setWatermarkModes({});
        } else if (currentImg) {
            setWatermarkModes(previous => ({...previous, [currentImg.id]: mode}));
        }
        setWatermarkMode(mode);
    };

    useEffect(() => {
        if (!currentImg) return;
        setWatermarkMode(resolveImageWatermarkMode(currentImg));
    }, [currentImg?.id, currentImg?.file.name, watermarkModes, batchWatermarkMode]);

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
        ...(currentImg ? manualConfigs[currentImg.id] : null),
        ...resolveWatermarkTypography(currentImg?.file.name||'',baseWatermarkConfig,currentImg?manualConfigs[currentImg.id]:{},smartEnabled),
    }), [baseWatermarkConfig, currentImg, manualConfigs, smartEnabled, captionCorrections]);
    const mixedWatermarkConfig = {...desiredConfig, ...automaticStyle,
        ...(currentImg ? manualConfigs[currentImg.id] : null),
        ...resolveWatermarkTypography(currentImg?.file.name||'',baseWatermarkConfig,currentImg?manualConfigs[currentImg.id]:{},smartEnabled)};
    const configRef = useRef(mixedWatermarkConfig);
    configRef.current = mixedWatermarkConfig;
    const patchWatermarkConfig = (patch:Partial<MixedWatermarkConfig>) => {
        patch=unifyWatermarkFontPatch(patch);
        patch = withLineReset(patch);
        // Font selection is shared by the whole batch.  Layout/text edits can
        // remain scoped to the current image, while the name/caption/author
        // font choices must never diverge when moving between images.
        const globalFontPatch: Partial<MixedWatermarkConfig> = {};
        for (const key of ['fontId', 'captionFontId', 'authorFontId'] as const) {
            if (patch[key] !== undefined) Object.assign(globalFontPatch, {[key]: patch[key]});
        }
        if (Object.keys(globalFontPatch).length) {
            setBaseWatermarkConfig(previous => ({...previous, ...globalFontPatch}));
            setManualConfigs(previous => {
                const next = {...previous};
                for (const image of images) {
                    next[image.id] = {...(previous[image.id] || {}), ...globalFontPatch};
                }
                return next;
            });
            patch = Object.fromEntries(Object.entries(patch).filter(([key]) => !(key in globalFontPatch))) as Partial<MixedWatermarkConfig>;
        }
        if (!currentImg) {setBaseWatermarkConfig(prev=>({...prev,...patch}));return;}
        // Text content is never batch-edited: one typo must not overwrite every caption.
        // Appearance follows the 当前/全部 switch.
        const isText = (key: string) => (TEXT_CONTENT_KEYS as readonly string[]).includes(key);
        const textPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => isText(key))) as Partial<MixedWatermarkConfig>;
        const stylePatch = Object.fromEntries(Object.entries(patch).filter(([key]) => !isText(key))) as Partial<MixedWatermarkConfig>;
        const styleTargets = editScope === "all" ? images : [currentImg];
        const currentId = currentImg.id;
        setManualConfigs(prev => {
            let next = Object.keys(stylePatch).length ? applyWatermarkConfigPatch(prev, styleTargets.map(image=>image.id), stylePatch) : prev;
            if (Object.keys(textPatch).length) next = applyWatermarkConfigPatch(next, [currentId], textPatch);
            return next;
        });
        const captionPatch = textPatch;
        if (Object.keys(captionPatch).length) {
            const filename = currentImg.file.name;
            setCaptionCorrections(previous => {
                const next = setCaptionCorrection(previous, filename, captionPatch);
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
    // Independent watermark: each setting has a batch value plus per-image values set in "current" scope.
    const [transparentWatermarkEnabled, setTransparentWatermarkEnabled] = useState(false);
    const [transparentWatermarkOverrides, setTransparentWatermarkOverrides] = useState<Record<string, boolean>>({});
    const [transparentWatermarkOpacity, setTransparentWatermarkOpacity] = useState(TRANSPARENT_WATERMARK_OPACITY);
    const [transparentWatermarkOpacities, setTransparentWatermarkOpacities] = useState<Record<string, number>>({});
    const [transparentWatermarkScale, setTransparentWatermarkScale] = useState(TRANSPARENT_WATERMARK_SCALE);
    const [transparentWatermarkScales, setTransparentWatermarkScales] = useState<Record<string, number>>({});
    const [transparentWatermarkPosition, setTransparentWatermarkPosition] = useState({x: 0.5, y: 0.5});
    const [transparentWatermarkPositions, setTransparentWatermarkPositions] = useState<Record<string, {x: number; y: number}>>({});
    const [transparentWatermarkUrl] = useState(DEFAULT_TRANSPARENT_WATERMARK_URL);
    const [transparentWatermarkColor, setTransparentWatermarkColor] = useState('');
    const [transparentWatermarkColors, setTransparentWatermarkColors] = useState<Record<string, string>>({});
    // Tinted copies of the independent watermark, keyed by color.
    const [transparentTintUrls, setTransparentTintUrls] = useState<Record<string, string>>({});
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
        resolveTransparentWatermark: imageId => resolveTransparentWatermark(imageId),
        copyrightStatement,
        quality,
        resolveWatermark: async (item) => {
            const image = images.find(candidate => candidate.id === item.id);
            if (!image) throw new Error("图片不存在");
            const effectiveMode = resolveImageWatermarkMode(image);
            if (effectiveMode === "image") {
                const imageWatermarkUrl = watermarkColorUrls[image.id] || resolveImageMaterial(image.id);
                const imageWatermark = await loadPositionImage(imageWatermarkUrl);
                const sourcePosition = !watermarkModes[image.id] && !manualPositions.current.has(image.id)
                    ? {...item.position, scaleX: 1, scaleY: 1}
                    : item.position;
                return {
                    url: imageWatermarkUrl,
                    position: fitWatermarkPosition(image.width, image.height, imageWatermark, sourcePosition),
                };
            }
            const config = {...baseWatermarkConfig, ...getCaptionForImage(image),
                ...manualConfigs[image.id], ...resolveWatermarkTypography(image.file.name,baseWatermarkConfig,manualConfigs[image.id],smartEnabled),textOnly: effectiveMode === "text"};
            if (smartEnabled) {
                const result = await createSmartWatermark(image, config, manualConfigs[image.id]);
                const manuallyPlaced = manualPositions.current.has(image.id);
                const position = result.url && manuallyPlaced
                    ? fitWatermarkPosition(image.width,image.height,await loadPositionImage(result.url),item.position)
                    : result.position;
                return {url: result.url, position};
            }
            const result=await createSizedTextWatermark(image,config);
            const manuallyPlaced = manualPositions.current.has(image.id);
            const position = result.url
                ? fitWatermarkPosition(image.width,image.height,await loadPositionImage(result.url),manuallyPlaced ? item.position : {...item.position,scaleX:result.scale,scaleY:result.scale})
                : item.position;
            return {url:result.url,position};
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
        const config = {...baseWatermarkConfig, ...getCaptionForImage(image), ...manualConfigs[image.id]};
        // The direction the preview actually chose applies to the image on screen,
        // unless the user picked one for it.
        const layout = manualConfigs[image.id]?.layout
            || (image.id === currentImg?.id ? automaticStyle.layout : undefined)
            || config.layout || baseWatermarkConfig.layout || 'horizontal';
        const mode = resolveImageWatermarkMode(image);
        return {
            id: image.id,
            filename: image.file.name,
            analysis,
            textLine1: config.textLine1 || '',
            textLine2: config.textLine2 || '',
            model: getWatermarkLineModel({...config, layout}, mode === 'text'),
            imageMode: mode === 'image',
            corrected: Boolean(correction),
        };
    }), [images, captionCorrections, manualConfigs, baseWatermarkConfig, automaticStyle.layout, currentImg?.id, watermarkModes, batchWatermarkMode]);
    const captionPendingCount = captionReviewItems.filter(item => !item.corrected && item.analysis.confidence !== 'high').length;
    // Saves the lines edited in the dialog to their images, and marks every listed image as reviewed.
    const saveCaptionReview = (edits: Record<string, Partial<MixedWatermarkConfig>>) => {
        const patches = Object.fromEntries(Object.entries(edits).map(([id, patch]) => [id, withLineReset(patch)]));
        if (Object.keys(patches).length) setManualConfigs(previous => {
            const next = {...previous};
            for (const [id, patch] of Object.entries(patches)) next[id] = {...previous[id], ...patch};
            return next;
        });
        setCaptionCorrections(previous => {
            let next = previous;
            for (const item of captionReviewItems) {
                next = setCaptionCorrection(next, item.filename, {textLine1: item.textLine1, textLine2: item.textLine2, ...patches[item.id]});
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
                for (const key of TEXT_CONTENT_KEYS) delete entry[key];
                next[item.id] = entry;
            }
            return next;
        });
    };

    useEffect(() => {setWatermarkColorUrls({}); setImageTints({}); colorRequest.current++;}, [storedImageWatermarkUrl]);
    useEffect(() => { setAutomaticStyle({}); }, [watermarkMode,currentImg?.id]);

    useEffect(() => {
        let cancelled = false;
        setSmartError("");
        if (watermarkMode === "image") {
            setSmartPending(false);
            setWatermarkUrl(currentImageMaterial);
            if (currentImg) void loadPositionImage(currentImageMaterial).then(logo=>{
                if(cancelled) return;
                setWatermarkMaxScale(getWatermarkMaximumScale(currentImg.width,currentImg.height,logo));
                setWatermarkPositions(prev=>prev.map(position=>{
                    if (position.id !== currentImg.id) return position;
                    const next = manualPositions.current.has(currentImg.id)
                        ? position
                        : {...position, scaleX: 1, scaleY: 1};
                    return fitWatermarkPosition(currentImg.width,currentImg.height,logo,next);
                }));
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
                const sized = !result&&currentImg?await createSizedTextWatermark(currentImg,config):null;
                const url = result ? result.url : sized?sized.url:await createMixedWatermark(config);
                const logo = url ? await loadPositionImage(url) : null;
                if (!cancelled) {
                    setWatermarkUrl(url);
                    const missing = missingFontCharacters(config.fontId || DEFAULT_FONT_ID,config.textLine1 + (config.singleLineText ?? ''))
                        + missingFontCharacters(config.captionFontId || DEFAULT_FONT_ID,config.textLine2);
                    setFontNotice(missing ? `所选字体缺少「${[...new Set(Array.from(missing))].join("")}」，这些字使用系统宋体补齐。` : "");
                    setAutomaticStyle(result ? {color:result.config.color, iconColor:result.config.iconColor, layout:result.config.layout} : {});
                    if (logo && currentImg) {
                        const generatedScale=result?.position.scaleX??sized?.scale??1;
                        const previousGeneratedScale=generatedTextScales.current.get(currentImg.id);
                        generatedTextScales.current.set(currentImg.id,generatedScale);
                        setWatermarkMaxScale(getWatermarkMaximumScale(currentImg.width,currentImg.height,logo));
                        setWatermarkPositions(prev => prev.map(position => {
                            if (position.id !== currentImg.id) return position;
                            // A manually moved/resized watermark belongs to this
                            // image. Re-generating the text (for example after
                            // switching away and back) must not replace its
                            // saved scale with the newly generated smart scale.
                            // Keep the saved position and only clamp it if a
                            // changed footprint would otherwise leave the image.
                            const manuallyPlaced = manualPositions.current.has(currentImg.id);
                            // Block-relative scale changes with the layout's width.
                            // Preserve the user's resize ratio, not the old block scale.
                            const rebasedScale=rebaseTextWatermarkScale(position.scaleX,previousGeneratedScale,generatedScale);
                            const next = manuallyPlaced
                                ? {...position,scaleX:rebasedScale,scaleY:rebasedScale}
                                : result?.position ?? {
                                    ...position,
                                    scaleX: sized?.scale ?? position.scaleX,
                                    scaleY: sized?.scale ?? position.scaleY,
                                };
                            return fitWatermarkPosition(currentImg.width,currentImg.height,logo,next);
                        }));
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
    }, [watermarkMode, desiredConfig, currentImageMaterial, smartEnabled, currentImg, manualConfigs]);

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
                    // Pick the initial automatic font once for the batch. The
                    // choice is shared by every image; later images must not
                    // derive a different font from their own filenames.
                    const initialFont = suggestWatermarkFont(uploadImages[0].file.name);
                    setBaseWatermarkConfig(previous => previous.fontId || previous.captionFontId
                        ? previous
                        : {...previous, fontId: initialFont, captionFontId: initialFont});
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

    const handleLogoColorChange = (color: string, batch = editScope === "all") => {
        const targets = batch ? images : currentImg ? [currentImg] : [];
        setManualConfigs(prev => {
            const next = {...prev};
            for (const image of targets) {
                const config = {...prev[image.id]};
                if (color === "transparent") delete config.iconColor;
                else config.iconColor = color;
                next[image.id] = config;
            }
            return next;
        });
    };

    /** "全部" sets the batch value and drops per-image values; "当前" sets only this image. */
    const applyScoped = <T,>(setBase: (value: T) => void, setOverrides: React.Dispatch<React.SetStateAction<Record<string, T>>>, value: T) => {
        if (editScope === "all" || !currentImg) {
            setBase(value);
            setOverrides({});
            return;
        }
        const id = currentImg.id;
        setOverrides(previous => ({...previous, [id]: value}));
    };

    const resolveTransparentWatermark = (imageId: string) => {
        const color = transparentWatermarkColors[imageId] ?? transparentWatermarkColor;
        return {
            enabled: transparentWatermarkOverrides[imageId] ?? transparentWatermarkEnabled,
            color,
            url: color ? transparentTintUrls[color] ?? transparentWatermarkUrl : transparentWatermarkUrl,
            opacity: transparentWatermarkOpacities[imageId] ?? transparentWatermarkOpacity,
            scale: transparentWatermarkScales[imageId] ?? transparentWatermarkScale,
            position: transparentWatermarkPositions[imageId] ?? transparentWatermarkPosition,
        };
    };
    const currentTransparent = currentImg
        ? resolveTransparentWatermark(currentImg.id)
        : {enabled: transparentWatermarkEnabled, color: transparentWatermarkColor, url: transparentWatermarkColor ? transparentTintUrls[transparentWatermarkColor] ?? transparentWatermarkUrl : transparentWatermarkUrl,
            opacity: transparentWatermarkOpacity, scale: transparentWatermarkScale, position: transparentWatermarkPosition};

    const handleTransparentWatermarkColorChange = async (color: string) => {
        if (color === 'transparent') {
            applyScoped(setTransparentWatermarkColor, setTransparentWatermarkColors, '');
            return;
        }
        try {
            if (!transparentTintUrls[color]) {
                const url = await applyColorToWatermark(transparentWatermarkUrl, color);
                setTransparentTintUrls(previous => ({...previous, [color]: url}));
            }
            applyScoped(setTransparentWatermarkColor, setTransparentWatermarkColors, color);
        } catch {
            setSmartError('独立水印颜色更新失败，请重试');
        }
    };

    const currentTransparentWatermarkEnabled = currentTransparent.enabled;
    const handleTransparentWatermarkEnabledChange = (value: boolean) =>
        applyScoped(setTransparentWatermarkEnabled, setTransparentWatermarkOverrides, value);
    const currentTransparentWatermarkPosition = currentTransparent.position;
    const currentTransparentWatermarkOpacity = currentTransparent.opacity;
    const currentTransparentWatermarkScale = currentTransparent.scale;
    const setCurrentTransparentWatermarkOpacity = (value: number) =>
        applyScoped(setTransparentWatermarkOpacity, setTransparentWatermarkOpacities, value);
    const setCurrentTransparentWatermarkScale = (value: number) =>
        applyScoped(setTransparentWatermarkScale, setTransparentWatermarkScales, value);
    const handleTransparentWatermarkTransform = (position: {x: number; y: number}) =>
        applyScoped(setTransparentWatermarkPosition, setTransparentWatermarkPositions, position);


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
        const targetIds = batch ? images.map(image => image.id) : [currentImg.id];
        try {
            // Images can carry different materials, so each material is tinted on its own.
            const tinted = new Map<string, string>();
            if (color !== 'transparent') {
                for (const id of targetIds) {
                    const material = resolveImageMaterial(id);
                    if (!tinted.has(material)) tinted.set(material, await applyColorToWatermark(material, color));
                }
            }
            if (request !== colorRequest.current) return;
            setImageTints(previous => {const next = {...previous}; for (const id of targetIds) {if (color === 'transparent') delete next[id]; else next[id] = color;} return next;});
            setWatermarkColorUrls(previous => {
                const next = {...previous};
                for (const id of targetIds) {
                    if (color === 'transparent') delete next[id];
                    else next[id] = tinted.get(resolveImageMaterial(id))!;
                }
                return next;
            });
        } catch {setSmartError('水印颜色更新失败，请重试');}
    };

    const handleWatermarkUpload = (files: File[]) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const url = event.target?.result as string;
            if (watermarkMode === "image") {
                if (editScope === "all" || !currentImg) {
                    setStoredImageWatermarkUrl(url);
                    setImageWatermarkUrls({});
                } else {
                    // A new material drops this image's old tint, as a batch change drops all tints.
                    const id = currentImg.id;
                    setImageWatermarkUrls(previous => ({...previous, [id]: url}));
                    setImageTints(previous => {const next = {...previous}; delete next[id]; return next;});
                    setWatermarkColorUrls(previous => {const next = {...previous}; delete next[id]; return next;});
                }
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
        // The editor's payload may still carry the previously shown image's
        // id; the saved entry must stay keyed by the image being edited.
        setWatermarkPositions((prev) =>
            prev.map((pos) =>
                pos.id === imageId ? { ...pos, ...position, id: imageId } : pos
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

    // Image-mode images are measured with their own material; text watermarks only exist for the image on screen.
    const positionWatermarkUrl = (image: ImageType) => resolveImageWatermarkMode(image) === 'image'
        ? watermarkColorUrls[image.id] || resolveImageMaterial(image.id)
        : watermarkUrl;

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
            const targets = editScope === "all" ? images : [currentImg];
            const logos = new Map<string, HTMLImageElement>();
            for (const url of new Set(targets.map(positionWatermarkUrl))) logos.set(url, await loadPositionImage(url));
            if (request !== placementRequest.current) return;
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
                const logo = logos.get(positionWatermarkUrl(image))!;
                const nextScale = Math.min(scale ?? position.scaleX,getWatermarkMaximumScale(image.width,image.height,logo));
                const metrics = getAdaptiveWatermarkRenderMetrics(image.width,image.height,logo,nextScale);
                const maxX = Math.max(0,1-metrics.width/image.width), maxY = Math.max(0,1-metrics.height/image.height);
                const anchor = placement ? anchors[placement] : undefined;
                return {...position,scaleX:nextScale,scaleY:nextScale,
                    x:anchor ? anchor[0]*maxX : Math.min(position.x,maxX),
                    y:anchor ? anchor[1]*maxY : Math.min(position.y,maxY)};
            }));
        } catch(error) { setSmartError(error instanceof Error ? error.message : "位置设置失败"); }
    }, [currentImg,watermarkUrl,smartPending,editScope,images,watermarkColorUrls,imageWatermarkUrls,storedImageWatermarkUrl,watermarkModes,batchWatermarkMode]);

    const handleWatermarkScaleChange = (scale:number) => {
        if (watermarkMode !== 'image') {
            patchWatermarkConfig({textScale:Math.max(.1,Math.min(3,scale))});
            return;
        }
        void handlePlacementChange(undefined,scale);
    };

    // Changing the scope only decides which images later edits reach; it never changes a watermark itself.
    const handleEditScopeChange = (scope:'current'|'all') => setEditScope(scope);

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
                    loadPositionImage(positionWatermarkUrl(image)),
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
                        {watermarkMode !== "image" && <div className="px-2 pt-1"><CaptionReviewDialog pendingCount={captionPendingCount} items={captionReviewItems} onSave={saveCaptionReview} onClear={clearCaptionReview}/></div>}
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
                            transparentWatermarkEnabled={currentTransparentWatermarkEnabled}
                            setTransparentWatermarkEnabled={handleTransparentWatermarkEnabledChange}
                            transparentWatermarkUrl={currentTransparent.url}
                            transparentWatermarkBaseUrl={transparentWatermarkUrl}
                            transparentWatermarkOpacity={currentTransparentWatermarkOpacity}
                            transparentWatermarkScale={currentTransparentWatermarkScale}
                            transparentWatermarkPosition={currentTransparentWatermarkPosition}
                            onTransparentWatermarkTransform={handleTransparentWatermarkTransform}
                            setTransparentWatermarkOpacity={setCurrentTransparentWatermarkOpacity}
                            setTransparentWatermarkScale={setCurrentTransparentWatermarkScale}
                            transparentWatermarkColor={currentTransparent.color}
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
                            onAutoLogoColor={() => handleLogoColorChange("transparent")}
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
                            onUpload={async (files) => {
                                await handleImagesUpload(files);
                            }}
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
                                watermarkMode === 'image' ? watermarkColorUrls[currentImg.id] || "" : ""
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
                            onBatchEditingChange={batch => handleEditScopeChange(batch ? "all" : "current")}
                            watermarkBlur={watermarkBlur}
                            watermarkOpacity={watermarkOpacity}
                            onWatermarkOpacityChange={setWatermarkOpacity}
                            transparentWatermarkEnabled={currentTransparentWatermarkEnabled}
                            transparentWatermarkUrl={currentTransparent.url}
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
                    onAutoLogoColor={() => handleLogoColorChange("transparent")}
                    fontNotice={fontNotice}
                    smartPending={smartPending}
                    smartError={smartError}
                    onResetSmart={() => {
                        if (currentImg) {
                            const targets = editScope === "all" ? images : [currentImg];
                            const currentId = currentImg.id, filename = currentImg.file.name;
                            targets.forEach(image => manualPositions.current.delete(image.id));
                            setManualConfigs(prev => {
                                const next = {...prev};
                                targets.forEach(image => {
                                    const kept: Partial<MixedWatermarkConfig> = prev[image.id]?.icon ? {icon:prev[image.id].icon} : {};
                                    // Text is only ever reset on the image being edited.
                                    if (image.id !== currentId) for (const key of TEXT_CONTENT_KEYS) {
                                        if (prev[image.id] && key in prev[image.id]) Object.assign(kept, {[key]: prev[image.id][key]});
                                    }
                                    next[image.id] = kept;
                                });
                                return next;
                            });
                            setCaptionCorrections(previous => {
                                const next = clearCaptionCorrection(previous, filename);
                                saveCaptionCorrections(next);
                                return next;
                            });
                        }
                    }}
                    watermarkMode={watermarkMode}
                    setWatermarkMode={handleWatermarkModeChange}
                    storedImageWatermarkUrl={currentImageMaterial}
                    mixedWatermarkConfig={mixedWatermarkConfig}
                    onConfigPatch={patchWatermarkConfig}
                    onWatermarkUpload={handleWatermarkUpload}
                    watermarkBlur={watermarkBlur}
                    setWatermarkBlur={setWatermarkBlur}
                    quality={quality}
                    setQuality={setQuality}
                    watermarkOpacity={watermarkOpacity}
                    setWatermarkOpacity={setWatermarkOpacity}
                    transparentWatermarkEnabled={currentTransparentWatermarkEnabled}
                    setTransparentWatermarkEnabled={handleTransparentWatermarkEnabledChange}
                    transparentWatermarkOpacity={currentTransparentWatermarkOpacity}
                    setTransparentWatermarkOpacity={setCurrentTransparentWatermarkOpacity}
                    transparentWatermarkScale={currentTransparentWatermarkScale}
                    setTransparentWatermarkScale={setCurrentTransparentWatermarkScale}
                    transparentWatermarkColor={currentTransparent.color}
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
