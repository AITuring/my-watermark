import type JSZip from "jszip";
import { loadJSZip, loadSaveAs } from "@/utils/lazy-deps";

export type ImageExportMode = "current" | "files" | "zip";
export type ImageExportFile = { data: Blob | File; name: string };
export type ImageExportOptions = {
    mode: ImageExportMode;
    archiveName?: string;
    folder?: string;
    singleFileAsFile?: boolean;
    onProgress?: (percent: number) => void;
    download?: (data: Blob, name: string) => void;
    intervalMs?: number;
};

import { uniqueExportName } from "./names";
export { uniqueExportName } from "./names";

/** Tools provide only source items and their full-resolution renderer. */
export async function exportImages<T>(items: readonly T[], render: (item: T, index: number) => Promise<ImageExportFile> | ImageExportFile, options: ImageExportOptions) {
    const sources = options.mode === "current" ? items.slice(0, 1) : [...items];
    if (!sources.length) return;
    const onProgress = options.onProgress ?? (() => {});
    onProgress(0);
    const save = options.download ?? await loadSaveAs();
    const zipMode = options.mode === "zip" && !(sources.length === 1 && options.singleFileAsFile);
    const zip = zipMode ? new (await loadJSZip() as typeof JSZip)() : null;
    const used = new Set<string>();
    const folder = options.folder ? uniqueExportName(options.folder, new Set()) + "/" : "";
    for (const [index, item] of sources.entries()) {
        const result = await render(item, index);
        const name = uniqueExportName(result.name, used);
        if (zip) zip.file(folder + name, await result.data.arrayBuffer());
        else {
            save(result.data, name);
            if (index < sources.length - 1 && (options.intervalMs ?? 120) > 0) {
                await new Promise(resolve => setTimeout(resolve, options.intervalMs ?? 120));
            }
        }
        onProgress((index + 1) / sources.length * (zip ? 80 : 100));
    }
    if (zip) {
        const blob = await zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }, metadata => onProgress(80 + metadata.percent * .2));
        save(blob, uniqueExportName(options.archiveName ?? `images-${sources.length}.zip`, new Set()));
        onProgress(100);
    }
}

export const downloadExportFiles = (files: readonly ImageExportFile[], options: ImageExportOptions) => exportImages(files, file => file, options);
