import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type CropMode = "fixed" | "ratio";
type DragMode = "new" | "move" | "nw" | "ne" | "sw" | "se";

type CropBox = {
    x: number;
    y: number;
    w: number;
    h: number;
};

type CropImage = {
    id: string;
    name: string;
    url: string;
    width: number;
    height: number;
    crop: CropBox;
};

type DragState = {
    active: boolean;
    mode: DragMode;
    startPoint: { x: number; y: number };
    startCrop: CropBox | null;
};

const ratioOptions = [
    { label: "1:1", value: 1 },
    { label: "15:8", value: 15 / 8 },
    { label: "4:3", value: 4 / 3 },
    { label: "3:4", value: 3 / 4 },
    { label: "16:9", value: 16 / 9 },
    { label: "9:16", value: 9 / 16 },
    { label: "2:1", value: 2 },
    { label: "1:2", value: 0.5 },
    { label: "自定义", value: 1 },
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const normalizeBox = (box: CropBox): CropBox => {
    const x = Math.min(box.x, box.x + box.w);
    const y = Math.min(box.y, box.y + box.h);
    return { x, y, w: Math.abs(box.w), h: Math.abs(box.h) };
};

const fitBoxInImage = (box: CropBox, imgW: number, imgH: number): CropBox => {
    const n = normalizeBox(box);
    const w = clamp(n.w, 1, imgW);
    const h = clamp(n.h, 1, imgH);
    const x = clamp(n.x, 0, imgW - w);
    const y = clamp(n.y, 0, imgH - h);
    return { x, y, w, h };
};

const createCenteredCrop = (imgW: number, imgH: number, ratio: number): CropBox => {
    const maxW = imgW * 0.75;
    const maxH = imgH * 0.75;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
        h = maxH;
        w = h * ratio;
    }
    const x = (imgW - w) / 2;
    const y = (imgH - h) / 2;
    return { x, y, w, h };
};

const buildAspectBox = (
    anchor: { x: number; y: number },
    point: { x: number; y: number },
    ratio: number,
    imgW: number,
    imgH: number
): CropBox => {
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const sx = dx >= 0 ? 1 : -1;
    const sy = dy >= 0 ? 1 : -1;
    let aw = Math.max(Math.abs(dx), 1);
    let ah = Math.max(Math.abs(dy), 1);
    if (aw / Math.max(ah, 1e-6) > ratio) {
        ah = aw / ratio;
    } else {
        aw = ah * ratio;
    }
    const maxW = sx > 0 ? imgW - anchor.x : anchor.x;
    const maxH = sy > 0 ? imgH - anchor.y : anchor.y;
    const scale = Math.min(1, maxW / aw, maxH / ah);
    aw *= scale;
    ah *= scale;
    const x = sx > 0 ? anchor.x : anchor.x - aw;
    const y = sy > 0 ? anchor.y : anchor.y - ah;
    return normalizeBox({ x, y, w: aw, h: ah });
};

