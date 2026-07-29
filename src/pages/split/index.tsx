import React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AxisSplitPreview } from '@/pages/split/components/AxisSplitPreview';
import { GeneratedImagesCard } from '@/pages/split/components/GeneratedImagesCard';
import { SplitSettingsCard } from '@/pages/split/components/SplitSettingsCard';
import { useImageSplitter } from '@/pages/split/hooks/useImageSplitter';

const ImageSplitter: React.FC = () => {
  const {
    activeIsAdjusted,
    activePlan,
    activePreviewOrientation,
    activeTitle,
    aspectH,
    aspectW,
    canvasRef,
    commitManualRegionStarts,
    generatedImages,
    handleExport,
    handleFileChange,
    handleGridSplit,
    handleHorizontalSplit,
    handleSendToWatermark,
    handleVerticalSplit,
    horizontalPlan,
    hvCount,
    hvMode,
    hvRatioH,
    hvRatioW,
    isPreviewOpen,
    isProcessing,
    overlapPercent,
    previewIndex,
    previewUrl,
    resetManualRegionStart,
    setAspectH,
    setAspectW,
    setHvCount,
    setHvMode,
    setHvRatioH,
    setHvRatioW,
    setIsPreviewOpen,
    setOverlapPercent,
    setPreviewIndex,
    sourceImage,
    verticalPlan,
  } = useImageSplitter();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">长图智能切片</h2>
        <p className="mt-1 text-sm text-slate-500">水平/竖直切割（重叠可选）与按比例网格切分</p>
      </div>

      <SplitSettingsCard
        hasSourceImage={Boolean(sourceImage)}
        isProcessing={isProcessing}
        hvMode={hvMode}
        hvRatioW={hvRatioW}
        hvRatioH={hvRatioH}
        hvCount={hvCount}
        overlapPercent={overlapPercent}
        aspectW={aspectW}
        aspectH={aspectH}
        activePreviewOrientation={activePreviewOrientation}
        sourceNaturalWidth={sourceImage?.naturalWidth}
        sourceNaturalHeight={sourceImage?.naturalHeight}
        verticalPlan={verticalPlan}
        horizontalPlan={horizontalPlan}
        onFileChange={handleFileChange}
        onHvModeChange={setHvMode}
        onHvRatioWChange={setHvRatioW}
        onHvRatioHChange={setHvRatioH}
        onHvCountChange={setHvCount}
        onOverlapPercentChange={setOverlapPercent}
        onAspectWChange={setAspectW}
        onAspectHChange={setAspectH}
        onVerticalSplit={handleVerticalSplit}
        onHorizontalSplit={handleHorizontalSplit}
        onGridSplit={handleGridSplit}
      />

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {previewUrl && sourceImage && activePlan && (
        <Card className="mb-6 overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]">
          <CardHeader>
            <CardTitle>实时切片预览</CardTitle>
            <CardDescription>当前仅显示已选方向的预览与微调结果，橙色斜纹表示重叠区域</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AxisSplitPreview
              title={activeTitle}
              imageUrl={previewUrl}
              naturalWidth={sourceImage.naturalWidth}
              naturalHeight={sourceImage.naturalHeight}
              plan={activePlan}
              isAdjusted={activeIsAdjusted}
              onCommitStarts={(starts) => commitManualRegionStarts(activePreviewOrientation, starts)}
              onReset={() => resetManualRegionStart(activePreviewOrientation)}
            />
          </CardContent>
        </Card>
      )}

      <GeneratedImagesCard
        images={generatedImages}
        isPreviewOpen={isPreviewOpen}
        previewIndex={previewIndex}
        onOpenChange={setIsPreviewOpen}
        onPreviewIndexChange={setPreviewIndex}
        onSendToWatermark={handleSendToWatermark}
        onExport={() => void handleExport()}
      />
    </div>
  );
};

export default ImageSplitter;
