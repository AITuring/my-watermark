import { Image as ImageIcon } from 'lucide-react';
import GenerativeBackground from '@/components/GenerativeBackground';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CompressImageGrid from './components/CompressImageGrid';
import CompressSidebar from './components/CompressSidebar';
import EmptyUploadState from './components/EmptyUploadState';
import { useCompressWorkbench } from './hooks/useCompressWorkbench';

const BatchImageCompressor = () => {
  const workbench = useCompressWorkbench();

  return (
    <div className="relative min-h-screen w-full">
      <div className="fixed inset-0 z-0 overflow-hidden bg-[#f4f1ea]">
        <GenerativeBackground />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(244,241,234,0.22)_0%,rgba(244,241,234,0.12)_24%,rgba(244,241,234,0.18)_100%)]" />
      </div>

      <div className="relative z-10 p-6">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <Card className="border-white/50 bg-white/82 shadow-xl backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                <ImageIcon className="h-5 w-5 text-slate-700" />
                图片压缩
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {workbench.images.length === 0 && (
                <EmptyUploadState
                  getRootProps={workbench.getRootProps}
                  getInputProps={workbench.getInputProps}
                  isDragActive={workbench.isDragActive}
                />
              )}

              {workbench.images.length > 0 && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_320px] xl:grid-cols-[minmax(0,4.2fr)_340px]">
                  <input {...workbench.getInputProps()} />
                  <CompressImageGrid
                    images={workbench.images}
                    expandedImageId={workbench.expandedImageId}
                    isCompressing={workbench.isCompressing}
                    isExporting={workbench.isExporting}
                    compressionAction={workbench.compressionAction}
                    activeImageId={workbench.activeImageId}
                    imagesExceedingTargetCount={workbench.imagesExceedingTarget.length}
                    openFilePicker={workbench.open}
                    onForceCompress={workbench.handleForceCompressToTarget}
                    onBatchExport={workbench.handleBatchExport}
                    onRemoveImage={workbench.removeImage}
                    onToggleExpanded={workbench.toggleExpandedImage}
                    onUpdateImageConfig={workbench.updateImageConfig}
                    onSingleCompress={workbench.handleSingleCompress}
                  />
                  <CompressSidebar
                    imageCount={workbench.images.length}
                    compressedCount={workbench.compressedCount}
                    imagesExceedingTargetCount={workbench.imagesExceedingTarget.length}
                    totalSavedBytes={workbench.totalSavedBytes}
                    normalizedTargetSizeMB={workbench.normalizedTargetSizeMB}
                    resizePercent={workbench.resizePercent}
                    isCompressing={workbench.isCompressing}
                    isExporting={workbench.isExporting}
                    compressionAction={workbench.compressionAction}
                    compressionProgress={workbench.compressionProgress}
                    onTargetSizeChange={workbench.updateTargetSize}
                    onResizePercentChange={workbench.updateResizePercent}
                    onBatchCompress={workbench.handleBatchCompress}
                    onRouteTransfer={workbench.handleRouteTransfer}
                    onClearAll={workbench.clearAllImages}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BatchImageCompressor;
