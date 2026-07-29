import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import type { AspectRatio } from "../../types";
import { SliderField } from "./FormControls";
import { SettingsSection } from "./SettingsSection";

type ViewExportSectionProps = {
    selectedRatioLabel: string;
    onRatioChange: (value: string) => void;
    aspectRatioOptions: AspectRatio[];
    inputScale: number;
    onInputScaleChange: (value: number) => void;
    tiltAngle: number;
    onTiltAngleChange: (value: number) => void;
    tiltScale: number;
    onTiltScaleChange: (value: number) => void;
    vignette: boolean;
    onVignetteChange: (value: boolean) => void;
    pageScale: number;
    onPageScaleChange: (value: number) => void;
    estimatedPages: number;
    showPagePreview: boolean;
    onShowPagePreviewChange: (value: boolean) => void;
};

export function ViewExportSection({
    selectedRatioLabel,
    onRatioChange,
    aspectRatioOptions,
    inputScale,
    onInputScaleChange,
    tiltAngle,
    onTiltAngleChange,
    tiltScale,
    onTiltScaleChange,
    vignette,
    onVignetteChange,
    pageScale,
    onPageScaleChange,
    estimatedPages,
    showPagePreview,
    onShowPagePreviewChange,
}: ViewExportSectionProps) {
    return (
        <SettingsSection title="View & Export">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs">Target Ratio</Label>
                    <Select value={selectedRatioLabel} onValueChange={onRatioChange}>
                        <SelectTrigger className="w-[140px] h-7 text-xs">
                            <SelectValue placeholder="自适应" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="自适应">Auto (自适应)</SelectItem>
                            {aspectRatioOptions.map((ratio) => (
                                <SelectItem key={ratio.label} value={ratio.label}>
                                    {ratio.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <SliderField
                label={
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted">
                                    Export Scale
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                Larger scale = higher resolution but slower export
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                }
                valueLabel={`${inputScale}x`}
                value={[inputScale]}
                min={1}
                max={10}
                step={1}
                onChange={(value) => onInputScaleChange(value[0])}
                badgeValue
            />

            <div className="grid grid-cols-2 gap-4">
                <SliderField
                    label="Tilt Angle"
                    valueLabel={`${tiltAngle}°`}
                    value={[tiltAngle]}
                    min={-45}
                    max={45}
                    step={1}
                    onChange={(value) => onTiltAngleChange(value[0])}
                    compact
                />
                <SliderField
                    label="Tilt Zoom"
                    valueLabel={`${tiltScale}x`}
                    value={[tiltScale]}
                    min={0.6}
                    max={1.6}
                    step={0.05}
                    onChange={(value) => onTiltScaleChange(Number(value[0]))}
                    compact
                />
            </div>

            <div className="flex items-center justify-between">
                <Label className="text-xs">Vignette Effect</Label>
                <Switch
                    checked={vignette}
                    onCheckedChange={onVignetteChange}
                    className="scale-75 origin-right"
                />
            </div>

            <div className="space-y-3 pt-2 border-t border-dashed">
                <SliderField
                    label="Page Zoom"
                    valueLabel={`${pageScale}x`}
                    value={[pageScale]}
                    min={0.6}
                    max={1.5}
                    step={0.05}
                    onChange={(value) => onPageScaleChange(Number(value[0]))}
                    badgeValue
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <span>Pages: {estimatedPages}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span>Preview</span>
                        <Switch
                            checked={showPagePreview}
                            onCheckedChange={onShowPagePreviewChange}
                            className="scale-75"
                        />
                    </div>
                </div>
            </div>
        </SettingsSection>
    );
}
