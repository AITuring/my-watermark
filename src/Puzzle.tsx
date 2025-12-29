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
};
interface ImgProp {
    id: string;
    src: string;
    width: number;
    height: number;
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
        } = props;
        const { alt, style, ...restImageProps } = imageProps;

        return (
            <div
                ref={ref}
                style={{
                    width: overlay ? (wrapperStyle?.width ?? style.width) : style.width,
                    // padding: margin || 0,
                    boxSizing: "border-box",
                    position: "relative",
                    // borderRadius: margin > 2 ? "4px" : 0,
                    // boxShadow: margin > 0
                    // ? "0px 3px 3px -2px rgb(0 0 0 / 20%), 0px 3px 4px 0px rgb(0 0 0 / 24%), 0px 1px 8px 0px rgb(0 0 0 / 22%)"
                    // : "none",
                    transition:
                        "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
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
                <div className="relative w-full h-full">
                    <img
                        alt={alt}
                        style={{
                            ...style,
                            width: "100%",
                            height: "auto",
                            padding: 0,
                            margin: 0,
                            borderRadius: radius || 0,
                            cursor: "zoom-in",
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

                {!overlay && (
                    <div className="opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1 right-1 w-6 h-6 p-0 rounded-full"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete?.(photo.id);
                                        }}
                                    >
                                        <Icon
                                            icon="material-symbols:delete-outline-sharp"
                                            className="w-3 h-3"
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
    // 添加自定义比较函数作为第二个参数
    (prevProps, nextProps) => {
        return (
            prevProps.imageProps.src === nextProps.imageProps.src &&
            prevProps.active === nextProps.active &&
            prevProps.insertPosition === nextProps.insertPosition &&
            prevProps.overlay === nextProps.overlay &&
            prevProps.margin === nextProps.margin && // 添加 margin 比较
            prevProps.radius === nextProps.radius // 添加 radius 比较
        );
    }
);

function SortablePhotoFrame(
    props: SortablePhotoProps & {
        activeIndex?: number;
        onDelete?: (id: UniqueIdentifier) => void;
        margin?: number;
        radius?: number;
    }
) {
    const { photo, activeIndex, onDelete, margin, radius } = props;
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
            {...props}
        />
    );
}

const Puzzle = () => {
    const galleryRef = useRef(null);
    const [files, setFiles] = useState([]);
    const [images, setImages] = useState<ImgProp[]>([]);
    const [spinning, setSpinning] = useState<boolean>(false);

    const [isUpload, setIsUpload] = useState<boolean>(false);
    const [inputColumns, setInputColumns] = useState<number>(3);
    const [inputScale, setInputScale] = useState<number>(6);
    const [margin, setMargin] = useState<number>(0);
    const [radius, setRadius] = useState<number>(0);
    const [layout, setLayout] = useState<"rows" | "masonry" | "columns">(
        "columns"
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
                                newImages.push({
                                    id: src,
                                    src: src,
                                    width: img.width,
                                    height: img.height,
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
        const target = document.getElementById("tilt-wrapper") || document.getElementById("gallery") || document.getElementById("container");

        try {
            const originalCanvas = await html2canvas(target, {
                scale: inputScale,
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#ffffff",
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
            fullCanvas.width = originalCanvas.width + padding * 2;
            fullCanvas.height = originalCanvas.height + padding * 2;
            const fctx = fullCanvas.getContext("2d")!;
            fctx.fillStyle = "#ffffff";
            fctx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
            fctx.drawImage(originalCanvas, padding, padding);

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
                    link.download = "album-long.jpeg";
                    link.click();
                    URL.revokeObjectURL(url);
                    setSpinning(false);
                    toast.success("大图合成成功！");
                }, "image/jpeg", 0.9);
            } else {
                const ratio = selectedRatio.width / selectedRatio.height;
                const pageW = fullCanvas.width;
                const pageH = Math.max(1, Math.round(pageW / ratio));
                const pageSourceH = Math.max(1, Math.round(pageH / Math.max(pageScale, 0.1)));

                const breaksCss = overlayBounds && overlayBounds.length > 0 ? overlayBounds : [];
                const boundaries = [0, ...breaksCss.map(v => Math.round(padding + v * inputScale)), fullCanvas.height];

                const zip = new JSZip();
                const files: {name:string,blob:Blob}[] = [];
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
                    pctx.fillStyle = "#ffffff";
                    pctx.fillRect(0, 0, pageW, pageH);
                    if (sliceH > 0) {
                        const scaleFactor = pageH / Math.max(pageSourceH, 1);
                        const dh = Math.min(pageH, Math.round(sliceH * scaleFactor));
                        const dy = Math.round((pageH - dh) / 2);
                        pctx.drawImage(fullCanvas, 0, prev, fullCanvas.width, sliceH, 0, dy, pageW, dh);
                    }
                    if (vignette) {
                        const g = pctx.createRadialGradient(pageW / 2, pageH / 2, Math.min(pageW, pageH) * 0.45, pageW / 2, pageH / 2, Math.max(pageW, pageH) * 0.6);
                        g.addColorStop(0, "rgba(0,0,0,0)");
                        g.addColorStop(1, "rgba(0,0,0,0.35)");
                        pctx.fillStyle = g;
                        pctx.fillRect(0, 0, pageW, pageH);
                    }
                    await new Promise((r) => requestAnimationFrame(() => r(null)));
                    const blob = (page as any).convertToBlob ? await (page as any).convertToBlob({ type: "image/jpeg", quality: 0.9 }) : await new Promise<Blob | null>((resolve) => page.toBlob(resolve, "image/jpeg", 0.9));
                    if (blob) files.push({ name: `album-${selectedRatio.label}-${files.length + 1}.jpeg`, blob });
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
        <div ref={galleryRef} id="container" style={{ position: 'relative', overflow: 'hidden' }}>
            <div
                id="tilt-wrapper"
                style={{
                    position: 'relative',
                    display: 'inline-block',
                    transform: `rotate(${tiltAngle}deg) scale(${tiltScale})`,
                    transformOrigin: 'center',
                    transition: 'transform 300ms ease',
                    willChange: 'transform',
                }}
            >
                <div
                    {...containerProps}
                    id="gallery"
                    style={{
                        ...(containerProps?.style ?? {}),
                        padding: `${margin}px`,
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
        ]
    );

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
        if (!wrapper) { setEstimatedPages(1); setOverlayBounds([]); return; }
        const rect = wrapper.getBoundingClientRect();
        if (!selectedRatio || selectedRatio.width === null) { setEstimatedPages(1); setOverlayBounds([]); return; }
        const ratio = selectedRatio.width / selectedRatio.height;
        const pageW = rect.width;
        const pageH = pageW / ratio;
        const pageSourceH = pageH / Math.max(pageScale, 0.1);
        const frames = Array.from(wrapper.querySelectorAll('.photo-frame')) as HTMLElement[];
        const bottoms = Array.from(new Set(frames.map(el => el.getBoundingClientRect().bottom - rect.top).filter(v => v > 0))).sort((a,b)=>a-b);
        const snapTolerance = Math.max(12, margin + 8);
        const pages = Math.max(1, Math.ceil((rect.height) / pageSourceH));
        const breaks: number[] = [];
        for (let i = 1; i < pages; i++) {
            const ideal = i * pageSourceH;
            let snapped = ideal;
            for (let j = 0; j < bottoms.length; j++) {
                const b = bottoms[j];
                if (Math.abs(b - ideal) <= snapTolerance) { snapped = b; break; }
            }
            breaks.push(Math.min(Math.max(snapped, 0), rect.height));
        }
        const uniqueBreaks = Array.from(new Set(breaks.map(v => Math.round(v)))).sort((a,b)=>a-b);
        setEstimatedPages(uniqueBreaks.length + 1);
        setOverlayBounds(uniqueBreaks);
    }, [selectedRatio?.width, selectedRatio?.height, tiltAngle, tiltScale, margin, layout, inputColumns, images.length, containerSize.width, containerSize.height, pageScale]);

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
                <div className="album">
                    <Card className="mx-auto max-w-5xl sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border rounded-lg">
                        <CardHeader className="py-1 px-2 sm:py-2 sm:px-3">
                            <CardTitle className="flex items-center gap-1 text-xs sm:text-sm">
                                <Icon icon="tabler:settings" className="w-3 h-3 sm:w-4 sm:h-4" />
                                拼图设置
                                <Badge variant="outline" className="ml-auto text-[10px] sm:text-xs">{images.length} 张</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="py-1 px-2 sm:py-2 sm:px-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 sm:gap-2">
                            <div className="flex items-center gap-1 sm:gap-2 my-1 sm:my-2 text-xs sm:text-sm">
                                <div className="text-xs sm:text-sm">布局方式:</div>
                                <Select value={layout} onValueChange={(value) => setLayout(value as "rows" | "columns" | "masonry")}>
                                    <SelectTrigger className="w-16 sm:w-20 ml-2 h-7 sm:h-8">
                                        <SelectValue placeholder="布局方式" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="rows">行</SelectItem>
                                        <SelectItem value="columns">列</SelectItem>
                                        <SelectItem value="masonry">masonry</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {layout !== "rows" && (
                                <div className="flex items-center gap-1 sm:gap-2 my-1 sm:my-2 text-xs sm:text-sm">
                                    <div className="text-xs sm:text-sm">图片列数:</div>
                                    <Slider
                                        className="w-24 sm:w-28 ml-2"
                                        value={[typeof inputColumns === "number" ? inputColumns : 0]}
                                        min={0}
                                        max={15}
                                        step={1}
                                        onValueChange={(value) => setInputColumns(value[0])}
                                    />
                                    <input
                                        type="number"
                                        className="w-12 sm:w-14 ml-2 border rounded px-1 py-0.5 text-xs sm:text-sm"
                                        min={0}
                                        max={15}
                                        value={typeof inputColumns === "number" ? inputColumns : 0}
                                        onChange={(e) => setInputColumns(Number(e.target.value))}
                                    />
                                </div>
                            )}
                            <div className="flex items-center gap-1 sm:gap-2 my-1 sm:my-2 text-xs sm:text-sm">
                                <div className="text-xs sm:text-sm">图片间距:</div>
                                <Slider
                                    className="w-24 sm:w-28 ml-2"
                                    value={[margin]}
                                    min={0}
                                    max={50}
                                    step={1}
                                    onValueChange={(value) => {
                                        setMargin(value[0]);
                                        debouncedSetMargin(value[0]);
                                    }}
                                />
                                <input
                                    type="number"
                                    className="w-12 sm:w-14 ml-2 border rounded px-1 py-0.5 text-xs sm:text-sm"
                                    min={0}
                                    max={50}
                                    value={margin}
                                    onChange={(e) => {
                                        const v = Number(e.target.value);
                                        setMargin(v);
                                        debouncedSetMargin(v);
                                    }}
                                />
                            </div>
                            {margin > 0 && (
                                <div className="flex items-center gap-1 sm:gap-2 my-1 sm:my-2 text-xs sm:text-sm">
                                    <div className="text-xs sm:text-sm">图片圆角:</div>
                                    <Slider
                                        className="w-24 sm:w-28 ml-2"
                                        value={[radius]}
                                        min={0}
                                        max={50}
                                        step={1}
                                        onValueChange={(value) => setRadius(value[0])}
                                    />
                                    <input
                                        type="number"
                                        className="w-12 sm:w-14 ml-2 border rounded px-1 py-0.5 text-xs sm:text-sm"
                                        min={0}
                                        max={50}
                                        value={radius}
                                        onChange={(e) => setRadius(Number(e.target.value))}
                                    />
                                </div>
                            )}
                            <div className="flex items-center gap-1 sm:gap-2 my-1 sm:my-2 text-xs sm:text-sm">
                                <div className="text-xs sm:text-sm">生成图片长宽比:</div>
                                <Select value={selectedRatio?.label} onValueChange={(value) => {
                                    if (!value || value === "自适应") {
                                        setSelectedRatio(null);
                                        setInputColumns(null);
                                    } else {
                                        const ratio = aspectRatioOptions.find((r) => r.label === value);
                                        setSelectedRatio(ratio || null);
                                        setInputColumns(null);
                                    }
                                }}>
                                    <SelectTrigger className="w-20 ml-2 h-7 sm:h-8">
                                        <SelectValue placeholder="自适应" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="自适应">自适应</SelectItem>
                                        {aspectRatioOptions.map((ratio) => (
                                            <SelectItem key={ratio.label} value={ratio.label}>{ratio.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* <div className="flex items-center gpa-4 my-4">
                                        <div>画框宽度:</div>
                                        <InputNumber
                                            className="w-16 ml-4"
                                            min={1}
                                            max={50}
                                            onChange={(value) =>
                                                setPadding(value)
                                            }
                                            value={Number(padding)}
                                        />
                                    </div> */}
                            <div className="flex items-center gap-1 sm:gap-2 my-1 sm:my-2 text-xs sm:text-sm">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="cursor-help text-xs sm:text-sm">导出图片规模:</div>
                                        </TooltipTrigger>
                                        <TooltipContent>规模越大，导出图片尺寸越大，导出更加耗时</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                <Slider
                                    className="w-24 sm:w-28 ml-2"
                                    value={[inputScale]}
                                    min={1}
                                    max={10}
                                    step={1}
                                    onValueChange={(value) => setInputScale(value[0])}
                                />
                                <input
                                    type="number"
                                    className="w-12 sm:w-14 ml-2 border rounded px-1 py-0.5 text-xs sm:text-sm"
                                    min={1}
                                    max={10}
                                    value={inputScale}
                                    onChange={(e) => setInputScale(Number(e.target.value))}
                                />
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 my-1 sm:my-2 text-xs sm:text-sm">
                                <div className="text-xs sm:text-sm">倾斜角度:</div>
                                <Slider
                                    className="w-24 sm:w-28 ml-2"
                                    value={[tiltAngle]}
                                    min={-45}
                                    max={45}
                                    step={1}
                                    onValueChange={(value) => setTiltAngle(value[0])}
                                />
                                <input
                                    type="number"
                                    className="w-12 sm:w-14 ml-2 border rounded px-1 py-0.5 text-xs sm:text-sm"
                                    min={-45}
                                    max={45}
                                    value={tiltAngle}
                                    onChange={(e) => setTiltAngle(Number(e.target.value))}
                                />
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 my-1 sm:my-2 text-xs sm:text-sm">
                                <div className="text-xs sm:text-sm">缩放:</div>
                                <Slider
                                    className="w-24 sm:w-28 ml-2"
                                    value={[tiltScale]}
                                    min={0.6}
                                    max={1.6}
                                    step={0.05}
                                    onValueChange={(value) => setTiltScale(Number(value[0]))}
                                />
                                <input
                                    type="number"
                                    className="w-12 sm:w-14 ml-2 border rounded px-1 py-0.5 text-xs sm:text-sm"
                                    min={0.6}
                                    max={1.6}
                                    step={0.05}
                                    value={tiltScale}
                                    onChange={(e) => setTiltScale(Number(e.target.value))}
                                />
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 my-1 sm:my-2 text-xs sm:text-sm">
                                <div className="text-xs sm:text-sm">暗角:</div>
                                <Switch checked={vignette} onCheckedChange={setVignette} />
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 my-1 sm:my-2 text-xs sm:text-sm">
                                <div className="text-xs sm:text-sm">每页内容缩放:</div>
                                <Slider
                                    className="w-24 sm:w-28 ml-2"
                                    value={[pageScale]}
                                    min={0.6}
                                    max={1.5}
                                    step={0.05}
                                    onValueChange={(v) => setPageScale(Number(v[0]))}
                                />
                                <input
                                    type="number"
                                    className="w-12 sm:w-14 ml-2 border rounded px-1 py-0.5 text-xs sm:text-sm"
                                    min={0.6}
                                    max={1.5}
                                    step={0.05}
                                    value={pageScale}
                                    onChange={(e) => setPageScale(Number(e.target.value))}
                                />
                                <Badge variant="outline" className="ml-2">预估页数: {(!selectedRatio || selectedRatio.width === null) ? 1 : estimatedPages}</Badge>
                                <div className="ml-3 flex items-center gap-2"><span>分页预览:</span><Switch checked={showPagePreview} onCheckedChange={setShowPagePreview} /></div>
                            </div>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex flex-wrap items-center gap-8 justify-center">
                            <Button size="sm" onClick={downloadImage}>下载大图</Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                    (
                                        document.querySelector(
                                            'input[type="file"]'
                                        ) as HTMLInputElement
                                    )?.click()
                                }
                            >
                                继续添加
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                    setImages([]);
                                    setFiles([]);
                                    setIsUpload(false);
                                }}
                            >
                                清空
                            </Button>
                        </div>
                        </CardContent>
                    </Card>
                    <div style={{ display: "none" }}>
                        <input {...getInputProps()} />
                    </div>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={images}>
                            <div style={{ margin: 30 }}>
                                {memoizedPhotoAlbum}
                            </div>
                        </SortableContext>
                        <DragOverlay>
                            {activeId && (
                                <PhotoFrame
                                    overlay
                                    margin={margin}
                                    radius={radius}
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

export default Puzzle;
