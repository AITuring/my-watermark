import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UploadPermissionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    recentUploadedCount: number;
    secondaryButtonClass: string;
    accentButtonClass: string;
    onBindDirectory: () => void;
}

const UploadPermissionDialog = ({
    open,
    onOpenChange,
    recentUploadedCount,
    secondaryButtonClass,
    accentButtonClass,
    onBindDirectory,
}: UploadPermissionDialogProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <DialogHeader>
                <DialogTitle>已上传图片</DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">
                    已读取 {recentUploadedCount} 张图片。若要后续直接写回 JPEG / PNG 原文件，现在请继续授权图片所在文件夹的读取与写入权限。
                </DialogDescription>
            </DialogHeader>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
                授权后，已上传的 JPEG / PNG 图片就可以直接写回原文件；不授权也可以继续查看和导出修改后图片。
            </div>
            <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="outline" className={secondaryButtonClass} onClick={() => onOpenChange(false)}>
                    稍后再说
                </Button>
                <Button
                    className={accentButtonClass}
                    onClick={() => {
                        onOpenChange(false);
                        onBindDirectory();
                    }}
                >
                    授权文件夹读取权限
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

export default UploadPermissionDialog;
