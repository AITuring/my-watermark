import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Maximize2 } from "lucide-react";
import { ImageType } from "./types";
import ImageUploader from "./ImageUploader";
import ImagePreview from "./ImagePreview";

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
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    // 优化图片URL生成，使用懒加载方式
    useEffect(() => {
        // 清理旧的URLs
        imageUrls.forEach((url) => URL.revokeObjectURL(url));

        // 只为可见的图片创建URL
        const urls: string[] = [];
        const createUrls = async () => {
            // 每次处理10张图片，避免一次性处理太多导致卡顿
            for (let i = 0; i < images.length; i += 10) {
                const batch = images.slice(i, i + 10);
                const batchUrls = batch.map((image) =>
                    URL.createObjectURL(image.file)
                );
                urls.push(...batchUrls);

                // 更新状态，让UI能够逐步显示图片
                setImageUrls([...urls]);

                // 如果不是最后一批，等待一小段时间再处理下一批
                if (i + 10 < images.length) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            }
        };

        createUrls();

        // 清理函数
        return () => {
            urls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [images]);

    const handleImageClick = (image: ImageType) => {
        setCurrentImg(image);
        onImageSelect();
    };

    const handleDeleteImage = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
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
        try {
            setIsUploading(true);
            // Batch processing, avoiding UI freeze
            const batchSize = 5;
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                await onUpload(batch); // Call parent handler

                if (i + batchSize < files.length) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.error("上传图片失败", error);
        } finally {
            setIsUploading(false);
        }
    };

    const handlePreviewImage = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        setPreviewIndex(index);
        setPreviewOpen(true);
    };

    return (
        <div className="flex flex-col h-full bg-background dark:bg-slate-950">
            <div className="p-3 border-b dark:border-slate-800 flex justify-between items-center">
                <Badge variant="outline" className="text-sm dark:text-slate-200">
                    背景图片 ({images.length})
                </Badge>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => {
                            setImages([]);
                            setImageUploaderVisible(true);
                            setCurrentImg(null);
                        }}
                    >
                        <X className="h-4 w-4 mr-1" />
                        清空
                    </Button>
                    <ImageUploader
                        onUpload={handleImagesUpload}
                        fileType="背景"
                        className="inline-block"
                    >
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 dark:text-slate-200 dark:hover:bg-slate-800"
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mr-1"></div>
                                    上传中
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-1" />
                                    添加
                                </>
                            )}
                        </Button>
                    </ImageUploader>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="grid grid-cols-2 gap-2 p-2">
                    {images.map((image, index) => (
                        <div
                            key={image.id}
                            className={`relative rounded-md overflow-hidden cursor-pointer transition-all duration-200 ${
                                currentImageId === image.id
                                    ? "ring-2 ring-primary"
                                    : "hover:ring-1 hover:ring-primary/50"
                            }`}
                            onClick={() => handleImageClick(image)}
                        >
                            <img
                                src={imageUrls[index]}
                                alt={image.file.name}
                                className="w-full h-auto object-cover aspect-square"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                <p className="text-white text-xs truncate max-w-[90%] px-2">
                                    {image.file.name}
                                </p>
                            </div>
                            <div className="absolute top-1 right-1 flex gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6 bg-white/80 dark:bg-slate-800/80 dark:text-slate-200 opacity-70 hover:opacity-100 transition-opacity border-none"
                                    onClick={(e) =>
                                        handlePreviewImage(e, index)
                                    }
                                >
                                    <Maximize2 className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="h-6 w-6 opacity-70 hover:opacity-100 transition-opacity"
                                    onClick={(e) =>
                                        handleDeleteImage(image.id, e)
                                    }
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* 图片预览组件 */}
            <ImagePreview
                images={imageUrls}
                currentIndex={previewIndex}
                open={previewOpen}
                onOpenChange={setPreviewOpen}
            />
        </div>
    );
};

export default MobileImageGallery;
