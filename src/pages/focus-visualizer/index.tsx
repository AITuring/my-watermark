import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { type RawDecodeMode } from "@/pages/raw-editor/editor/engine/RawDecoder";
import {
    analyzeFocusFile,
    getFocusMarkerColor,
    isSupportedFocusFile,
    revokeFocusVisualizationUrls,
    type FocusVisualizationResult,
} from "./helpers";

interface FocusVisualizationItem {
    id: string;
    file: File;
    status: "processing" | "ready" | "error";
    errorMessage?: string;
    result?: FocusVisualizationResult;
}

function formatPercent(value: number) {
    return `${(value * 100).toFixed(1)}%`;
}

function formatPixel(value: number) {
    return `${Math.round(value)} px`;
}

function revokeItemUrls(item: FocusVisualizationItem | null | undefined) {
    revokeFocusVisualizationUrls(item?.result);
}

const FocusVisualizerPage = () => {
    const [items, setItems] = useState<FocusVisualizationItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [rawDecodeMode, setRawDecodeMode] = useState<RawDecodeMode>("fast");
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [progressMotionMs, setProgressMotionMs] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const itemsRef = useRef<FocusVisualizationItem[]>([]);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    useEffect(() => {
        return () => {
            itemsRef.current.forEach(revokeItemUrls);
        };
    }, []);

    const readyItems = useMemo(
        () => items.filter((item) => item.status === "ready" && item.result),
        [items]
    );
    const errorCount = items.filter((item) => item.status === "error").length;
    const processingCount = items.filter((item) => item.status === "processing").length;
    const processedCount = readyItems.length + errorCount;
    const isProcessing = processingCount > 0;
    const activeItemFraction =
        isProcessing && items.length > 0
            ? Math.min(0.82, 0.08 + Math.log1p(Math.max(progressMotionMs, 1) / 900) * 0.17)
            : 0;
    const animatedProgressPercent =
        items.length > 0
            ? Math.min(
                  isProcessing ? 99 : 100,
                  ((processedCount + activeItemFraction) / items.length) * 100
              )
            : 0;
    const overviewBase = readyItems[0]?.result ?? null;
    const isRawModeLocked = items.length > 0;

    useEffect(() => {
        if (!isProcessing) {
            setProgressMotionMs(0);
            return;
        }
        const start = Date.now();
        const timer = window.setInterval(() => {
            setProgressMotionMs(Date.now() - start);
        }, 140);
        return () => {
            window.clearInterval(timer);
        };
    }, [isProcessing, items.length]);

    const updateItem = (
        id: string,
        updater: (current: FocusVisualizationItem) => FocusVisualizationItem
    ) => {
        setItems((current) =>
            current.map((item) => {
                if (item.id !== id) {
                    return item;
                }
                const nextItem = updater(item);
                if (item !== nextItem && item.result && item.result !== nextItem.result) {
                    revokeFocusVisualizationUrls(item.result);
                }
                return nextItem;
            })
        );
    };

    const handleAppendFiles = async (incomingFiles: File[]) => {
        const files = incomingFiles.filter(isSupportedFocusFile);
        if (files.length === 0) {
            return;
        }

        const pendingItems: FocusVisualizationItem[] = files.map((file, index) => ({
            id: `${Date.now()}-${index}-${file.name}`,
            file,
            status: "processing",
        }));

        setItems((current) => [...current, ...pendingItems]);
        if (pendingItems.length > 0) {
            setExpandedItemId(null);
        }

        for (const item of pendingItems) {
            try {
                const result = await analyzeFocusFile(item.file, {
                    rawDecodeMode,
                });
                updateItem(item.id, (current) => ({
                    ...current,
                    status: "ready",
                    errorMessage: "",
                    result,
                }));
            } catch (error) {
                console.error(error);
                updateItem(item.id, (current) => ({
                    ...current,
                    status: "error",
                    errorMessage:
                        error instanceof Error ? error.message : "文件分析失败",
                }));
            }

            await new Promise<void>((resolve) => {
                window.setTimeout(resolve, 0);
            });
        }
    };

    const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList) {
            return;
        }
        await handleAppendFiles(Array.from(fileList));
        event.target.value = "";
    };

    const handleClear = () => {
        setItems((current) => {
            current.forEach(revokeItemUrls);
            return [];
        });
        setExpandedItemId(null);
    };

    const handleRemove = (id: string) => {
        setItems((current) => {
            const target = current.find((item) => item.id === id);
            revokeItemUrls(target);
            return current.filter((item) => item.id !== id);
        });
        setExpandedItemId((current) => (current === id ? null : current));
    };

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        await handleAppendFiles(Array.from(event.dataTransfer.files ?? []));
    };

    return (
        <div className="min-h-screen w-full bg-stone-100 dark:bg-slate-950">
            <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-4 px-3 py-4 md:px-4 xl:px-4">
                <div className="flex flex-col gap-2.5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30">
                                <Icon icon="mdi:image-search-outline" className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                                    焦点可视化
                                </h1>
                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                    查看同视角素材的落焦位置分布。
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <input
                                ref={inputRef}
                                type="file"
                                className="hidden"
                                multiple
                                accept="image/*,.cr2,.cr3,.nef,.nrw,.arw,.sr2,.srf,.dng,.raf,.orf,.rw2,.pef,.iiq,.3fr,.srw"
                                onChange={handleInputChange}
                            />
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-full bg-fuchsia-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-fuchsia-500"
                                onClick={() => inputRef.current?.click()}
                            >
                                <Icon icon="mdi:upload" className="h-4 w-4" />
                                {items.length > 0 ? "添加上传" : "选择文件"}
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                onClick={handleClear}
                                disabled={items.length === 0}
                            >
                                <Icon icon="mdi:delete-outline" className="h-4 w-4" />
                                清空结果
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">支持 JPG / PNG / TIFF / 常见 RAW</Badge>
                        <Badge variant="secondary">自动生成焦点热力图</Badge>
                        <Badge variant="secondary">总览比较所有焦点中心</Badge>
                    </div>
                    <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-900/70 dark:ring-slate-800">
                        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                    RAW 模式
                                </p>
                                <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/80 p-1 dark:border-slate-700 dark:bg-slate-950/60">
                                    <div
                                        className={[
                                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                                            rawDecodeMode === "fast"
                                                ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/25"
                                                : "text-slate-500 dark:text-slate-400",
                                        ].join(" ")}
                                    >
                                        <Icon icon="mdi:rocket-launch-outline" className="h-3.5 w-3.5" />
                                        快速预览
                                    </div>
                                    <Switch
                                        checked={rawDecodeMode === "high"}
                                        disabled={isRawModeLocked}
                                        onCheckedChange={(checked) =>
                                            setRawDecodeMode(checked ? "high" : "fast")
                                        }
                                        aria-label="切换 RAW 模式"
                                        className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-emerald-500"
                                    />
                                    <div
                                        className={[
                                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                                            rawDecodeMode === "high"
                                                ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/25"
                                                : "text-slate-500 dark:text-slate-400",
                                        ].join(" ")}
                                    >
                                        <Icon icon="mdi:image-filter-hdr" className="h-3.5 w-3.5" />
                                        高质量
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {isRawModeLocked ? "已有文件，清空后可切换" : "请在上传前设置"}
                                </p>
                            </div>
                            {items.length > 0 ? (
                                <div className="min-w-0 xl:w-[360px]">
                                    <div className="mb-1 flex items-center justify-between gap-3">
                                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                            {processedCount} / {items.length}
                                            {processingCount > 0
                                                ? `，第 ${processedCount + 1} 张处理中`
                                                : ""}
                                        </p>
                                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                            {animatedProgressPercent.toFixed(0)}%
                                        </p>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                        <div
                                            className={[
                                                "relative h-full rounded-full transition-all duration-300",
                                                isProcessing
                                                    ? "bg-gradient-to-r from-fuchsia-500 via-fuchsia-400 to-violet-500"
                                                    : "bg-fuchsia-600",
                                            ].join(" ")}
                                            style={{ width: `${animatedProgressPercent}%` }}
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                {items.length === 0 ? (
                    <div
                        className={[
                            "rounded-2xl border border-dashed px-5 py-8 transition",
                            isDragging
                                ? "border-fuchsia-500 bg-fuchsia-500/10"
                                : "border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70",
                        ].join(" ")}
                        onDragEnter={(event) => {
                            event.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={(event) => {
                            event.preventDefault();
                            if (event.currentTarget === event.target) {
                                setIsDragging(false);
                            }
                        }}
                        onDrop={handleDrop}
                    >
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-fuchsia-600/10 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300">
                                <Icon icon="mdi:crosshairs-gps" className="h-8 w-8" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                    拖入文件开始分析
                                </h2>
                                <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                                    建议上传同机位、曝光参数相近、仅焦点不同的一组素材。页面会按局部锐度生成热区，颜色越暖表示越可能是当前图片的对焦区域。
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <section className="grid gap-3 xl:h-[calc(100vh-158px)] xl:grid-cols-[252px_minmax(0,1fr)] 2xl:grid-cols-[244px_minmax(0,1fr)]">
                            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                            单张分析
                                        </h2>
                                        <p className="text-xs text-slate-600 dark:text-slate-300">
                                            左侧滚动查看单张结果。
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
                                    {items.map((item, index) => {
                                if (item.status === "processing") {
                                    return (
                                        <div
                                            key={item.id}
                                            className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
                                        >
                                            <div className="aspect-[16/10] animate-pulse bg-slate-200 dark:bg-slate-800" />
                                            <div className="space-y-2 p-2.5">
                                                <div>
                                                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        {item.file.name}
                                                    </p>
                                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                        正在解码并计算焦点热区...
                                                        {item.file.name.match(/\.(cr2|cr3|nef|nrw|arw|sr2|srf|dng|raf|orf|rw2|pef|iiq|3fr|srw)$/i)
                                                            ? ` 当前 RAW 模式：${rawDecodeMode === "fast" ? "快速预览" : "高质量"}`
                                                            : ""}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                if (item.status === "error" || !item.result) {
                                    return (
                                        <div
                                            key={item.id}
                                            className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
                                        >
                                            <div className="flex aspect-[16/10] items-center justify-center bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-300">
                                                <Icon icon="mdi:alert-circle-outline" className="h-10 w-10" />
                                            </div>
                                            <div className="space-y-2 p-2.5">
                                                <div>
                                                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        {item.file.name}
                                                    </p>
                                                    <p className="mt-1 text-sm text-rose-500 dark:text-rose-300">
                                                        {item.errorMessage ?? "分析失败"}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                                    onClick={() => handleRemove(item.id)}
                                                >
                                                    <Icon icon="mdi:close" className="h-4 w-4" />
                                                    移除
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                const color = getFocusMarkerColor(index);
                                const result = item.result;
                                const isExpanded = expandedItemId === item.id;

                                return (
                                    <div
                                        key={item.id}
                                        className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
                                    >
                                        <div className="relative aspect-[16/10] bg-slate-950">
                                            <img
                                                src={result.previewUrl}
                                                alt={item.file.name}
                                                className="absolute inset-0 h-full w-full object-contain"
                                            />
                                            <img
                                                src={result.overlayUrl}
                                                alt={`${item.file.name} 焦点热力图`}
                                                className="absolute inset-0 h-full w-full object-contain"
                                            />
                                            <div
                                                className="absolute -translate-x-1/2 -translate-y-1/2"
                                                style={{
                                                    left: `${(result.focusPoint.x / result.width) * 100}%`,
                                                    top: `${(result.focusPoint.y / result.height) * 100}%`,
                                                }}
                                            >
                                                <div
                                                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-sm font-semibold text-white shadow-lg"
                                                    style={{ backgroundColor: color }}
                                                >
                                                    {index + 1}
                                                </div>
                                            </div>
                                            <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
                                                {result.fileKind === "raw"
                                                    ? result.rawDecodePreset === "fast-preview"
                                                        ? "RAW 快速预览"
                                                        : "RAW 高质量"
                                                    : "标准图片"}
                                            </div>
                                        </div>
                                        <div className="space-y-2.5 p-2.5">
                                            <div className="space-y-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                        {item.file.name}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        预览 {result.width} x {result.height}，原图 {result.originalWidth} x {result.originalHeight}
                                                    </p>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-slate-800/70">
                                                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        焦点位置
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                        X {formatPercent(result.focusPoint.x / result.width)}
                                                    </p>
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                        Y {formatPercent(result.focusPoint.y / result.height)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                                        onClick={() =>
                                                            setExpandedItemId((current) =>
                                                                current === item.id ? null : item.id
                                                            )
                                                        }
                                                    >
                                                        <Icon
                                                            icon={
                                                                isExpanded
                                                                    ? "mdi:chevron-up"
                                                                    : "mdi:chevron-down"
                                                            }
                                                            className="h-4 w-4"
                                                        />
                                                        {isExpanded ? "收起信息" : "展开信息"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                                        onClick={() => handleRemove(item.id)}
                                                        aria-label={`移除 ${item.file.name}`}
                                                    >
                                                        <Icon icon="mdi:delete-outline" className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            {isExpanded ? (
                                                <>
                                                    {result.fileKind === "raw" ? (
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            模式 {result.rawDecodeMode === "fast" ? "快速预览" : "高质量"}，实际预设 {result.rawDecodePreset === "fast-preview" ? "半尺寸解码" : "完整解码"}
                                                        </p>
                                                    ) : null}
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/70">
                                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        焦点中心
                                                    </p>
                                                    <p className="mt-1.5 text-xs font-medium text-slate-900 dark:text-slate-100">
                                                        X {formatPercent(result.focusPoint.x / result.width)}
                                                    </p>
                                                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                                                        Y {formatPercent(result.focusPoint.y / result.height)}
                                                    </p>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/70">
                                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        焦点面积
                                                    </p>
                                                    <p className="mt-1.5 text-xs font-medium text-slate-900 dark:text-slate-100">
                                                        {formatPercent(result.focusCoverage)}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                        热区覆盖越大，表示清晰区域越分散
                                                    </p>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/70">
                                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        局部锐度
                                                    </p>
                                                    <p className="mt-1.5 text-xs font-medium text-slate-900 dark:text-slate-100">
                                                        平均热点 {formatPercent(result.focusScore)}
                                                    </p>
                                                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                                                        峰值 {formatPercent(result.peakValue)}
                                                    </p>
                                                </div>
                                                <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/70">
                                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        最强焦点像素
                                                    </p>
                                                    <p className="mt-1.5 text-xs font-medium text-slate-900 dark:text-slate-100">
                                                        {formatPixel(result.peakPoint.x)}, {formatPixel(result.peakPoint.y)}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                        适合快速定位“最实”的落焦位置
                                                    </p>
                                                </div>
                                            </div>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                                </div>
                            </div>

                            <div className="min-h-0">
                                <section className="flex h-full min-h-0 flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                                    <div className="mb-3 flex flex-col gap-1">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                            焦点总览
                                        </h2>
                                        <p className="text-xs text-slate-600 dark:text-slate-300">
                                            右侧对比所有焦点中心。
                                        </p>
                                    </div>
                                    {overviewBase ? (
                                        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_210px] 2xl:grid-cols-[minmax(0,1fr)_228px]">
                                            <div className="flex min-h-[540px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-2 dark:border-slate-800">
                                                <div
                                                    className="relative mx-auto"
                                                    style={{
                                                        height: "100%",
                                                        width: "auto",
                                                        maxWidth: "100%",
                                                        aspectRatio: `${overviewBase.width} / ${overviewBase.height}`,
                                                    }}
                                                >
                                                    <img
                                                        src={overviewBase.previewUrl}
                                                        alt="焦点总览底图"
                                                        className="absolute inset-0 h-full w-full object-contain"
                                                    />
                                                    {readyItems.map((item, index) => {
                                                        const result = item.result!;
                                                        const color = getFocusMarkerColor(index);
                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className="absolute -translate-x-1/2 -translate-y-1/2"
                                                                style={{
                                                                    left: `${(result.focusPoint.x / result.width) * 100}%`,
                                                                    top: `${(result.focusPoint.y / result.height) * 100}%`,
                                                                }}
                                                            >
                                                                <div
                                                                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow-lg"
                                                                    style={{ backgroundColor: color }}
                                                                >
                                                                    {index + 1}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="space-y-2.5 overflow-y-auto pr-1">
                                                {readyItems.map((item, index) => {
                                                    const result = item.result!;
                                                    const color = getFocusMarkerColor(index);
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-800"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                                                                    style={{ backgroundColor: color }}
                                                                >
                                                                    {index + 1}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                                                        {item.file.name}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                        焦点中心 {formatPercent(result.focusPoint.x / result.width)} / {formatPercent(result.focusPoint.y / result.height)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex min-h-[360px] flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                            上传后会在这里显示焦点总览
                                        </div>
                                    )}
                                </section>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
};

export default FocusVisualizerPage;
