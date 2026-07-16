import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FolderOpen, Image as ImageIcon, Upload } from "lucide-react";

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
    accentButtonClass,
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
    <Card className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
        <CardContent className="space-y-3 p-5">
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl text-center transition-all ${
                    hasItems ? "px-5 py-4" : "p-8 md:p-9"
                } ${
                    isDragActive
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                        : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
                }`}
            >
                <input {...getInputProps()} />
                <div className={`flex items-center justify-center gap-3 ${hasItems ? "min-h-[56px]" : "flex-col"}`}>
                    <Upload className={`text-slate-400 ${hasItems ? "h-8 w-8 shrink-0" : "mb-4 h-12 w-12"}`} />
                    <div className={`space-y-1 ${hasItems ? "text-left" : "space-y-2"}`}>
                        <p className={`${hasItems ? "text-base font-medium" : "text-lg font-medium"}`}>
                            {isDragActive ? "释放图片开始读取" : hasItems ? "继续拖拽添加图片" : "拖拽图片到这里"}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {hasItems
                                ? "可继续补充图片，或直接使用下方按钮进行选择与授权"
                                : "先上传图片查看和修改；上传完成后，如需直接写回原文件，再继续授权原文件"}
                        </p>
                    </div>
                </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300 space-y-1">
                <p>推荐上传：通用兼容优先 `JPEG`，需要无损或透明背景优先 `PNG`，`TIF` 更适合读取检查后再导出。</p>
                <p>推荐导出：日常分享和体积优先 `JPEG`；需要保留透明背景或无损内容时优先 `PNG`；`TIF` 当前建议转导出为 `JPEG`。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-900/60">
                <Button size="sm" onClick={openFilePicker} className={primaryButtonClass}>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    选择图片
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className={secondaryButtonClass}
                    onClick={onSelectDirectory}
                    disabled={isImportingDirectory}
                >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    {isImportingDirectory ? "读取文件夹中..." : "选择文件夹并授权写入"}
                </Button>
                <Button
                    size="sm"
                    variant={hasItems ? "default" : "outline"}
                    className={hasItems ? accentButtonClass : secondaryButtonClass}
                    onClick={onBindDirectory}
                    disabled={!hasItems || isBindingDirectory}
                >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    {isBindingDirectory ? "授权中..." : "授权文件夹读取权限"}
                </Button>
                {directoryHandleName && (
                    <Badge variant="outline" className="rounded-xl border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                        已授权文件夹：{directoryHandleName}
                    </Badge>
                )}
            </div>
            {hasItems && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    已上传 {itemCount} 张图片。若要直接写回原文件，请继续授权 JPEG / PNG 所在文件夹；目前已授权 {linkedCount} 张，还有 {bindableCount} 张 JPEG / PNG 可继续授权。
                </p>
            )}
        </CardContent>
    </Card>
);

export default ImportPanel;
