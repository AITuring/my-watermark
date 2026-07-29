import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import ImagePreview from "@/components/ImagePreview";
import ImageUploader from "@/components/ImageUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ImageType } from "@/types";
import { Maximize2, Plus, X } from "lucide-react";

type ImageAssetPickerProps = {
    images: ImageType[];
    selectedId?: string | null;
    layout?: "grid" | "list";
    title?: ReactNode;
    className?: string;
    headerClassName?: string;
    scrollAreaClassName?: string;
    itemsClassName?: string;
    itemClassName?: string;
    imageClassName?: string;
    addLabel?: string;
    clearLabel?: string;
    emptyState?: ReactNode;
    onSelect: (image: ImageType) => void;
    onDelete: (id: string) => void;
    onClear: () => void;
    onUpload: (files: File[]) => Promise<void> | void;
};

export default function ImageAssetPicker({
    images,
    selectedId,
    layout = "grid",
    title = "背景图片",
    className,
    headerClassName,
    scrollAreaClassName,
    itemsClassName,
    itemClassName,
    imageClassName,
    addLabel = "添加",
    clearLabel = "清空",
    emptyState,
    onSelect,
    onDelete,
    onClear,
    onUpload,
}: ImageAssetPickerProps) {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const imageUrls = useMemo(
        () => images.map((image) => image.previewUrl || ""),
        [images]
    );

    const handleUpload = async (files: File[]) => {
        try {
            setIsUploading(true);
            await Promise.resolve(onUpload(files));
        } catch (error) {
            console.error("上传图片失败", error);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className={cn("flex h-full flex-col bg-background", className)}>
            <div
                className={cn(
                    "flex items-center justify-between border-b p-3 dark:border-slate-800",
                    headerClassName
                )}
            >
                <Badge variant="outline" className="text-sm dark:text-slate-200">
                    {title} ({images.length})
                </Badge>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={onClear}
                        disabled={images.length === 0}
                    >
                        <X className="mr-1 h-4 w-4" />
                        {clearLabel}
                    </Button>
                    <ImageUploader
                        onUpload={handleUpload}
                        fileType={String(title)}
                        className="inline-block"
                    >
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 dark:text-slate-200 dark:hover:bg-slate-800"
                            disabled={isUploading}
                        >
                            <Plus className="mr-1 h-4 w-4" />
                            {isUploading ? "上传中" : addLabel}
                        </Button>
                    </ImageUploader>
                </div>
            </div>

            <ScrollArea className={cn("flex-1", scrollAreaClassName)}>
                {images.length > 0 ? (
                    <div
                        className={cn(
                            layout === "grid"
                                ? "grid grid-cols-2 gap-2 p-2"
                                : "space-y-2 p-2",
                            itemsClassName
                        )}
                    >
                        {images.map((image, index) => (
                            <div
                                key={image.id}
                                className={cn(
                                    "relative cursor-pointer overflow-hidden rounded-md transition-all duration-200",
                                    selectedId === image.id
                                        ? "ring-2 ring-primary"
                                        : "hover:ring-1 hover:ring-primary/50",
                                    itemClassName
                                )}
                                onClick={() => onSelect(image)}
                            >
                                <img
                                    src={image.previewUrl}
                                    alt={image.file.name}
                                    className={cn(
                                        layout === "grid"
                                            ? "aspect-square w-full object-cover"
                                            : "h-auto w-full object-cover",
                                        imageClassName
                                    )}
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                                    <p className="max-w-[90%] truncate px-2 text-xs text-white">
                                        {image.file.name}
                                    </p>
                                </div>
                                <div className="absolute right-1 top-1 flex gap-1">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-6 w-6 border-none bg-white/80 opacity-70 transition-opacity hover:opacity-100 dark:bg-slate-800/80 dark:text-slate-200"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setPreviewIndex(index);
                                            setPreviewOpen(true);
                                        }}
                                    >
                                        <Maximize2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-6 w-6 opacity-70 transition-opacity hover:opacity-100"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onDelete(image.id);
                                        }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex min-h-[180px] items-center justify-center p-4 text-center text-sm text-muted-foreground">
                        {emptyState ?? "还没有图片。"}
                    </div>
                )}
            </ScrollArea>

            <ImagePreview
                images={imageUrls}
                currentIndex={previewIndex}
                open={previewOpen}
                onOpenChange={setPreviewOpen}
            />
        </div>
    );
}
