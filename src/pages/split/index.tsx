import React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { AxisSplitPreview } from '@/pages/split/components/AxisSplitPreview';
import { GeneratedImagesCard } from '@/pages/split/components/GeneratedImagesCard';
import { GridSplitPreview } from '@/pages/split/components/GridSplitPreview';
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
    gridPlan,
    gridRatioH,
    gridRatioW,
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
    setGridRatioH,
    setGridRatioW,
    setHvCount,
    setHvMode,
    setHvRatioH,
    setHvRatioW,
    setIsPreviewOpen,
    setOverlapPercent,
    setPreviewIndex,
    sourceFileName,
    sourceImage,
    verticalPlan,
  } = useImageSplitter();
  const [splitMethod, setSplitMethod] = React.useState<'axis' | 'grid'>('axis');
  const hasPreview = Boolean(previewUrl && sourceImage && (splitMethod === 'grid' ? gridPlan : activePlan));

  return (
    <div className="mx-auto max-w-[1760px] px-3 py-3 lg:px-4">
      <div className="mb-3">
        <h2 className="text-2xl font-bold text-foreground">长图智能切片</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">上传长图后，可连续切长图或生成规则网格。</p>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className={hasPreview ? 'grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]' : ''}>
        <div className={hasPreview ? 'xl:sticky xl:top-4 xl:self-start' : ''}>
          <SplitSettingsCard
            hasSourceImage={Boolean(sourceImage)}
            isProcessing={isProcessing}
            splitMethod={splitMethod}
            hvMode={hvMode}
            hvRatioW={hvRatioW}
            hvRatioH={hvRatioH}
            hvCount={hvCount}
            overlapPercent={overlapPercent}
            gridRatioW={gridRatioW}
            gridRatioH={gridRatioH}
            aspectW={aspectW}
            aspectH={aspectH}
            activePreviewOrientation={activePreviewOrientation}
            sourceNaturalWidth={sourceImage?.naturalWidth}
            sourceNaturalHeight={sourceImage?.naturalHeight}
            sourceFileName={sourceFileName}
            verticalPlan={verticalPlan}
            horizontalPlan={horizontalPlan}
            onFileChange={handleFileChange}
            onSplitMethodChange={setSplitMethod}
            onHvModeChange={setHvMode}
            onHvRatioWChange={setHvRatioW}
            onHvRatioHChange={setHvRatioH}
            onHvCountChange={setHvCount}
            onOverlapPercentChange={setOverlapPercent}
            onGridRatioWChange={setGridRatioW}
            onGridRatioHChange={setGridRatioH}
            onAspectWChange={setAspectW}
            onAspectHChange={setAspectH}
            onVerticalSplit={handleVerticalSplit}
            onHorizontalSplit={handleHorizontalSplit}
            onGridSplit={handleGridSplit}
          />
        </div>

        {hasPreview && (
          <Card className="overflow-hidden border-border/70 bg-card/92 dark:bg-card/78">
            <CardContent className="space-y-2 p-3">
              {splitMethod === 'axis' ? (
                <AxisSplitPreview
                  title={activeTitle}
                  imageUrl={previewUrl!}
                  naturalWidth={sourceImage!.naturalWidth}
                  naturalHeight={sourceImage!.naturalHeight}
                  plan={activePlan!}
                  isAdjusted={activeIsAdjusted}
                  onCommitStarts={(starts) => commitManualRegionStarts(activePreviewOrientation, starts)}
                  onReset={() => resetManualRegionStart(activePreviewOrientation)}
                />
              ) : (
                <GridSplitPreview
                  title="规则网格预览"
                  imageUrl={previewUrl!}
                  naturalWidth={sourceImage!.naturalWidth}
                  naturalHeight={sourceImage!.naturalHeight}
                  plan={gridPlan!}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>

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
