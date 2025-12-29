import {
    forwardRef,
    useCallback,
    useState,
    useRef,
    memo,
    useMemo,
    useEffect,
} from "react";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Icon } from "@iconify/react";
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    UniqueIdentifier,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from "@dnd-kit/sortable";
import { useDebouncedCallback } from "use-debounce";
import clsx from "clsx";
import PhotoAlbum, { Photo } from "react-photo-album";
import "react-photo-album/styles.css";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import "./puzzle.css";
import ImagePreview from "./ImagePreview";
import ThreeLanding from "@/components/ThreeLanding";
import React from "react";
import ColorThief from "colorthief";
import chroma from "chroma-js";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";


const getRandomColor = () => {
  // Morandi-style colors: Low saturation (5-25%), Muted brightness (50-80%)
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(Math.random() * 20) + 5;
  const l = Math.floor(Math.random() * 30) + 50;

  const sPct = s / 100;
  const lPct = l / 100;

  const c = (1 - Math.abs(2 * lPct - 1)) * sPct;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lPct - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

interface AspectRatio {
    width: number;
    height: number;
    label: string;
}

const aspectRatioOptions: AspectRatio[] = [
    { width: null, height: null, label: "自适应" },
    { width: 1, height: 1, label: "1:1" },
    { width: 4, height: 3, label: "4:3" },
    { width: 3, height: 4, label: "3:4" },
    { width: 16, height: 9, label: "16:9" },
    { width: 9, height: 16, label: "9:16" },
    { width: 2, height: 1, label: "2:1" },
    { width: 1, height: 2, label: "1:2" },
];

interface SortablePhoto extends Photo {
    id: UniqueIdentifier;
}

type SortablePhotoProps = {
    photo: SortablePhoto;
    imageProps: any;
    index?: number;
    onPreview?: (index: number) => void;
    wrapperStyle?: React.CSSProperties;
};

type PhotoFrameProps = SortablePhotoProps & {
    overlay?: boolean;
    active?: boolean;
    insertPosition?: "before" | "after";
    attributes?: Partial<React.HTMLAttributes<HTMLDivElement>>;
    listeners?: Partial<React.HTMLAttributes<HTMLDivElement>>;
    onDelete?: (id: UniqueIdentifier) => void;
    margin?: number;
    radius?: number;
    onPreview?: (index: number) => void;
    index?: number;
    frameColor?: string;
    frameThickness?: number;
    hasMat?: boolean;
    matColor?: string;
    matSize?: number;
    frameOpacity?: number;
};
interface ImgProp {
    id: string;
    src: string;
    width: number;
    height: number;
    frameColor?: string;
}

const PhotoFrame = memo(
    forwardRef<HTMLDivElement, PhotoFrameProps>(function PhotoFrame(
        props,
        ref
    ) {
        const {
            imageProps,
            wrapperStyle,
            overlay,
            active,
            insertPosition,
            attributes,
            listeners,
            photo,
            onDelete,
            margin,
            radius,
            onPreview,
            index,
            frameColor = "#4a3728",
            frameThickness = 20,
            hasMat = true,
            matColor = "#f0f0f0",
            matSize = 30,
            frameOpacity = 0.6,
        } = props;
        const { alt, style, ...restImageProps } = imageProps;

        // Calculate 3D Frame Styles
        const frameStyle = {
            // Frosted Glass (Matte) Style
            // 1. Material: Adjustable opacity white for visible "frost" + soft blur
            backgroundColor: `rgba(255, 255, 255, ${frameOpacity})`,
            backdropFilter: "blur(40px) saturate(100%)",
            WebkitBackdropFilter: "blur(40px) saturate(100%)",

            // 2. Diffused Lighting (Matte finish, no sharp glints)
            boxShadow: `
                /* Soft Lift Shadow */
                0 20px 40px -10px rgba(0, 0, 0, 0.2),

                /* Diffused Top Light (Soft highlight) */
                inset 0 1px 2px rgba(255, 255, 255, 0.4),

                /* Inner Frost Glow */
                inset 0 0 30px rgba(255,255,255,0.2),

                /* Subtle Edge Definition */
                0 0 0 1px rgba(255,255,255,0.3)
            `,

            // 3. Soft Physical Edge
            border: "1px solid rgba(255, 255, 255, 0.2)",

            padding: `${frameThickness}px`,
            position: "relative" as const,
            transition: "all 0.3s ease",
            ...wrapperStyle,
            borderRadius: radius ? `${radius}px` : "0px",
        };

        const matStyle = {
            backgroundColor: matColor,
            padding: hasMat ? `${matSize}px` : "0px",
            // Mat thickness shadow
            boxShadow: hasMat ? "inset 1px 1px 3px rgba(0,0,0,0.1)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
        };

        return (
            <div
                ref={ref}
                style={{
                    ...frameStyle,
                     width: overlay ? (wrapperStyle?.width ?? style.width) : style.width,
                     boxSizing: "border-box",
                }}
                className={clsx("photo-frame group", {
                    overlay: overlay,
                    active: active,
                    insertBefore: insertPosition === "before",
                    insertAfter: insertPosition === "after",
                })}
                {...attributes}
                {...listeners}
            >
                 <div style={matStyle}>
                    <div
                        className="relative w-full h-full"
                        style={{
                            // Deep Bevel Cut: Stronger shadow to show card stock thickness
                            boxShadow: hasMat ? `
                                2px 2px 4px rgba(0,0,0,0.2),
                                inset 1px 1px 0px rgba(255,255,255,0.5)
                            ` : "none",
                            overflow: "hidden"
                        }}
                    >
                        <img
                            alt={alt}
                            style={{
                                ...style,
                                width: "100%",
                                height: "auto",
                                padding: 0,
                                margin: 0,
                                borderRadius: 0,
                                cursor: "zoom-in",
                                display: "block"
                            }}
                            {...restImageProps}
                            onClick={() => {
                                if (!overlay && onPreview) onPreview(index ?? 0)
                            }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <div className="flex items-center text-white">
                                <Icon
                                    icon="ph:eye-bold"
                                    className="w-5 h-5 mr-2"
                                />
                                预览
                            </div>
                        </div>
                    </div>
                </div>

                {!overlay && (
                    <div className="opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-20">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute -top-3 -right-3 w-8 h-8 p-0 rounded-full shadow-md border-2 border-white"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete?.(photo.id);
                                        }}
                                    >
                                        <Icon
                                            icon="material-symbols:delete-outline-sharp"
                                            className="w-4 h-4"
                                        />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>删除</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )}
            </div>
        );
    }),
    // Custom comparison function
    (prevProps, nextProps) => {
        return (
            prevProps.imageProps.src === nextProps.imageProps.src &&
            prevProps.active === nextProps.active &&
            prevProps.insertPosition === nextProps.insertPosition &&
            prevProps.overlay === nextProps.overlay &&
            prevProps.frameColor === nextProps.frameColor &&
            prevProps.frameThickness === nextProps.frameThickness &&
            prevProps.hasMat === nextProps.hasMat &&
            prevProps.matColor === nextProps.matColor &&
            prevProps.matSize === nextProps.matSize &&
            prevProps.frameOpacity === nextProps.frameOpacity
        );
    }
);

