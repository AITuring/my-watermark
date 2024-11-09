import React, {
    useState,
    useRef,
    useEffect,
    useContext,
    memo,
    useCallback,
} from "react";
import { Icon } from "@iconify/react";
import { Button } from "antd";
import { ThemeContext } from "@/context";
import ImageUploader from "./ImageUploader";
import { loadImageData, getColorBrightness } from "./utils";
import { ImageType } from "./types";

interface VerticalCarouselProps {
    images: ImageType[];
    setImages: React.Dispatch<React.SetStateAction<ImageType[]>>;
    setImageUploaderVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setCurrentImg: React.Dispatch<React.SetStateAction<ImageType | null>>;
    height?: number;
}

const CarouselItem = memo(
    ({
        image,
        onImageLoad,
        onDelete,
        onClick,
        brightness,
    }: {
        image: ImageType;
        onImageLoad: (
            e: React.SyntheticEvent<HTMLImageElement>,
            id: string
        ) => void;
        onDelete: (id: string) => void;
        onClick: (image: ImageType) => void;
        brightness: boolean;
    }) => (
        <div className="relative m-2 first:mt-0">
            <img
                src={URL.createObjectURL(image?.file)}
                alt={`Slide`}
                onClick={() => onClick(image)}
                onLoad={(e) => onImageLoad(e, image.id)}
            />
            <Icon
                icon="ic:baseline-cancel"
                className="w-4 h-4 absolute right-1 top-1 cursor-pointer"
                style={{ color: brightness ? "#000" : "#fff" }}
                onClick={() => onDelete(image.id)}
            />
        </div>
    )
);

CarouselItem.displayName = 'CarouselItem';

const VerticalCarousel: React.FC<VerticalCarouselProps> = ({
    images,
    setImages,
    setImageUploaderVisible,
    setCurrentImg,
    height = window.innerHeight * 0.8,
}) => {
    const { isDark } = useContext(ThemeContext);
    const carouselRef = useRef<HTMLDivElement>(null);
    // 创建一个用于存放图片元素引用的数组
    const imageRefs = useRef<(HTMLImageElement | null)[]>([]);

    const [imageBrightness, setImageBrightness] = useState<{
        [key: string]: boolean;
    }>({});

    const handleImagesUpload = useCallback(
        async (files: File[]) => {
            const uploadImages: ImageType[] = await loadImageData(files);
            setImages((prev) => [...prev, ...uploadImages]);
        },
        [setImages]
    );

    const handleImageLoad = useCallback(
        (event: React.SyntheticEvent<HTMLImageElement>, imageId: string) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            canvas.width = 16;
            canvas.height = 16;
            ctx.drawImage(event.currentTarget, 0, 0, 16, 16);

            const imageData = ctx.getImageData(0, 0, 16, 16);
            const isBright = getColorBrightness(imageData.data);

            setImageBrightness((prev) => ({
                ...prev,
                [imageId]: isBright,
            }));
        },
        []
    );

    const analyzeImageBrightness = (
        image: HTMLImageElement,
        imageId: string
    ) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 16;
        canvas.height = 16;
        ctx.drawImage(image, 0, 0, 16, 16);

        const imageData = ctx.getImageData(0, 0, 16, 16);
        const isBright = getColorBrightness(imageData.data);

        setImageBrightness((prev) => ({
            ...prev,
            [imageId]: isBright,
        }));
    };

    const handleDelete = useCallback(
        (imageId: string) => {
            setImages((prevImages) => {
                const newImages = prevImages.filter(
                    (item) => item.id !== imageId
                );
                setCurrentImg(newImages[0] || null);
                return newImages;
            });
        },
        [setImages, setCurrentImg]
    );

    const handleImageClick = useCallback(
        (image: ImageType) => {
            setCurrentImg(image);
        },
        [setCurrentImg]
    );

    return (
        <div
            className="relative overflow-hidden flex flex-col items-center justify-between"
            style={{ height: height }}
            ref={carouselRef}
        >
            <div className="flex flex-col items-center overflow-y-auto">
                {images.map((image) => (
                    <CarouselItem
                        key={image.id}
                        image={image}
                        onImageLoad={handleImageLoad}
                        onDelete={handleDelete}
                        onClick={handleImageClick}
                        brightness={imageBrightness[image.id]}
                    />
                ))}
            </div>
            <div className="w-full flex flex-col items-center">
                <div>共计{images.length}张</div>
                <div className="flex flex-wrap justify-between items-center w-full p-2">
                    <Button
                        onClick={() => {
                            setImages([]);
                            setImageUploaderVisible(true);
                        }}
                        className="mb-2"
                        icon={
                            <Icon
                                icon="icon-park-twotone:clear"
                                className={`w-4 h-4 cursor-pointer`}
                                style={{ color: isDark ? "#fff" : "#000" }}
                            />
                        }
                    >
                        清空
                    </Button>

                    <ImageUploader
                        onUpload={handleImagesUpload}
                        className="flex"
                    >
                        <Button
                            className="mb-2"
                            icon={
                                <Icon
                                    icon="material-symbols:note-stack-add-outline-rounded"
                                    className={`w-4 h-4 cursor-pointer`}
                                    style={{ color: isDark ? "#fff" : "#000" }}
                                />
                            }
                        >
                            添加
                        </Button>
                    </ImageUploader>
                </div>
            </div>
        </div>
    );
};

export default VerticalCarousel;
