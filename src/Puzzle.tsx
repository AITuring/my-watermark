import {
    forwardRef,
    useCallback,
    useState,
    useRef,
    memo,
    useMemo,
} from "react";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import {
    message,
    Button,
    Tooltip,
    Select,
    Spin,
    InputNumber,
    Image,
} from "antd";
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
import { useDebouncedCallback } from 'use-debounce';
import clsx from "clsx";
import {
    PhotoAlbum,
    RenderContainer,
    Photo,
    RenderPhotoProps,
} from "react-photo-album";
import html2canvas from "html2canvas";
import "./puzzle.css";

interface SortablePhoto extends Photo {
    id: UniqueIdentifier;
}

type SortablePhotoProps = RenderPhotoProps<SortablePhoto> & {
    photo: SortablePhoto;
};

type PhotoFrameProps = SortablePhotoProps & {
    overlay?: boolean;
    active?: boolean;
    insertPosition?: "before" | "after";
    attributes?: Partial<React.HTMLAttributes<HTMLDivElement>>;
    listeners?: Partial<React.HTMLAttributes<HTMLDivElement>>;
    onDelete?: (id: UniqueIdentifier) => void;
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
            layoutOptions,
            imageProps,
            overlay,
            active,
            insertPosition,
            attributes,
            listeners,
            photo,
            onDelete,
        } = props;
        const { alt, style, ...restImageProps } = imageProps;

        return (
            <div
                ref={ref}
                style={{
                    width: overlay
                        ? `calc(100% - ${2 * layoutOptions.padding}px)`
                        : style.width,
                    padding: style.padding,
                    margin: style.marginBottom,
                    position: "relative",
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
                <Image
                    alt={alt}
                    style={{
                        ...style,
                        width: "100%",
                        height: "auto",
                        padding: 0,
                        marginBottom: 0,
                    }}
                    preview={{
                        maskClassName:
                            "group-hover:opacity-100 opacity-0 transition-opacity duration-200",
                        mask: (
                            <div className="flex items-center justify-center">
                                <Icon
                                    icon="ph:eye-bold"
                                    className="w-5 h-5 mr-2"
                                />
                                预览
                            </div>
                        ),
                    }}
                    {...restImageProps}
                />
                {!overlay && ( // 拖拽时不显示删除按钮
                    <div className="opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <Tooltip title="删除">
                            <Button
                                shape="circle"
                                size="small"
                                className="absolute top-1 right-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete?.(photo.id);
                                }}
                                icon={
                                    <Icon
                                        icon="material-symbols:delete-outline-sharp"
                                        className="w-3 h-3"
                                    />
                                }
                            />
                        </Tooltip>
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
            prevProps.overlay === nextProps.overlay
        );
    }
);

