import { downloadExportFiles } from "@/utils/image-export";
export type WatermarkDownloadMode = 'zip' | 'files';
export async function downloadWatermarkOutputs(files: File[], mode: WatermarkDownloadMode, download: (file: File) => void, onProgress: (percent: number) => void) {
    const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
    await downloadExportFiles(ordered.map(file => ({ data: file, name: file.name })), {
        mode, archiveName: `watermarks-${ordered.length}.zip`, singleFileAsFile: true, intervalMs: 300, onProgress,
        download: (data, name) => download(data instanceof File && data.name === name ? data : new File([data], name, { type: data.type })),
    });
}
