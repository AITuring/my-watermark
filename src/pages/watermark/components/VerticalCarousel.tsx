import { useEffect, useState } from "react";
import type React from "react";

import ImageAssetPicker from "@/components/ImageAssetPicker";
import type { ImageType } from "@/types";

interface VerticalCarouselProps {
    images: ImageType[];
    setImages: React.Dispatch<React.SetStateAction<ImageType[]>>;
    setImageUploaderVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setCurrentImg: React.Dispatch<React.SetStateAction<ImageType | null>>;
    height?: number;
}

const VerticalCarousel: React.FC<VerticalCarouselProps> = ({
    images,
    setImages,
    setImageUploaderVisible,
    setCurrentImg,
    height = 600,
}) => {
    const [selectedImageId, setSelectedImageId] = useState<string | null>(
        images[0]?.id ?? null
    );

    useEffect(() => {
        if (!images.length) {
            setSelectedImageId(null);
            return;
        }

        if (!selectedImageId || !images.some((image) => image.id === selectedImageId)) {
            setSelectedImageId(images[0].id);
        }
    }, [images, selectedImageId]);

    const handleDeleteImage = (id: string) => {
        const newImages = images.filter((img) => img.id !== id);
        setImages(newImages);

        if (newImages.length === 0) {
            setImageUploaderVisible(true);
            setCurrentImg(null);
            setSelectedImageId(null);
        } else if (id === selectedImageId) {
            setSelectedImageId(newImages[0].id);
            setCurrentImg(newImages[0]);
        }
    };

    const handleImagesUpload = async (files: File[]) => {
        const { loadImageData } = await import("@/utils");
        const { images: newImages, failedFiles } = await loadImageData(files);

        setImages((prevImages) => [...prevImages, ...newImages]);

        if (newImages.length > 0 && images.length === 0) {
            setSelectedImageId(newImages[0].id);
            setCurrentImg(newImages[0]);
        }

        if (failedFiles.length > 0) {
            const summary =
                failedFiles.length > 3
                    ? `${failedFiles.slice(0, 3).join("、")} 等 ${failedFiles.length} 张`
                    : failedFiles.join("、");
            alert(
                `已添加 ${newImages.length} 张图片，跳过 ${failedFiles.length} 张不支持或读取失败的图片：${summary}`
            );
        }
    };

    return (
        <div
            className="overflow-hidden rounded-lg border bg-background shadow-sm"
            style={{ height: `${height}px`, width: "30%", flexShrink: 0 }}
        >
            <ImageAssetPicker
                images={images}
                selectedId={selectedImageId}
                layout="list"
                title="背景图片"
                className="h-full"
                scrollAreaClassName="flex-1"
                itemsClassName="space-y-2 p-2"
                onSelect={(image) => {
                    setSelectedImageId(image.id);
                    setCurrentImg(image);
                }}
                onDelete={handleDeleteImage}
                onClear={() => {
                    setImages([]);
                    setImageUploaderVisible(true);
                    setCurrentImg(null);
                    setSelectedImageId(null);
                }}
                onUpload={handleImagesUpload}
            />
        </div>
    );
};

export default VerticalCarousel;
