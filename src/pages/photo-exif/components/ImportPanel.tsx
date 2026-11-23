import EmptyImportPanel from "@/pages/photo-exif/components/EmptyImportPanel";
import { Button } from "@/components/ui/button";
import { FolderOpen, Image as ImageIcon } from "lucide-react";

interface ImportPanelProps {
    accentButtonClass: string;
    getInputProps: () => Record<string, unknown>;
    getRootProps: () => Record<string, unknown>;
    isBindingDirectory: boolean;
    isDragActive: boolean;
    isImportingDirectory: boolean;
    bindableCount: number;
    directoryHandleName: string | null;
    hasItems: boolean;
    itemCount: number;
    linkedCount: number;
    openFilePicker: () => void;
    onBindDirectory: () => void;
    onSelectDirectory: () => void;
    primaryButtonClass: string;
    secondaryButtonClass: string;
}

const ImportPanel = ({
    getInputProps,
    getRootProps,
    isBindingDirectory,
    isDragActive,
    isImportingDirectory,
    bindableCount,
    directoryHandleName,
    hasItems,
    itemCount,
    linkedCount,
    openFilePicker,
    onBindDirectory,
    onSelectDirectory,
    primaryButtonClass,
    secondaryButtonClass,
}: ImportPanelProps) => (
    <div {...getRootProps()} className={!hasItems ? "outline-none" : `rounded-xl border p-3 ${isDragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-800"}`}>
        <input {...getInputProps()} />
        {!hasItems ? <EmptyImportPanel isDragActive={isDragActive} isImportingDirectory={isImportingDirectory} openFilePicker={openFilePicker} onSelectDirectory={onSelectDirectory} /> : <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onSelectDirectory} disabled={isImportingDirectory} className={primaryButtonClass}>
                <FolderOpen className="mr-2 h-4 w-4" />{isImportingDirectory ? "读取中…" : "打开文件夹"}
            </Button>
            <Button size="sm" variant="outline" onClick={openFilePicker} className={secondaryButtonClass}>
                <ImageIcon className="mr-2 h-4 w-4" />添加照片
            </Button>
            {hasItems && bindableCount > 0 && (
                <Button size="sm" variant="outline" onClick={onBindDirectory} disabled={isBindingDirectory} className={secondaryButtonClass}>{isBindingDirectory ? "授权中…" : "授权写回原文件"}</Button>
            )}
            <span className="min-w-0 break-all text-xs text-slate-500 sm:ml-2">
                {isDragActive ? "释放以添加照片" : directoryHandleName ? `${directoryHandleName} · ${linkedCount} 张可写回` : hasItems ? `${itemCount} 张照片 · 可继续拖入` : "或拖入照片 · JPEG / PNG 可写回原文件"}
            </span>
        </div>}
    </div>
);

export default ImportPanel;