function SortablePhotoFrame(
    props: SortablePhotoProps & {
        activeIndex?: number;
        onDelete?: (id: UniqueIdentifier) => void;
        margin?: number;
        radius?: number;
        frameColor?: string;
        frameThickness?: number;
        hasMat?: boolean;
        matColor?: string;
        matSize?: number;
        frameOpacity?: number;
    }
) {
    const { photo, activeIndex, onDelete, margin, radius, frameColor, frameThickness, hasMat, matColor, matSize, frameOpacity } = props;
    const { attributes, listeners, isDragging, index, over, setNodeRef } =
        useSortable({ id: photo.id });

    return (
        <PhotoFrame
            ref={setNodeRef}
            active={isDragging}
            insertPosition={
                activeIndex !== undefined &&
                over?.id === photo.id &&
                !isDragging
                    ? index > activeIndex
                        ? "after"
                        : "before"
                    : undefined
            }
            aria-label="sortable image"
            attributes={attributes}
            listeners={listeners}
            onDelete={onDelete}
            margin={margin}
            radius={radius}
            frameColor={frameColor}
            frameThickness={frameThickness}
            hasMat={hasMat}
            matColor={matColor}
            matSize={matSize}
            frameOpacity={frameOpacity}
            {...props}
        />
    );
}

