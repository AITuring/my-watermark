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
import {
    message,
    Button,
    Tooltip,
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
import photosData from './photos.json';
import "./puzzle.css";

interface AspectRatio {
    width: number;
    height: number;
    label: string;
}

interface Photo {
  src: string;
  width: number;
  height: number;
  srcSet?: { src: string; width: number; height: number }[];
}


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
                    <Image
                        alt={alt}
                        style={{
                            ...style,
                            width: "100%",
                            height: "auto",
                            padding: 0,
                            margin: 0,
                            borderRadius: radius || 0,
                            
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
    const [images, setImages] = useState<Photo[]>((photosData as Photo[]) || []);
    const [spinning, setSpinning] = useState<boolean>(false);
    const [isUpload, setIsUpload] = useState<boolean>(false);
    const [inputColumns, setInputColumns] = useState<number>(3);
    const [margin, setMargin] = useState<number>(0);
    const [radius, setRadius] = useState<number>(2);
    const [layout, setLayout] = useState<"rows" | "masonry" | "columns">(
        "rows"
    );
    const [selectedRatio, setSelectedRatio] = useState<AspectRatio | null>(
        null
    );

    // 添加一个状态来存储容器尺寸
    const [containerSize, setContainerSize] = useState<{
        width: number;
        height: number;
    }>({ width: 0, height: 0 });
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
        [ inputColumns]
    );

    const renderPhoto = (props: SortablePhotoProps) => {
        // capture rendered photos for future use in DragOverlay
        renderedPhotos.current[props.photo.id] = props;
        return (
            <SortablePhotoFrame
                activeIndex={activeIndex}
                margin={margin}
                radius={radius}
                {...props}
            />
        );
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
                    // margin: `-${margin}px`, // 抵消最外层的 padding
                    padding: `${margin}px`,
                    boxSizing: 'border-box',
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
            ) : (
                <div className="album">
                    <div className="w-full">
                        <div className="flex flex-wrap gap-4 justify-center">


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

                        </div>

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
            )}
        </div>
    );
};

export default Puzzle;
