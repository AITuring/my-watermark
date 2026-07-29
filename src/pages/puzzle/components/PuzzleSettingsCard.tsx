import PanelCard from "@/components/PanelCard";
import { SettingsSection } from "@/components/SettingsSection";
import SliderNumberField from "@/components/SliderNumberField";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Icon } from "@iconify/react";

import { aspectRatioOptions } from "../constants";
import type { AspectRatio, PuzzleLayout } from "../types";

type PuzzleSettingsCardProps = {
    imagesCount: number;
    layout: PuzzleLayout;
    inputColumns: number | null;
    margin: number;
    radius: number;
    inputScale: number;
    selectedRatio: AspectRatio | null;
    onLayoutChange: (value: PuzzleLayout) => void;
    onInputColumnsChange: (value: number) => void;
    onMarginChange: (value: number) => void;
    onRadiusChange: (value: number) => void;
    onInputScaleChange: (value: number) => void;
    onRatioChange: (value: string) => void;
    onDownload: () => void;
    onAddMore: () => void;
    onClear: () => void;
};

export function PuzzleSettingsCard({
    imagesCount,
    layout,
    inputColumns,
    margin,
    radius,
    inputScale,
    selectedRatio,
    onLayoutChange,
    onInputColumnsChange,
    onMarginChange,
    onRadiusChange,
    onInputScaleChange,
    onRatioChange,
    onDownload,
    onAddMore,
    onClear,
}: PuzzleSettingsCardProps) {
    const inlineFieldClassName = "my-1 sm:my-2 text-xs sm:text-sm";
    const inlineSliderClassName = "ml-2 w-24 sm:w-28";
    const inlineInputClassName = "ml-2 w-12 sm:w-14 px-1 py-0.5";

    return (
        <PanelCard
            title="拼图设置"
            icon={<Icon icon="tabler:settings" className="w-3 h-3 sm:w-4 sm:h-4" />}
            count={`${imagesCount} 张`}
            className="sticky top-0 z-20 mx-auto max-w-5xl rounded-lg border bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-gray-900/80"
            headerClassName="px-2 py-1 sm:px-3 sm:py-2"
            titleClassName="text-xs sm:text-sm"
            countClassName="text-[10px] sm:text-xs"
            contentClassName="px-2 py-1 sm:px-3 sm:py-2"
        >
            <SettingsSection
                title="Layout"
                className="pb-3"
                bodyClassName="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2 lg:grid-cols-3"
            >
                    <div className="flex items-center gap-1 sm:gap-2 my-1 sm:my-2 text-xs sm:text-sm">
                        <div className="text-xs sm:text-sm">布局方式:</div>
                        <Select
                            value={layout}
                            onValueChange={(value) =>
                                onLayoutChange(value as PuzzleLayout)
                            }
                        >
                            <SelectTrigger className="w-16 sm:w-20 ml-2 h-7 sm:h-8">
                                <SelectValue placeholder="布局方式" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="rows">行</SelectItem>
                                <SelectItem value="columns">列</SelectItem>
                                <SelectItem value="masonry">masonry</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {layout !== "rows" && (
                        <SliderNumberField
                            label="图片列数:"
                            value={typeof inputColumns === "number" ? inputColumns : 0}
                            min={0}
                            max={15}
                            onChange={onInputColumnsChange}
                            step={1}
                            layout="inline"
                            showInput
                            className={inlineFieldClassName}
                            sliderClassName={inlineSliderClassName}
                            inputClassName={inlineInputClassName}
                        />
                    )}

                    <SliderNumberField
                        label="图片间距:"
                        value={margin}
                        min={0}
                        max={50}
                        onChange={onMarginChange}
                        step={1}
                        layout="inline"
                        showInput
                        className={inlineFieldClassName}
                        sliderClassName={inlineSliderClassName}
                        inputClassName={inlineInputClassName}
                    />

                    {margin > 0 && (
                        <SliderNumberField
                            label="图片圆角:"
                            value={radius}
                            min={0}
                            max={50}
                            onChange={onRadiusChange}
                            step={1}
                            layout="inline"
                            showInput
                            className={inlineFieldClassName}
                            sliderClassName={inlineSliderClassName}
                            inputClassName={inlineInputClassName}
                        />
                    )}
            </SettingsSection>

            <SettingsSection
                title="Export"
                className="py-3"
                bodyClassName="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2"
            >
                    <div className="flex items-center gap-1 sm:gap-2 my-1 sm:my-2 text-xs sm:text-sm">
                        <div className="text-xs sm:text-sm">生成图片长宽比:</div>
                        <Select
                            value={selectedRatio?.label ?? "自适应"}
                            onValueChange={onRatioChange}
                        >
                            <SelectTrigger className="w-20 ml-2 h-7 sm:h-8">
                                <SelectValue placeholder="自适应" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="自适应">自适应</SelectItem>
                                {aspectRatioOptions.map((ratio) => (
                                    <SelectItem key={ratio.label} value={ratio.label}>
                                        {ratio.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <SliderNumberField
                        label={
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="cursor-help text-xs sm:text-sm">
                                            导出图片规模:
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        规模越大，导出图片尺寸越大，导出更加耗时
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        }
                        value={inputScale}
                        valueLabel={`${inputScale}x`}
                        min={1}
                        max={10}
                        step={1}
                        onChange={onInputScaleChange}
                        layout="inline"
                        showInput
                        className={inlineFieldClassName}
                        sliderClassName={inlineSliderClassName}
                        inputClassName={inlineInputClassName}
                    />
            </SettingsSection>

            <SettingsSection
                title="Actions"
                className="pt-3"
                bodyClassName="flex flex-wrap items-center justify-center gap-4 sm:gap-8"
            >
                <Button size="sm" onClick={onDownload}>
                    下载大图
                </Button>
                <Button size="sm" variant="secondary" onClick={onAddMore}>
                    继续添加
                </Button>
                <Button size="sm" variant="secondary" onClick={onClear}>
                    清空
                </Button>
            </SettingsSection>
        </PanelCard>
    );
}
