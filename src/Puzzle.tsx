import { forwardRef, useCallback, useState, useRef, memo, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import { message, Button, Slider, Tooltip, Select, Spin } from "antd";
import { Icon } from '@iconify/react';
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
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from "@dnd-kit/sortable";

import { CircleHelp } from "lucide-react";
import clsx from "clsx";
import {
    PhotoAlbum,
    RenderContainer,
    Photo,
    RenderPhotoProps,
} from "react-photo-album";
import html2canvas from "html2canvas";
import EmojiBg from "./EmojiBg";
import "./puzzle.css";

const watermarkUrl = "./assets/logo.png";

interface SortablePhoto extends Photo {
    id: UniqueIdentifier;
}

type SortablePhotoProps = RenderPhotoProps<SortablePhoto>;

type PhotoFrameProps = SortablePhotoProps & {
    overlay?: boolean;
    active?: boolean;
    insertPosition?: "before" | "after";
    attributes?: Partial<React.HTMLAttributes<HTMLDivElement>>;
    listeners?: Partial<React.HTMLAttributes<HTMLDivElement>>;
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
                    marginBottom: style.marginBottom,
                }}
                className={clsx("photo-frame", {
                    overlay: overlay,
                    active: active,
                    insertBefore: insertPosition === "before",
                    insertAfter: insertPosition === "after",
                })}
                {...attributes}
                {...listeners}
            >
                <img
                    alt={alt}
                    style={{
                        ...style,
                        width: "100%",
                        height: "auto",
                        padding: 0,
                        marginBottom: 0,
                    }}
                    {...restImageProps}
                />
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
    props: SortablePhotoProps & { activeIndex?: number }
) {
    const { photo, activeIndex } = props;
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
            setImages((items) => {
                const oldIndex = items.findIndex(
                    (item) => item.id === active.id
                );
                const newIndex = items.findIndex((item) => item.id === over.id);

                return arrayMove(items, oldIndex, newIndex);
            });
        }

        setActiveId(undefined);
    }, []);

    const renderPhoto = (props: SortablePhotoProps) => {
        // capture rendered photos for future use in DragOverlay
        renderedPhotos.current[props.photo.id] = props;
        return <SortablePhotoFrame activeIndex={activeIndex} {...props} />;
    };

    const onDrop = useCallback(async (acceptedFiles) => {
        setSpinning(true);
        const newImages = [];

        try {
            const compressionOptions = {
                maxSizeMB: 15,
                maxWidthOrHeight: 2560,
                useWebWorker: true
            };

            // 使用 Promise.all 并行处理所有图片
            await Promise.all(acceptedFiles.map(async (file) => {
                const compressedFile = await imageCompression(file, compressionOptions);
                const src = URL.createObjectURL(compressedFile);

                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        newImages.push({
                            id: src,
                            src: src,
                            width: img.width,
                            height: img.height,
                        });
                        resolve(undefined);
                    };
                    img.src = src;
                });
            }));

            // 批量更新状态
            setFiles(prev => [...prev, ...acceptedFiles]);
            setImages(prev => [...prev, ...newImages]);
            if (!isUpload) {
                setIsUpload(true);
            }
        } catch (error) {
            message.error(`图片处理失败: ${error.message}`);
        } finally {
            setSpinning(false);
        }
    }, [isUpload]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".jpeg", ".jpg", ".png"],
        },
    });

    const downloadImage = async () => {
        if (files.length === 0) {
            message.error("请选择图片");
            return;
        }
        setSpinning(true);
        const galleryElement = galleryRef.current;
        setSpinning(true);
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

    // 使用 useMemo 优化渲染的图片列表
    const memoizedPhotoAlbum = useMemo(() => (
        <PhotoAlbum
            layout={layout}
            photos={images}
            padding={0}
            spacing={margin}
            columns={inputColumns}
            renderContainer={renderContainer}
            renderPhoto={renderPhoto}
        />
    ), [layout, images, margin, inputColumns, renderContainer, renderPhoto]);


    return (
        <div className="h-[calc(100vh-56px)]">
            {spinning ? (
                <Spin
                    size="large"
                    fullscreen
                    indicator={ <Icon icon="line-md:uploading-loop" className=" text-white" />}
                />
            ) : isUpload ? (
                <div className="album">
                    <>
                        <div className="tab">
                            <h2>大图生成</h2>
                            <div className="controls">
                                <div className="slide">
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
                                            { value: "columns", label: "列" },
                                            {
                                                value: "masonry",
                                                label: "masonry",
                                            },
                                        ]}
                                    />
                                </div>
                                {layout !== "rows" && (
                                    <div className="slide">
                                        <div>图片列数:</div>
                                        <Slider
                                            style={{
                                                width: "100px",
                                                marginLeft: "20px",
                                            }}
                                            min={0}
                                            max={10}
                                            onChange={(value) =>
                                                setInputColumns(value)
                                            }
                                            value={Number(inputColumns)}
                                        />
                                    </div>
                                )}
                                <div className="slide">
                                    <div>图片间距:</div>
                                    <Slider
                                        style={{
                                            width: "100px",
                                            marginLeft: "20px",
                                        }}
                                        min={0}
                                        max={50}
                                        onChange={(value) => setMargin(value)}
                                        value={Number(margin)}
                                    />
                                </div>
                                {/* <div className="slide">
                                        <div>画框宽度:</div>
                                        <Slider
                                            style={{
                                                width: "100px",
                                                marginLeft: "20px",
                                            }}
                                            min={1}
                                            max={50}
                                            onChange={(value) =>
                                                setPadding(value)
                                            }
                                            value={Number(padding)}
                                        />
                                    </div> */}
                                <div className="slide">
                                    <div>导出图片规模:</div>
                                    <Slider
                                        style={{
                                            width: "100px",
                                            margin: "0 20px",
                                        }}
                                        min={1}
                                        max={10}
                                        onChange={(value) =>
                                            setInputScale(value)
                                        }
                                        value={Number(inputScale)}
                                    />
                                    <Tooltip title="规模越大，导出图片尺寸越大，导出更加耗时">
                                        <CircleHelp className="w-4 h-4" />
                                    </Tooltip>
                                </div>
                            </div>
                            <div className="controls">
                                <Button
                                    type="primary"
                                    size="large"
                                    onClick={downloadImage}
                                    style={{ margin: "0 30px" }}
                                >
                                    下载大图
                                </Button>
                                <Button
                                    type="default"
                                    size="large"
                                    onClick={() =>
                                        document
                                            .querySelector('input[type="file"]')
                                            ?.click()
                                    }
                                    style={{ margin: "0 30px" }}
                                >
                                    继续添加
                                </Button>
                                <Button
                                    style={{ margin: "0 30px" }}
                                    size="large"
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
                    </>
                </div>
            ) : (
                <div className="h-full">
                    <input {...getInputProps()} />
                        <div {...getRootProps()} className="upload-button">
                            <div>选择（或拖拽）图片</div>
                            <div className="upload-desc">
                                请不要上传太多图片，否则处理速度会很慢
                            </div>
                        </div>
                </div>
            )}
        </div>
    );
};

export default Puzzle;
