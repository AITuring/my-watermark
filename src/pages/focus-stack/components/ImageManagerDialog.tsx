import { Icon } from "@iconify/react";
import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    type useSensors,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import ImageUploader from "@/components/ImageUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import SortableImageItem from "./SortableImageItem";
import type { UploadState } from "../types";

interface ImageManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    images: UploadState[];
    readyCount: number;
    loadingCount: number;
    sensors: ReturnType<typeof useSensors>;
    onUpload: (files: File[]) => void;
    onDragEnd: (event: DragEndEvent) => void;
    onRemoveImage: (index: number) => void;
    onClearImages: () => void;
}

export default function ImageManagerDialog({
    open,
    onOpenChange,
    images,
    readyCount,
    loadingCount,
    sensors,
    onUpload,
    onDragEnd,
    onRemoveImage,
    onClearImages,
}: ImageManagerDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] p-0">
                <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                    <DialogHeader className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                        <DialogTitle>管理焦点序列</DialogTitle>
                        <DialogDescription>
                            第一张作为初始参考图。拖拽可调整顺序，删除或继续添加都在这里完成。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto px-6 py-5">
                        <div className="space-y-5">
                            <ImageUploader onUpload={onUpload} fileType="焦点序列">
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500 dark:hover:bg-slate-950">
                                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                                            <Icon icon="mdi:image-plus" className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">继续添加图片</div>
                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                支持批量添加，新增图片会接到当前序列末尾
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ImageUploader>

                            {images.length > 0 ? (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={onDragEnd}
                                >
                                    <SortableContext
                                        items={images.map((image) => image.id)}
                                        strategy={rectSortingStrategy}
                                    >
                                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                                            {images.map((image, index) => (
                                                <SortableImageItem
                                                    key={image.id}
                                                    image={image}
                                                    index={index}
                                                    onRemove={onRemoveImage}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            ) : (
                                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-900">
                                    <Icon
                                        icon="mdi:image-multiple-outline"
                                        className="h-10 w-10 text-slate-400"
                                    />
                                    <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                                        还没有图片
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        先添加至少两张不同对焦点的图片
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">总数 {images.length} 张</Badge>
                            <Badge variant="outline">可用 {readyCount} 张</Badge>
                            {loadingCount > 0 && (
                                <Badge variant="outline">加载中 {loadingCount} 张</Badge>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            onClick={onClearImages}
                            disabled={images.length === 0}
                        >
                            清空全部
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
