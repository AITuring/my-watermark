import { forwardRef, memo } from "react";
import type React from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icon } from "@iconify/react";
import clsx from "clsx";

import type { PhotoFrameProps, SortablePhotoProps } from "../types";

export const PuzzlePhotoFrame = memo(
    forwardRef<HTMLDivElement, PhotoFrameProps>(function PuzzlePhotoFrame(
        props,
        ref
    ) {
        const {
            imageProps,
            wrapperStyle,
            overlay,
            active,
            insertPosition,
            attributes,
            listeners,
            photo,
            onDelete,
            radius,
            onPreview,
            index,
        } = props;
        const { alt, style = {}, ...restImageProps } = imageProps;

        return (
            <div
                ref={ref}
                style={{
                    ...(wrapperStyle ?? {}),
                    width: wrapperStyle?.width ?? style.width,
                    boxSizing: "border-box",
                    position: "relative",
                    transition:
                        "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
                }}
                className={clsx("photo-frame group", {
                    overlay,
                    active,
                    insertBefore: insertPosition === "before",
                    insertAfter: insertPosition === "after",
                })}
                {...attributes}
                {...listeners}
            >
                <div className="relative">
                    <img
                        alt={alt}
                        style={{
                            ...style,
                            borderRadius: radius || 0,
                            cursor: "zoom-in",
                        }}
                        {...restImageProps}
                        onClick={() => {
                            if (!overlay && onPreview) {
                                onPreview(index ?? 0);
                            }
                        }}
                    />
                    <div className="interactive-overlay absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 pointer-events-none group-hover:opacity-100">
                        <div className="flex items-center text-white">
                            <Icon icon="ph:eye-bold" className="w-5 h-5 mr-2" />
                            预览
                        </div>
                    </div>
                </div>

                {!overlay && (
                    <div className="interactive-actions opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1 right-1 w-6 h-6 p-0 rounded-full"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onDelete?.(photo.id);
                                        }}
                                    >
                                        <Icon
                                            icon="material-symbols:delete-outline-sharp"
                                            className="w-3 h-3"
                                        />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>删除</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )}
            </div>
        );
    }),
    (prevProps, nextProps) =>
        prevProps.imageProps.src === nextProps.imageProps.src &&
        prevProps.active === nextProps.active &&
        prevProps.insertPosition === nextProps.insertPosition &&
        prevProps.overlay === nextProps.overlay &&
        prevProps.margin === nextProps.margin &&
        prevProps.radius === nextProps.radius
);

type SortablePuzzlePhotoFrameProps = SortablePhotoProps & {
    activeIndex?: number;
    onDelete?: (id: UniqueIdentifier) => void;
    margin?: number;
    radius?: number;
    attributes?: Partial<React.HTMLAttributes<HTMLDivElement>>;
};

export function SortablePuzzlePhotoFrame(
    props: SortablePuzzlePhotoFrameProps
) {
    const { photo, activeIndex, onDelete, margin, radius } = props;
    const { attributes, listeners, isDragging, index, over, setNodeRef } =
        useSortable({ id: photo.id });

    return (
        <PuzzlePhotoFrame
            ref={setNodeRef}
            active={isDragging}
            insertPosition={
                activeIndex !== undefined && over?.id === photo.id && !isDragging
                    ? index > activeIndex
                        ? "after"
                        : "before"
                    : undefined
            }
            aria-label="sortable image"
            attributes={attributes}
            listeners={listeners}
            onDelete={onDelete}
            margin={margin}
            radius={radius}
            {...props}
        />
    );
}
