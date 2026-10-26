import { HardDrive } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatBytes, type FileStorageEstimate } from "@/utils/file-storage";

type StorageStatusProps = {
    estimate: FileStorageEstimate;
};

const SESSION_WARNING_BYTES = 80 * 1024 * 1024;

export default function StorageStatus({ estimate }: StorageStatusProps) {
    const quotaPercent = estimate.quotaBytes
        ? Math.min(100, (estimate.fileBytes / estimate.quotaBytes) * 100)
        : null;
    const isWarning =
        estimate.fileBytes >= SESSION_WARNING_BYTES || (quotaPercent !== null && quotaPercent >= 80);

    return (
        <div
            role="status"
            className={`space-y-2 rounded-lg border px-3 py-2 text-xs ${
                isWarning
                    ? "border-amber-300/70 bg-amber-50/80 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/25 dark:text-amber-100"
                    : "border-border/60 bg-muted/20 text-muted-foreground"
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                    <HardDrive className="h-3.5 w-3.5" />
                    本地会话空间
                </span>
                <span className="tabular-nums">{formatBytes(estimate.fileBytes)}</span>
            </div>
            {quotaPercent !== null && (
                <Progress value={quotaPercent} className={isWarning ? "bg-amber-200/70 dark:bg-amber-900/50" : "h-1.5"} />
            )}
            <p className="m-0 leading-4">
                {isWarning
                    ? "暂存数据较大，建议先导出结果后清理会话。"
                    : estimate.quotaBytes
                      ? `浏览器配额约 ${formatBytes(estimate.quotaBytes)}`
                      : "图片会保存在当前浏览器会话中，刷新后可恢复。"}
            </p>
        </div>
    );
}
