import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WorkbenchPanel = "images" | "editor" | "settings";

type PanelsProps = {
    images?: ReactNode;
    editor: ReactNode;
    settings?: ReactNode;
    editorLabel?: string;
    settingsLabel?: string;
    imageCount?: number;
    activePanel?: WorkbenchPanel;
    onPanelChange?: (panel: WorkbenchPanel) => void;
    className?: string;
    gridClassName?: string;
};

/** Shared responsive layout; each tool owns the contents and its processing state. */
export function ImageWorkbenchPanels({ images, editor, settings, imageCount, editorLabel = "编辑", settingsLabel = "设置与导出", activePanel, onPanelChange, className, gridClassName }: PanelsProps) {
    const [localPanel, setLocalPanel] = useState<WorkbenchPanel>("editor");
    const requested = activePanel ?? localPanel;
    const id = useId();
    const panels = [
        { key: "images", label: `图片${imageCount === undefined ? "" : ` ${imageCount}`}`, content: images },
        { key: "editor", label: editorLabel, content: editor },
        { key: "settings", label: settingsLabel, content: settings },
    ] as const;
    const visiblePanels = panels.filter(panel => panel.content != null);
    const selected = visiblePanels.some(panel => panel.key === requested) ? requested : visiblePanels[0]?.key;
    return <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
        <div className="mb-3 grid shrink-0 gap-1 rounded-xl border border-border bg-muted p-1 lg:hidden" role="group" aria-label="工作区面板" style={{ gridTemplateColumns: `repeat(${visiblePanels.length}, minmax(0, 1fr))` }}>
            {visiblePanels.map(panel => <button key={panel.key} type="button" aria-controls={`${id}-${panel.key}`} aria-pressed={selected === panel.key}
                onClick={() => { setLocalPanel(panel.key); onPanelChange?.(panel.key); }}
                className={cn("min-h-11 rounded-lg px-2 text-sm", selected === panel.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{panel.label}</button>)}
        </div>
        <div className={cn("grid min-h-0 flex-1 gap-4", visiblePanels.length === 3 ? "lg:grid-cols-[200px_minmax(0,1fr)_290px] xl:grid-cols-[220px_minmax(0,1fr)_310px]" : images ? "lg:grid-cols-[280px_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_310px]", gridClassName)}>
            {visiblePanels.map(panel => <div key={panel.key} id={`${id}-${panel.key}`} aria-label={panel.label}
                className={cn("min-h-0 min-w-0 flex-col lg:flex", selected === panel.key ? "flex" : "hidden")}>{panel.content}</div>)}
        </div>
    </div>;
}

export function ImageWorkbenchHeader({ title, description, icon, actions }: { title: ReactNode; description?: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
    return <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">{icon}{title}</h1>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>;
}
