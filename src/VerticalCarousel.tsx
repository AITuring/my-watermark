import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImageType } from "./types";
import { X, Plus, Maximize2 } from "lucide-react";
import ImageUploader from "./ImageUploader";
import ImagePreview from "./ImagePreview";

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
        images.length > 0 ? images[0].id : null
    );
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    // 生成图片URL列表
    useEffect(() => {
        const urls = images.map(image => URL.createObjectURL(image.file));
        setImageUrls(urls);

        // 清理函数
        return () => {
            urls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [images]);

    const handleImageClick = (image: ImageType) => {
        setSelectedImageId(image.id);
        setCurrentImg(image);
    };

    const handleDeleteImage = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newImages = images.filter((img) => img.id !== id);
        setImages(newImages);

        if (newImages.length === 0) {
            setImageUploaderVisible(true);
            setCurrentImg(null);
        } else if (id === selectedImageId) {
            setSelectedImageId(newImages[0].id);
            setCurrentImg(newImages[0]);
        }
    };

    const handleImagesUpload = async (files: File[]) => {
        try {
            // 导入 loadImageData 函数
            const { loadImageData } = await import('./utils');
            const newImages = await loadImageData(files);

            // 合并新上传的图片和现有图片
            setImages(prevImages => [...prevImages, ...newImages]);

            // 如果是第一张图片，设置为当前图片
            if (newImages.length > 0 && images.length === 0) {
                setCurrentImg(newImages[0]);
            }

            console.log("上传新图片成功", newImages);
        } catch (error) {
            console.error("上传图片失败", error);
        }
    };


    const handlePreviewImage = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        setPreviewIndex(index);
        setPreviewOpen(true);
    };

    return (
        <div
            className="flex flex-col bg-background border rounded-lg shadow-sm overflow-hidden"
            style={{ height: `${height}px`, width: '30%', flexShrink: 0 }}
        >
                       <div className="p-3 border-b flex justify-between items-center">
                <Badge variant="outline" className="text-sm">
                    背景图片 ({images.length})
                </Badge>
                <div className="flex gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                        setImages([]);
                                        setImageUploaderVisible(true);
                                        setCurrentImg(null);
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                    清空
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>清空所有背景图片</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <ImageUploader
                        onUpload={handleImagesUpload}
                        fileType="背景"
                        className="inline-block"
                    >
                        <Button variant="ghost" size="sm" className="h-8">
                            <Plus className="h-4 w-4" />
                            添加
                        </Button>
                    </ImageUploader>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                    {images.map((image, index) => (
                        <div
                            key={image.id}
                            className={`relative rounded-md overflow-hidden cursor-pointer transition-all duration-200 ${
                                selectedImageId === image.id
                                    ? "ring-2 ring-primary"
                                    : "hover:ring-1 hover:ring-primary/50"
                            }`}
                            onClick={() => handleImageClick(image)}
                        >
                            <img
                                src={imageUrls[index]}
                                alt={image.file.name}
                                className="w-full h-auto object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                <p className="text-white text-xs truncate max-w-[90%] px-2">
                                    {image.file.name}
                                </p>
                            </div>

                            <div className="absolute top-1 right-1 flex gap-1">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-6 w-6 bg-white/80 opacity-0 hover:opacity-100 transition-opacity"
                                                onClick={(e) => handlePreviewImage(e, index)}
                                            >
                                                <Maximize2 className="h-3 w-3" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                            <p>预览大图</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 hover:opacity-100 transition-opacity"
                                                onClick={(e) =>
                                                    handleDeleteImage(image.id, e)
                                                }
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                            <p>删除图片</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* 使用新的图片预览组件 */}
            <ImagePreview
                images={imageUrls}
                currentIndex={previewIndex}
                open={previewOpen}
                onOpenChange={setPreviewOpen}
            />
        </div>
    );
};

export default VerticalCarousel;
