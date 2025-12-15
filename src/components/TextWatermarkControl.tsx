import React from "react";
import { Icon } from "@iconify/react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { TextWatermarkConfig } from "@/types";

interface TextWatermarkControlProps {
    config: TextWatermarkConfig;
    onChange: (config: TextWatermarkConfig) => void;
}

export const TextWatermarkControl: React.FC<TextWatermarkControlProps> = ({
    config,
    onChange,
}) => {
    const handleChange = (updates: Partial<TextWatermarkConfig>) => {
        onChange({ ...config, ...updates });
    };

    return (
        <div className="flex-1 min-w-[220px] max-w-[300px] flex flex-col gap-2 p-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <Icon
                            icon="mdi:format-text"
                            className={`transition-colors ${
                                config.enabled ? "text-blue-500" : "text-slate-400"
                            }`}
                        />
                        文字水印
                    </div>
                    <Switch
                        checked={config.enabled}
                        onCheckedChange={(checked) => handleChange({ enabled: checked })}
                        className="scale-75 data-[state=checked]:bg-blue-600"
                    />
                </div>
                {config.enabled && (
                    <div className="flex gap-1">
                        <div
                            className={`cursor-pointer w-4 h-4 rounded flex items-center justify-center border border-slate-300 ${
                                !config.isVertical
                                    ? "bg-blue-100 text-blue-600"
                                    : "bg-white text-slate-400"
                            }`}
                            title="横排"
                            onClick={() => handleChange({ isVertical: false })}
                        >
                            <Icon
                                icon="mdi:format-horizontal-align-center"
                                className="w-3 h-3"
                            />
                        </div>
                        <div
                            className={`cursor-pointer w-4 h-4 rounded flex items-center justify-center border border-slate-300 ${
                                config.isVertical
                                    ? "bg-blue-100 text-blue-600"
                                    : "bg-white text-slate-400"
                            }`}
                            title="竖排"
                            onClick={() => handleChange({ isVertical: true })}
                        >
                            <Icon
                                icon="mdi:format-vertical-align-center"
                                className="w-3 h-3"
                            />
                        </div>
                    </div>
                )}
            </div>
            <div
                className={`transition-all duration-200 flex flex-col gap-2 ${
                    config.enabled ? "opacity-100" : "opacity-40 pointer-events-none"
                }`}
            >
                <input
                    type="text"
                    value={config.content}
                    onChange={(e) => handleChange({ content: e.target.value })}
                    placeholder="输入文字..."
                    className="w-full text-xs px-2 py-1 rounded border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
                />
                <div className="flex items-center gap-2">
                    <div className="relative w-6 h-6 shrink-0 overflow-hidden rounded border border-slate-200">
                        <input
                            type="color"
                            value={config.color}
                            onChange={(e) => handleChange({ color: e.target.value })}
                            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 border-0 cursor-pointer"
                        />
                    </div>
                    <Slider
                        value={[config.fontSize]}
                        onValueChange={(value) => handleChange({ fontSize: value[0] })}
                        max={200}
                        min={10}
                        step={1}
                        className="flex-1 py-1"
                    />
                </div>
            </div>
        </div>
    );
};