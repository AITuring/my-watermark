import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
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
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [rawDecodeMode, setRawDecodeMode] = useState<RawDecodeMode>("fast");
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
    const overviewBase = readyItems[0]?.result ?? null;

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
        setIsAnalyzing(true);

        try {
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
        } finally {
            setIsAnalyzing(false);
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
    };

    const handleRemove = (id: string) => {
        setItems((current) => {
            const target = current.find((item) => item.id === id);
            revokeItemUrls(target);
            return current.filter((item) => item.id !== id);
        });
    };

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        await handleAppendFiles(Array.from(event.dataTransfer.files ?? []));
    };

    return (
        <div className="min-h-screen w-full bg-stone-100 dark:bg-slate-950">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30">
                            <Icon icon="mdi:image-search-outline" className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                                焦点可视化
                            </h1>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                上传同视角、不同对焦点的 RAW 或图片，查看每张图局部最清晰区域分别落在哪。
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">支持 JPG / PNG / TIFF / 常见 RAW</Badge>
                        <Badge variant="secondary">自动生成焦点热力图</Badge>
                        <Badge variant="secondary">总览比较所有焦点中心</Badge>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200 dark:bg-slate-900/70 dark:ring-slate-800">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    RAW 分析模式
                                </h2>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    快速预览会直接强制走半尺寸 RAW 解码，明显更快；高质量会先尝试完整解码，失败时再自动降级。
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    className={[
                                        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                                        rawDecodeMode === "fast"
                                            ? "bg-fuchsia-600 text-white"
                                            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
                                    ].join(" ")}
                                    onClick={() => setRawDecodeMode("fast")}
                                >
                                    <Icon icon="mdi:rocket-launch-outline" className="h-4 w-4" />
                                    快速预览
                                </button>
                                <button
                                    type="button"
                                    className={[
                                        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                                        rawDecodeMode === "high"
                                            ? "bg-fuchsia-600 text-white"
                                            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
                                    ].join(" ")}
                                    onClick={() => setRawDecodeMode("high")}
                                >
                                    <Icon icon="mdi:image-filter-hdr" className="h-4 w-4" />
                                    高质量
                                </button>
                            </div>
                        </div>
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            当前设置只影响新上传的 RAW 文件；普通 JPG / PNG / TIFF 不受影响。
                        </p>
                    </div>
                </div>

                <div
                    className={[
                        "rounded-3xl border border-dashed px-6 py-10 transition",
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
                    <input
                        ref={inputRef}
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*,.cr2,.cr3,.nef,.nrw,.arw,.sr2,.srf,.dng,.raf,.orf,.rw2,.pef,.iiq,.3fr,.srw"
                        onChange={handleInputChange}
                    />
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
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-full bg-fuchsia-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-fuchsia-500"
                                onClick={() => inputRef.current?.click()}
                            >
                                <Icon icon="mdi:upload" className="h-4 w-4" />
                                选择文件
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
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                        <p className="text-sm text-slate-500 dark:text-slate-400">已上传</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                            {items.length}
                        </p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                        <p className="text-sm text-slate-500 dark:text-slate-400">分析完成</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                            {readyItems.length}
                        </p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                        <p className="text-sm text-slate-500 dark:text-slate-400">处理中</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                            {isAnalyzing ? processingCount : 0}
                        </p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                        <p className="text-sm text-slate-500 dark:text-slate-400">失败</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                            {errorCount}
                        </p>
                    </div>
                </div>

                {overviewBase ? (
                    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                        <div className="mb-4 flex flex-col gap-1">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                焦点总览
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                下面把所有图片的焦点中心叠到同一视角中，方便判断对焦点是从前景往后移，还是在横向位置上发生变化。
                            </p>
                        </div>
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 dark:border-slate-800">
                                <div
                                    className="relative mx-auto"
                                    style={{
                                        width: "100%",
                                        maxWidth: `${overviewBase.width}px`,
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
                            <div className="space-y-3">
                                {readyItems.map((item, index) => {
                                    const result = item.result!;
                                    const color = getFocusMarkerColor(index);
                                    return (
                                        <div
                                            key={item.id}
                                            className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800"
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
                    </section>
                ) : null}

                {items.length > 0 ? (
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                单张分析
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                每张图都会标出一个焦点中心点，并覆盖局部锐度热力图。
                            </p>
                        </div>
                        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
                            {items.map((item, index) => {
                                if (item.status === "processing") {
                                    return (
                                        <div
                                            key={item.id}
                                            className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
                                        >
                                            <div className="aspect-[4/3] animate-pulse bg-slate-200 dark:bg-slate-800" />
                                            <div className="space-y-3 p-4">
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
                                            className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
                                        >
                                            <div className="flex aspect-[4/3] items-center justify-center bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-300">
                                                <Icon icon="mdi:alert-circle-outline" className="h-10 w-10" />
                                            </div>
                                            <div className="space-y-3 p-4">
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
                                                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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

                                return (
                                    <div
                                        key={item.id}
                                        className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
                                    >
                                        <div className="relative aspect-[4/3] bg-slate-950">
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
                                        <div className="space-y-4 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                                                        {item.file.name}
                                                    </p>
                                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                        预览 {result.width} x {result.height}，原图 {result.originalWidth} x {result.originalHeight}
                                                    </p>
                                                    {result.fileKind === "raw" ? (
                                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            模式 {result.rawDecodeMode === "fast" ? "快速预览" : "高质量"}，实际预设 {result.rawDecodePreset === "fast-preview" ? "半尺寸解码" : "完整解码"}
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                                    onClick={() => handleRemove(item.id)}
                                                >
                                                    <Icon icon="mdi:delete-outline" className="h-4 w-4" />
                                                    移除
                                                </button>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        焦点中心
                                                    </p>
                                                    <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        X {formatPercent(result.focusPoint.x / result.width)}
                                                    </p>
                                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        Y {formatPercent(result.focusPoint.y / result.height)}
                                                    </p>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        焦点面积
                                                    </p>
                                                    <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        {formatPercent(result.focusCoverage)}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        热区覆盖越大，表示清晰区域越分散
                                                    </p>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        局部锐度
                                                    </p>
                                                    <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        平均热点 {formatPercent(result.focusScore)}
                                                    </p>
                                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        峰值 {formatPercent(result.peakValue)}
                                                    </p>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                                                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                        最强焦点像素
                                                    </p>
                                                    <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        {formatPixel(result.peakPoint.x)}, {formatPixel(result.peakPoint.y)}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        适合快速定位“最实”的落焦位置
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ) : null}
            </div>
        </div>
    );
};

export default FocusVisualizerPage;
