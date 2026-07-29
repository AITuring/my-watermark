import { Icon } from "@iconify/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import type { UploadState } from "../types";

interface SortableImageItemProps {
    image: UploadState;
    index: number;
    onRemove: (index: number) => void;
}

export default function SortableImageItem({
    image,
    index,
    onRemove,
}: SortableImageItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({
            id: image.id,
            disabled: image.status === "loading",
        });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 ${
                isDragging ? "opacity-70" : ""
            }`}
        >
            <div className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900">
                {image.previewUrl ? (
                    <img
                        src={image.previewUrl}
                        alt={`图片 ${index + 1} 预览`}
                        className="aspect-[4/3] h-full w-full object-cover"
                    />
                ) : image.status === "loading" ? (
                    <div className="flex aspect-[4/3] h-full w-full items-center justify-center text-slate-500 dark:text-slate-400">
                        <Icon icon="mdi:loading" className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <div className="flex aspect-[4/3] h-full w-full items-center justify-center text-rose-500 dark:text-rose-300">
                        <Icon icon="mdi:alert-circle-outline" className="h-8 w-8" />
                    </div>
                )}
                <div className="absolute left-2 top-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">#{index + 1}</Badge>
                    {index === 0 && <Badge variant="default">初始参考</Badge>}
                </div>
                <div className="absolute right-2 top-2 flex gap-2">
                    <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/35 text-white transition hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-40"
                        {...attributes}
                        {...listeners}
                        disabled={image.status === "loading"}
                        aria-label={`拖拽调整图片 ${index + 1} 顺序`}
                    >
                        <Icon icon="mdi:drag" className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/35 text-white transition hover:bg-rose-500"
                        onClick={() => onRemove(index)}
                        aria-label={`移除图片 ${index + 1}`}
                    >
                        <Icon icon="mdi:close" className="h-5 w-5" />
                    </button>
                </div>
            </div>
            <div className="space-y-2 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                        {image.status === "ready"
                            ? "已就绪"
                            : image.status === "loading"
                              ? "生成预览中"
                              : "加载失败"}
                    </Badge>
                </div>
                <p className="truncate text-sm text-slate-700 dark:text-slate-200">
                    {image.file?.name}
                </p>
                {image.status === "loading" && (
                    <p className="text-xs text-blue-600 dark:text-blue-300">
                        TIFF 预览较慢，正在后台逐张解码
                    </p>
                )}
                {image.status === "error" && (
                    <p className="text-xs text-rose-600 dark:text-rose-300">
                        {image.errorMessage || "图片不可用"}
                    </p>
                )}
            </div>
        </div>
    );
}