export default function ImageCropper() {
    const [images, setImages] = useState<CropImage[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [mode, setMode] = useState<CropMode>("fixed");
    const [targetWidth, setTargetWidth] = useState(1080);
    const [targetHeight, setTargetHeight] = useState(1350);
    const [ratioPreset, setRatioPreset] = useState("1:1");
    const [customRatioW, setCustomRatioW] = useState(1);
    const [customRatioH, setCustomRatioH] = useState(1);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<DragState>({
        active: false,
        mode: "new",
        startPoint: { x: 0, y: 0 },
        startCrop: null,
    });
    const objectUrlsRef = useRef<string[]>([]);

    const selectedRatio = useMemo(() => {
        if (mode === "fixed") {
            return Math.max(targetWidth, 1) / Math.max(targetHeight, 1);
        }
        if (ratioPreset === "自定义") {
            return Math.max(customRatioW, 1) / Math.max(customRatioH, 1);
        }
        const found = ratioOptions.find((r) => r.label === ratioPreset);
        return found?.value ?? 1;
    }, [mode, targetWidth, targetHeight, ratioPreset, customRatioW, customRatioH]);

    const activeImage = useMemo(
        () => images.find((item) => item.id === activeId) ?? null,
        [images, activeId]
    );

    const cropPercent = useMemo(() => {
        if (!activeImage) return null;
        const { crop, width, height } = activeImage;
        return {
            left: (crop.x / width) * 100,
            top: (crop.y / height) * 100,
            width: (crop.w / width) * 100,
            height: (crop.h / height) * 100,
        };
    }, [activeImage]);

    useEffect(() => {
        return () => {
            objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        };
    }, []);

    const releaseUrl = (url: string) => {
        URL.revokeObjectURL(url);
        objectUrlsRef.current = objectUrlsRef.current.filter((item) => item !== url);
    };

    const updateActiveCrop = (updater: (prev: CropBox, image: CropImage) => CropBox) => {
        if (!activeId) return;
        setImages((prev) =>
            prev.map((item) => {
                if (item.id !== activeId) return item;
                const next = updater(item.crop, item);
                return { ...item, crop: fitBoxInImage(next, item.width, item.height) };
            })
        );
    };

    const resetCurrentCrop = () => {
        if (!activeImage) return;
        updateActiveCrop((_, image) => createCenteredCrop(image.width, image.height, selectedRatio));
    };

    const resetAllCrop = () => {
        setImages((prev) =>
            prev.map((item) => ({
                ...item,
                crop: createCenteredCrop(item.width, item.height, selectedRatio),
            }))
        );
    };

    useEffect(() => {
        if (!images.length) return;
        setImages((prev) =>
            prev.map((item) => ({
                ...item,
                crop: createCenteredCrop(item.width, item.height, selectedRatio),
            }))
        );
    }, [selectedRatio]);

    const getImagePoint = (clientX: number, clientY: number) => {
        const stageEl = stageRef.current;
        if (!stageEl || !activeImage) return null;
        const rect = stageEl.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const x = ((clientX - rect.left) / rect.width) * activeImage.width;
        const y = ((clientY - rect.top) / rect.height) * activeImage.height;
        return {
            x: clamp(x, 0, activeImage.width),
            y: clamp(y, 0, activeImage.height),
        };
    };

    const startDrag = (dragMode: DragMode, e: React.PointerEvent) => {
        if (!activeImage) return;
        const pt = getImagePoint(e.clientX, e.clientY);
        if (!pt) return;
        dragRef.current = {
            active: true,
            mode: dragMode,
            startPoint: pt,
            startCrop: activeImage.crop,
        };
    };

    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            const d = dragRef.current;
            if (!d.active || !activeImage) return;
            const pt = getImagePoint(e.clientX, e.clientY);
            if (!pt) return;
            if (d.mode === "move" && d.startCrop) {
                const dx = pt.x - d.startPoint.x;
                const dy = pt.y - d.startPoint.y;
                const nextX = clamp(d.startCrop.x + dx, 0, activeImage.width - d.startCrop.w);
                const nextY = clamp(d.startCrop.y + dy, 0, activeImage.height - d.startCrop.h);
                updateActiveCrop((prev) => ({ ...prev, x: nextX, y: nextY }));
                return;
            }
            let anchor = d.startPoint;
            if (d.mode !== "new" && d.startCrop) {
                const { x, y, w, h } = d.startCrop;
                if (d.mode === "nw") anchor = { x: x + w, y: y + h };
                if (d.mode === "ne") anchor = { x, y: y + h };
                if (d.mode === "sw") anchor = { x: x + w, y };
                if (d.mode === "se") anchor = { x, y };
            }
            const next = buildAspectBox(anchor, pt, selectedRatio, activeImage.width, activeImage.height);
            if (next.w < 2 || next.h < 2) return;
            updateActiveCrop(() => next);
        };

        const onUp = () => {
            dragRef.current.active = false;
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
    }, [activeImage, selectedRatio]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;
        const loaded = await Promise.all(
            files.map(
                (file) =>
                    new Promise<CropImage | null>((resolve) => {
                        const url = URL.createObjectURL(file);
                        const img = new Image();
                        img.src = url;
                        img.onload = () => {
                            objectUrlsRef.current.push(url);
                            const crop = createCenteredCrop(img.width, img.height, selectedRatio);
                            resolve({
                                id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                                name: file.name.replace(/\.[^/.]+$/, "") || "image",
                                url,
                                width: img.width,
                                height: img.height,
                                crop,
                            });
                        };
                        img.onerror = () => {
                            URL.revokeObjectURL(url);
                            resolve(null);
                        };
                    })
            )
        );
        const valid = loaded.filter((item): item is CropImage => Boolean(item));
        if (!valid.length) {
            toast.error("图片读取失败");
            return;
        }
        setImages((prev) => [...prev, ...valid]);
        setActiveId((prev) => prev ?? valid[0].id);
        toast.success(`已加载 ${valid.length} 张图片`);
        e.target.value = "";
    };

    const removeImage = (id: string) => {
        setImages((prev) => {
            const removeIndex = prev.findIndex((item) => item.id === id);
            if (removeIndex < 0) return prev;
            const removing = prev[removeIndex];
            releaseUrl(removing.url);
            const next = prev.filter((item) => item.id !== id);
            setActiveId((current) => {
                if (current !== id) return current;
                if (!next.length) return null;
                const nextIndex = Math.min(removeIndex, next.length - 1);
                return next[nextIndex].id;
            });
            return next;
        });
    };

    const clearAllImages = () => {
        objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        objectUrlsRef.current = [];
        setImages([]);
        setActiveId(null);
    };

    const drawCropToBlob = async (
        image: CropImage,
        crop: CropBox,
        outputW: number,
        outputH: number
    ) => {
        const img = new Image();
        img.src = image.url;
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("load-image-failed"));
        });
        const canvas = document.createElement("canvas");
        canvas.width = outputW;
        canvas.height = outputH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(
            img,
            crop.x,
            crop.y,
            crop.w,
            crop.h,
            0,
            0,
            outputW,
            outputH
        );
        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.95)
        );
        return blob;
    };

    const exportCurrent = async () => {
        if (!activeImage) {
            toast.error("请先上传图片");
            return;
        }
        const crop = activeImage.crop;
        const outputW =
            mode === "fixed" ? Math.max(1, Math.round(targetWidth)) : Math.max(1, Math.round(crop.w));
        const outputH =
            mode === "fixed" ? Math.max(1, Math.round(targetHeight)) : Math.max(1, Math.round(crop.h));
        const blob = await drawCropToBlob(activeImage, crop, outputW, outputH);
        if (!blob) {
            toast.error("导出失败");
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${activeImage.name}-crop-${outputW}x${outputH}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`已导出 ${outputW} × ${outputH}`);
    };

    const exportBatch = async () => {
        if (!images.length) {
            toast.error("请先上传图片");
            return;
        }
        const zip = new JSZip();
        let success = 0;
        for (let i = 0; i < images.length; i += 1) {
            const image = images[i];
            const crop = image.crop;
            const outputW =
                mode === "fixed" ? Math.max(1, Math.round(targetWidth)) : Math.max(1, Math.round(crop.w));
            const outputH =
                mode === "fixed" ? Math.max(1, Math.round(targetHeight)) : Math.max(1, Math.round(crop.h));
            const blob = await drawCropToBlob(image, crop, outputW, outputH);
            if (!blob) continue;
            zip.file(`${image.name}-crop-${outputW}x${outputH}.jpg`, blob);
            success += 1;
        }
        if (!success) {
            toast.error("批量导出失败");
            return;
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `crop-batch-${Date.now()}.zip`);
        toast.success(`已批量导出 ${success} 张`);
    };

    const setCropX = (x: number) => {
        if (!activeImage) return;
        updateActiveCrop((prev, image) => ({
            ...prev,
            x: clamp(x, 0, image.width - prev.w),
        }));
    };

    const setCropY = (y: number) => {
        if (!activeImage) return;
        updateActiveCrop((prev, image) => ({
            ...prev,
            y: clamp(y, 0, image.height - prev.h),
        }));
    };

    const setCropW = (nextWRaw: number) => {
        if (!activeImage) return;
        updateActiveCrop((prev, image) => {
            let w = clamp(nextWRaw, 1, image.width);
            let h = w / selectedRatio;
            if (h > image.height) {
                h = image.height;
                w = h * selectedRatio;
            }
            const x = clamp(prev.x, 0, image.width - w);
            const y = clamp(prev.y, 0, image.height - h);
            return { x, y, w, h };
        });
    };

    const setCropH = (nextHRaw: number) => {
        if (!activeImage) return;
        updateActiveCrop((prev, image) => {
            let h = clamp(nextHRaw, 1, image.height);
            let w = h * selectedRatio;
            if (w > image.width) {
                w = image.width;
                h = w / selectedRatio;
            }
            const x = clamp(prev.x, 0, image.width - w);
            const y = clamp(prev.y, 0, image.height - h);
            return { x, y, w, h };
        });
    };

    const nudge = (dx: number, dy: number) => {
        if (!activeImage) return;
        updateActiveCrop((prev, image) => ({
            ...prev,
            x: clamp(prev.x + dx, 0, image.width - prev.w),
            y: clamp(prev.y + dy, 0, image.height - prev.h),
        }));
    };

    return (
        <div className="h-[calc(100vh-56px)] overflow-auto p-4">
            <Card className="mx-auto max-w-7xl">
                <CardHeader>
                    <CardTitle>图片裁切</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
                        <div className="space-y-4 xl:col-span-1">
                            <div className="space-y-2">
                                <div className="text-sm">裁切模式</div>
                                <Select value={mode} onValueChange={(v) => setMode(v as CropMode)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">固定像素导出</SelectItem>
                                        <SelectItem value="ratio">按比例选区导出</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {mode === "fixed" ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <div className="text-sm">导出宽度(px)</div>
                                        <Input type="number" value={targetWidth} min={1} onChange={(e) => setTargetWidth(Number(e.target.value || 1))} />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-sm">导出高度(px)</div>
                                        <Input type="number" value={targetHeight} min={1} onChange={(e) => setTargetHeight(Number(e.target.value || 1))} />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="text-sm">长宽比</div>
                                    <Select value={ratioPreset} onValueChange={setRatioPreset}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ratioOptions.map((item) => (
                                                <SelectItem key={item.label} value={item.label}>
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {ratioPreset === "自定义" && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input
                                                type="number"
                                                value={customRatioW}
                                                min={1}
                                                onChange={(e) => setCustomRatioW(Number(e.target.value || 1))}
                                            />
                                            <Input
                                                type="number"
                                                value={customRatioH}
                                                min={1}
                                                onChange={(e) => setCustomRatioH(Number(e.target.value || 1))}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                                <Button asChild>
                                    <label className="cursor-pointer">
                                        批量上传
                                        <input
                                            className="hidden"
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleUpload}
                                        />
                                    </label>
                                </Button>
                                <Button variant="secondary" onClick={resetCurrentCrop} disabled={!activeImage}>
                                    重置当前
                                </Button>
                                <Button variant="secondary" onClick={resetAllCrop} disabled={!images.length}>
                                    重置全部
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button onClick={exportCurrent} disabled={!activeImage}>
                                    导出当前
                                </Button>
                                <Button onClick={exportBatch} disabled={!images.length}>
                                    批量导出ZIP
                                </Button>
                                <Button variant="destructive" onClick={clearAllImages} disabled={!images.length}>
                                    清空列表
                                </Button>
                            </div>
                            {activeImage && (
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">
                                        原图: {activeImage.width} × {activeImage.height}
                                    </Badge>
                                    <Badge variant="outline">
                                        选区: {Math.round(activeImage.crop.w)} × {Math.round(activeImage.crop.h)}
                                    </Badge>
                                </div>
                            )}
                            {activeImage && (
                                <div className="space-y-2 rounded-md border p-3">
                                    <div className="text-sm">单张微调</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            type="number"
                                            value={Math.round(activeImage.crop.x)}
                                            onChange={(e) => setCropX(Number(e.target.value || 0))}
                                        />
                                        <Input
                                            type="number"
                                            value={Math.round(activeImage.crop.y)}
                                            onChange={(e) => setCropY(Number(e.target.value || 0))}
                                        />
                                        <Input
                                            type="number"
                                            value={Math.round(activeImage.crop.w)}
                                            onChange={(e) => setCropW(Number(e.target.value || 1))}
                                        />
                                        <Input
                                            type="number"
                                            value={Math.round(activeImage.crop.h)}
                                            onChange={(e) => setCropH(Number(e.target.value || 1))}
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        <Button variant="secondary" size="sm" onClick={() => nudge(0, -1)}>
                                            上
                                        </Button>
                                        <Button variant="secondary" size="sm" onClick={() => nudge(0, 1)}>
                                            下
                                        </Button>
                                        <Button variant="secondary" size="sm" onClick={() => nudge(-1, 0)}>
                                            左
                                        </Button>
                                        <Button variant="secondary" size="sm" onClick={() => nudge(1, 0)}>
                                            右
                                        </Button>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2">
                                <div className="text-sm">图片列表 ({images.length})</div>
                                <div className="max-h-[280px] overflow-auto space-y-2 pr-1">
                                    {images.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setActiveId(item.id)}
                                            className={`w-full text-left rounded-md border p-2 flex items-center gap-2 ${
                                                activeId === item.id ? "border-primary bg-primary/5" : "border-border"
                                            }`}
                                        >
                                            <img
                                                src={item.url}
                                                alt={item.name}
                                                className="w-14 h-14 rounded object-cover bg-black/5"
                                            />
                                            <div className="min-w-0">
                                                <div className="text-xs truncate">{item.name}</div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    {item.width} × {item.height}
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="destructive"
                                                className="ml-auto h-7 px-2"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeImage(item.id);
                                                }}
                                            >
                                                删除
                                            </Button>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="xl:col-span-3">
                            {!activeImage ? (
                                <div className="h-[60vh] border rounded-lg border-dashed flex items-center justify-center text-sm text-muted-foreground">
                                    先批量上传图片，再选择单张进行微调
                                </div>
                            ) : (
                                <div className="w-full h-[75vh] overflow-auto rounded-lg border bg-black/5 p-2 flex items-center justify-center">
                                    <div
                                        className="relative inline-block select-none"
                                        ref={stageRef}
                                        onPointerDown={(e) => startDrag("new", e)}
                                    >
                                        <img
                                            src={activeImage.url}
                                            alt={activeImage.name}
                                            className="block max-w-full max-h-[70vh]"
                                            draggable={false}
                                        />
                                        {cropPercent && (
                                            <>
                                                <div className="absolute inset-0 pointer-events-none">
                                                    <div className="absolute left-0 top-0 h-full bg-black/35" style={{ width: `${cropPercent.left}%` }} />
                                                    <div className="absolute right-0 top-0 h-full bg-black/35" style={{ width: `${Math.max(0, 100 - cropPercent.left - cropPercent.width)}%` }} />
                                                    <div className="absolute" style={{ left: `${cropPercent.left}%`, top: 0, width: `${cropPercent.width}%`, height: `${cropPercent.top}%`, backgroundColor: "rgba(0,0,0,0.35)" }} />
                                                    <div className="absolute" style={{ left: `${cropPercent.left}%`, top: `${cropPercent.top + cropPercent.height}%`, width: `${cropPercent.width}%`, height: `${Math.max(0, 100 - cropPercent.top - cropPercent.height)}%`, backgroundColor: "rgba(0,0,0,0.35)" }} />
                                                </div>
                                                <div
                                                    className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
                                                    style={{
                                                        left: `${cropPercent.left}%`,
                                                        top: `${cropPercent.top}%`,
                                                        width: `${cropPercent.width}%`,
                                                        height: `${cropPercent.height}%`,
                                                    }}
                                                    onPointerDown={(e) => {
                                                        e.stopPropagation();
                                                        startDrag("move", e);
                                                    }}
                                                >
                                                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/60" />
                                                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/60" />
                                                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/60" />
                                                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/60" />
                                                    {(["nw", "ne", "sw", "se"] as DragMode[]).map((h) => {
                                                        const map: Record<string, string> = {
                                                            nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
                                                            ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
                                                            sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
                                                            se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
                                                        };
                                                        return (
                                                            <div
                                                                key={h}
                                                                className={`absolute w-3 h-3 rounded-full border border-white bg-black/80 ${map[h]}`}
                                                                onPointerDown={(e) => {
                                                                    e.stopPropagation();
                                                                    startDrag(h, e);
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
