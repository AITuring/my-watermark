import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
    ImportDiffRow,
    ImportScopeDefinition,
    ImportScopeSelection,
    PhotoExifItem,
} from "@/pages/photo-exif/types";
import { createImportScopeSelection, getEffectiveFileName } from "@/pages/photo-exif/utils";

interface ImportScopeSummary extends ImportScopeDefinition {
    diffRows: ImportDiffRow[];
    diffCount: number;
}

interface ImportConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pendingImportPersistInPlace: boolean;
    selectedItem: PhotoExifItem | null;
    selectedImportSourceItem: PhotoExifItem | null;
    importScopeSelection: ImportScopeSelection;
    setImportScopeSelection: Dispatch<SetStateAction<ImportScopeSelection>>;
    importScopeSummaries: ImportScopeSummary[];
    defaultImportScopeSelection: ImportScopeSelection;
    secondaryButtonClass: string;
    accentButtonClass: string;
    dangerButtonClass: string;
    onConfirm: () => void;
}

const ImportConfirmDialog = ({
    open,
    onOpenChange,
    pendingImportPersistInPlace,
    selectedItem,
    selectedImportSourceItem,
    importScopeSelection,
    setImportScopeSelection,
    importScopeSummaries,
    defaultImportScopeSelection,
    secondaryButtonClass,
    accentButtonClass,
    dangerButtonClass,
    onConfirm,
}: ImportConfirmDialogProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <DialogHeader>
                <DialogTitle>选择要导入的信息</DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">
                    {pendingImportPersistInPlace
                        ? "先勾选需要从 B 图导入到 A 图的内容，再根据右侧差异确认是否执行。确认后会直接写回原文件。"
                        : "先勾选需要从 B 图导入到 A 图的内容，再根据右侧差异确认是否执行。"}
                </DialogDescription>
            </DialogHeader>
            {selectedItem && selectedImportSourceItem && (
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                            <p className="text-xs text-slate-500 dark:text-slate-400">A 图（目标图）</p>
                            <p className="mt-1 text-sm font-medium break-all">{getEffectiveFileName(selectedItem)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                            <p className="text-xs text-slate-500 dark:text-slate-400">B 图（来源图）</p>
                            <p className="mt-1 text-sm font-medium break-all">{getEffectiveFileName(selectedImportSourceItem)}</p>
                        </div>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className={secondaryButtonClass}
                                    onClick={() => setImportScopeSelection(createImportScopeSelection(["gps"]))}
                                >
                                    只导入GPS
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className={secondaryButtonClass}
                                    onClick={() => setImportScopeSelection(createImportScopeSelection(["time"]))}
                                >
                                    只导入时间
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className={secondaryButtonClass}
                                    onClick={() => setImportScopeSelection(defaultImportScopeSelection)}
                                >
                                    恢复默认勾选
                                </Button>
                            </div>
                            {importScopeSummaries.map((scope) => (
                                <label
                                    key={scope.key}
                                    className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${
                                        importScopeSelection[scope.key]
                                            ? "border-blue-500 bg-blue-50/70 dark:border-blue-500/70 dark:bg-blue-950/20"
                                            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={importScopeSelection[scope.key]}
                                        onChange={(event) =>
                                            setImportScopeSelection((previous) => ({
                                                ...previous,
                                                [scope.key]: event.target.checked,
                                            }))
                                        }
                                    />
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium">{scope.label}</p>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {scope.diffCount ? `${scope.diffCount} 处差异` : "无差异"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{scope.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                                <div>
                                    <p className="text-sm font-medium">A / B 差异预览</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        仅展示当前勾选分类；左侧是 A 图当前值，右侧是 B 图来源值
                                    </p>
                                </div>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {Object.values(importScopeSelection).filter(Boolean).length} 类已选
                                </span>
                            </div>
                            <ScrollArea className="h-[360px] pr-4">
                                <div className="space-y-4 pt-4">
                                    {importScopeSummaries.filter((scope) => importScopeSelection[scope.key]).length > 0 ? (
                                        importScopeSummaries
                                            .filter((scope) => importScopeSelection[scope.key])
                                            .map((scope) => {
                                                const changedRows = scope.diffRows.filter((row) => row.changed);
                                                return (
                                                    <div key={scope.key} className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="text-sm font-medium">{scope.label}</p>
                                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                                {changedRows.length ? `${changedRows.length} 处将被覆盖` : "当前无差异"}
                                                            </span>
                                                        </div>
                                                        {changedRows.length ? (
                                                            <div className="space-y-2">
                                                                {changedRows.map((row) => (
                                                                    <div
                                                                        key={`${scope.key}-${row.fieldLabel}`}
                                                                        className={`grid gap-2 rounded-xl p-3 ${
                                                                            row.willClearTarget
                                                                                ? "border border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20"
                                                                                : "bg-slate-50/70 dark:bg-slate-900/50"
                                                                        }`}
                                                                    >
                                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{row.fieldLabel}</p>
                                                                            {row.willClearTarget && (
                                                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
                                                                                    导入后将清空
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="grid gap-2 md:grid-cols-2">
                                                                            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                                                                                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">A 图当前值</p>
                                                                                <p className="mt-1 text-sm break-words">{row.targetValue}</p>
                                                                            </div>
                                                                            <div
                                                                                className={`rounded-lg border p-3 ${
                                                                                    row.willClearTarget
                                                                                        ? "border-amber-300 bg-amber-100/80 dark:border-amber-900/60 dark:bg-amber-950/40"
                                                                                        : "border-blue-200 bg-blue-50/80 dark:border-blue-900/60 dark:bg-blue-950/30"
                                                                                }`}
                                                                            >
                                                                                <p
                                                                                    className={`text-[11px] uppercase tracking-wide ${
                                                                                        row.willClearTarget
                                                                                            ? "text-amber-700 dark:text-amber-200"
                                                                                            : "text-blue-600 dark:text-blue-300"
                                                                                    }`}
                                                                                >
                                                                                    B 图来源值
                                                                                </p>
                                                                                <p className="mt-1 text-sm break-words">{row.sourceValue}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-slate-500 dark:text-slate-400">该分类下 A / B 当前没有差异，导入后不会有可见变化。</p>
                                                        )}
                                                    </div>
                                                );
                                            })
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                            请至少勾选一类要导入的信息。
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </div>
            )}
            <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="outline" className={secondaryButtonClass} onClick={() => onOpenChange(false)}>
                    取消
                </Button>
                <Button
                    className={pendingImportPersistInPlace ? dangerButtonClass : accentButtonClass}
                    disabled={!selectedItem || !selectedImportSourceItem || !Object.values(importScopeSelection).some(Boolean)}
                    onClick={onConfirm}
                >
                    {pendingImportPersistInPlace ? "确认导入并原地写回" : "确认导入到当前"}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

export default ImportConfirmDialog;
