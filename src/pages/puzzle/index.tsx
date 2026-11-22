import { FixedRatioPreview } from "./components/FixedRatioPreview";
import { recommendColumns } from "./fixed-ratio";
import { SimilarPhotoDialog } from "./components/SimilarPhotoDialog";
import { groupSimilarPhotos, readPhotoSignature, photoPairKey, type SimilarPhotoGroup, type PhotoSignature } from "./similar-photos";
import { isPuzzleImageFile, isPuzzleSidecar } from "./import-files";
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
    downloadPuzzleImage,
    findAspectRatioByLabel,
    processAcceptedFiles,
    swapImagesById,
} from "./utils";

const tiltAngle = 0;
const tiltScale = 1;

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
    const imagesRef = useRef<ImgProp[]>([]);
    useEffect(() => { imagesRef.current = images; }, [images]);
    const signatures = useRef(new Map<string, PhotoSignature | null>());
    const reviewedPairs = useRef(new Set<string>());
    const [similarGroups, setSimilarGroups] = useState<SimilarPhotoGroup[]>([]);
    const finishSimilarReview = (removed: Set<string>) => {
        for (const group of similarGroups) for (let a = 0; a < group.photos.length; a++) for (let b = a + 1; b < group.photos.length; b++) reviewedPairs.current.add(photoPairKey(group.photos[a].id, group.photos[b].id));
        const next = imagesRef.current.filter((photo) => !removed.has(photo.id));
        imagesRef.current.filter((photo) => removed.has(photo.id)).forEach((photo) => { URL.revokeObjectURL(photo.src); previewUrlsRef.current.delete(photo.src); signatures.current.delete(photo.id); });
        imagesRef.current = next;
        setImages(next); setFiles(next.flatMap((photo) => photo.sourceFile ? [photo.sourceFile] : []));
        setSimilarGroups([]);
        if (removed.size) toast.success(`已从拼图排除 ${removed.size} 张同件候选，原文件未改动`);
    };
    const [spinning, setSpinning] = useState(false);
    const [importProgress, setImportProgress] = useState("");
    const [isUpload, setIsUpload] = useState(false);
    const [inputColumns, setInputColumns] = useState<number | null>(3);
    const [inputScale, setInputScale] = useState(6);
    const [margin, setMargin] = useState(8);
    const [radius, setRadius] = useState(0);
    const [layout, setLayout] = useState<PuzzleLayout>("columns");
    const [selectedRatio, setSelectedRatio] = useState<AspectRatio | null>(null);
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
            setFiles(images.filter((image) => image.id !== id).flatMap((image) => image.sourceFile ? [image.sourceFile] : []));
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
            const photoFiles = acceptedFiles.filter(isPuzzleImageFile).sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true, sensitivity: "base" }));
            const unsupported = acceptedFiles.filter((file) => !isPuzzleSidecar(file.name) && !isPuzzleImageFile(file));
            if (unsupported.length) toast.error(`${unsupported.length} 个文件格式不支持，请选择 JPEG、PNG、TIFF 或 WebP`);
            if (!photoFiles.length) {
                if (!unsupported.length) toast.info("没有可导入的照片，已忽略 macOS 元数据伴随文件");
                return;
            }
            importingRef.current = true;
            setSpinning(true);
            const progressId = toast.loading("正在准备导入图片");
            const imported: ImgProp[] = [];
            const previousImages = [...imagesRef.current];
            try {
                for (const [index, file] of photoFiles.entries()) {
                    const message = `正在导入 ${index + 1}/${photoFiles.length}：${file.name}`;
                    setImportProgress(message);
                    toast.loading(message, { id: progressId });
                    try {
                        const newImages = await processAcceptedFiles([file]);
                        for (const image of newImages) {
                            previewUrlsRef.current.add(image.src);
                            signatures.current.set(image.id, await readPhotoSignature(image));
                            imported.push(image);
                        }
                        setFiles((prev) => [...prev, file]);
                        setImages((prev) => [...prev, ...newImages]);
                        setIsUpload(true);
                    } catch (error) {
                        toast.error(`${file.name}：${(error as Error).message}`, { duration: 8000 });
                    }
                }
                const allImages = [...previousImages, ...imported];
                imagesRef.current = allImages;
                setSimilarGroups(groupSimilarPhotos(allImages.map((photo) => ({ photo, signature: signatures.current.get(photo.id) ?? null })), reviewedPairs.current));
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

    const { getRootProps, getInputProps, open: openPhotoPicker } = useDropzone({
        onDrop,
        // Let the native picker show all files; validate selected filenames in onDrop.
        // macOS may otherwise disable valid images with stale or missing type metadata.
        useFsAccessApi: false,
        maxSize: 2 * 1024 * 1024 * 1024,
        onDropRejected: (rejections) => {
            const tooLarge = rejections.some(({ errors }) => errors.some((error) => error.code === "file-too-large"));
            toast.error(tooLarge ? "单个文件不能超过 2 GB" : "文件无法导入，请重新选择", { position: "top-center" });
        },
    });

    const handleDownload = useCallback(async () => {
        setSpinning(true);

        try {
            const { pageCount } = await downloadPuzzleImage({
                filesCount: files.length,
                inputScale,
                selectedRatio,
            });

            if (!selectedRatio || selectedRatio.width === null) {
                toast.success("大图合成成功！");
            } else {
                toast.success(`已导出 ${pageCount} 张 ${selectedRatio.label} 拼图，每张照片完整保留`);
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
    }, [files.length, inputScale, selectedRatio]);

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
        const ratio = findAspectRatioByLabel(value);
        setSelectedRatio(ratio);
        if (ratio?.width) setInputColumns(recommendColumns(images, ratio.width / ratio.height));
    }, [images]);

    const memoizedPhotoAlbum = useMemo(
        () => (
            <>
                {selectedRatio?.width ? <FixedRatioPreview photos={images} ratio={selectedRatio.width / selectedRatio.height} columns={inputColumns} gap={margin} radius={radius} onPreview={(index) => { setPreviewIndex(index); setPreviewOpen(true); }} onDelete={handleDelete} /> : <PhotoAlbum
                    layout={layout}
                    photos={images}
                    targetRowHeight={240}
                    rowConstraints={{ singleRowMaxHeight: 320 }}
                    padding={0}
                    spacing={margin}
                    columns={inputColumns}
                    render={{
                        container: renderContainer,
                        image: renderImage,
                    }}
                />}
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
            selectedRatio,
            radius,
            handleDelete,
            previewIndex,
            previewOpen,
            renderContainer,
            renderImage,
        ]
    );

    return (
        <div className="h-[calc(100vh-56px)]">
            {spinning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="flex flex-col items-center">
                        <Icon icon="line-md:speedometer-loop" className="text-white mt-2" />
                        <p className="mt-2 max-w-xl break-all px-4 text-center text-white">{importProgress || "正在处理..."}</p>
                    </div>
                </div>
            )}
            {isUpload ? (
                <div className="album">
                    {similarGroups.length > 0 && <SimilarPhotoDialog groups={similarGroups} onFinish={finishSimilarReview} onCancel={() => finishSimilarReview(new Set())} />}
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
                        onAddMore={openPhotoPicker}
                        onClear={() => {
                            for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
                            previewUrlsRef.current.clear();
                            setImages([]);
                            imagesRef.current = [];
                            signatures.current.clear(); reviewedPairs.current.clear(); setSimilarGroups([]);
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
                            <div className="p-4 sm:p-6">{memoizedPhotoAlbum}</div>
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
            ) : !spinning && (
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
