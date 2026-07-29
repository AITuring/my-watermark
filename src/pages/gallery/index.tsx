import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Icon } from "@iconify/react";
import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    DragOverlay,
    type DragStartEvent,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    type UniqueIdentifier,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useDebouncedCallback } from "use-debounce";
import PhotoAlbum, {
    type RenderContainerProps,
    type RenderImageContext,
} from "react-photo-album";

import "react-photo-album/styles.css";
import "@/puzzle.css";

import ImagePreview from "@/components/ImagePreview";
import ThreeLanding from "@/components/ThreeLanding";
import { aspectRatioOptions, getRandomColor } from "./constants";
import {
    calculateOverlayPagination,
    exportGalleryImage,
    getColumnsForRatioLabel,
    getIdealColumnsFromContainer,
    prepareImagesFromFiles,
} from "./helpers";
import { GalleryCanvasContainer } from "./components/GalleryCanvasContainer";
import { GallerySettingsPanel } from "./components/GallerySettingsPanel";
import {
    getPhotoFrameColor,
    PhotoFrame,
    SortablePhotoFrame,
} from "./components/PhotoFrame";
import type {
    AspectRatio,
    GalleryImageProps,
    GalleryLayout,
    ImgProp,
    SortablePhotoProps,
} from "./types";

const Gallery = () => {
    const galleryRef = useRef<HTMLDivElement | null>(null);
    const renderedPhotos = useRef<Record<string, SortablePhotoProps>>({});

    const [files, setFiles] = useState<File[]>([]);
    const [images, setImages] = useState<ImgProp[]>([]);
    const [spinning, setSpinning] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(true);

    const [wallColor, setWallColor] = useState("#e0e0e0");
    const [frameColor, setFrameColor] = useState("#4a3728");
    const [frameThickness, setFrameThickness] = useState([20]);
    const [hasMat, setHasMat] = useState(true);
    const [matColor, setMatColor] = useState("#f0f0f0");
    const [matSize, setMatSize] = useState([30]);
    const [frameOpacity, setFrameOpacity] = useState([0.6]);

    const [isUpload, setIsUpload] = useState(false);
    const [inputColumns, setInputColumns] = useState<number | null>(3);
    const [inputScale, setInputScale] = useState(6);
    const [margin, setMargin] = useState(30);
    const [outerPadding, setOuterPadding] = useState(30);
    const [radius, setRadius] = useState(0);
    const [layout, setLayout] = useState<GalleryLayout>("masonry");

    const [selectedRatio, setSelectedRatio] = useState<AspectRatio | null>(null);
    const [tiltAngle, setTiltAngle] = useState(0);
    const [tiltScale, setTiltScale] = useState(1);
    const [vignette, setVignette] = useState(true);
    const [pageScale, setPageScale] = useState(1);
    const [estimatedPages, setEstimatedPages] = useState(1);
    const [showPagePreview, setShowPagePreview] = useState(true);
    const [overlayBounds, setOverlayBounds] = useState<number[]>([]);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [activeId, setActiveId] = useState<UniqueIdentifier>();

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

    useEffect(() => {
        setWallColor(getRandomColor());
    }, []);

    const handleDragStart = useCallback(
        ({ active }: DragStartEvent) => setActiveId(active.id),
        []
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setImages((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = [...items];

                [newItems[oldIndex], newItems[newIndex]] = [
                    newItems[newIndex],
                    newItems[oldIndex],
                ];

                return newItems;
            });
        }

        setActiveId(undefined);
    }, []);

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
    );

    const renderImage = useCallback(
        (imageProps: GalleryImageProps, ctx: RenderImageContext<ImgProp>) => {
            const photoProps: SortablePhotoProps = {
                photo: ctx.photo,
                imageProps,
                index: ctx.index,
                onPreview: (index: number) => {
                    setPreviewIndex(index ?? 0);
                    setPreviewOpen(true);
                },
            };

            renderedPhotos.current[String(ctx.photo.id)] = photoProps;

            return (
                <SortablePhotoFrame
                    activeIndex={activeIndex}
                    onDelete={handleDelete}
                    margin={margin}
                    radius={radius}
                    frameColor={getPhotoFrameColor(ctx.photo, frameColor)}
                    frameThickness={frameThickness[0]}
                    hasMat={hasMat}
                    matColor={matColor}
                    matSize={matSize[0]}
                    frameOpacity={frameOpacity[0]}
                    {...photoProps}
                />
            );
        },
        [
            activeIndex,
            handleDelete,
            margin,
            radius,
            frameColor,
            frameThickness,
            hasMat,
            matColor,
            matSize,
            frameOpacity,
        ]
    );

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
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

            try {
                const newImages = await prepareImagesFromFiles(acceptedFiles);
                setFiles((prev) => [...prev, ...acceptedFiles]);
                setImages((prev) => [...prev, ...newImages]);

                if (!isUpload) {
                    setIsUpload(true);
                }
            } catch (error) {
                toast.error(`图片处理失败: ${(error as Error).message}`, {
                    position: "top-center",
                });
            } finally {
                setSpinning(false);
            }
        },
        [isUpload]
    );

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".jpeg", ".jpg", ".png"],
        },
        maxSize: 100 * 1024 * 1024,
        onDropRejected: () => {
            toast.error("图片大小不能超过200MB", { position: "top-center" });
        },
    });

    const downloadImage = useCallback(async () => {
        setSpinning(true);

        try {
            const result = await exportGalleryImage({
                filesLength: files.length,
                inputScale,
                selectedRatio,
                vignette,
                overlayBounds,
                outerPadding,
                wallColor,
            });

            if (result.isZip) {
                toast.success(`已打包导出 ${result.exportedCount} 张`);
            } else {
                toast.success("大图合成成功！");
            }
        } catch (error) {
            if (error instanceof Error && error.message === "请选择图片") {
                toast.error(error.message, { position: "top-center" });
            } else {
                toast.error("导出失败，请重试", { position: "top-center" });
            }
        } finally {
            setSpinning(false);
        }
    }, [
        files.length,
        inputScale,
        selectedRatio,
        vignette,
        overlayBounds,
        outerPadding,
        wallColor,
    ]);

    const renderContainer = useCallback(
        (containerProps: RenderContainerProps) => (
            <GalleryCanvasContainer
                containerProps={containerProps}
                galleryRef={galleryRef}
                wallColor={wallColor}
                tiltAngle={tiltAngle}
                tiltScale={tiltScale}
                outerPadding={outerPadding}
                showPagePreview={showPagePreview}
                selectedRatio={selectedRatio}
                overlayBounds={overlayBounds}
                vignette={vignette}
            />
        ),
        [
            wallColor,
            tiltAngle,
            tiltScale,
            outerPadding,
            showPagePreview,
            selectedRatio,
            overlayBounds,
            vignette,
        ]
    );

    const debouncedSetMargin = useDebouncedCallback((value: number) => {
        setMargin(value);
    }, 300);

    const memoizedPhotoAlbum = useMemo(
        () => (
            <>
                <PhotoAlbum
                    layout={layout}
                    photos={images}
                    padding={0}
                    spacing={margin}
                    columns={inputColumns ?? undefined}
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
            previewIndex,
            previewOpen,
        ]
    );

    const randomizeWall = useCallback(() => {
        setWallColor(getRandomColor());
    }, []);

    const randomizeAllFrames = useCallback(() => {
        setImages((prev) =>
            prev.map((img) => ({
                ...img,
                frameColor: getRandomColor(),
            }))
        );
    }, []);

    const handleRatioChange = useCallback((value: string) => {
        if (!value || value === "自适应") {
            setSelectedRatio(null);
            setInputColumns(null);
            return;
        }

        const ratio = aspectRatioOptions.find((item) => item.label === value);
        setSelectedRatio(ratio || null);
        setInputColumns(null);
    }, []);

    useEffect(() => {
        const container = galleryRef.current;
        if (!container) {
            return;
        }

        const resizeObserver = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            setContainerSize({ width, height });
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        const idealColumns = getIdealColumnsFromContainer({
            containerWidth: containerSize.width,
            containerHeight: containerSize.height,
            selectedRatio,
            imageCount: images.length,
        });

        if (!idealColumns) {
            return;
        }

        const currentRatio = containerSize.width / containerSize.height;
        const targetRatio = selectedRatio!.width! / selectedRatio!.height!;
        console.log(
            "Layout adjustment - Current ratio:",
            currentRatio,
            "Target ratio:",
            targetRatio
        );

        if (idealColumns !== inputColumns) {
            console.log("Adjusting columns from", inputColumns, "to", idealColumns);
            setInputColumns(idealColumns);
        }
    }, [
        containerSize.width,
        containerSize.height,
        selectedRatio,
        images.length,
        inputColumns,
    ]);

    useEffect(() => {
        if (!selectedRatio?.width || !images.length || inputColumns !== null) {
            return;
        }

        const newColumns = getColumnsForRatioLabel({
            selectedRatio,
            imageCount: images.length,
        });

        if (newColumns === null) {
            return;
        }

        console.log(
            `Adjusting layout for ${selectedRatio.label} - New columns:`,
            newColumns
        );
        setInputColumns(newColumns);
    }, [selectedRatio, images.length, inputColumns]);

    useEffect(() => {
        const pagination = calculateOverlayPagination({
            selectedRatio,
            outerPadding,
            pageScale,
        });

        setEstimatedPages(pagination.estimatedPages);
        setOverlayBounds(pagination.overlayBounds);
    }, [
        selectedRatio,
        tiltAngle,
        tiltScale,
        outerPadding,
        layout,
        inputColumns,
        images.length,
        containerSize.width,
        containerSize.height,
        pageScale,
    ]);

    console.log(inputColumns, selectedRatio);

    return (
        <div className="h-[calc(100vh-56px)]">
            {spinning ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="flex flex-col items-center">
                        <Icon
                            icon="line-md:speedometer-loop"
                            className="text-white mt-2"
                        />
                        <p className="mt-2 text-white">正在处理...</p>
                    </div>
                </div>
            ) : isUpload ? (
                <div className="relative w-full min-h-screen">
                    <GallerySettingsPanel
                        settingsOpen={settingsOpen}
                        onToggleOpen={() => setSettingsOpen(!settingsOpen)}
                        imagesCount={images.length}
                        wallColor={wallColor}
                        onWallColorChange={setWallColor}
                        onRandomizeWall={randomizeWall}
                        frameColor={frameColor}
                        onFrameColorChange={setFrameColor}
                        onRandomizeAllFrames={randomizeAllFrames}
                        frameThickness={frameThickness}
                        onFrameThicknessChange={setFrameThickness}
                        frameOpacity={frameOpacity}
                        onFrameOpacityChange={setFrameOpacity}
                        radius={radius}
                        onRadiusChange={setRadius}
                        hasMat={hasMat}
                        onHasMatChange={setHasMat}
                        matColor={matColor}
                        onMatColorChange={setMatColor}
                        matSize={matSize}
                        onMatSizeChange={setMatSize}
                        layout={layout}
                        onLayoutChange={setLayout}
                        inputColumns={inputColumns}
                        onInputColumnsChange={setInputColumns}
                        margin={margin}
                        onMarginChange={(value) => {
                            setMargin(value);
                            debouncedSetMargin(value);
                        }}
                        outerPadding={outerPadding}
                        onOuterPaddingChange={setOuterPadding}
                        selectedRatioLabel={selectedRatio?.label || "自适应"}
                        onRatioChange={handleRatioChange}
                        aspectRatioOptions={aspectRatioOptions}
                        inputScale={inputScale}
                        onInputScaleChange={setInputScale}
                        tiltAngle={tiltAngle}
                        onTiltAngleChange={setTiltAngle}
                        tiltScale={tiltScale}
                        onTiltScaleChange={setTiltScale}
                        vignette={vignette}
                        onVignetteChange={setVignette}
                        pageScale={pageScale}
                        onPageScaleChange={setPageScale}
                        estimatedPages={
                            !selectedRatio || selectedRatio.width === null
                                ? 1
                                : estimatedPages
                        }
                        showPagePreview={showPagePreview}
                        onShowPagePreviewChange={setShowPagePreview}
                        onDownload={downloadImage}
                        onAddMore={() =>
                            (
                                document.querySelector(
                                    'input[type="file"]'
                                ) as HTMLInputElement | null
                            )?.click()
                        }
                        onClear={() => {
                            setImages([]);
                            setFiles([]);
                            setIsUpload(false);
                        }}
                    />
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
                                <div style={{ position: "relative", zIndex: 1 }}>
                                    {memoizedPhotoAlbum}
                                </div>
                            </SortableContext>
                        </div>
                        <DragOverlay>
                            {activeId && renderedPhotos.current[String(activeId)] && (
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
                                    {...renderedPhotos.current[String(activeId)]}
                                />
                            )}
                        </DragOverlay>
                    </DndContext>
                </div>
            ) : (
                <div className="h-full">
                    <ThreeLanding
                        getRootProps={getRootProps}
                        getInputProps={getInputProps}
                    />
                </div>
            )}
        </div>
    );
};

export default Gallery;
