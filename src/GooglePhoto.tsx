import { useState, useRef, useMemo, useEffect } from "react";
import { Icon } from "@iconify/react";
import { Image } from "antd";
import {
    PhotoAlbum,
    RenderContainer,
    Photo,
    RenderPhotoProps,
} from "react-photo-album";
import photosData from "./photos.json";
import "./puzzle.css";

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

    // 添加一个状态来存储容器尺寸
    const [containerSize, setContainerSize] = useState<{
        width: number;
        height: number;
    }>({ width: 0, height: 0 });

    const renderPhoto = (props: RenderPhotoProps<PhotoType>) => {
        const { imageProps } = props;
        const { alt, style, ...restImageProps } = imageProps;
        return (
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
                            <Icon icon="ph:eye-bold" className="w-5 h-5 mr-2" />
                            预览
                        </div>
                    ),
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
            <Image.PreviewGroup>
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
            {
                <div className="album">
                    <div style={{ margin: 30 }}>{memoizedPhotoAlbum}</div>
                </div>
            }
        </div>
    );
};

export default Puzzle;
