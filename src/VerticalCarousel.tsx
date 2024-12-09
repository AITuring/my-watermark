import React, {
    useRef,
    memo,
    useCallback,
} from "react";
import { Icon } from "@iconify/react";
import { Button, Tooltip } from "antd";
import ImageUploader from "./ImageUploader";
import { loadImageData } from "./utils";
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
        onDelete,
        onClick,
    }: {
        image: ImageType;
        onDelete: (id: string) => void;
        onClick: (image: ImageType) => void;
    }) => (
        <div className="relative m-2 first:mt-0">
            <img
                src={URL.createObjectURL(image?.file)}
                alt={`Slide`}
                onClick={() => onClick(image)}
            />
            <Tooltip title="删除">
                <Icon
                    icon="ic:baseline-cancel"
                    className="w-4 h-4 absolute right-1 top-1 cursor-pointer text-white"
                    onClick={() => onDelete(image.id)}
                />
            </Tooltip>
        </div>
    )
);

CarouselItem.displayName = "CarouselItem";

const VerticalCarousel: React.FC<VerticalCarouselProps> = ({
    images,
    setImages,
    setImageUploaderVisible,
    setCurrentImg,
    height = window.innerHeight * 0.8,
}) => {
    const carouselRef = useRef<HTMLDivElement>(null);

    const handleImagesUpload = useCallback(
        async (files: File[]) => {
            const uploadImages: ImageType[] = await loadImageData(files);
            setImages((prev) => [...prev, ...uploadImages]);
        },
        [setImages]
    );

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
            className="relative overflow-hidden flex flex-col items-center justify-between w-[20vw]"
            style={{ height: height }}
            ref={carouselRef}
        >
            <div className="flex flex-col items-center overflow-y-auto">
                {images.map((image) => (
                    <CarouselItem
                        key={image.id}
                        image={image}
                        onDelete={handleDelete}
                        onClick={handleImageClick}
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
                                className={`w-4 h-4 cursor-pointer text-black`}
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
                                    className={`w-4 h-4 cursor-pointer text-black`}
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
