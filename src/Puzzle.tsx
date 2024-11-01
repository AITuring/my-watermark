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
import { useDebouncedCallback } from "use-debounce";
import clsx from "clsx";
import {
    PhotoAlbum,
    RenderContainer,
    Photo,
    RenderPhotoProps,
} from "react-photo-album";
import html2canvas from "html2canvas";
import "./puzzle.css";

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
    margin?: number;
    radius?: number;
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
            margin,
            radius,
        } = props;
        const { alt, style, ...restImageProps } = imageProps;

        return (
            <div
                ref={ref}
                style={{
                    width: overlay
                        ? `calc(100% - ${2 * layoutOptions.padding}px)`
                        : style.width,
                    padding: margin || 0,
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
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                    }}
                >
                    <Image
                        alt={alt}
                        style={{
                            ...style,
                            width: "100%",
                            height: "auto",
                            padding: 0,
                            margin: 0,
                            borderRadius: radius || 0,
                            // TODO 导出图片无法带这个阴影，想做后期还得研究
                            // boxShadow:
                            //     margin > 0
                            //         ? "0px 3px 3px -2px rgb(0 0 0 / 20%), 0px 3px 4px 0px rgb(0 0 0 / 24%), 0px 1px 8px 0px rgb(0 0 0 / 22%)"
                            //         : "none",
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
                </div>

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
                margin={margin}
                radius={radius}
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
        setSpinning(true);
        const galleryElement = galleryRef.current;
        const canvasElement = galleryElement
            ? galleryElement
            : document.getElementById("container");

        try {
            // 1. 先生成原始图片
            const originalCanvas = await html2canvas(canvasElement, {
                scale: inputScale,
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#ffffff",
                logging: false,
                onclone: (clonedDoc) => {
                    const images = clonedDoc.getElementsByTagName("img");
                    return Promise.all(
                        Array.from(images).map(
                            (img) =>
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

            // 2. 根据是否选择了自适应来决定是否添加边框
            let finalCanvas;
            if (!selectedRatio || selectedRatio.width === null) {
                // 自适应模式：直接使用原始画布
                finalCanvas = originalCanvas;
            } else {
                // 指定长宽比模式：添加边框
                const originalWidth = originalCanvas.width;
                const originalHeight = originalCanvas.height;
                const targetRatio = selectedRatio.width / selectedRatio.height;
                const currentRatio = originalWidth / originalHeight;

                let finalWidth = originalWidth;
                let finalHeight = originalHeight;

                if (currentRatio > targetRatio) {
                    finalHeight = originalWidth / targetRatio;
                    finalWidth = originalWidth;
                } else {
                    finalWidth = originalHeight * targetRatio;
                    finalHeight = originalHeight;
                }

                finalCanvas = document.createElement('canvas');
                finalCanvas.width = finalWidth;
                finalCanvas.height = finalHeight;
                const ctx = finalCanvas.getContext('2d');

                // 填充白色背景
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, finalWidth, finalHeight);

                // 在中心绘制原始图片
                const x = (finalWidth - originalWidth) / 2;
                const y = (finalHeight - originalHeight) / 2;
                ctx.drawImage(originalCanvas, x, y);
            }

            // 3. 导出最终图片
            finalCanvas.toBlob(
                (blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "my-image.jpeg";
                        link.click();
                        URL.revokeObjectURL(url);
                        setSpinning(false);
                        message.success("大图合成成功！");
                    }
                },
                "image/jpeg",
                0.9
            );
        } catch (error) {
            console.error('Export error:', error);
            setSpinning(false);
            message.error("导出失败，请重试");
        }
    };

    const renderContainer: RenderContainer = ({
        containerProps,
        children,
        containerRef,
    }) => (
        <div ref={galleryRef} id="container">
            <div
                ref={containerRef}
                {...containerProps}
                id="gallery"
                style={{
                    ...containerProps.style,
                    margin: `-${margin}px`, // 抵消最外层的 padding
                    padding: `${margin}px`,
                    // TODO 这里可以自定义背景颜色
                }}
            >
                {children}
            </div>
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
                    spacing={0}
                    columns={inputColumns}
                    renderContainer={renderContainer}
                    renderPhoto={renderPhoto}
                />
            </Image.PreviewGroup>
        ),
        [
            layout,
            images,
            margin,
            inputColumns,
            renderContainer,
            renderPhoto,
            radius,
        ]
    );

    useEffect(() => {
        if (selectedRatio && selectedRatio.width && selectedRatio.height) {
            // 修正：如果是高小于宽的比例（如16:9, 4:3），使用行布局
            if (selectedRatio.height < selectedRatio.width) {
                setLayout("columns");
                // 根据比例估算合适的列数
                const estimatedColumns = Math.ceil(Math.sqrt(images.length * selectedRatio.width / selectedRatio.height));
                setInputColumns(Math.min(Math.max(estimatedColumns, 1), 10));
            }
            // 修正：如果是高大于宽的比例（如9:16, 3:4），使用列布局
            else if (selectedRatio.height > selectedRatio.width) {
                setLayout("rows");
                // 根据比例估算合适的列数
                const estimatedColumns = Math.ceil(Math.sqrt(images.length * selectedRatio.height / selectedRatio.width));
                setInputColumns(Math.min(Math.max(estimatedColumns, 1), 10));
            }
        }
    }, [selectedRatio, images.length]);


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
                                    className="w-24 ml-4"
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
                            <div className="flex items-center gpa-4 my-4">
                                <div>图片间距:</div>
                                <InputNumber
                                    className="w-16 ml-4"
                                    min={0}
                                    max={50}
                                    onChange={debouncedSetMargin}
                                    value={Number(margin)}
                                />
                            </div>
                            {margin > 0 && (
                                <div className="flex items-center gpa-4 my-4">
                                    <div>图片圆角:</div>
                                    <InputNumber
                                        className="w-16 ml-4"
                                        min={0}
                                        max={50}
                                        onChange={(value) => setRadius(value)}
                                        value={Number(radius)}
                                    />
                                </div>
                            )}
                            <div className="flex items-center gpa-4 my-4">
                                <div>生成图片长宽比:</div>
                                <Select
                                    value={selectedRatio?.label}
                                    className="w-24 ml-4"
                                    onChange={(value) => {
                                        const ratio = aspectRatioOptions.find(
                                            (r) => r.label === value
                                        );
                                        setSelectedRatio(ratio || null);
                                        if (!ratio || ratio.width === null) {
                                            return;
                                        }
                                    }}
                                    allowClear
                                    placeholder="自适应"
                                    options={aspectRatioOptions.map(
                                        (ratio) => ({
                                            value: ratio.label,
                                            label: ratio.label,
                                        })
                                    )}
                                />
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
                    <input {...getInputProps()} />
                    <div {...getRootProps()} className="upload-button">
                        <div>选择图片</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Puzzle;
