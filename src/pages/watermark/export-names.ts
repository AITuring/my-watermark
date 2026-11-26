export function watermarkOutputName(filename:string,mimeType:string) {
    const stem=filename.replace(/\.[^.]+$/,'');
    return `${stem}-mark.${mimeType==='image/webp'?'webp':'jpg'}`;
}
export { uniqueExportName as uniqueArchiveName } from "@/utils/image-export/names";
