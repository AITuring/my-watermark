import React from "react";
import { Icon } from "@iconify/react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import ImageUploader from "@/components/ImageUploader";
import { MixedWatermarkConfig } from "@/types";
import ProgressButton from "@/pages/watermark/components/ProgressButton";

interface DesktopToolbarProps {
    watermarkMode: "image" | "mixed";
    setWatermarkMode: (mode: "image" | "mixed") => void;
    storedImageWatermarkUrl: string;
    mixedWatermarkConfig: MixedWatermarkConfig;
    setMixedWatermarkConfig: React.Dispatch<
        React.SetStateAction<MixedWatermarkConfig>
    >;
    onWatermarkUpload: (files: File[]) => void;
    watermarkBlur: boolean;
    setWatermarkBlur: (value: boolean) => void;
    quality: number;
    setQuality: (value: number) => void;
    watermarkOpacity: number;
    setWatermarkOpacity: (value: number) => void;
    onGenerate: () => void;
    loading: boolean;
    progress: number;
}

const DesktopToolbar: React.FC<DesktopToolbarProps> = ({
    watermarkMode,
    setWatermarkMode,
    storedImageWatermarkUrl,
    mixedWatermarkConfig,
    setMixedWatermarkConfig,
    onWatermarkUpload,
    watermarkBlur,
    setWatermarkBlur,
    quality,
    setQuality,
    watermarkOpacity,
    setWatermarkOpacity,
    onGenerate,
    loading,
    progress,
}) => {
    return (
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg px-6 py-4">
            <div className="flex items-center justify-between max-w-[1920px] mx-auto gap-8">
                <div className="flex items-center gap-4 shrink-0">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            混合水印
                        </span>
                        <div className="flex items-center gap-2">
                            <span
                                className={`text-sm ${
                                    watermarkMode === "mixed"
                                        ? "text-blue-600 dark:text-blue-400 font-medium"
                                        : "text-slate-600 dark:text-slate-300"
                                }`}
                            >
                                开启
                            </span>
                            <Switch
                                checked={watermarkMode === "mixed"}
                                onCheckedChange={(checked) =>
                                    setWatermarkMode(
                                        checked ? "mixed" : "image"
                                    )
                                }
                                className="data-[state=checked]:bg-blue-600"
                            />
                        </div>
                    </div>

                    <div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-700" />

                    <div className="relative group">
                        <ImageUploader
                            onUpload={onWatermarkUpload}
                            fileType={
                                watermarkMode === "image" ? "水印图片" : "图标"
                            }
                            className="w-14 h-14 rounded-lg cursor-pointer overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md bg-slate-50 dark:bg-slate-800"
                        >
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="w-full h-full flex items-center justify-center p-1">
                                            <img
                                                src={
                                                    watermarkMode === "image"
                                                        ? storedImageWatermarkUrl
                                                        : mixedWatermarkConfig.icon
                                                }
                                                alt="watermark"
                                                className="max-w-full max-h-full object-contain group-hover:opacity-80 transition-opacity"
                                            />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>
                                            点击更换
                                            {watermarkMode === "image"
                                                ? "水印图片"
                                                : "图标"}
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </ImageUploader>
                        <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm">
                            {watermarkMode === "image" ? "水印" : "图标"}
                        </div>
                    </div>

                    <div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-700" />

                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            基础设置
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                                背景模糊
                            </span>
                            <Switch
                                checked={watermarkBlur}
                                onCheckedChange={setWatermarkBlur}
                                className="scale-90 data-[state=checked]:bg-blue-600"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8 flex-1 justify-center max-w-5xl">
                    <div className="flex-1 min-w-[180px] max-w-[240px] flex flex-col gap-2 group">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                                <Icon
                                    icon="mdi:quality-high"
                                    className="text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors"
                                />
                                图片质量
                            </div>
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                {Math.round(quality * 100)}%
                            </span>
                        </div>
                        <Slider
                            value={[quality]}
                            onValueChange={(value) => setQuality(value[0])}
                            max={1}
                            min={0.1}
                            step={0.1}
                            className="w-full py-1"
                        />
                    </div>

                    <div className="flex-1 min-w-[180px] max-w-[240px] flex flex-col gap-2 group">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                                <Icon
                                    icon="mdi:opacity"
                                    className="text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors"
                                />
                                水印透明度
                            </div>
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                {Math.round(watermarkOpacity * 100)}%
                            </span>
                        </div>
                        <Slider
                            value={[watermarkOpacity]}
                            onValueChange={(value) =>
                                setWatermarkOpacity(value[0])
                            }
                            max={1}
                            min={0.1}
                            step={0.1}
                            className="w-full py-1"
                        />
                    </div>

                    {watermarkMode === "mixed" && (
                        <div className="flex items-center gap-4 border-l pl-4 border-slate-200 dark:border-slate-700">
                            <div className="flex flex-col gap-2 w-32">
                                <input
                                    type="text"
                                    value={mixedWatermarkConfig.textLine1}
                                    onChange={(e) =>
                                        setMixedWatermarkConfig((prev) => ({
                                            ...prev,
                                            textLine1: e.target.value,
                                        }))
                                    }
                                    className="h-7 text-xs px-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none"
                                    placeholder="第一行文字"
                                />
                                <input
                                    type="text"
                                    value={mixedWatermarkConfig.textLine2}
                                    onChange={(e) =>
                                        setMixedWatermarkConfig((prev) => ({
                                            ...prev,
                                            textLine2: e.target.value,
                                        }))
                                    }
                                    className="h-7 text-xs px-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none"
                                    placeholder="第二行文字"
                                />
                            </div>

                            <div className="flex flex-col gap-1 items-center">
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                    布局
                                </span>
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                                    <button
                                        className={`p-1 rounded-md transition-all ${
                                            mixedWatermarkConfig.layout !==
                                            "vertical"
                                                ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400"
                                                : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                                        }`}
                                        onClick={() =>
                                            setMixedWatermarkConfig((prev) => ({
                                                ...prev,
                                                layout: "horizontal",
                                            }))
                                        }
                                        title="水平布局"
                                    >
                                        <Icon
                                            icon="mdi:format-list-bulleted"
                                            className="w-4 h-4"
                                        />
                                    </button>
                                    <button
                                        className={`p-1 rounded-md transition-all ${
                                            mixedWatermarkConfig.layout ===
                                            "vertical"
                                                ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400"
                                                : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                                        }`}
                                        onClick={() =>
                                            setMixedWatermarkConfig((prev) => ({
                                                ...prev,
                                                layout: "vertical",
                                            }))
                                        }
                                        title="竖直布局"
                                    >
                                        <Icon
                                            icon="mdi:format-vertical-align-top"
                                            className="w-4 h-4 transform rotate-90"
                                        />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 items-center">
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                    颜色
                                </span>
                                <div className="relative overflow-hidden w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer">
                                    <input
                                        type="color"
                                        value={mixedWatermarkConfig.color}
                                        onChange={(e) =>
                                            setMixedWatermarkConfig((prev) => ({
                                                ...prev,
                                                color: e.target.value,
                                            }))
                                        }
                                        title="选择混合水印颜色"
                                        aria-label="选择混合水印颜色"
                                        className="absolute -top-2 -left-2 w-10 h-10 p-0 border-0 cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 w-24">
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                    字体大小
                                </span>
                                <Slider
                                    value={[mixedWatermarkConfig.fontSize]}
                                    onValueChange={(value) =>
                                        setMixedWatermarkConfig((prev) => ({
                                            ...prev,
                                            fontSize: value[0],
                                        }))
                                    }
                                    min={10}
                                    max={100}
                                    step={1}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <ProgressButton
                        onClick={onGenerate}
                        loading={loading}
                        progress={progress}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 text-white font-medium px-8 py-6 h-12 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                        <div className="flex items-center gap-3">
                            <Icon icon="ri:magic-line" className="h-5 w-5" />
                            <span>水印生成</span>
                        </div>
                    </ProgressButton>
                </div>
            </div>
        </div>
    );
};

export default DesktopToolbar;
