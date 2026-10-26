import { loadSaveAs } from "@/utils/lazy-deps";

export type DownloadFile = {
    data: Blob | File;
    name: string;
};

const DOWNLOAD_INTERVAL_MS = 120;

const waitForNextDownload = () =>
    new Promise<void>((resolve) => {
        window.setTimeout(resolve, DOWNLOAD_INTERVAL_MS);
    });

export async function downloadFilesIndividually(files: DownloadFile[]) {
    const saveAs = await loadSaveAs();

    for (const file of files) {
        saveAs(file.data, file.name);
        await waitForNextDownload();
    }
}
