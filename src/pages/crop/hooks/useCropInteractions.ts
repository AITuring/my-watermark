import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from "react";
import { buildAspectBox, clamp, fitBoxInImage, normalizeBox } from "../helpers";
import type { CropBox, CropImage, DragMode, DragState } from "../types";

type UseCropInteractionsParams = {
    activeId: string | null;
    activeImage: CropImage | null;
    isFreeMode: boolean;
    selectedRatio: number | null;
    setImages: Dispatch<SetStateAction<CropImage[]>>;
    stageRef: RefObject<HTMLDivElement | null>;
};

export function useCropInteractions({
    activeId,
    activeImage,
    isFreeMode,
    selectedRatio,
    setImages,
    stageRef,
}: UseCropInteractionsParams) {
    const dragRef = useRef<DragState>({
        active: false,
        mode: "new",
        startPoint: { x: 0, y: 0 },
        startCrop: null,
    });
    const animationFrameRef = useRef<number | null>(null);
    const pendingCropRef = useRef<CropBox | null>(null);

    const updateActiveCrop = useCallback(
        (updater: (prev: CropBox, image: CropImage) => CropBox) => {
            if (!activeId) return;
            setImages((prev) =>
                prev.map((item) => {
                    if (item.id !== activeId) return item;
                    const next = updater(item.crop, item);
                    return { ...item, crop: fitBoxInImage(next, item.width, item.height) };
                })
            );
        },
        [activeId, setImages]
    );

    const getImagePoint = useCallback(
        (clientX: number, clientY: number) => {
            const stageEl = stageRef.current;
            if (!stageEl || !activeImage) return null;
            const rect = stageEl.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return null;

            const x = ((clientX - rect.left) / rect.width) * activeImage.width;
            const y = ((clientY - rect.top) / rect.height) * activeImage.height;
            return {
                x: clamp(x, 0, activeImage.width),
                y: clamp(y, 0, activeImage.height),
            };
        },
        [activeImage, stageRef]
    );

    const flushScheduledCropUpdate = useCallback(() => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (!pendingCropRef.current) return;
        const nextCrop = pendingCropRef.current;
        pendingCropRef.current = null;
        updateActiveCrop(() => nextCrop);
    }, [updateActiveCrop]);

    const scheduleCropUpdate = useCallback(
        (nextCrop: CropBox) => {
            pendingCropRef.current = nextCrop;
            if (animationFrameRef.current !== null) return;
            animationFrameRef.current = requestAnimationFrame(() => {
                animationFrameRef.current = null;
                if (!pendingCropRef.current) return;
                const next = pendingCropRef.current;
                pendingCropRef.current = null;
                updateActiveCrop(() => next);
            });
        },
        [updateActiveCrop]
    );

    const startDrag = useCallback(
        (dragMode: DragMode, event: ReactPointerEvent) => {
            if (!activeImage) return;
            const point = getImagePoint(event.clientX, event.clientY);
            if (!point) return;
            dragRef.current = {
                active: true,
                mode: dragMode,
                startPoint: point,
                startCrop: activeImage.crop,
            };
        },
        [activeImage, getImagePoint]
    );

    useEffect(() => {
        const onMove = (event: PointerEvent) => {
            const dragState = dragRef.current;
            if (!dragState.active || !activeImage) return;

            const point = getImagePoint(event.clientX, event.clientY);
            if (!point) return;

            if (dragState.mode === "move" && dragState.startCrop) {
                const dx = point.x - dragState.startPoint.x;
                const dy = point.y - dragState.startPoint.y;
                const nextX = clamp(dragState.startCrop.x + dx, 0, activeImage.width - dragState.startCrop.w);
                const nextY = clamp(dragState.startCrop.y + dy, 0, activeImage.height - dragState.startCrop.h);
                scheduleCropUpdate({ ...dragState.startCrop, x: nextX, y: nextY });
                return;
            }

            let anchor = dragState.startPoint;
            if (dragState.mode !== "new" && dragState.startCrop) {
                const { x, y, w, h } = dragState.startCrop;
                if (dragState.mode === "nw") anchor = { x: x + w, y: y + h };
                if (dragState.mode === "ne") anchor = { x, y: y + h };
                if (dragState.mode === "sw") anchor = { x: x + w, y };
                if (dragState.mode === "se") anchor = { x, y };
            }

            const nextCrop = isFreeMode
                ? fitBoxInImage(
                      normalizeBox({
                          x: anchor.x,
                          y: anchor.y,
                          w: point.x - anchor.x,
                          h: point.y - anchor.y,
                      }),
                      activeImage.width,
                      activeImage.height
                  )
                : buildAspectBox(anchor, point, selectedRatio ?? 1, activeImage.width, activeImage.height);

            if (nextCrop.w < 2 || nextCrop.h < 2) return;
            scheduleCropUpdate(nextCrop);
        };

        const onUp = () => {
            flushScheduledCropUpdate();
            dragRef.current.active = false;
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
    }, [activeImage, flushScheduledCropUpdate, getImagePoint, isFreeMode, scheduleCropUpdate, selectedRatio]);

    useEffect(() => {
        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    return {
        flushScheduledCropUpdate,
        startDrag,
    };
}
