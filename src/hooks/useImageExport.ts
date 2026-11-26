import { useCallback, useRef, useState } from "react";
import { exportImages, type ImageExportFile, type ImageExportMode } from "@/utils/image-export";

export function useImageExport<T>({ items, current, render, archiveName, folder }: {
    items: readonly T[]; current?: T | null;
    render: (item: T, index: number) => Promise<ImageExportFile> | ImageExportFile;
    archiveName?: string; folder?: string;
}) {
    const running = useRef(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const run = useCallback(async (mode: ImageExportMode) => {
        if (running.current) return;
        const sources = mode === "current" ? current ? [current] : [] : [...items];
        if (!sources.length) return;
        running.current = true;
        setLoading(true);
        setProgress(0);
        try {
            await exportImages(sources, render, { mode, archiveName, folder, onProgress: setProgress });
        } finally {
            running.current = false;
            setLoading(false);
        }
    }, [items, current, render, archiveName, folder]);
    return { loading, progress, run };
}
