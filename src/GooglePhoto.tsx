import { useState, useRef, useMemo, useEffect } from "react";
import { PhotoAlbum, RenderContainer } from "react-photo-album";
import type { RenderPhotoProps } from "react-photo-album";
import photosData from "./photos.json";
import "./puzzle.css";
import ImagePreview from "./ImagePreview";

interface AspectRatio {
    width: number;
    height: number;
    label: string;
}

interface PhotoType {
    src: string;
    width: number;
    height: number;
    srcSet?: { src: string; width: number; height: number }[];
}

const Puzzle = () => {
    const galleryRef = useRef(null);
    const [images, setImages] = useState<PhotoType[]>(
        (photosData as PhotoType[]) || []
    );

    const [inputColumns, setInputColumns] = useState<number>(3);
    const [margin, setMargin] = useState<number>(0);
    const [radius, setRadius] = useState<number>(2);
    const [layout, setLayout] = useState<"rows" | "masonry" | "columns">(
        "rows"
    );
    const [selectedRatio, setSelectedRatio] = useState<AspectRatio | null>(
        null
    );

    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const imageUrls = useMemo(() => images.map((img) => img.src), [images]);

    // 添加一个状态来存储容器尺寸
    const [containerSize, setContainerSize] = useState<{
        width: number;
        height: number;
    }>({ width: 0, height: 0 });

    const renderPhoto = (props: RenderPhotoProps<PhotoType>) => {
        const { imageProps } = props;
        const { alt, style, ...restImageProps } = imageProps;
        return (
            <img
                alt={alt}
                style={{
                    ...style,
                    width: "100%",
                    height: "auto",
                    display: "block",
                    boxSizing: "content-box",
                    borderRadius: radius || 0,
                }}
                {...restImageProps}
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
                    boxSizing: "border-box",
                    // TODO 这里可以自定义背景颜色
                }}
            >
                {children}
            </div>
        </div>
    );

    // 使用 useMemo 优化渲染的图片列表
    const memoizedPhotoAlbum = useMemo(
        () => (
            <PhotoAlbum
                layout={layout}
                photos={images}
                padding={0}
                spacing={margin}
                targetRowHeight={220}
                renderContainer={renderContainer}
                renderPhoto={renderPhoto}
                onClick={({ index }) => {
                    setPreviewIndex(index);
                    setPreviewOpen(true);
                }}
            />
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
            {
                <div className="album">
                    <div style={{ margin: 30 }}>{memoizedPhotoAlbum}</div>
                    <ImagePreview
                        images={imageUrls}
                        currentIndex={previewIndex}
                        open={previewOpen}
                        onOpenChange={setPreviewOpen}
                    />
                </div>
            }
        </div>
    );
};

export default Puzzle;
