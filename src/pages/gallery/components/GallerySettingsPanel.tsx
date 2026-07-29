import PanelCard from "@/components/PanelCard";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import type { AspectRatio, GalleryLayout } from "../types";
import { ActionsSection } from "./settings/ActionsSection";
import { AppearanceSection } from "./settings/AppearanceSection";
import { LayoutSection } from "./settings/LayoutSection";
import { ViewExportSection } from "./settings/ViewExportSection";
import { Icon } from "@iconify/react";

type GallerySettingsPanelProps = {
    settingsOpen: boolean;
    onToggleOpen: () => void;
    imagesCount: number;
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
    layout: GalleryLayout;
    onLayoutChange: (value: GalleryLayout) => void;
    inputColumns: number | null;
    onInputColumnsChange: (value: number) => void;
    margin: number;
    onMarginChange: (value: number) => void;
    outerPadding: number;
    onOuterPaddingChange: (value: number) => void;
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
    onDownload: () => void;
    onAddMore: () => void;
    onClear: () => void;
};

export function GallerySettingsPanel({
    settingsOpen,
    onToggleOpen,
    imagesCount,
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
    layout,
    onLayoutChange,
    inputColumns,
    onInputColumnsChange,
    margin,
    onMarginChange,
    outerPadding,
    onOuterPaddingChange,
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
    onDownload,
    onAddMore,
    onClear,
}: GallerySettingsPanelProps) {
    const headerAction = (
        <Button
            variant="ghost"
            size="icon"
            className={cn(
                "h-8 w-8 ml-auto hover:bg-muted",
                !settingsOpen && "h-full w-full rounded-full p-0"
            )}
            onClick={onToggleOpen}
        >
            <Icon
                icon={settingsOpen ? "mdi:chevron-left" : "mdi:cog"}
                className="w-5 h-5"
            />
        </Button>
    );

    return (
        <div
            className={cn(
                "fixed top-4 left-4 z-50 transition-all duration-300 ease-in-out",
                settingsOpen
                    ? "w-80 h-[calc(100vh-32px)]"
                    : "w-10 h-10 overflow-hidden rounded-full"
            )}
        >
            <PanelCard
                title={settingsOpen ? "拼图设置" : undefined}
                icon={settingsOpen ? <Icon icon="tabler:settings" className="w-4 h-4" /> : undefined}
                count={settingsOpen ? `${imagesCount}` : undefined}
                actions={headerAction}
                className="h-full border bg-white/95 shadow-2xl backdrop-blur-sm flex flex-col overflow-hidden"
                headerClassName={cn(
                    "shrink-0 border-b bg-muted/30",
                    settingsOpen ? "h-12 px-3 py-3" : "h-full border-b-0 p-0"
                )}
                titleClassName="truncate text-sm font-semibold"
                countClassName="h-5 px-1.5 text-xs"
                contentClassName={cn(
                    "flex-1 overflow-y-auto custom-scrollbar transition-opacity duration-200",
                    settingsOpen ? "p-4 opacity-100" : "hidden p-0 opacity-0"
                )}
            >
                    <AppearanceSection
                        wallColor={wallColor}
                        onWallColorChange={onWallColorChange}
                        onRandomizeWall={onRandomizeWall}
                        frameColor={frameColor}
                        onFrameColorChange={onFrameColorChange}
                        onRandomizeAllFrames={onRandomizeAllFrames}
                        frameThickness={frameThickness}
                        onFrameThicknessChange={onFrameThicknessChange}
                        frameOpacity={frameOpacity}
                        onFrameOpacityChange={onFrameOpacityChange}
                        radius={radius}
                        onRadiusChange={onRadiusChange}
                        hasMat={hasMat}
                        onHasMatChange={onHasMatChange}
                        matColor={matColor}
                        onMatColorChange={onMatColorChange}
                        matSize={matSize}
                        onMatSizeChange={onMatSizeChange}
                    />

                    <LayoutSection
                        layout={layout}
                        onLayoutChange={onLayoutChange}
                        inputColumns={inputColumns}
                        onInputColumnsChange={onInputColumnsChange}
                        margin={margin}
                        onMarginChange={onMarginChange}
                        outerPadding={outerPadding}
                        onOuterPaddingChange={onOuterPaddingChange}
                    />

                    <ViewExportSection
                        selectedRatioLabel={selectedRatioLabel}
                        onRatioChange={onRatioChange}
                        aspectRatioOptions={aspectRatioOptions}
                        inputScale={inputScale}
                        onInputScaleChange={onInputScaleChange}
                        tiltAngle={tiltAngle}
                        onTiltAngleChange={onTiltAngleChange}
                        tiltScale={tiltScale}
                        onTiltScaleChange={onTiltScaleChange}
                        vignette={vignette}
                        onVignetteChange={onVignetteChange}
                        pageScale={pageScale}
                        onPageScaleChange={onPageScaleChange}
                        estimatedPages={estimatedPages}
                        showPagePreview={showPagePreview}
                        onShowPagePreviewChange={onShowPagePreviewChange}
                    />

                    <ActionsSection
                        onDownload={onDownload}
                        onAddMore={onAddMore}
                        onClear={onClear}
                    />
            </PanelCard>
        </div>
    );
}
