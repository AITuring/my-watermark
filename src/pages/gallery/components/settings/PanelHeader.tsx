import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";

import { cn } from "@/lib/utils";

type PanelHeaderProps = {
    settingsOpen: boolean;
    imagesCount: number;
    onToggleOpen: () => void;
};

export function PanelHeader({
    settingsOpen,
    imagesCount,
    onToggleOpen,
}: PanelHeaderProps) {
    return (
        <div className="flex items-center justify-between p-3 border-b bg-muted/30 shrink-0 h-12">
            {settingsOpen && (
                <span className="font-semibold text-sm flex items-center gap-2 truncate">
                    <Icon icon="tabler:settings" className="w-4 h-4" />
                    拼图设置
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                        {imagesCount}
                    </Badge>
                </span>
            )}
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "h-8 w-8 ml-auto hover:bg-muted",
                    !settingsOpen && "w-full h-full p-0 rounded-full"
                )}
                onClick={onToggleOpen}
            >
                <Icon
                    icon={settingsOpen ? "mdi:chevron-left" : "mdi:cog"}
                    className="w-5 h-5"
                />
            </Button>
        </div>
    );
}
