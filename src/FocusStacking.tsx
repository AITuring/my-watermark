import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ImageUploader from "./ImageUploader";
import {
    createFocusStackResult,
    type FocusStackOptions,
    type FocusStackResult,
} from "./utils/focus-stack";

type UploadSide = "first" | "second";

interface UploadState {
    file: File | null;
    previewUrl: string;
}

const emptyUploadState: UploadState = {
    file: null,
    previewUrl: "",
};

function revokeUploadPreview(state: UploadState) {
    if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
    }
}

function revokeFocusStackResult(result: FocusStackResult | null) {
    if (!result) {
        return;
    }
    URL.revokeObjectURL(result.resultUrl);
    URL.revokeObjectURL(result.maskUrl);
    URL.revokeObjectURL(result.winnerOverlayUrl);
    URL.revokeObjectURL(result.basePreviewUrl);
    URL.revokeObjectURL(result.alignedPreviewUrl);
    URL.revokeObjectURL(result.sharpnessAUrl);
    URL.revokeObjectURL(result.sharpnessBUrl);
}

const FocusStacking = () => {
    const [firstImage, setFirstImage] = useState<UploadState>(emptyUploadState);
    const [secondImage, setSecondImage] = useState<UploadState>(emptyUploadState);
    const [result, setResult] = useState<FocusStackResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState("等待开始");

    const [autoAlign, setAutoAlign] = useState(true);
    const [manualShiftX, setManualShiftX] = useState(0);
    const [manualShiftY, setManualShiftY] = useState(0);
    const [scale, setScale] = useState(1);
    const [searchRadius, setSearchRadius] = useState(12);
    const [smoothRadius, setSmoothRadius] = useState(8);
    const [confidenceThreshold, setConfidenceThreshold] = useState(0.04);
    const [featherRadius, setFeatherRadius] = useState(1);

    useEffect(() => {
        return () => {
            revokeUploadPreview(firstImage);
            revokeUploadPreview(secondImage);
            revokeFocusStackResult(result);
        };
    }, [firstImage, secondImage, result]);

    const canProcess = firstImage.file && secondImage.file && !isProcessing;

    const effectiveOffset = useMemo(() => {
        if (!result) {
            return {
                x: manualShiftX,
                y: manualShiftY,
            };
        }
        return {
            x: result.estimatedOffset.x + manualShiftX,
            y: result.estimatedOffset.y + manualShiftY,
        };
    }, [manualShiftX, manualShiftY, result]);

    const clearGeneratedResult = () => {
        setResult((current) => {
            revokeFocusStackResult(current);
            return null;
        });
    };

    const updateUpload = (side: UploadSide, files: File[]) => {
        const file = files[0];
        if (!file) {
            return;
        }

        clearGeneratedResult();
        const nextState: UploadState = {
            file,
            previewUrl: URL.createObjectURL(file),
        };

        if (side === "first") {
            setFirstImage((current) => {
                revokeUploadPreview(current);
                return nextState;
            });
        } else {
            setSecondImage((current) => {
                revokeUploadPreview(current);
                return nextState;
            });
        }
    };

    const handleSwapImages = () => {
        clearGeneratedResult();
        setFirstImage(secondImage);
        setSecondImage(firstImage);
    };

    const handleProcess = async () => {
        if (!firstImage.file || !secondImage.file) {
            alert("请先上传两张不同对焦点的图片。");
            return;
        }

        clearGeneratedResult();
        setIsProcessing(true);
        setProgress(0);
        setProgressLabel("准备开始");

        const options: FocusStackOptions = {
            autoAlign,
            manualShiftX,
            manualShiftY,
            scale,
            searchRadius,
            smoothRadius,
            confidenceThreshold,
            featherRadius,
        };

        try {
            const nextResult = await createFocusStackResult(
                firstImage.file,
                secondImage.file,
                options,
                ({ percent, label }) => {
                    setProgress(percent);
                    setProgressLabel(label);
                }
            );
            setResult(nextResult);
        } catch (error) {
            console.error(error);
            alert("焦点合成失败，请尝试调整参数后重试。");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = () => {
        if (!result) {
            return;
        }
        const link = document.createElement("a");
        link.href = result.resultUrl;
        link.download = "focus-stacked.png";
        link.click();
    };

    const previewPanels = result
        ? [
              {
                  key: "result",
                  label: "合成结果",
                  url: result.resultUrl,
              },
              {
                  key: "mask",
                  label: "清晰掩膜",
                  url: result.maskUrl,
              },
              {
                  key: "winner-overlay",
                  label: "选区叠色",
                  url: result.winnerOverlayUrl,
              },
              {
                  key: "first",
                  label: "参考图",
                  url: result.basePreviewUrl,
              },
              {
                  key: "second",
                  label: "对齐后",
                  url: result.alignedPreviewUrl,
              },
              {
                  key: "sharp-a",
                  label: "清晰度 A",
                  url: result.sharpnessAUrl,
              },
              {
                  key: "sharp-b",
                  label: "清晰度 B",
                  url: result.sharpnessBUrl,
              },
          ]
        : [];

    return (
        <div className="min-h-screen w-full bg-stone-100 dark:bg-slate-950">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                            <Icon icon="mdi:image-filter-hdr" className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                                焦点合成
                            </h1>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                上传两张同机位、不同对焦点的照片，自动提取每个区域更清晰的部分。
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">避免平均堆栈发糊</Badge>
                        <Badge variant="secondary">局部清晰度选择融合</Badge>
                        <Badge variant="secondary">支持轻微对齐微调</Badge>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="flex flex-col gap-6">
                        <Card className="border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
                            <CardHeader>
                                <CardTitle>上传图片</CardTitle>
                                <CardDescription>
                                    第一张作为参考图，第二张会自动对齐并抽取清晰区域。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
                                    `选区叠色` 中红色代表 `图片 A`，蓝色代表 `图片 B`。如果圈是红的但结果仍然糊，通常说明当前上传到 `图片 A` 的就是那张前景模糊的图。
                                </div>

                                <div className="space-y-2">
                                    <Label>图片 A</Label>
                                    <ImageUploader
                                        onUpload={(files) => updateUpload("first", files)}
                                        fileType="图片 A"
                                    >
                                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500 dark:hover:bg-slate-900">
                                            {firstImage.previewUrl ? (
                                                <img
                                                    src={firstImage.previewUrl}
                                                    alt="图片 A 预览"
                                                    className="aspect-[4/3] w-full rounded-xl object-cover"
                                                />
                                            ) : (
                                                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                                    <Icon icon="mdi:image-plus" className="h-8 w-8" />
                                                    <span className="text-sm">拖拽或点击上传第一张图</span>
                                                </div>
                                            )}
                                        </div>
                                    </ImageUploader>
                                    {firstImage.file && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {firstImage.file.name}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>图片 B</Label>
                                    <ImageUploader
                                        onUpload={(files) => updateUpload("second", files)}
                                        fileType="图片 B"
                                    >
                                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500 dark:hover:bg-slate-900">
                                            {secondImage.previewUrl ? (
                                                <img
                                                    src={secondImage.previewUrl}
                                                    alt="图片 B 预览"
                                                    className="aspect-[4/3] w-full rounded-xl object-cover"
                                                />
                                            ) : (
                                                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                                    <Icon icon="mdi:image-plus" className="h-8 w-8" />
                                                    <span className="text-sm">拖拽或点击上传第二张图</span>
                                                </div>
                                            )}
                                        </div>
                                    </ImageUploader>
                                    {secondImage.file && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {secondImage.file.name}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={handleSwapImages}
                                        disabled={!firstImage.file || !secondImage.file}
                                    >
                                        交换 A / B
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            clearGeneratedResult();
                                            setFirstImage(emptyUploadState);
                                            setSecondImage(emptyUploadState);
                                        }}
                                        disabled={!firstImage.file && !secondImage.file}
                                    >
                                        清空两张图
                                    </Button>
                                </div>

                                <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                                    建议使用脚架和定时快门拍摄，曝光参数固定，仅改变对焦点，效果会更稳定。
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
                            <CardHeader>
                                <CardTitle>合成参数</CardTitle>
                                <CardDescription>
                                    自动对齐负责消除轻微位移，微调参数负责压住边缘重影。
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
                                    <Switch
                                        checked={autoAlign}
                                        onCheckedChange={setAutoAlign}
                                    />
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
                                        onValueChange={(value) => setSearchRadius(value[0])}
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
                                        onValueChange={(value) => setManualShiftX(value[0])}
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
                                        onValueChange={(value) => setManualShiftY(value[0])}
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
                                        onValueChange={(value) => setScale(value[0])}
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
                                        onValueChange={(value) => setSmoothRadius(value[0])}
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
                                        onValueChange={(value) =>
                                            setConfidenceThreshold(value[0])
                                        }
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
                                        onValueChange={(value) => setFeatherRadius(value[0])}
                                        min={0}
                                        max={5}
                                        step={1}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <Button onClick={handleProcess} disabled={!canProcess}>
                                        {isProcessing ? "处理中..." : "开始合成"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleDownload}
                                        disabled={!result}
                                    >
                                        下载结果
                                    </Button>
                                </div>

                                <Button
                                    variant="ghost"
                                    className="w-full"
                                    onClick={() => {
                                        setManualShiftX(0);
                                        setManualShiftY(0);
                                        setScale(1);
                                    }}
                                >
                                    重置微调参数
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex flex-col gap-6">
                        <Card className="border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
                            <CardHeader>
                                <CardTitle>处理状态</CardTitle>
                                <CardDescription>
                                    先在低分辨率下分析清晰区域，再输出全分辨率结果。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">当前步骤: {progressLabel}</Badge>
                                    {result && (
                                        <Badge variant="outline">
                                            输出尺寸: {result.width} × {result.height}
                                        </Badge>
                                    )}
                                    <Badge variant="outline">
                                        有效偏移: {effectiveOffset.x.toFixed(1)}px /{" "}
                                        {effectiveOffset.y.toFixed(1)}px
                                    </Badge>
                                    {result && autoAlign && (
                                        <Badge variant="outline">
                                            自动估计: {result.estimatedOffset.x.toFixed(1)}px /{" "}
                                            {result.estimatedOffset.y.toFixed(1)}px
                                        </Badge>
                                    )}
                                </div>
                                <Progress value={progress} className="h-2.5" />
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    如果边缘仍有轻微重影，优先微调水平/垂直位移，其次再小范围调整缩放补偿。
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="min-h-[720px] border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
                            <CardHeader>
                                <CardTitle>预览结果</CardTitle>
                                <CardDescription>
                                    可切换查看掩膜和清晰度图，便于判断算法是不是选中了正确区域。
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {result ? (
                                    <Tabs defaultValue="result" className="w-full">
                                        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
                                            {previewPanels.map((panel) => (
                                                <TabsTrigger
                                                    key={panel.key}
                                                    value={panel.key}
                                                    className="rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm data-[state=active]:border-blue-500 data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:border-slate-700 dark:bg-slate-950"
                                                >
                                                    {panel.label}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>

                                        {previewPanels.map((panel) => (
                                            <TabsContent key={panel.key} value={panel.key}>
                                                <div className="mt-4 rounded-2xl bg-slate-100 p-3 dark:bg-slate-950">
                                                    <img
                                                        src={panel.url}
                                                        alt={panel.label}
                                                        className="max-h-[70vh] w-full rounded-xl object-contain"
                                                    />
                                                </div>
                                            </TabsContent>
                                        ))}
                                    </Tabs>
                                ) : (
                                    <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-950">
                                        <Icon
                                            icon="mdi:layers-triple-outline"
                                            className="h-12 w-12 text-slate-400"
                                        />
                                        <div>
                                            <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                                                结果会显示在这里
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                上传两张图后点击“开始合成”，即可查看清晰掩膜和最终输出。
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FocusStacking;