function SortablePhotoFrame(
    props: SortablePhotoProps & {
        activeIndex?: number;
        onDelete?: (id: UniqueIdentifier) => void;
    }
) {
    const { photo, activeIndex, onDelete } = props;
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
    const [layout, setLayout] = useState<"rows" | "masonry" | "columns">(
        "columns"
    );

    const renderedPhotos = useRef<{ [key: string]: SortablePhotoProps }>({});
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

    const renderPhoto = (props: SortablePhotoProps) => {
        // capture rendered photos for future use in DragOverlay
        renderedPhotos.current[props.photo.id] = props;
        return (
            <SortablePhotoFrame
                activeIndex={activeIndex}
                onDelete={handleDelete}
                {...props}
            />
        );
    };

    const onDrop = useCallback(
        async (acceptedFiles) => {
            const oversizedFiles = acceptedFiles.filter(
                (file) => file.size > 100 * 1024 * 1024
            );
            if (oversizedFiles.length > 0) {
                message.error("图片大小不能超过100MB");
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
                message.error(`图片处理失败: ${error.message}`);
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
            message.error("图片大小不能超过100MB");
        },
    });

    const downloadImage = async () => {
        if (files.length === 0) {
            message.error("请选择图片");
            return;
        }
        // 临时隐藏所有删除按钮
        const deleteButtons = document.querySelectorAll(
            ".photo-frame .ant-btn"
        );
        deleteButtons.forEach((button) => {
            (button as HTMLElement).style.display = "none";
        });
        setSpinning(true);
        const galleryElement = galleryRef.current;
        const canvasElement = galleryElement
            ? galleryElement
            : document.getElementById("container");
        const canvas = await html2canvas(canvasElement, { scale: inputScale });
        // 导出最终的图片
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "my-image.jpeg";
                    link.click();
                    setSpinning(false);
                    message.success("大图合成成功！");
                }
            },
            "image/jpeg",
            0.9
        );
    };

    const renderContainer: RenderContainer = ({
        containerProps,
        children,
        containerRef,
    }) => (
        <div ref={galleryRef} id="container">
            <div ref={containerRef} {...containerProps} id="gallery">
                {children}
            </div>
        </div>
    );

    const layoutKey = useMemo(() => `${layout}-${margin}-${inputColumns}`, [layout, margin, inputColumns]);

    const debouncedSetMargin = useDebouncedCallback(
        (value: number) => {
            setMargin(value);
        },
        300 // 300ms 延迟
    );

    // 使用 useMemo 优化渲染的图片列表
    const memoizedPhotoAlbum = useMemo(
        () => (
            <Image.PreviewGroup
                // TODO 期待新增一个删除按钮，但还需要梳理一下
                // preview={{
                //     onChange: (current) => {

                //     },
                //     toolbarRender: (
                //         _,
                //         {
                //             actions: {
                //                 onFlipY,
                //                 onFlipX,
                //                 onRotateLeft,
                //                 onRotateRight,
                //                 onZoomOut,
                //                 onZoomIn,
                //             },
                //         }
                //     ) => (
                //         <div className="flex items-center gpa-4 text-xl">
                //             <Icon icon="ant-design:rotate-left-outlined" className="w-5 h-5 cursor-pointer" onClick={onRotateLeft} />
                //             <Icon icon="ant-design:rotate-right-outlined" className="w-5 h-5 mx-2 cursor-pointer" onClick={onRotateRight} />
                //             <Icon icon="ant-design:swap-outlined" className="w-5 h-5 mx-2 cursor-pointer" onClick={onFlipY} style={{ transform: 'rotate(90deg)'}} />
                //             <Icon icon="ant-design:swap-outlined" className="w-5 h-5 mx-2 cursor-pointer" onClick={onFlipX} />
                //             <Icon icon="ant-design:zoom-out-outlined" className="w-5 h-5 mx-2 cursor-pointer" onClick={onZoomOut} />
                //             <Icon icon="ant-design:zoom-in-outlined" className="w-5 h-5 mx-2 cursor-pointer" onClick={onZoomIn} />
                //             <Icon icon="ant-design:delete-outlined" className="w-5 h-5 cursor-pointer" onClick={() => {
                //                 console.log(currentImageIndex);
                //                 if (currentImageIndex !== undefined) {
                //                     const newImages = [...images];
                //                     newImages.splice(currentImageIndex, 1);
                //                     setImages(newImages);
                //                     setFiles(prev => {
                //                         const newFiles = [...prev];
                //                         newFiles.splice(currentImageIndex, 1);
                //                         return newFiles;
                //                     });
                //                     // 如果删除的是最后一张图片，显示前一张
                //                     if (currentImageIndex >= newImages.length) {
                //                         setCurrentImageIndex(Math.max(newImages.length - 1, 0));
                //                     }
                //                 }
                //             }} />

                //         </div>
                //     ),
                // }}
            >
                <PhotoAlbum
                    layout={layout}
                    photos={images}
                    padding={0}
                    spacing={margin}
                    columns={inputColumns}
                    renderContainer={renderContainer}
                    renderPhoto={renderPhoto}
                />
            </Image.PreviewGroup>
        ),
        [layout, images, margin, inputColumns, renderContainer, renderPhoto]
    );

    return (
        <div className="h-[calc(100vh-56px)]">
            {spinning ? (
                <Spin
                    size="large"
                    fullscreen
                    indicator={
                        <Icon
                            icon="line-md:speedometer-loop"
                            className=" text-white"
                        />
                    }
                />
            ) : isUpload ? (
                <div className="album">
                    <div className="w-full">
                        <div className="flex flex-wrap gap-4 justify-center">
                            <div className="flex items-center gpa-4">
                                <div>布局方式:</div>
                                <Select
                                    value={layout}
                                    style={{
                                        width: 100,
                                        marginLeft: "20px",
                                    }}
                                    onChange={(value) =>
                                        setLayout(
                                            value as
                                                | "rows"
                                                | "masonry"
                                                | "columns"
                                        )
                                    }
                                    options={[
                                        { value: "rows", label: "行" },
                                        {
                                            value: "columns",
                                            label: "列",
                                        },
                                        {
                                            value: "masonry",
                                            label: "masonry",
                                        },
                                    ]}
                                />
                            </div>
                            {layout !== "rows" && (
                                <div className="flex items-center gpa-4 my-4">
                                    <div>图片列数:</div>
                                    <InputNumber
                                        className="w-16 ml-4"
                                        min={0}
                                        max={10}
                                        onChange={(value) =>
                                            setInputColumns(value)
                                        }
                                        value={Number(inputColumns)}
                                    />
                                </div>
                            )}
                            {/* <div className="flex items-center gpa-4 my-4">
                                <div>图片间距:</div>
                                <InputNumber
                                    className="w-16 ml-4"
                                    min={0}
                                    max={50}
                                    onChange={debouncedSetMargin}
                                    value={Number(margin)}
                                />
                            </div> */}
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
                            <div className="flex items-center gpa-4 my-4">
                                <Tooltip title="规模越大，导出图片尺寸越大，导出更加耗时">
                                    <div>导出图片规模:</div>
                                </Tooltip>

                                <InputNumber
                                    className="w-16 ml-4"
                                    min={1}
                                    max={10}
                                    onChange={(value) => setInputScale(value)}
                                    value={Number(inputScale)}
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 justify-center mt-2">
                            <Button type="primary" onClick={downloadImage}>
                                下载大图
                            </Button>
                            <Button
                                type="default"
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
                                onClick={() => {
                                    setImages([]);
                                    setFiles([]);
                                    setIsUpload(false);
                                }}
                            >
                                清空
                            </Button>
                        </div>
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
                        <SortableContext items={images}>
                            <div style={{ margin: 30 }}>
                                {memoizedPhotoAlbum}
                            </div>
                        </SortableContext>
                        <DragOverlay>
                            {activeId && (
                                <PhotoFrame
                                    overlay
                                    {...renderedPhotos.current[activeId]}
                                />
                            )}
                        </DragOverlay>
                    </DndContext>
                </div>
            ) : (
                <div className="h-full">
                    <input {...getInputProps()} />
                    <div {...getRootProps()} className="upload-button">
                        <div>选择图片</div>
                        {/* <div className="upload-desc">
                                请不要上传太多图片，否则处理速度会很慢
                            </div> */}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Puzzle;
