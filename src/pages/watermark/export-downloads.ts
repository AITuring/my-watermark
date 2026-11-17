import {importWithRecovery} from '@/utils/import-recovery';
import {uniqueArchiveName} from './export-names';

export type WatermarkDownloadMode = 'zip' | 'files';

export async function downloadWatermarkOutputs(
    files: File[],
    mode: WatermarkDownloadMode,
    download: (file: File) => void,
    onProgress: (percent: number) => void,
) {
    const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', {numeric: true}));
    const used = new Set<string>();
    if (mode === 'files' || ordered.length === 1) {
        for (let index = 0; index < ordered.length; index++) {
            const file = ordered[index];
            const name = uniqueArchiveName(file.name, used);
            download(name === file.name ? file : new File([file], name, {type: file.type, lastModified: file.lastModified}));
            onProgress((index + 1) / ordered.length * 100);
            // Space separate requests so the browser can start each download.
            if (index < ordered.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
        }
    } else if (ordered.length) {
        const {default: JSZip} = await importWithRecovery(() => import('jszip'), 'watermark:zip');
        const archive = new JSZip();
        ordered.forEach(file => archive.file(uniqueArchiveName(file.name, used), file.arrayBuffer()));
        const blob = await archive.generateAsync({type: 'blob', compression: 'STORE', streamFiles: true},
            metadata => onProgress(metadata.percent));
        download(new File([blob], `watermarks-${ordered.length}.zip`, {type: 'application/zip'}));
    }
}
