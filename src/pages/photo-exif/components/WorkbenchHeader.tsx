import DarkToggle from "@/components/DarkToggle";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface WorkbenchHeaderProps {
    hasItems: boolean;
    dangerSubtleButtonClass: string;
    onClearAll: () => void;
}

const WorkbenchHeader = ({
    hasItems,
    dangerSubtleButtonClass,
    onClearAll,
}: WorkbenchHeaderProps) => (
    <header className={`flex gap-3 ${hasItems ? "flex-col md:flex-row md:items-center md:justify-between" : "items-center justify-between"}`}>
        <div>
            <h1 className="text-2xl font-bold tracking-tight lg:text-[28px]">照片 EXIF</h1>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
                补齐照片信息，保留已有 EXIF。
            </p>
        </div>
        <div className="flex items-center gap-3">
            <DarkToggle />
            {hasItems && (
                <Button variant="outline" className={dangerSubtleButtonClass} onClick={onClearAll}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    清空全部
                </Button>
            )}
        </div>
    </header>
);

export default WorkbenchHeader;
