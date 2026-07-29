import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface ParametersPanelProps {
    autoAlign: boolean;
    manualShiftX: number;
    manualShiftY: number;
    scale: number;
    searchRadius: number;
    smoothRadius: number;
    confidenceThreshold: number;
    featherRadius: number;
    foregroundProtect: number;
    hasResult: boolean;
    onAutoAlignChange: (value: boolean) => void;
    onManualShiftXChange: (value: number) => void;
    onManualShiftYChange: (value: number) => void;
    onScaleChange: (value: number) => void;
    onSearchRadiusChange: (value: number) => void;
    onSmoothRadiusChange: (value: number) => void;
    onConfidenceThresholdChange: (value: number) => void;
    onFeatherRadiusChange: (value: number) => void;
    onForegroundProtectChange: (value: number) => void;
    onDownload: () => void;
    onResetAdjustment: () => void;
}

export default function ParametersPanel({
    autoAlign,
    manualShiftX,
    manualShiftY,
    scale,
    searchRadius,
    smoothRadius,
    confidenceThreshold,
    featherRadius,
    foregroundProtect,
    hasResult,
    onAutoAlignChange,
    onManualShiftXChange,
    onManualShiftYChange,
    onScaleChange,
    onSearchRadiusChange,
    onSmoothRadiusChange,
    onConfidenceThresholdChange,
    onFeatherRadiusChange,
    onForegroundProtectChange,
    onDownload,
    onResetAdjustment,
}: ParametersPanelProps) {
    return (
        <Card className="border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
            <CardHeader>
                <CardTitle>合成参数</CardTitle>
                <CardDescription>
                    自动对齐负责消除轻微位移，以下参数会应用到每一张候选图。
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                    <div>
                        <div className="text-sm font-medium">自动对齐</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            适合脚架下的轻微平移误差
                        </div>
                    </div>
                    <Switch checked={autoAlign} onCheckedChange={onAutoAlignChange} />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <Label>搜索范围</Label>
                        <span className="text-slate-500 dark:text-slate-400">
                            {searchRadius}px
                        </span>
                    </div>
                    <Slider
                        value={[searchRadius]}
                        onValueChange={(value) => onSearchRadiusChange(value[0])}
                        min={2}
                        max={30}
                        step={1}
                        disabled={!autoAlign}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <Label>手动水平微调</Label>
                        <span className="text-slate-500 dark:text-slate-400">
                            {manualShiftX.toFixed(1)}px
                        </span>
                    </div>
                    <Slider
                        value={[manualShiftX]}
                        onValueChange={(value) => onManualShiftXChange(value[0])}
                        min={-40}
                        max={40}
                        step={0.5}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <Label>手动垂直微调</Label>
                        <span className="text-slate-500 dark:text-slate-400">
                            {manualShiftY.toFixed(1)}px
                        </span>
                    </div>
                    <Slider
                        value={[manualShiftY]}
                        onValueChange={(value) => onManualShiftYChange(value[0])}
                        min={-40}
                        max={40}
                        step={0.5}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <Label>缩放补偿</Label>
                        <span className="text-slate-500 dark:text-slate-400">
                            {scale.toFixed(3)}x
                        </span>
                    </div>
                    <Slider
                        value={[scale]}
                        onValueChange={(value) => onScaleChange(value[0])}
                        min={0.96}
                        max={1.04}
                        step={0.001}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <Label>区域平滑</Label>
                        <span className="text-slate-500 dark:text-slate-400">
                            {smoothRadius}px
                        </span>
                    </div>
                    <Slider
                        value={[smoothRadius]}
                        onValueChange={(value) => onSmoothRadiusChange(value[0])}
                        min={1}
                        max={20}
                        step={1}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <Label>清晰度门限</Label>
                        <span className="text-slate-500 dark:text-slate-400">
                            {confidenceThreshold.toFixed(3)}
                        </span>
                    </div>
                    <Slider
                        value={[confidenceThreshold]}
                        onValueChange={(value) => onConfidenceThresholdChange(value[0])}
                        min={0}
                        max={0.2}
                        step={0.005}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <Label>边缘羽化</Label>
                        <span className="text-slate-500 dark:text-slate-400">
                            {featherRadius}px
                        </span>
                    </div>
                    <Slider
                        value={[featherRadius]}
                        onValueChange={(value) => onFeatherRadiusChange(value[0])}
                        min={0}
                        max={5}
                        step={1}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <Label>边缘光晕抑制</Label>
                        <span className="text-slate-500 dark:text-slate-400">
                            {foregroundProtect}px
                        </span>
                    </div>
                    <Slider
                        value={[foregroundProtect]}
                        onValueChange={(value) => onForegroundProtectChange(value[0])}
                        min={0}
                        max={30}
                        step={1}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        让清晰的一方认领紧贴自己的边缘：既消除玉璧内缘的溢出光晕，也用干净背景盖掉陶俑等主体轮廓外的一圈亮边。调大更干净，过大会吃掉紧贴的细节。
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button variant="outline" onClick={onDownload} disabled={!hasResult}>
                        下载结果
                    </Button>
                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        当前按列表顺序依次合成
                    </div>
                </div>

                <Button variant="ghost" className="w-full" onClick={onResetAdjustment}>
                    重置微调参数
                </Button>
            </CardContent>
        </Card>
    );
}
