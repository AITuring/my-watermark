import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type SliderNumberFieldProps = {
    label: ReactNode;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    valueLabel?: string;
    valueFormatter?: (value: number) => string;
    showInput?: boolean;
    layout?: "stacked" | "inline";
    compact?: boolean;
    mutedLabel?: boolean;
    badgeValue?: boolean;
    className?: string;
    sliderClassName?: string;
    inputClassName?: string;
};

export default function SliderNumberField({
    label,
    value,
    min,
    max,
    step,
    onChange,
    valueLabel,
    valueFormatter,
    showInput = false,
    layout = "stacked",
    compact = false,
    mutedLabel = false,
    badgeValue = false,
    className,
    sliderClassName,
    inputClassName,
}: SliderNumberFieldProps) {
    const resolvedValueLabel = valueLabel ?? valueFormatter?.(value) ?? String(value);

    if (layout === "inline") {
        return (
            <div className={cn("flex items-center gap-2 text-sm", className)}>
                <Label className="shrink-0 text-xs sm:text-sm">{label}</Label>
                <Slider
                    value={[value]}
                    min={min}
                    max={max}
                    step={step}
                    onValueChange={([nextValue]) => onChange(nextValue)}
                    className={cn("w-24 sm:w-28", sliderClassName)}
                />
                {showInput ? (
                    <Input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(event) => onChange(Number(event.target.value))}
                        className={cn(
                            "h-8 w-14 rounded px-2 text-xs sm:text-sm",
                            inputClassName
                        )}
                    />
                ) : (
                    <span className="text-xs font-mono text-muted-foreground">
                        {resolvedValueLabel}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className={cn("space-y-2", className)}>
            <div
                className={cn(
                    "flex items-center justify-between",
                    mutedLabel && "pt-1"
                )}
            >
                <Label
                    className={cn(
                        "text-xs",
                        mutedLabel && "text-muted-foreground"
                    )}
                >
                    {label}
                </Label>
                <span
                    className={cn(
                        "text-xs font-mono",
                        compact && "text-muted-foreground",
                        badgeValue && "rounded bg-muted px-1.5 py-0.5"
                    )}
                >
                    {resolvedValueLabel}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <Slider
                    value={[value]}
                    min={min}
                    max={max}
                    step={step}
                    onValueChange={([nextValue]) => onChange(nextValue)}
                    className={cn("py-1", sliderClassName)}
                />
                {showInput ? (
                    <Input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(event) => onChange(Number(event.target.value))}
                        className={cn("h-8 w-16 px-2", inputClassName)}
                    />
                ) : null}
            </div>
        </div>
    );
}
