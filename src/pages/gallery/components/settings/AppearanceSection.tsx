import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Icon } from "@iconify/react";
import { ColorPickerControl, SliderField } from "./FormControls";
import { SettingsSection, SettingsSectionHeader } from "./SettingsSection";

type AppearanceSectionProps = {
    wallColor: string;
    onWallColorChange: (value: string) => void;
    onRandomizeWall: () => void;
    frameColor: string;
    onFrameColorChange: (value: string) => void;
    onRandomizeAllFrames: () => void;
    frameThickness: number[];
    onFrameThicknessChange: (value: number[]) => void;
    frameOpacity: number[];
    onFrameOpacityChange: (value: number[]) => void;
    radius: number;
    onRadiusChange: (value: number) => void;
    hasMat: boolean;
    onHasMatChange: (value: boolean) => void;
    matColor: string;
    onMatColorChange: (value: string) => void;
    matSize: number[];
    onMatSizeChange: (value: number[]) => void;
};

export function AppearanceSection({
    wallColor,
    onWallColorChange,
    onRandomizeWall,
    frameColor,
    onFrameColorChange,
    onRandomizeAllFrames,
    frameThickness,
    onFrameThicknessChange,
    frameOpacity,
    onFrameOpacityChange,
    radius,
    onRadiusChange,
    hasMat,
    onHasMatChange,
    matColor,
    onMatColorChange,
    matSize,
    onMatSizeChange,
}: AppearanceSectionProps) {
    return (
        <SettingsSection title="Appearance">
            <div className="space-y-3">
                <SettingsSectionHeader
                    title="Wall"
                    action={
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 hover:bg-muted"
                            onClick={onRandomizeWall}
                            title="Random Color"
                        >
                            <Icon icon="mdi:dice-5" className="w-3.5 h-3.5" />
                        </Button>
                    }
                />
                <ColorPickerControl
                    value={wallColor}
                    onChange={onWallColorChange}
                />
            </div>

            <div className="space-y-3">
                <SettingsSectionHeader
                    title="Frame"
                    action={
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 hover:bg-muted"
                            onClick={onRandomizeAllFrames}
                            title="Randomize All Frames"
                        >
                            <Icon icon="mdi:dice-multiple" className="w-3.5 h-3.5" />
                        </Button>
                    }
                />
                <div className="space-y-2">
                    <ColorPickerControl
                        value={frameColor}
                        onChange={onFrameColorChange}
                    />
                    <SliderField
                        label="Border Width"
                        valueLabel={`${frameThickness[0]}px`}
                        value={frameThickness}
                        min={0}
                        max={100}
                        step={1}
                        onChange={onFrameThicknessChange}
                        mutedLabel
                    />
                </div>

                <SliderField
                    label="Glass Opacity"
                    valueLabel={`${Math.round(frameOpacity[0] * 100)}%`}
                    value={frameOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={onFrameOpacityChange}
                    mutedLabel
                />

                <SliderField
                    label="Corner Radius"
                    valueLabel={`${radius}px`}
                    value={[radius]}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(value) => onRadiusChange(value[0])}
                    mutedLabel
                />
            </div>

            <div className="space-y-3">
                <SettingsSectionHeader
                    title="Matting"
                    action={
                        <Switch
                            checked={hasMat}
                            onCheckedChange={onHasMatChange}
                            className="scale-75 origin-right"
                        />
                    }
                />

                {hasMat && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <ColorPickerControl
                            value={matColor}
                            onChange={onMatColorChange}
                        />
                        <SliderField
                            label="Size"
                            valueLabel={`${matSize[0]}px`}
                            value={matSize}
                            min={0}
                            max={100}
                            step={1}
                            onChange={onMatSizeChange}
                            mutedLabel
                        />
                    </div>
                )}
            </div>
        </SettingsSection>
    );
}
