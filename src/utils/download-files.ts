import { downloadExportFiles } from "@/utils/image-export";
export type DownloadFile = { data: Blob | File; name: string };
export const downloadFilesIndividually = (files: DownloadFile[]) => downloadExportFiles(files, { mode: "files" });
