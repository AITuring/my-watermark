import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type ColorPickerControlProps = {
    value: string;
    onChange: (value: string) => void;
};

type SliderFieldProps = {
    label: ReactNode;
    valueLabel: string;
    value: number[];
    min: number;
    max: number;
    step: number;
    onChange: (value: number[]) => void;
    compact?: boolean;
    mutedLabel?: boolean;
    badgeValue?: boolean;
};

export function ColorPickerControl({
    value,
    onChange,
}: ColorPickerControlProps) {
    return (
        <div className="flex gap-2 items-center">
            <div
                className="w-8 h-8 rounded border shadow-sm shrink-0"
                style={{ backgroundColor: value }}
            />
            <Input
                type="color"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="flex-1 h-8 px-1"
            />
        </div>
    );
}

export function SliderField({
    label,
    valueLabel,
    value,
    min,
    max,
    step,
    onChange,
    compact = false,
    mutedLabel = false,
    badgeValue = false,
}: SliderFieldProps) {
    return (
        <div className="space-y-2">
            <div
                className={`flex items-center justify-between${
                    mutedLabel ? " pt-1" : ""
                }`}
            >
                <Label
                    className={
                        mutedLabel
                            ? "text-xs text-muted-foreground"
                            : "text-xs"
                    }
                >
                    {label}
                </Label>
                <span
                    className={
                        compact
                            ? "text-xs font-mono text-muted-foreground"
                            : badgeValue
                              ? "text-xs font-mono bg-muted px-1.5 py-0.5 rounded"
                              : "text-xs font-mono"
                    }
                >
                    {valueLabel}
                </span>
            </div>
            <Slider
                value={value}
                onValueChange={onChange}
                min={min}
                max={max}
                step={step}
                className="py-1"
            />
        </div>
    );
}