const Gallery = () => {
    const galleryRef = useRef(null);
    const [files, setFiles] = useState([]);
    const [images, setImages] = useState<ImgProp[]>([]);
    const [spinning, setSpinning] = useState<boolean>(false);
    const [settingsOpen, setSettingsOpen] = useState(true);

    // Gallery State
    const [wallColor, setWallColor] = useState("#e0e0e0");
    const [frameColor, setFrameColor] = useState("#4a3728");
    const [frameThickness, setFrameThickness] = useState([20]);
    const [hasMat, setHasMat] = useState(true);
    const [matColor, setMatColor] = useState("#f0f0f0");
    const [matSize, setMatSize] = useState([30]);
    const [frameOpacity, setFrameOpacity] = useState([0.6]);

    // Initialize random wall color
    useEffect(() => {
        setWallColor(getRandomColor());
    }, []);

    const [isUpload, setIsUpload] = useState<boolean>(false);
    const [inputColumns, setInputColumns] = useState<number>(3);
    const [inputScale, setInputScale] = useState<number>(6);
    const [margin, setMargin] = useState<number>(30); // Gap between images
    const [outerPadding, setOuterPadding] = useState<number>(30); // Outer padding
    const [radius, setRadius] = useState<number>(0);
    const [layout, setLayout] = useState<"rows" | "masonry" | "columns">(
        "masonry" // Default to masonry for gallery look
    );

    const [selectedRatio, setSelectedRatio] = useState<AspectRatio | null>(
        null
    );
    const [tiltAngle, setTiltAngle] = useState<number>(0);
    const [tiltScale, setTiltScale] = useState<number>(1);
    const [vignette, setVignette] = useState<boolean>(true);
    const [pageScale, setPageScale] = useState<number>(1);
    const [estimatedPages, setEstimatedPages] = useState<number>(1);
    const [showPagePreview, setShowPagePreview] = useState<boolean>(true);
    const [overlayBounds, setOverlayBounds] = useState<number[]>([]);

    // 添加一个状态来存储容器尺寸
    const [containerSize, setContainerSize] = useState<{
        width: number;
        height: number;
    }>({ width: 0, height: 0 });
    const renderedPhotos = useRef<{ [key: string]: SortablePhotoProps }>({});
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [activeId, setActiveId] = useState<UniqueIdentifier>();
    // const [currentImageIndex, setCurrentImageIndex] = useState<number>();
    const activeIndex = activeId
        ? images.findIndex((photo) => photo.id === activeId)
        : undefined;

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 50, tolerance: 10 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = useCallback(
        ({ active }: DragStartEvent) => setActiveId(active.id),
        []
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;

            if (over && active.id !== over.id) {
                setImages((items) => {
                    const oldIndex = items.findIndex(
                        (item) => item.id === active.id
                    );
                    const newIndex = items.findIndex(
                        (item) => item.id === over.id
                    );

                    // 在列布局时进行特殊处理
                    // if (layout === "columns") {
                    //     // 计算每行的图片数量
                    //     const itemsPerRow = inputColumns;
                    //     // 计算源图片和目标图片所在的行
                    //     const oldRow = Math.floor(oldIndex / itemsPerRow);
                    //     const newRow = Math.floor(newIndex / itemsPerRow);

                    //     // 如果在同一行内，则直接交换位置
                    //     if (oldRow === newRow) {
                    //         const newItems = [...items];
                    //         [newItems[oldIndex], newItems[newIndex]] = [
                    //             newItems[newIndex],
                    //             newItems[oldIndex],
                    //         ];
                    //         return newItems;
                    //     }
                    //     // 如果不在同一行，则保持原有行为（整体重排）
                    //     return arrayMove(items, oldIndex, newIndex);
                    // }

                    // // 其他布局保持原有行为
                    // return arrayMove(items, oldIndex, newIndex);
                    const newItems = [...items];
                    [newItems[oldIndex], newItems[newIndex]] = [
                        newItems[newIndex],
                        newItems[oldIndex],
                    ];
                    return newItems;
                });
            }

            setActiveId(undefined);
        },
        [layout, inputColumns]
    );

    const handleDelete = useCallback(
        (id: UniqueIdentifier) => {
            setImages((prevImages) =>
                prevImages.filter((img) => img.id !== id)
            );
            setFiles((prevFiles) => {
                const imageIndex = images.findIndex((img) => img.id === id);
                return prevFiles.filter((_, index) => index !== imageIndex);
            });
        },
        [images]
    ); // 添加 images 作为依赖

    const renderImage = (imageProps: any, ctx: any) => {
        const props: SortablePhotoProps = {
            photo: ctx?.photo,
            imageProps,
            index: ctx?.index,
            onPreview: (i: number) => {
                setPreviewIndex(i ?? 0);
                setPreviewOpen(true);
            },
        };
        renderedPhotos.current[props.photo.id] = props;
        return (
            <SortablePhotoFrame
                activeIndex={activeIndex}
                onDelete={handleDelete}
                margin={margin}
                radius={radius}
                frameColor={(ctx.photo as ImgProp).frameColor || frameColor}
                frameThickness={frameThickness[0]}
                hasMat={hasMat}
                matColor={matColor}
                matSize={matSize[0]}
                frameOpacity={frameOpacity[0]}
                {...props}
            />
        );
    };

    const onDrop = useCallback(
        async (acceptedFiles) => {
            const oversizedFiles = acceptedFiles.filter(
                (file) => file.size > 200 * 1024 * 1024
            );
            if (oversizedFiles.length > 0) {
                toast.error(
                    `以下图片大小超过 200MB，已被过滤: ${oversizedFiles
                        .map((file) => file.name)
                        .join(", ")}`,
                    { position: "top-center" }
                );
                return;
            }
            setSpinning(true);
            const newImages = [];

            try {
                const compressionOptions = {
                    maxSizeMB: 15,
                    maxWidthOrHeight: 2560,
                    useWebWorker: true,
                };

                // 使用 Promise.all 并行处理所有图片
                await Promise.all(
                    acceptedFiles.map(async (file) => {
                        const compressedFile = await imageCompression(
                            file,
                            compressionOptions
                        );
                        const src = URL.createObjectURL(compressedFile);

                        return new Promise<HTMLImageElement>((resolve) => {
                            const img = new window.Image();
                            img.onload = () => {
                                let extractedColor = getRandomColor();
                                try {
                                    const colorThief = new ColorThief();
                                    const rgb = colorThief.getColor(img);
                                    if (rgb) {
                                        // Use chroma-js to create contrast while keeping harmony
                                        // Darken and desaturate to make it look like a frame (wood/metal/matte)
                                        // rather than an extension of the image
                                        extractedColor = chroma(rgb).darken(2).desaturate(1).hex();
                                    }
                                } catch (e) {
                                    console.warn("Color extraction failed, falling back to random color", e);
                                }

                                newImages.push({
                                    id: src,
                                    src: src,
                                    width: img.width,
                                    height: img.height,
                                    frameColor: extractedColor,
                                });
                                resolve(img);
                            };
                            img.src = src;
                        });
                    })
                );

                // 批量更新状态
                setFiles((prev) => [...prev, ...acceptedFiles]);
                setImages((prev) => [...prev, ...newImages]);
                if (!isUpload) {
                    setIsUpload(true);
                }
            } catch (error) {
                toast.error(`图片处理失败: ${error.message}`, { position: "top-center" });
            } finally {
                setSpinning(false);
            }
        },
        [isUpload]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".jpeg", ".jpg", ".png"],
        },
        maxSize: 100 * 1024 * 1024, // 100MB
        onDropRejected: () => {
            toast.error("图片大小不能超过200MB", { position: "top-center" });
        },
    });

    const downloadImage = async () => {
        if (files.length === 0) {
            toast.error("请选择图片", { position: "top-center" });
            return;
        }
        setSpinning(true);
        // Prioritize #container to capture the background
        const target = document.getElementById("container") || document.getElementById("tilt-wrapper") || document.getElementById("gallery");

        try {
            const originalCanvas = await html2canvas(target, {
                scale: inputScale,
                useCORS: true,
                allowTaint: true,
                backgroundColor: null, // Transparent to capture container background
                logging: false,
                onclone: (clonedDoc) => {
                    const container = clonedDoc.getElementById("container") as HTMLElement | null;
                    const wrapper = clonedDoc.getElementById("tilt-wrapper") as HTMLElement | null;
                    if (container) container.style.overflow = "visible";
                    if (wrapper) wrapper.style.overflow = "visible";
                    const images = clonedDoc.getElementsByTagName("img");
                    return Promise.all(
                        Array.from(images).map((img) =>
                            new Promise((resolve) => {
                                if (img.complete) {
                                    resolve(null);
                                } else {
                                    img.onload = () => resolve(null);
                                }
                            })
                        )
                    );
                },
            });

            const padding = Math.round(40 * inputScale);
            const fullCanvas = document.createElement("canvas");
            fullCanvas.width = originalCanvas.width;
            fullCanvas.height = originalCanvas.height;
            const fctx = fullCanvas.getContext("2d")!;
            fctx.drawImage(originalCanvas, 0, 0);

            if (!selectedRatio || selectedRatio.width === null) {
                if (vignette) {
                    const g = fctx.createRadialGradient(
                        fullCanvas.width / 2,
                        fullCanvas.height / 2,
                        Math.min(fullCanvas.width, fullCanvas.height) * 0.45,
                        fullCanvas.width / 2,
                        fullCanvas.height / 2,
                        Math.max(fullCanvas.width, fullCanvas.height) * 0.6
                    );
                    g.addColorStop(0, "rgba(0,0,0,0)");
                    g.addColorStop(1, "rgba(0,0,0,0.35)");
                    fctx.fillStyle = g;
                    fctx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
                }
                fullCanvas.toBlob((blob) => {
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "album-long.png";
                    link.click();
                    URL.revokeObjectURL(url);
                    setSpinning(false);
                    toast.success("大图合成成功！");
                }, "image/png");
            } else {
                const ratio = selectedRatio.width / selectedRatio.height;
                const pageW = fullCanvas.width;
                const pageH = Math.max(1, Math.round(pageW / ratio));
                const pageSourceH = Math.max(1, Math.round(pageH / Math.max(pageScale, 0.1)));

                // Calculate offset of tilt-wrapper relative to container
                const containerEl = document.getElementById("container");
                const wrapperEl = document.getElementById("tilt-wrapper");
                let wrapperOffsetTop = 0;
                if (containerEl && wrapperEl) {
                    const cRect = containerEl.getBoundingClientRect();
                    const wRect = wrapperEl.getBoundingClientRect();
                    wrapperOffsetTop = wRect.top - cRect.top;
                }

                const breaksCss = overlayBounds && overlayBounds.length > 0 ? overlayBounds : [];
                const boundaries = [0, ...breaksCss.map(v => Math.round((v + wrapperOffsetTop) * inputScale)), fullCanvas.height];

                const zip = new JSZip();
                const files: {name:string,blob:Blob}[] = [];
                const pagePadding = Math.round(outerPadding * inputScale);

                for (let i = 1; i < boundaries.length; i++) {
                    const prev = boundaries[i - 1];
                    const end = boundaries[i];
                    const sliceH = Math.max(0, end - prev);
                    const page = document.createElement("canvas");
                page.width = pageW;
                page.height = pageH;
                const pctx = page.getContext("2d")!;
                pctx.imageSmoothingEnabled = true;
                pctx.imageSmoothingQuality = "high";

                // Fill background with wall color
                pctx.fillStyle = wallColor;
                pctx.fillRect(0, 0, pageW, pageH);

                if (sliceH > 0) {
                     // Determine destination Y
                    // Page 1 (i===1): Top padding is already in the source (from container capture).
                    // Page 2+ (i>1): Source starts at a cut. We need to inject top padding.
                    const destY = (i === 1) ? 0 : pagePadding;

                    // We draw the slice at destY.
                    // We assume the slice fits. Our break logic ensures it fits in (pageSourceH - padding).
                    pctx.drawImage(fullCanvas, 0, prev, fullCanvas.width, sliceH, 0, destY, pageW, sliceH);
                }
                    if (vignette) {
                        const g = pctx.createRadialGradient(pageW / 2, pageH / 2, Math.min(pageW, pageH) * 0.45, pageW / 2, pageH / 2, Math.max(pageW, pageH) * 0.6);
                        g.addColorStop(0, "rgba(0,0,0,0)");
                        g.addColorStop(1, "rgba(0,0,0,0.35)");
                        pctx.fillStyle = g;
                        pctx.fillRect(0, 0, pageW, pageH);
                    }
                    await new Promise((r) => requestAnimationFrame(() => r(null)));
                    const blob = (page as any).convertToBlob ? await (page as any).convertToBlob({ type: "image/png" }) : await new Promise<Blob | null>((resolve) => page.toBlob(resolve, "image/png"));
                    if (blob) files.push({ name: `album-${selectedRatio.label}-${files.length + 1}.png`, blob });
                }
                files.forEach(f => zip.file(f.name, f.blob));
                const zipBlob = await zip.generateAsync({ type: "blob" });
                saveAs(zipBlob, `album-${selectedRatio.label}-${files.length}p.zip`);
                setSpinning(false);
                toast.success(`已打包导出 ${files.length} 张`);
            }
        } catch (error) {
            setSpinning(false);
            toast.error("导出失败，请重试", { position: "top-center" });
        }
    };

    const renderContainer = (containerProps: any) => (
        <div
            ref={galleryRef}
            id="container"
            style={{
                position: 'relative',
                overflow: 'hidden',
                // Premium Liquid Glass Background backed by Wall Color
                backgroundColor: wallColor,
                backgroundImage: `
                    radial-gradient(at 50% 0%, rgba(255,255,255,0.15) 0%, transparent 50%),
                    radial-gradient(at 50% 100%, rgba(0,0,0,0.1) 0%, transparent 50%),
                    linear-gradient(120deg, rgba(255,255,255,0.05) 0%, transparent 40%),
                    radial-gradient(circle at 80% 20%, rgba(255,255,255,0.05), transparent 30%)
                `,
                boxShadow: "inset 0 0 100px rgba(0,0,0,0.05)",
                minHeight: '100vh',
            }}
        >
             {/* Noise Texture for Realism */}
             <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.04,
                    pointerEvents: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat',
                    zIndex: 0
                }}
            />

            <div
                id="tilt-wrapper"
                style={{
                    position: 'relative',
                    display: 'inline-block',
                    transform: `rotate(${tiltAngle}deg) scale(${tiltScale})`,
                    transformOrigin: 'center',
                    transition: 'transform 300ms ease',
                    willChange: 'transform',
                    zIndex: 1
                }}
            >
                <div
                    {...containerProps}
                    id="gallery"
                    style={{
                    ...(containerProps?.style ?? {}),
                    padding: `${outerPadding}px`,
                    boxSizing: 'border-box',
                }}
            >
                {containerProps?.children}
            </div>
            {showPagePreview && selectedRatio?.width && overlayBounds.length > 0 && (
                <div id="page-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {overlayBounds.map((y, i) => (
                        <div key={i} style={{ position: 'absolute', top: `${y}px`, left: 0, right: 0, height: 0, borderTop: '2px dashed rgba(255,0,0,0.5)' }} />
                    ))}
                </div>
            )}
        </div>
        {vignette && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        background:
                            'radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%)',
                    }}
                />
            )}
        </div>
    );

    const debouncedSetMargin = useDebouncedCallback(
        (value: number) => {
            setMargin(value);
        },
        300 // 300ms 延迟
    );

    // 使用 useMemo 优化渲染的图片列表
    const memoizedPhotoAlbum = useMemo(
        () => (
            <>
                <PhotoAlbum
                    layout={layout}
                    photos={images}
                    padding={0}
                    spacing={margin}
                    columns={inputColumns}
                    render={{
                        container: renderContainer,
                        image: renderImage,
                    }}
                />
                <ImagePreview
                    images={images.map((img) => img.src)}
                    currentIndex={previewIndex}
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                />
            </>
        ),
        [
            layout,
            images,
            margin,
            inputColumns,
            renderContainer,
            renderImage,
            radius,
            previewIndex,
            previewOpen,
            frameColor,
            frameThickness,
            hasMat,
            matColor,
            matSize,
        ]
    );

    const randomizeWall = () => setWallColor(getRandomColor());

    const randomizeAllFrames = () => {
        setImages(prev => prev.map(img => ({
            ...img,
            frameColor: getRandomColor()
        })));
    };

    const handleRatioChange = (value) => {
        const ratio = aspectRatioOptions.find((r) => r.label === value);
        setSelectedRatio(ratio || null);
        // 清空列数，触发重新计算
        setInputColumns(null);
    };

    // 使用 ResizeObserver 监听容器尺寸变化
    useEffect(() => {
        const container = galleryRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            setContainerSize({ width, height });
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    // 根据容器尺寸和目标比例调整布局
    useEffect(() => {
        if (!selectedRatio?.width || !containerSize.width || !images.length)
            return;

        const currentRatio = containerSize.width / containerSize.height;
        const targetRatio = selectedRatio.width / selectedRatio.height;
        console.log(
            "Layout adjustment - Current ratio:",
            currentRatio,
            "Target ratio:",
            targetRatio
        );

        // 计算理想的列数
        const calculateIdealColumns = () => {
            // 根据图片数量和目标比例估算初始列数
            const sqrtCount = Math.sqrt(images.length);

            if (currentRatio > targetRatio) {
                // 当前太宽，需要更多列使其变窄
                return Math.min(Math.ceil(sqrtCount * 1.5), 10);
            } else if (currentRatio < targetRatio) {
                // 当前太高，需要更少列使其变宽
                return Math.max(Math.ceil(sqrtCount * 0.7), 1);
            }

            return Math.ceil(sqrtCount);
        };

        const idealColumns = calculateIdealColumns();

        // 直接设置新的列数，不再渐进式调整
        if (idealColumns !== inputColumns) {
            console.log(
                "Adjusting columns from",
                inputColumns,
                "to",
                idealColumns
            );
            setInputColumns(idealColumns);
        }
    }, [
        containerSize.width,
        containerSize.height,
        selectedRatio?.width,
        selectedRatio?.height,
        images.length,
        inputColumns,
    ]);

    // 添加一个独立的 useEffect 来处理 selectedRatio 的变化
    // useEffect(() => {
    //     if (!selectedRatio?.width || !images.length) return;

    //     const targetRatio = selectedRatio.width / selectedRatio.height;
    //     console.log("Ratio changed to:", targetRatio);

    //     // 根据图片数量和目标比例计算初始列数
    //     const sqrtCount = Math.sqrt(images.length);
    //     let newColumns;

    //     if (targetRatio > 1) {
    //         // 横向布局（如 4:3）：减少列数使整体变宽
    //         newColumns = Math.max(Math.ceil(sqrtCount * 0.7), 1);
    //         console.log("Horizontal layout, reducing columns to:", newColumns);
    //     } else {
    //         // 竖向布局（如 3:4）：增加列数使整体变高
    //         newColumns = Math.min(Math.ceil(sqrtCount * 1.5), 10);
    //         console.log("Vertical layout, increasing columns to:", newColumns);
    //     }

    //     setInputColumns(newColumns);
    // }, [selectedRatio?.width, selectedRatio?.height, images.length]); // 只依赖这些关键属性

    // 添加一个独立的 useEffect 来处理 selectedRatio 的变化
    useEffect(() => {
        if (!selectedRatio?.width || !images.length || inputColumns !== null)
            return;

        const targetRatio = selectedRatio.width / selectedRatio.height;
        const sqrtCount = Math.sqrt(images.length);
        let newColumns;

        // 根据具体的比例选择合适的列数
        switch (selectedRatio.label) {
            case "1:1":
                // 正方形：使用平方根作为基准
                newColumns = Math.round(sqrtCount);
                break;
            case "4:3":
                // 横向矩形：减少列数使整体变宽
                newColumns = Math.max(Math.round(sqrtCount * 0.7), 1);
                break;
            case "3:4":
                // 竖向矩形：增加列数使整体变高
                newColumns = Math.min(Math.round(sqrtCount * 1.3), 10);
                break;
            case "16:9":
                // 宽屏横向：显著减少列数
                newColumns = Math.max(Math.round(sqrtCount * 0.5), 1);
                break;
            case "9:16":
                // 窄屏竖向：显著增加列数
                newColumns = Math.min(Math.round(sqrtCount * 1.6), 10);
                break;
            case "2:1":
                // 超宽横向：最少列数
                newColumns = Math.max(Math.round(sqrtCount * 0.4), 1);
                break;
            case "1:2":
                // 超窄竖向：最多列数
                newColumns = Math.min(Math.round(sqrtCount * 1.8), 10);
                break;
            default:
                // 自适应或其他情况：使用默认列数
                newColumns = Math.round(sqrtCount);
        }

        console.log(
            `Adjusting layout for ${selectedRatio.label} - New columns:`,
            newColumns
        );
        setInputColumns(newColumns);
    }, [
        selectedRatio?.label,
        selectedRatio?.width,
        selectedRatio?.height,
        images.length
    ]); // 只需要监听 label 和图片数量

    useEffect(() => {
        const wrapper = document.getElementById("tilt-wrapper") as HTMLElement | null;
        const container = document.getElementById("container") as HTMLElement | null;
        if (!wrapper || !container) { setEstimatedPages(1); setOverlayBounds([]); return; }

        const wrapperRect = wrapper.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (!selectedRatio || selectedRatio.width === null) { setEstimatedPages(1); setOverlayBounds([]); return; }

        const ratio = selectedRatio.width / selectedRatio.height;
        // pageW corresponds to Container Width (since we capture container)
        const pageW = containerRect.width;
        const pageH = pageW / ratio;
        const pageSourceH = pageH / Math.max(pageScale, 0.1);

        const wrapperOffsetTop = wrapperRect.top - containerRect.top;

        // Collect positions relative to CONTAINER
        const frames = Array.from(wrapper.querySelectorAll('.photo-frame')) as HTMLElement[];
        const framePositions = frames.map(el => {
            const r = el.getBoundingClientRect();
            return {
                top: r.top - containerRect.top,
                bottom: r.bottom - containerRect.top
            };
        }).sort((a, b) => a.top - b.top);

        const breaks: number[] = [];
        let currentY = 0; // Container Top
        const totalHeight = containerRect.height;

        // Page padding in DOM pixels
        const pagePadding = outerPadding;

        // Iteratively calculate page breaks
        while (currentY < totalHeight) {
            // Determine available height for this page
            // Page 1 (currentY==0): Already has top padding. Need bottom padding buffer.
            // Page 2+ (currentY>0): Need injected top padding AND bottom padding buffer.
            const usableH = pageSourceH - (currentY === 0 ? pagePadding : 2 * pagePadding);
            let idealBottom = currentY + usableH;

            // If we reached the end, stop
            if (idealBottom >= totalHeight) {
                break;
            }

            // Function to find a safe cut point recursively
            const findSafeCut = (targetY: number): number => {
                // Find frames crossing the target line
                // Crossing means: top < targetY AND bottom > targetY
                const crossing = framePositions.filter(p => p.top < targetY && p.bottom > targetY);

                if (crossing.length === 0) {
                    return targetY;
                }

                // If crossing, we must move the cut UP to the top of the highest crossing frame
                const highestCrossingTop = Math.min(...crossing.map(p => p.top));

                // Add safety margin
                const newTarget = highestCrossingTop - 20;

                // Check if we are stuck (infinite loop or moving backwards too much)
                if (newTarget <= currentY) {
                     return currentY; // Fail safe, will force advance later
                }

                // Recursively check the new target
                return findSafeCut(newTarget);
            };

            let splitPoint = findSafeCut(idealBottom);

            // If we couldn't find a safe cut (e.g. giant image), force advance
            if (splitPoint <= currentY) {
                // Check if we can at least cut at idealBottom?
                // If the user accepts cutting giant images, we cut at idealBottom.
                // But generally we should advance by at least 1 pixel or the full page height?
                // Let's assume giant images get cut.
                splitPoint = idealBottom;
            }

            // Safety check to ensure progress
            if (splitPoint <= currentY + 1) {
                 splitPoint = currentY + usableH;
            }

            breaks.push(splitPoint);
            currentY = splitPoint;
        }

        // Convert breaks to Wrapper Space for overlay
        const breaksRelative = breaks.map(v => v - wrapperOffsetTop);

        const uniqueBreaks = Array.from(new Set(breaksRelative.map(v => Math.round(v)))).sort((a,b)=>a-b);
        setEstimatedPages(uniqueBreaks.length + 1);
        setOverlayBounds(uniqueBreaks);
    }, [selectedRatio?.width, selectedRatio?.height, tiltAngle, tiltScale, outerPadding, layout, inputColumns, images.length, containerSize.width, containerSize.height, pageScale]);

    console.log(inputColumns, selectedRatio);

    return (
        <div className="h-[calc(100vh-56px)]">

            {spinning ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="flex flex-col items-center">
                        {/* <div className="w-10 h-10 border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div> */}
                        <Icon icon="line-md:speedometer-loop" className=" text-white mt-2" />
                        <p className="mt-2 text-white">正在处理...</p>
                    </div>
                </div>
            ) : isUpload ? (
                <div className="relative w-full min-h-screen">
                    <div className={cn(
                        "fixed top-4 left-4 z-50 transition-all duration-300 ease-in-out",
                        settingsOpen ? "w-80 h-[calc(100vh-32px)]" : "w-10 h-10 overflow-hidden rounded-full"
                    )}>
                        <Card className="h-full bg-white/95 backdrop-blur-sm shadow-2xl border flex flex-col overflow-hidden">
                             <div className="flex items-center justify-between p-3 border-b bg-muted/30 shrink-0 h-12">
                                {settingsOpen && (
                                    <span className="font-semibold text-sm flex items-center gap-2 truncate">
                                        <Icon icon="tabler:settings" className="w-4 h-4" />
                                        拼图设置
                                        <Badge variant="secondary" className="text-xs h-5 px-1.5">{images.length}</Badge>
                                    </span>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn("h-8 w-8 ml-auto hover:bg-muted", !settingsOpen && "w-full h-full p-0 rounded-full")}
                                    onClick={() => setSettingsOpen(!settingsOpen)}
                                >
                                    <Icon icon={settingsOpen ? "mdi:chevron-left" : "mdi:cog"} className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className={cn(
                                "flex-1 overflow-y-auto custom-scrollbar transition-opacity duration-200",
                                settingsOpen ? "opacity-100 p-4" : "opacity-0 p-0 hidden"
                            )}>
                                {/* Wall & Frame Settings Group */}
                                <div className="space-y-5 mb-6">
                                    {/* Wall Settings */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wall</Label>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted" onClick={randomizeWall} title="Random Color">
                                                <Icon icon="mdi:dice-5" className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                        <div className="flex gap-2">
                                            <div
                                                className="w-8 h-8 rounded border shadow-sm shrink-0"
                                                style={{ backgroundColor: wallColor }}
                                            />
                                            <Input
                                                type="color"
                                                value={wallColor}
                                                onChange={(e) => setWallColor(e.target.value)}
                                                className="flex-1 h-8 px-1"
                                            />
                                        </div>
                                    </div>

                                    {/* Frame Settings */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frame</Label>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted" onClick={randomizeAllFrames} title="Randomize All Frames">
                                                <Icon icon="mdi:dice-multiple" className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex gap-2 items-center">
                                                 <div
                                                    className="w-8 h-8 rounded border shadow-sm shrink-0"
                                                    style={{ backgroundColor: frameColor }}
                                                />
                                                <Input
                                                    type="color"
                                                    value={frameColor}
                                                    onChange={(e) => {
                                                        const color = e.target.value;
                                                        setFrameColor(color);
                                                    }}
                                                    className="flex-1 h-8 px-1"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between pt-1">
                                                <Label className="text-xs text-muted-foreground">Border Width</Label>
                                                <span className="text-xs font-mono">{frameThickness[0]}px</span>
                                            </div>
                                            <Slider
                                                value={frameThickness}
                                                onValueChange={setFrameThickness}
                                                min={0}
                                                max={100}
                                                step={1}
                                                className="py-1"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between pt-1">
                                                <Label className="text-xs text-muted-foreground">Glass Opacity</Label>
                                                <span className="text-xs font-mono">{Math.round(frameOpacity[0] * 100)}%</span>
                                            </div>
                                            <Slider
                                                value={frameOpacity}
                                                onValueChange={setFrameOpacity}
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                className="py-1"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between pt-1">
                                                <Label className="text-xs text-muted-foreground">Corner Radius</Label>
                                                <span className="text-xs font-mono">{radius}px</span>
                                            </div>
                                            <Slider
                                                value={[radius]}
                                                min={0}
                                                max={100}
                                                step={1}
                                                onValueChange={(value) => setRadius(value[0])}
                                                className="py-1"
                                            />
                                        </div>
                                    </div>

                                    {/* Mat Settings */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matting</Label>
                                            <Switch checked={hasMat} onCheckedChange={setHasMat} className="scale-75 origin-right" />
                                        </div>

                                        {hasMat && (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="flex gap-2 items-center">
                                                    <div
                                                        className="w-8 h-8 rounded border shadow-sm shrink-0"
                                                        style={{ backgroundColor: matColor }}
                                                    />
                                                    <Input
                                                        type="color"
                                                        value={matColor}
                                                        onChange={(e) => setMatColor(e.target.value)}
                                                        className="flex-1 h-8 px-1"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between pt-1">
                                                    <Label className="text-xs text-muted-foreground">Size</Label>
                                                    <span className="text-xs font-mono">{matSize[0]}px</span>
                                                </div>
                                                <Slider
                                                    value={matSize}
                                                    onValueChange={setMatSize}
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    className="py-1"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Separator className="my-6" />

                                {/* Layout Settings Group */}
                                <div className="space-y-5 mb-6">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Layout</Label>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">Mode</Label>
                                            <Select value={layout} onValueChange={(value) => setLayout(value as "rows" | "columns" | "masonry")}>
                                                <SelectTrigger className="w-[140px] h-7 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="rows">Row (行)</SelectItem>
                                                    <SelectItem value="columns">Column (列)</SelectItem>
                                                    <SelectItem value="masonry">Masonry</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {layout !== "rows" && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs">Columns</Label>
                                                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{typeof inputColumns === "number" ? inputColumns : "Auto"}</span>
                                            </div>
                                            <Slider
                                                value={[typeof inputColumns === "number" ? inputColumns : 0]}
                                                min={1}
                                                max={15}
                                                step={1}
                                                onValueChange={(value) => setInputColumns(value[0])}
                                                className="py-1"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">Spacing (Gap)</Label>
                                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{margin}px</span>
                                        </div>
                                        <Slider
                                            value={[margin]}
                                            min={0}
                                            max={50}
                                            step={1}
                                            onValueChange={(value) => {
                                                setMargin(value[0]);
                                                debouncedSetMargin(value[0]);
                                            }}
                                            className="py-1"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">Outer Padding</Label>
                                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{outerPadding}px</span>
                                        </div>
                                        <Slider
                                            value={[outerPadding]}
                                            min={0}
                                            max={100}
                                            step={1}
                                            onValueChange={(value) => setOuterPadding(value[0])}
                                            className="py-1"
                                        />
                                    </div>
                                </div>

                                <Separator className="my-6" />

                                {/* View & Export Settings Group */}
                                <div className="space-y-5 mb-6">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-3">View & Export</Label>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">Target Ratio</Label>
                                            <Select value={selectedRatio?.label || "自适应"} onValueChange={(value) => {
                                                if (!value || value === "自适应") {
                                                    setSelectedRatio(null);
                                                    setInputColumns(null);
                                                } else {
                                                    const ratio = aspectRatioOptions.find((r) => r.label === value);
                                                    setSelectedRatio(ratio || null);
                                                    setInputColumns(null);
                                                }
                                            }}>
                                                <SelectTrigger className="w-[140px] h-7 text-xs">
                                                    <SelectValue placeholder="自适应" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="自适应">Auto (自适应)</SelectItem>
                                                    {aspectRatioOptions.map((ratio) => (
                                                        <SelectItem key={ratio.label} value={ratio.label}>{ratio.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Label className="text-xs cursor-help underline decoration-dotted">Export Scale</Label>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Larger scale = higher resolution but slower export</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{inputScale}x</span>
                                        </div>
                                        <Slider
                                            value={[inputScale]}
                                            min={1}
                                            max={10}
                                            step={1}
                                            onValueChange={(value) => setInputScale(value[0])}
                                            className="py-1"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs">Tilt Angle</Label>
                                                <span className="text-xs font-mono text-muted-foreground">{tiltAngle}°</span>
                                            </div>
                                            <Slider
                                                value={[tiltAngle]}
                                                min={-45}
                                                max={45}
                                                step={1}
                                                onValueChange={(value) => setTiltAngle(value[0])}
                                                className="py-1"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs">Tilt Zoom</Label>
                                                <span className="text-xs font-mono text-muted-foreground">{tiltScale}x</span>
                                            </div>
                                            <Slider
                                                value={[tiltScale]}
                                                min={0.6}
                                                max={1.6}
                                                step={0.05}
                                                onValueChange={(value) => setTiltScale(Number(value[0]))}
                                                className="py-1"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs">Vignette Effect</Label>
                                        <Switch checked={vignette} onCheckedChange={setVignette} className="scale-75 origin-right" />
                                    </div>

                                    <div className="space-y-3 pt-2 border-t border-dashed">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">Page Zoom</Label>
                                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{pageScale}x</span>
                                        </div>
                                        <Slider
                                            value={[pageScale]}
                                            min={0.6}
                                            max={1.5}
                                            step={0.05}
                                            onValueChange={(v) => setPageScale(Number(v[0]))}
                                            className="py-1"
                                        />
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <span>Pages: {(!selectedRatio || selectedRatio.width === null) ? 1 : estimatedPages}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span>Preview</span>
                                                <Switch checked={showPagePreview} onCheckedChange={setShowPagePreview} className="scale-75" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator className="my-6" />

                                <div className="grid grid-cols-2 gap-2 pb-4">
                                    <Button className="col-span-2" onClick={downloadImage}>
                                        <Icon icon="mdi:download" className="w-4 h-4 mr-2" />
                                        Download Image
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
                                    >
                                        <Icon icon="mdi:plus" className="w-4 h-4 mr-2" />
                                        Add More
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => {
                                            setImages([]);
                                            setFiles([]);
                                            setIsUpload(false);
                                        }}
                                    >
                                        <Icon icon="mdi:delete" className="w-4 h-4 mr-2" />
                                        Clear
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                    <div style={{ display: "none" }}>
                        <input {...getInputProps()} />
                    </div>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                         <div className="relative min-h-screen">
                            <SortableContext items={images}>
                                <div style={{ position: 'relative', zIndex: 1 }}>
                                    {memoizedPhotoAlbum}
                                </div>
                            </SortableContext>
                        </div>
                        <DragOverlay>
                            {activeId && (
                                <PhotoFrame
                                    overlay
                                    margin={margin}
                                    radius={radius}
                                    frameColor={frameColor}
                                    frameThickness={frameThickness[0]}
                                    hasMat={hasMat}
                                    matColor={matColor}
                                    matSize={matSize[0]}
                                    frameOpacity={frameOpacity[0]}
                                    {...renderedPhotos.current[activeId]}
                                />
                            )}
                        </DragOverlay>
                    </DndContext>
                </div>
            ) : (
                <div className="h-full">
                    <ThreeLanding getRootProps={getRootProps} getInputProps={getInputProps} />
                </div>
            )}
        </div>
    );
};

export default Gallery;
