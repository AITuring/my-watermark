import type { ReactNode } from "react";

import SliderNumberField from "@/components/SliderNumberField";
import { Input } from "@/components/ui/input";

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
        <SliderNumberField
            label={label}
            value={value[0] ?? min}
            valueLabel={valueLabel}
            min={min}
            max={max}
            step={step}
            onChange={(nextValue) => onChange([nextValue])}
            compact={compact}
            mutedLabel={mutedLabel}
            badgeValue={badgeValue}
        />
    );
}
