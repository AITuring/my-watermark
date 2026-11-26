import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
    Check,
    ChevronLeft,
    ChevronRight,
    Download,
    FileImage,
    Files,
    ImagePlus,
    Images,
    Loader2,
    Palette,
    Package,
    Plus,
    Sparkles,
    Star,
    Trash2,
    UploadCloud,
    WandSparkles,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { downloadExportFiles } from "@/utils/image-export";
import { applyColorMatch, deriveColorMatch, type ColorMatchAdjustment } from "./color-match";
import "./color-match.css";

const ACCEPTED_TYPES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
} as const;
const PREVIEW_MAX_EDGE = 1280;
const EXPORT_QUALITY = 0.93;

type MatchItemStatus = "queued" | "processing" | "ready" | "error";
type ExportMode = "single" | "files" | "zip" | null;

type MatchItem = {
    id: string;
    file: File;
    name: string;
    previewUrl: string;
    afterUrl: string | null;
    adjustment: ColorMatchAdjustment | null;
    status: MatchItemStatus;
    error: string | null;
};

const makeId = () => String(Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9));
const fileKey = (file: File) => file.name + ":" + file.size + ":" + file.lastModified;
const revoke = (url: string | null | undefined, keep?: string | null) => {
    if (url && url !== keep) URL.revokeObjectURL(url);
};
const releaseItemUrls = (item: MatchItem) => {
    revoke(item.afterUrl, item.previewUrl);
    revoke(item.previewUrl);
};
const getExtension = (file: File) => {
    const match = file.name.match(/\.([^.]+)$/);
    return match?.[1]?.toLowerCase() ||
        (file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg");
};
const getOutputType = (file: File): "image/jpeg" | "image/png" | "image/webp" => {
    if (file.type === "image/png") return "image/png";
    if (file.type === "image/webp") return "image/webp";
    return "image/jpeg";
};
const outputName = (file: File) => file.name.replace(/\.[^.]+$/, "") + "-统一色调." + getExtension(file);

const loadBitmap = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
    if (typeof createImageBitmap === "function") {
        try {
            return await createImageBitmap(file, { imageOrientation: "from-image" });
        } catch {
            // Some Safari versions reject imageOrientation for Blob inputs.
        }
    }
    const url = URL.createObjectURL(file);
    try {
        return await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = () => reject(new Error("图片读取失败"));
            element.src = url;
        });
    } finally {
        URL.revokeObjectURL(url);
    }
};

const drawFileToCanvas = async (file: File, maxEdge?: number) => {
    const source = await loadBitmap(file);
    const sourceWidth = "naturalWidth" in source ? source.naturalWidth : source.width;
    const sourceHeight = "naturalHeight" in source ? source.naturalHeight : source.height;
    const scale = maxEdge ? Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight)) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("无法创建图片处理画布");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    if ("close" in source && typeof source.close === "function") source.close();
    return canvas;
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
    new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("图片导出失败"))), type, quality);
    });

const canvasToUrl = async (canvas: HTMLCanvasElement, type: string) => {
    const blob = await canvasToBlob(canvas, type, type === "image/png" ? undefined : EXPORT_QUALITY);
    return URL.createObjectURL(blob);
};

const createPreviewItem = async (file: File): Promise<MatchItem> => {
    const canvas = await drawFileToCanvas(file, PREVIEW_MAX_EDGE);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("无法读取图片像素");
    return {
        id: makeId(),
        file,
        name: file.name,
        previewUrl: await canvasToUrl(canvas, getOutputType(file)),
        afterUrl: null,
        adjustment: null,
        status: "queued",
        error: null,
    };
};

const getImageDataForFile = async (file: File) => {
    const canvas = await drawFileToCanvas(file, PREVIEW_MAX_EDGE);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("无法读取基准图像素");
    return context.getImageData(0, 0, canvas.width, canvas.height);
};

