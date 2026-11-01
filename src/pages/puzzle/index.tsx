import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
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
    type RenderImageProps,
} from "react-photo-album";
import "react-photo-album/styles.css";
import { Icon } from "@iconify/react";

import ImagePreview from "@/components/ImagePreview";
import ThreeLanding from "@/components/ThreeLanding";
import { consumePendingCropTransfer } from "@/utils/crop-transfer";

import { PuzzlePhotoFrame, SortablePuzzlePhotoFrame } from "./components/PuzzlePhotoFrame";
import { PuzzleSettingsCard } from "./components/PuzzleSettingsCard";
import type {
    AspectRatio,
    ImgProp,
    PuzzleLayout,
    SortablePhotoProps,
} from "./types";
import {
    calculateOverlayBounds,
    downloadPuzzleImage,
    findAspectRatioByLabel,
    getAutoColumnsByContainerRatio,
    getAutoColumnsBySelectedRatio,
    processAcceptedFiles,
    swapImagesById,
} from "./utils";

const tiltAngle = 0;
const tiltScale = 1;
const pageScale = 1;

const Puzzle = () => {
    const galleryRef = useRef<HTMLDivElement | null>(null);
    const renderedPhotos = useRef<Record<string, SortablePhotoProps>>({});
    const restoredPendingTransferRef = useRef(false);
    const importingRef = useRef(false);
    const previewUrlsRef = useRef(new Set<string>());
    useEffect(() => () => {
        for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
        previewUrlsRef.current.clear();
    }, []);

    const [files, setFiles] = useState<File[]>([]);
    const [images, setImages] = useState<ImgProp[]>([]);
    const [spinning, setSpinning] = useState(false);
    const [importProgress, setImportProgress] = useState("");
    const [isUpload, setIsUpload] = useState(false);
    const [inputColumns, setInputColumns] = useState<number | null>(3);
    const [inputScale, setInputScale] = useState(6);
    const [margin, setMargin] = useState(0);
    const [radius, setRadius] = useState(0);
    const [layout, setLayout] = useState<PuzzleLayout>("columns");
    const [selectedRatio, setSelectedRatio] = useState<AspectRatio | null>(null);
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

    const handleDragStart = useCallback(
        ({ active }: DragStartEvent) => setActiveId(active.id),
        []
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setImages((currentImages) =>
                swapImagesById(
                    currentImages,
                    String(active.id),
                    String(over.id)
                )
            );
        }

        setActiveId(undefined);
    }, []);

    const handleDelete = useCallback(
        (id: UniqueIdentifier) => {
            const imageIndex = images.findIndex((image) => image.id === id);
            if (imageIndex < 0) {
                return;
            }

            URL.revokeObjectURL(images[imageIndex].src);
            previewUrlsRef.current.delete(images[imageIndex].src);
            setImages((prevImages) =>
                prevImages.filter((image) => image.id !== id)
            );
            setFiles((prevFiles) =>
                prevFiles.filter((_, index) => index !== imageIndex)
            );
        },
        [images]
    );

    const renderImage = useCallback(
        (
            imageProps: RenderImageProps,
            context: RenderImageContext<ImgProp>
        ) => {
            const renderedPhotoProps: SortablePhotoProps = {
                photo: context?.photo,
                imageProps,
                index: context?.index,
                onPreview: (index: number) => {
                    setPreviewIndex(index ?? 0);
                    setPreviewOpen(true);
                },
            };

            renderedPhotos.current[String(renderedPhotoProps.photo.id)] =
                renderedPhotoProps;

            return (
                <SortablePuzzlePhotoFrame
                    activeIndex={activeIndex}
                    onDelete={handleDelete}
                    margin={margin}
                    radius={radius}
                    {...renderedPhotoProps}
                />
            );
        },
        [activeIndex, handleDelete, margin, radius]
    );

    const renderContainer = useCallback(
        (containerProps: RenderContainerProps) => (
            <div
                ref={galleryRef}
                id="container"
                style={{ position: "relative", overflow: "hidden" }}
            >
                <div
                    id="tilt-wrapper"
                    style={{
                        position: "relative",
                        display: "inline-block",
                        transform: `rotate(${tiltAngle}deg) scale(${tiltScale})`,
                        transformOrigin: "center",
                        transition: "transform 300ms ease",
                        willChange: "transform",
                    }}
                >
                    <div
                        {...containerProps}
                        id="gallery"
                        style={{
                            ...(containerProps?.style ?? {}),
                            padding: `${margin}px`,
                            boxSizing: "border-box",
                        }}
                    >
                        {containerProps?.children}
                    </div>
                </div>
            </div>
        ),
        [margin]
    );

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            if (importingRef.current) {
                toast.info("正在导入，请等待当前批次完成");
                return;
            }
            importingRef.current = true;
            setSpinning(true);
            const progressId = toast.loading("正在准备导入图片");
            try {
                for (const [index, file] of acceptedFiles.entries()) {
                    const message = `正在导入 ${index + 1}/${acceptedFiles.length}：${file.name}`;
                    setImportProgress(message);
                    toast.loading(message, { id: progressId });
                    try {
                        const newImages = await processAcceptedFiles([file]);
                        for (const image of newImages) previewUrlsRef.current.add(image.src);
                        setFiles((prev) => [...prev, file]);
                        setImages((prev) => [...prev, ...newImages]);
                        setIsUpload(true);
                    } catch (error) {
                        toast.error(`${file.name}：${(error as Error).message}`, { duration: 8000 });
                    }
                }
            } finally {
                toast.dismiss(progressId);
                setImportProgress("");
                importingRef.current = false;
                setSpinning(false);
            }
        },
        []
    );

    useEffect(() => {
        if (restoredPendingTransferRef.current) return;
        restoredPendingTransferRef.current = true;
        void consumePendingCropTransfer("puzzle").then((incomingFiles) => {
            if (incomingFiles.length) {
                void onDrop(incomingFiles);
            }
        });
    }, [onDrop]);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"],
        },
        maxSize: 2 * 1024 * 1024 * 1024,
        onDropRejected: () => {
            toast.error("文件超过本地处理上限", { position: "top-center" });
        },
    });

    const handleDownload = useCallback(async () => {
        setSpinning(true);

        try {
            const { pageCount } = await downloadPuzzleImage({
                filesCount: files.length,
                inputScale,
                selectedRatio,
                overlayBounds,
                pageScale,
            });

            if (!selectedRatio || selectedRatio.width === null) {
                toast.success("大图合成成功！");
            } else {
                toast.success(`已打包导出 ${pageCount} 张`);
            }
        } catch (error) {
            const errorMessage = (error as Error).message;

            if (errorMessage === "请选择图片") {
                toast.error(errorMessage, { position: "top-center" });
            } else {
                console.error("Download failed:", error);
                toast.error("导出失败，请重试", { position: "top-center" });
            }
        } finally {
            setSpinning(false);
        }
    }, [files.length, inputScale, selectedRatio, overlayBounds]);

    const debouncedSetMargin = useDebouncedCallback((value: number) => {
        setMargin(value);
    }, 300);

    const handleMarginChange = useCallback(
        (value: number) => {
            setMargin(value);
            debouncedSetMargin(value);
        },
        [debouncedSetMargin]
    );

    const handleRatioChange = useCallback((value: string) => {
        setSelectedRatio(findAspectRatioByLabel(value));
        setInputColumns(null);
    }, []);

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
                    images={images.map((image) => image.src)}
                    currentIndex={previewIndex}
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                />
            </>
        ),
        [
            images,
            inputColumns,
            layout,
            margin,
            previewIndex,
            previewOpen,
            renderContainer,
            renderImage,
        ]
    );

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
        if (!selectedRatio?.width || !containerSize.width || !images.length) {
            return;
        }

        const currentRatio = containerSize.width / containerSize.height;
        const targetRatio = selectedRatio.width / selectedRatio.height;
        console.log(
            "Layout adjustment - Current ratio:",
            currentRatio,
            "Target ratio:",
            targetRatio
        );

        const idealColumns = getAutoColumnsByContainerRatio(
            currentRatio,
            targetRatio,
            images.length
        );

        if (idealColumns !== inputColumns) {
            console.log("Adjusting columns from", inputColumns, "to", idealColumns);
            setInputColumns(idealColumns);
        }
    }, [
        containerSize.height,
        containerSize.width,
        images.length,
        inputColumns,
        selectedRatio?.height,
        selectedRatio?.width,
    ]);

    useEffect(() => {
        if (!selectedRatio?.width || !images.length || inputColumns !== null) {
            return;
        }

        const newColumns = getAutoColumnsBySelectedRatio(
            selectedRatio.label,
            images.length
        );

        console.log(
            `Adjusting layout for ${selectedRatio.label} - New columns:`,
            newColumns
        );
        setInputColumns(newColumns);
    }, [
        images.length,
        inputColumns,
        selectedRatio?.height,
        selectedRatio?.label,
        selectedRatio?.width,
    ]);

    useEffect(() => {
        const wrapper = document.getElementById("tilt-wrapper") as HTMLElement | null;
        if (!wrapper) {
            setOverlayBounds([]);
            return;
        }

        setOverlayBounds(
            calculateOverlayBounds({
                wrapper,
                selectedRatio,
                margin,
                pageScale,
            })
        );
    }, [
        containerSize.height,
        containerSize.width,
        images.length,
        inputColumns,
        layout,
        margin,
        selectedRatio?.height,
        selectedRatio?.width,
    ]);

    console.log(inputColumns, selectedRatio);

    return (
        <div className="h-[calc(100vh-56px)]">
            {spinning ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="flex flex-col items-center">
                        <Icon icon="line-md:speedometer-loop" className="text-white mt-2" />
                        <p className="mt-2 max-w-xl break-all px-4 text-center text-white">{importProgress || "正在处理..."}</p>
                    </div>
                </div>
            ) : isUpload ? (
                <div className="album">
                    <PuzzleSettingsCard
                        imagesCount={images.length}
                        layout={layout}
                        inputColumns={inputColumns}
                        margin={margin}
                        radius={radius}
                        inputScale={inputScale}
                        selectedRatio={selectedRatio}
                        onLayoutChange={setLayout}
                        onInputColumnsChange={setInputColumns}
                        onMarginChange={handleMarginChange}
                        onRadiusChange={setRadius}
                        onInputScaleChange={setInputScale}
                        onRatioChange={handleRatioChange}
                        onDownload={handleDownload}
                        onAddMore={() =>
                            (
                                document.querySelector(
                                    'input[type="file"]'
                                ) as HTMLInputElement | null
                            )?.click()
                        }
                        onClear={() => {
                            for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
                            previewUrlsRef.current.clear();
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
                        <SortableContext items={images}>
                            <div style={{ margin: 30 }}>{memoizedPhotoAlbum}</div>
                        </SortableContext>

                        <DragOverlay>
                            {activeId && renderedPhotos.current[String(activeId)] ? (
                                <PuzzlePhotoFrame
                                    overlay
                                    margin={margin}
                                    radius={radius}
                                    {...renderedPhotos.current[String(activeId)]}
                                />
                            ) : null}
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

export default Puzzle;
