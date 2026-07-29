import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";

type ActionsSectionProps = {
    onDownload: () => void;
    onAddMore: () => void;
    onClear: () => void;
};

export function ActionsSection({
    onDownload,
    onAddMore,
    onClear,
}: ActionsSectionProps) {
    return (
        <div className="grid grid-cols-2 gap-2 pb-4">
            <Button className="col-span-2" onClick={onDownload}>
                <Icon icon="mdi:download" className="w-4 h-4 mr-2" />
                Download Image
            </Button>
            <Button size="sm" variant="outline" onClick={onAddMore}>
                <Icon icon="mdi:plus" className="w-4 h-4 mr-2" />
                Add More
            </Button>
            <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={onClear}
            >
                <Icon icon="mdi:delete" className="w-4 h-4 mr-2" />
                Clear
            </Button>
        </div>
    );
}
