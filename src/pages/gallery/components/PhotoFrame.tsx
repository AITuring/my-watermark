import { forwardRef, memo } from "react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";

import type { ImgProp, PhotoFrameProps, SortablePhotoProps } from "../types";

export const PhotoFrame = memo(
    forwardRef<HTMLDivElement, PhotoFrameProps>(function PhotoFrame(props, ref) {
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
            frameThickness = 20,
            hasMat = true,
            matColor = "#f0f0f0",
            matSize = 30,
            frameOpacity = 0.6,
        } = props;
        const { alt, style = {}, ...restImageProps } = imageProps;

        const frameStyle = {
            backgroundColor: `rgba(255, 255, 255, ${frameOpacity})`,
            backdropFilter: "blur(40px) saturate(100%)",
            WebkitBackdropFilter: "blur(40px) saturate(100%)",
            boxShadow: `
                0 20px 40px -10px rgba(0, 0, 0, 0.2),
                inset 0 1px 2px rgba(255, 255, 255, 0.4),
                inset 0 0 30px rgba(255,255,255,0.2),
                0 0 0 1px rgba(255,255,255,0.3)
            `,
            border: "1px solid rgba(255, 255, 255, 0.2)",
            padding: `${frameThickness}px`,
            position: "relative" as const,
            transition: "all 0.3s ease",
            ...wrapperStyle,
            borderRadius: radius ? `${radius}px` : "0px",
        };

        const matStyle = {
            backgroundColor: matColor,
            padding: hasMat ? `${matSize}px` : "0px",
            boxShadow: hasMat ? "inset 1px 1px 3px rgba(0,0,0,0.1)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
        };

        return (
            <div
                ref={ref}
                style={{
                    ...frameStyle,
                    width: overlay ? (wrapperStyle?.width ?? style.width) : style.width,
                    boxSizing: "border-box",
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
                <div style={matStyle}>
                    <div
                        className="relative w-full h-full"
                        style={{
                            boxShadow: hasMat
                                ? `
                                2px 2px 4px rgba(0,0,0,0.2),
                                inset 1px 1px 0px rgba(255,255,255,0.5)
                            `
                                : "none",
                            overflow: "hidden",
                        }}
                    >
                        <img
                            alt={alt}
                            style={{
                                ...style,
                                width: "100%",
                                height: "auto",
                                padding: 0,
                                margin: 0,
                                borderRadius: 0,
                                cursor: "zoom-in",
                                display: "block",
                            }}
                            {...restImageProps}
                            onClick={() => {
                                if (!overlay && onPreview) {
                                    onPreview(index ?? 0);
                                }
                            }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 pointer-events-none group-hover:opacity-100">
                            <div className="flex items-center text-white">
                                <Icon icon="ph:eye-bold" className="w-5 h-5 mr-2" />
                                预览
                            </div>
                        </div>
                    </div>
                </div>

                {!overlay && (
                    <div className="opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-20">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute -top-3 -right-3 w-8 h-8 p-0 rounded-full shadow-md border-2 border-white"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onDelete?.(photo.id);
                                        }}
                                    >
                                        <Icon
                                            icon="material-symbols:delete-outline-sharp"
                                            className="w-4 h-4"
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
        prevProps.frameColor === nextProps.frameColor &&
        prevProps.frameThickness === nextProps.frameThickness &&
        prevProps.hasMat === nextProps.hasMat &&
        prevProps.matColor === nextProps.matColor &&
        prevProps.matSize === nextProps.matSize &&
        prevProps.frameOpacity === nextProps.frameOpacity
);

type SortablePhotoFrameProps = SortablePhotoProps & {
    activeIndex?: number;
    onDelete?: (id: UniqueIdentifier) => void;
    margin?: number;
    radius?: number;
    frameColor?: string;
    frameThickness?: number;
    hasMat?: boolean;
    matColor?: string;
    matSize?: number;
    frameOpacity?: number;
};

export function SortablePhotoFrame(props: SortablePhotoFrameProps) {
    const {
        photo,
        activeIndex,
        onDelete,
        margin,
        radius,
        frameColor,
        frameThickness,
        hasMat,
        matColor,
        matSize,
        frameOpacity,
    } = props;
    const { attributes, listeners, isDragging, index, over, setNodeRef } =
        useSortable({ id: photo.id });

    return (
        <PhotoFrame
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
            frameColor={frameColor}
            frameThickness={frameThickness}
            hasMat={hasMat}
            matColor={matColor}
            matSize={matSize}
            frameOpacity={frameOpacity}
            {...props}
        />
    );
}

export const getPhotoFrameColor = (photo: ImgProp, defaultFrameColor: string) =>
    photo.frameColor || defaultFrameColor;
