import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CropBox, CropImage } from "../types";

const MAX_HISTORY_ENTRIES = 30;

type CropImageSnapshot = {
    id: string;
    name: string;
    file: File;
    url: string;
    previewUrl: string;
    previewWidth: number;
    previewHeight: number;
    width: number;
    height: number;
    crop: CropBox;
};

type HistoryEntry = {
    before: CropImageSnapshot;
    after: CropImageSnapshot;
};

type HistoryStack = {
    past: HistoryEntry[];
    future: HistoryEntry[];
};

const snapshot = (image: CropImage): CropImageSnapshot => ({
    id: image.id,
    name: image.name,
    file: image.file,
    url: image.url,
    previewUrl: image.previewUrl,
    previewWidth: image.previewWidth,
    previewHeight: image.previewHeight,
    width: image.width,
    height: image.height,
    crop: { ...image.crop },
});

const sameCrop = (first: CropBox, second: CropBox) =>
    first.x === second.x &&
    first.y === second.y &&
    first.w === second.w &&
    first.h === second.h;

const restoreSnapshot = (image: CropImage, restored: CropImageSnapshot): CropImage => ({
    ...image,
    ...restored,
    crop: { ...restored.crop },
});

type UseCropHistoryParams = {
    activeId: string | null;
    setImages: Dispatch<SetStateAction<CropImage[]>>;
};

export function useCropHistory({ activeId, setImages }: UseCropHistoryParams) {
    const stacksRef = useRef<Record<string, HistoryStack>>({});
    const [, forceUpdate] = useState(0);

    const touch = useCallback(() => forceUpdate((value) => value + 1), []);

    const getStack = useCallback((id: string) => {
        const existing = stacksRef.current[id];
        if (existing) return existing;
        const created = { past: [], future: [] };
        stacksRef.current[id] = created;
        return created;
    }, []);

    const recordImageChange = useCallback(
        (before: CropImage, after: CropImage) => {
            if (before.id !== after.id) return;
            if (
                before.url === after.url &&
                before.width === after.width &&
                before.height === after.height &&
                sameCrop(before.crop, after.crop)
            ) {
                return;
            }

            const stack = getStack(before.id);
            stack.past = [
                ...stack.past.slice(-(MAX_HISTORY_ENTRIES - 1)),
                { before: snapshot(before), after: snapshot(after) },
            ];
            stack.future = [];
            touch();
        },
        [getStack, touch]
    );

    const recordCropChange = useCallback(
        (image: CropImage, beforeCrop: CropBox, afterCrop: CropBox) => {
            if (sameCrop(beforeCrop, afterCrop)) return;
            recordImageChange(
                { ...image, crop: { ...beforeCrop } },
                { ...image, crop: { ...afterCrop } }
            );
        },
        [recordImageChange]
    );

    const undo = useCallback(() => {
        if (!activeId) return;
        const stack = stacksRef.current[activeId];
        const entry = stack?.past.pop();
        if (!entry) return;
        stack.future.push(entry);
        setImages((current) =>
            current.map((image) =>
                image.id === activeId ? restoreSnapshot(image, entry.before) : image
            )
        );
        touch();
    }, [activeId, setImages, touch]);

    const redo = useCallback(() => {
        if (!activeId) return;
        const stack = stacksRef.current[activeId];
        const entry = stack?.future.pop();
        if (!entry) return;
        stack.past.push(entry);
        setImages((current) =>
            current.map((image) =>
                image.id === activeId ? restoreSnapshot(image, entry.after) : image
            )
        );
        touch();
    }, [activeId, setImages, touch]);

    const clearHistory = useCallback((id?: string) => {
        if (id) {
            delete stacksRef.current[id];
        } else {
            stacksRef.current = {};
        }
        touch();
    }, [touch]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (
                target?.isContentEditable ||
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement
            ) {
                return;
            }

            const modifier = event.metaKey || event.ctrlKey;
            if (!modifier || event.key.toLowerCase() !== "z") return;
            event.preventDefault();
            if (event.shiftKey) {
                redo();
            } else {
                undo();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [redo, undo]);

    const activeStack = activeId ? stacksRef.current[activeId] : undefined;

    return {
        canRedo: Boolean(activeStack?.future.length),
        canUndo: Boolean(activeStack?.past.length),
        clearHistory,
        recordCropChange,
        recordImageChange,
        redo,
        undo,
    };
}