const processPreview = async (item: MatchItem, referenceData: ImageData, strength: number) => {
    const canvas = await drawFileToCanvas(item.file, PREVIEW_MAX_EDGE);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("无法读取目标图像素");
    const targetData = context.getImageData(0, 0, canvas.width, canvas.height);
    const adjustment = deriveColorMatch(referenceData, targetData);
    context.putImageData(applyColorMatch(targetData, adjustment, { strength }), 0, 0);
    return { afterUrl: await canvasToUrl(canvas, getOutputType(item.file)), adjustment };
};

const processFullResolution = async (item: MatchItem, referenceData: ImageData, strength: number) => {
    const canvas = await drawFileToCanvas(item.file);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("无法创建原图处理画布");
    const targetData = context.getImageData(0, 0, canvas.width, canvas.height);
    const adjustment = deriveColorMatch(referenceData, targetData);
    context.putImageData(applyColorMatch(targetData, adjustment, { strength }), 0, 0);
    const type = getOutputType(item.file);
    const blob = await canvasToBlob(canvas, type, type === "image/png" ? undefined : EXPORT_QUALITY);
    return new File([blob], outputName(item.file), { type });
};

const cloneReferenceFile = (item: MatchItem) => new File([item.file], outputName(item.file), {
    type: getOutputType(item.file),
    lastModified: item.file.lastModified,
});

const formatAdjustment = (adjustment: ColorMatchAdjustment | null) => {
    if (!adjustment) return "等待基准图";
    const temperature = adjustment.temperature >= 0 ? "+" + adjustment.temperature.toFixed(1) : adjustment.temperature.toFixed(1);
    const tint = adjustment.tint >= 0 ? "+" + adjustment.tint.toFixed(1) : adjustment.tint.toFixed(1);
    return "色温 " + temperature + " · 色调 " + tint;
};

