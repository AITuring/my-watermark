import SliderNumberField from "@/components/SliderNumberField";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import type { GalleryLayout } from "../../types";

type LayoutSectionProps = {
    layout: GalleryLayout;
    onLayoutChange: (value: GalleryLayout) => void;
    inputColumns: number | null;
    onInputColumnsChange: (value: number) => void;
    margin: number;
    onMarginChange: (value: number) => void;
    outerPadding: number;
    onOuterPaddingChange: (value: number) => void;
};

export function LayoutSection({
    layout,
    onLayoutChange,
    inputColumns,
    onInputColumnsChange,
    margin,
    onMarginChange,
    outerPadding,
    onOuterPaddingChange,
}: LayoutSectionProps) {
    return (
        <div className="space-y-5 mb-6">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                Layout
            </Label>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs">Mode</Label>
                    <Select
                        value={layout}
                        onValueChange={(value) => onLayoutChange(value as GalleryLayout)}
                    >
                        <SelectTrigger className="w-[140px] h-7 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="rows">Row (行)</SelectItem>
                            <SelectItem value="columns">Column (列)</SelectItem>
                            <SelectItem value="masonry">Masonry</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {layout !== "rows" && (
                <SliderNumberField
                    label="Columns"
                    valueLabel={
                        typeof inputColumns === "number"
                            ? String(inputColumns)
                            : "Auto"
                    }
                    value={typeof inputColumns === "number" ? inputColumns : 0}
                    min={1}
                    max={15}
                    step={1}
                    onChange={onInputColumnsChange}
                    badgeValue
                />
            )}

            <SliderNumberField
                label="Spacing (Gap)"
                valueLabel={`${margin}px`}
                value={margin}
                min={0}
                max={50}
                step={1}
                onChange={onMarginChange}
                badgeValue
            />

            <SliderNumberField
                label="Outer Padding"
                valueLabel={`${outerPadding}px`}
                value={outerPadding}
                min={0}
                max={100}
                step={1}
                onChange={onOuterPaddingChange}
                badgeValue
            />
        </div>
    );
}
