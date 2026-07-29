import type React from "react";

import ImageAssetPicker from "@/components/ImageAssetPicker";
import type { ImageType } from "@/types";

interface MobileImageGalleryProps {
    images: ImageType[];
    setImages: React.Dispatch<React.SetStateAction<ImageType[]>>;
    setImageUploaderVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setCurrentImg: React.Dispatch<React.SetStateAction<ImageType | null>>;
    currentImageId: string | undefined;
    onImageSelect: () => void;
    onUpload: (files: File[]) => Promise<void>;
}

const MobileImageGallery: React.FC<MobileImageGalleryProps> = ({
    images,
    setImages,
    setImageUploaderVisible,
    setCurrentImg,
    currentImageId,
    onImageSelect,
    onUpload,
}) => {
    const handleDeleteImage = (id: string) => {
        const newImages = images.filter((img) => img.id !== id);
        setImages(newImages);

        if (newImages.length === 0) {
            setImageUploaderVisible(true);
            setCurrentImg(null);
        } else if (id === currentImageId) {
            setCurrentImg(newImages[0]);
        }
    };

    const handleImagesUpload = async (files: File[]) => {
        const batchSize = 5;

        for (let index = 0; index < files.length; index += batchSize) {
            const batch = files.slice(index, index + batchSize);
            await onUpload(batch);

            if (index + batchSize < files.length) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }
    };

    return (
        <ImageAssetPicker
            images={images}
            selectedId={currentImageId}
            layout="grid"
            title="背景图片"
            className="h-full dark:bg-slate-950"
            onSelect={(image) => {
                setCurrentImg(image);
                onImageSelect();
            }}
            onDelete={handleDeleteImage}
            onClear={() => {
                setImages([]);
                setImageUploaderVisible(true);
                setCurrentImg(null);
            }}
            onUpload={handleImagesUpload}
        />
    );
};

export default MobileImageGallery;