const ColorMatchPage = () => {
    const [items, setItems] = useState<MatchItem[]>([]);
    const [referenceId, setReferenceId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [strength, setStrength] = useState(100);
    const [isExporting, setIsExporting] = useState(false);
    const [exportMode, setExportMode] = useState<ExportMode>(null);
    const [exportProgress, setExportProgress] = useState(0);

    const itemsRef = useRef<MatchItem[]>([]);
    const referenceIdRef = useRef<string | null>(null);
    const referenceDataRef = useRef<ImageData | null>(null);
    const strengthRef = useRef(strength);
    const runIdRef = useRef(0);

    useEffect(() => { itemsRef.current = items; }, [items]);
    useEffect(() => { referenceIdRef.current = referenceId; }, [referenceId]);
    useEffect(() => { strengthRef.current = strength; }, [strength]);
    useEffect(() => () => {
        itemsRef.current.forEach(releaseItemUrls);
    }, []);

    const updateItems = useCallback((updater: (current: MatchItem[]) => MatchItem[]) => {
        setItems((current) => {
            const next = updater(current);
            itemsRef.current = next;
            return next;
        });
    }, []);

    const processItems = useCallback(async (targets: MatchItem[], referenceData: ImageData, nextStrength: number) => {
        const runId = ++runIdRef.current;
        const currentReferenceId = referenceIdRef.current;
        for (const item of targets) {
            if (runId !== runIdRef.current) return;
            if (item.id === currentReferenceId) {
                updateItems((current) => current.map((entry) => entry.id === item.id
                    ? { ...entry, afterUrl: entry.previewUrl, adjustment: null, status: "ready", error: null }
                    : entry));
                continue;
            }
            updateItems((current) => current.map((entry) => entry.id === item.id
                ? { ...entry, status: "processing", error: null }
                : entry));
            try {
                const result = await processPreview(item, referenceData, nextStrength / 100);
                if (runId !== runIdRef.current) return;
                updateItems((current) => current.map((entry) => {
                    if (entry.id !== item.id) return entry;
                    revoke(entry.afterUrl, entry.previewUrl);
                    return { ...entry, afterUrl: result.afterUrl, adjustment: result.adjustment, status: "ready", error: null };
                }));
            } catch (error) {
                if (runId !== runIdRef.current) return;
                const message = error instanceof Error ? error.message : "处理失败";
                updateItems((current) => current.map((entry) => entry.id === item.id
                    ? { ...entry, status: "error", error: message }
                    : entry));
            }
        }
    }, [updateItems]);

    const processAll = useCallback(async (referenceData: ImageData, reference: string | null = referenceIdRef.current) => {
        if (!reference || referenceIdRef.current !== reference) return;
        await processItems(itemsRef.current, referenceData, strengthRef.current);
    }, [processItems]);

    const handleFiles = useCallback(async (files: File[]) => {
        const existing = new Set(itemsRef.current.map((item) => fileKey(item.file)));
        const freshFiles = files.filter((file) => !existing.has(fileKey(file)));
        if (!freshFiles.length) {
            toast.message("这些图片已经在当前图册中");
            return;
        }
        const results = await Promise.allSettled(freshFiles.map(createPreviewItem));
        const freshItems = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
        if (results.length !== freshItems.length) toast.error((results.length - freshItems.length) + " 张图片读取失败，请检查格式");
        if (!freshItems.length) return;
        updateItems((current) => current.concat(freshItems));
        setSelectedId((current) => current || freshItems[0].id);
        if (referenceDataRef.current && referenceIdRef.current) {
            void processAll(referenceDataRef.current, referenceIdRef.current);
        }
    }, [processAll, updateItems]);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        accept: ACCEPTED_TYPES,
        multiple: true,
        noClick: items.length > 0,
        onDrop: (files) => { void handleFiles(files); },
    });

    const chooseReference = useCallback(async (id: string) => {
        const target = itemsRef.current.find((item) => item.id === id);
        if (!target) return;
        const selectionRunId = ++runIdRef.current;
        try {
            const referenceData = await getImageDataForFile(target.file);
            if (selectionRunId !== runIdRef.current) return;
            referenceDataRef.current = referenceData;
            referenceIdRef.current = id;
            setReferenceId(id);
            updateItems((current) => current.map((entry) => {
                if (entry.id === id) {
                    revoke(entry.afterUrl, entry.previewUrl);
                    return { ...entry, afterUrl: entry.previewUrl, adjustment: null, status: "ready", error: null };
                }
                revoke(entry.afterUrl, entry.previewUrl);
                return { ...entry, afterUrl: null, adjustment: null, status: "queued", error: null };
            }));
            await processAll(referenceData, id);
            toast.success("已将「" + target.name + "」设为基准图");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "基准图读取失败");
        }
    }, [processAll, updateItems]);

    useEffect(() => {
        if (!referenceDataRef.current || !referenceIdRef.current || !itemsRef.current.length) return;
        const timer = window.setTimeout(() => {
            void processAll(referenceDataRef.current!, referenceIdRef.current);
        }, 180);
        return () => window.clearTimeout(timer);
    }, [strength, processAll]);

    const removeItem = useCallback((id: string) => {
        const target = itemsRef.current.find((item) => item.id === id);
        if (target) releaseItemUrls(target);
        if (id === referenceIdRef.current) {
            runIdRef.current += 1;
            referenceDataRef.current = null;
            referenceIdRef.current = null;
            setReferenceId(null);
        }
        updateItems((current) => current.filter((item) => item.id !== id));
        setSelectedId((current) => current === id ? null : current);
    }, [updateItems]);

    const clearAll = useCallback(() => {
        runIdRef.current += 1;
        itemsRef.current.forEach(releaseItemUrls);
        updateItems(() => []);
        referenceIdRef.current = null;
        referenceDataRef.current = null;
        setReferenceId(null);
        setSelectedId(null);
    }, [updateItems]);

    const clearReference = useCallback(() => {
        runIdRef.current += 1;
        referenceIdRef.current = null;
        referenceDataRef.current = null;
        setReferenceId(null);
        updateItems((current) => current.map((entry) => {
            revoke(entry.afterUrl, entry.previewUrl);
            return { ...entry, afterUrl: null, adjustment: null, status: "queued", error: null };
        }));
    }, [updateItems]);

    const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0] || null, [items, selectedId]);
    const reference = useMemo(() => items.find((item) => item.id === referenceId) || null, [items, referenceId]);
    const readyCount = items.filter((item) => item.status === "ready").length;
    const processingCount = items.filter((item) => item.status === "processing" || item.status === "queued").length;

    const renderExportFiles = useCallback(async (targets: MatchItem[]) => {
        if (!referenceDataRef.current || !referenceIdRef.current) throw new Error("请先选择一张基准图");
        const files: File[] = [];
        for (const item of targets) {
            files.push(item.id === referenceIdRef.current
                ? cloneReferenceFile(item)
                : await processFullResolution(item, referenceDataRef.current, strengthRef.current / 100));
        }
        return files;
    }, []);

    const runExport = useCallback(async (mode: Exclude<ExportMode, null>, targets: MatchItem[]) => {
        if (!targets.length || !referenceDataRef.current) return;
        setIsExporting(true);
        setExportMode(mode);
        setExportProgress(0);
        try {
            const files = await renderExportFiles(targets);
            await downloadExportFiles(files.map(file => ({ data: file, name: file.name })), {
                mode: mode === "single" ? "current" : mode === "zip" ? "zip" : "files",
                archiveName: `color-match-${files.length}.zip`, onProgress: setExportProgress,
            });
            toast.success(mode === "single" ? "已导出当前图片" : "已导出 " + files.length + " 张图片");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "导出失败，请重试");
        } finally {
            setIsExporting(false);
            setExportMode(null);
        }
    }, [renderExportFiles]);

    const shiftSelected = useCallback((direction: -1 | 1) => {
        if (!selected) return;
        const index = itemsRef.current.findIndex((item) => item.id === selected.id);
        const next = (index + direction + itemsRef.current.length) % itemsRef.current.length;
        setSelectedId(itemsRef.current[next]?.id || selected.id);
    }, [selected]);

    return (
        <main className="color-match-page">
            <div className="color-match-grain" aria-hidden="true" />
            <header className="color-match-header">
                <div className="color-match-kicker"><span>STUDIO TOOL / 01</span><span className="kicker-rule" /><span>本地处理</span></div>
                <div className="color-match-heading-row">
                    <div>
                        <h1>让一组器物，回到同一盏灯下</h1>
                        <p>先放入整组照片，再从图册里选一张基准图。其余图片会按这张图统一色温、色调与整体观感。</p>
                    </div>
                    <div className="color-match-header-mark" aria-hidden="true"><Palette size={26} strokeWidth={1.4} /><span>COLOR<br />MATCH</span></div>
                </div>
                <div className="color-match-format-note"><Sparkles size={14} /> JPG / PNG / WebP · 处理过程仅在当前设备完成</div>
            </header>

            <section className="upload-strip">
                <div className="section-label"><span>01</span><span>先上传图册</span><span className="section-line" /><span className="section-count">{items.length ? items.length + " 张" : "等待选择"}</span></div>
                {!items.length ? (
                    <div {...getRootProps({ className: "batch-dropzone" + (isDragActive ? " is-active" : "") })}>
                        <input {...getInputProps()} />
                        <div className="drop-orbit"><Images size={28} strokeWidth={1.2} /></div>
                        <strong>把这一组照片一次放进来</strong>
                        <span>支持多选 JPG、PNG、WebP，也可以直接拖拽整个图册</span>
                        <button type="button" className="text-action"><UploadCloud size={15} />选择图片</button>
                    </div>
                ) : (
                    <div className="uploaded-toolbar">
                        <div><strong>{reference ? "基准图：" + reference.name : "还没有设定基准图"}</strong><span>{reference ? "图册中的其余图片会按它统一" : "在下方缩略图上点击「设为基准图」"}</span></div>
                        <div className="toolbar-actions"><button type="button" className="quiet-action" onClick={open}><Plus size={15} />继续添加</button><button type="button" className="quiet-action danger" onClick={clearAll}><Trash2 size={14} />清空图册</button></div>
                    </div>
                )}
            </section>

            <section className="color-match-stage">
                <div className="reference-panel">
                    <div className="section-label"><span>02</span><span>选择基准图</span><span className="section-line" /></div>
                    <div className={"reference-guidance" + (reference ? " is-ready" : "")}>
                        {reference ? <><Star size={16} /><span><strong>{reference.name}</strong> 已作为色彩锚点</span></> : <><ImagePlus size={16} /><span>先在下方图册中选择一张你认可的成片</span></>}
                    </div>
                    {reference ? (
                        <div className="reference-card">
                            <img src={reference.previewUrl} alt={"基准图：" + reference.name} />
                            <div className="reference-card-footer"><div><strong>当前基准</strong><span>{reference.file.type || "image/jpeg"} · {Math.round(reference.file.size / 1024)} KB</span></div><button type="button" className="icon-button" onClick={clearReference} aria-label="取消基准图"><X size={16} /></button></div>
                        </div>
                    ) : (
                        <div className="reference-empty"><Star size={28} strokeWidth={1.1} /><strong>基准图会保持原样</strong><span>它只负责告诉其他图片应该靠近怎样的颜色。</span></div>
                    )}
                </div>

                <div className="match-inspector">
                    <div className="section-label"><span>03</span><span>统一方式</span><span className="section-line" /></div>
                    <div className="inspector-copy">
                        <div className="inspector-title"><WandSparkles size={17} /><span>自动匹配色彩统计</span><em>LAB</em></div>
                        <p>{reference ? "已从基准图提取明度、色温与色调分布，正在把其他图片拉回同一组观感。" : "选定基准图后，这里会自动分析整组图片，不需要逐张手动调色。"}</p>
                    </div>
                    <label className="strength-control">
                        <span><span>匹配强度</span><b>{strength}%</b></span>
                        <input type="range" min="0" max="100" step="1" value={strength} onChange={(event) => setStrength(Number(event.target.value))} disabled={!reference || !items.length} />
                        <span className="range-hint"><small>保留原片</small><small>完全匹配</small></span>
                    </label>
                    <div className="inspector-stats"><div><span>基准图</span><strong>{reference ? "已设定" : "等待选择"}</strong></div><div><span>已就绪</span><strong>{items.length ? readyCount + " / " + items.length : "—"}</strong></div></div>
                    <div className="privacy-note"><Check size={14} /><span>原图不会上传服务器，处理过程仅在浏览器中完成。</span></div>
                </div>
            </section>

            <section className="targets-section">
                <div className="section-label"><span>04</span><span>检查前后效果</span><span className="section-line" /><span className="section-count">{items.length ? items.length + " 张" : "未选择"}</span></div>
                {!items.length ? (
                    <div className="targets-empty"><Files size={22} /><span>上传图册后，这里会显示前后对照。</span></div>
                ) : (
                    <>
                        <div className="preview-board">
                            <div className="preview-board-heading"><div><span className="eyebrow">SELECTED FRAME</span><h2>{selected?.name || "选择一张图片"}</h2></div><div className="preview-board-actions"><button type="button" className="icon-button" onClick={() => shiftSelected(-1)} disabled={items.length < 2} aria-label="上一张"><ChevronLeft size={18} /></button><span>{Math.max(items.findIndex((item) => item.id === selected?.id) + 1, 1)} / {items.length}</span><button type="button" className="icon-button" onClick={() => shiftSelected(1)} disabled={items.length < 2} aria-label="下一张"><ChevronRight size={18} /></button></div></div>
                            <div className="preview-pair"><div className="preview-frame"><span>原图</span>{selected?.previewUrl ? <img src={selected.previewUrl} alt="原图预览" /> : <div className="preview-loading"><Loader2 size={20} className="spin" /></div>}</div><div className="preview-frame is-after"><span>{selected?.id === referenceId ? "基准图" : "统一后"}</span>{selected?.afterUrl ? <img src={selected.afterUrl} alt="统一后预览" /> : <div className="preview-loading"><Loader2 size={20} className="spin" /></div>}<div className="preview-accent" /></div></div>
                            <div className="preview-caption"><span>{selected?.id === referenceId ? <><Star size={14} />基准图保持原样</> : selected?.status === "processing" || selected?.status === "queued" ? <><Loader2 size={14} className="spin" />正在分析色彩</> : selected?.status === "error" ? selected.error : <><WandSparkles size={14} />{formatAdjustment(selected?.adjustment || null)}</>}</span><span>{selected?.file ? (selected.file.size / 1024 / 1024).toFixed(1) + " MB" : ""}</span></div>
                        </div>
                        <div className="target-toolbar"><div><strong>{processingCount ? "正在处理 " + processingCount + " 张" : reference ? "已准备好 " + readyCount + " 张" : "等待选择基准图"}</strong><span>点击缩略图查看对照，点击「设为基准图」重新匹配整组。</span></div></div>
                        <div className="thumb-grid">
                            {items.map((item, index) => (
                                <article key={item.id} className={"thumb-card" + (item.id === selected?.id ? " is-selected" : "") + (item.id === referenceId ? " is-reference" : "")} onClick={() => setSelectedId(item.id)}>
                                    <div className="thumb-image-wrap">{item.afterUrl || item.previewUrl ? <img src={item.afterUrl || item.previewUrl} alt={item.name} /> : <div className="preview-loading"><Loader2 size={18} className="spin" /></div>}<span className={"thumb-index" + (item.status === "ready" ? " is-ready" : "")}>{item.status === "ready" ? <Check size={12} /> : String(index + 1).padStart(2, "0")}</span>{item.id === referenceId && <span className="reference-badge"><Star size={11} />基准</span>}<button type="button" className="thumb-remove" onClick={(event) => { event.stopPropagation(); removeItem(item.id); }} aria-label={"移除 " + item.name}><Trash2 size={13} /></button></div>
                                    <div className="thumb-meta"><strong title={item.name}>{item.name}</strong><span>{item.id === referenceId ? "基准图 · 保持原样" : item.status === "ready" ? formatAdjustment(item.adjustment) : item.status === "error" ? "处理失败" : reference ? "分析中" : "等待基准图"}</span><button type="button" className={"reference-action" + (item.id === referenceId ? " is-active" : "")} onClick={(event) => { event.stopPropagation(); void chooseReference(item.id); }}>{item.id === referenceId ? <><Star size={12} />当前基准图</> : "设为基准图"}</button></div>
                                </article>
                            ))}
                            <button type="button" className="thumb-add" onClick={open}><Plus size={21} /><span>继续添加</span></button>
                        </div>
                    </>
                )}
            </section>

            <footer className="color-match-footer">
                <div className="footer-note"><FileImage size={16} /><span>单张、分别下载和 ZIP 打包都使用统一后的原尺寸文件。</span></div>
                <div className="export-actions">
                    <button type="button" className="export-secondary" onClick={() => selected && void runExport("single", [selected])} disabled={!reference || !selected || selected.status !== "ready" || isExporting}><Download size={15} />导出当前</button>
                    <button type="button" className="export-secondary" onClick={() => void runExport("files", items)} disabled={!reference || !items.length || readyCount !== items.length || isExporting}><Files size={15} />分别下载全部</button>
                    <button type="button" className="export-button" onClick={() => void runExport("zip", items)} disabled={!reference || !items.length || readyCount !== items.length || isExporting}>{isExporting ? <><Loader2 size={17} className="spin" />{exportMode === "zip" ? "打包中 " + Math.round(exportProgress) + "%" : "导出中…"}</> : <><Package size={17} />ZIP 打包导出 <span>{items.length} 张</span></>}</button>
                </div>
            </footer>
        </main>
    );
};

export default ColorMatchPage;
