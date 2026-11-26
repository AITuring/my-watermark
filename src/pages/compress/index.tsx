import { Image as ImageIcon } from 'lucide-react';
import { ImageWorkbenchHeader, ImageWorkbenchPanels } from "@/components/image-workbench/ImageWorkbench";
import CompressImageGrid from './components/CompressImageGrid';
import CompressSidebar from './components/CompressSidebar';
import EmptyUploadState from './components/EmptyUploadState';
import { useCompressWorkbench } from './hooks/useCompressWorkbench';

const BatchImageCompressor = () => {
  const workbench = useCompressWorkbench();

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <ImageWorkbenchHeader title="图片压缩" icon={<ImageIcon className="h-5 w-5 text-muted-foreground" />} />
        <div className="space-y-6">
              {workbench.images.length === 0 && (
                <EmptyUploadState
                  getRootProps={workbench.getRootProps}
                  getInputProps={workbench.getInputProps}
                  isDragActive={workbench.isDragActive}
                />
              )}

              {workbench.images.length > 0 && (
                <><input {...workbench.getInputProps()} /><ImageWorkbenchPanels editorLabel="图片与结果" editor={<CompressImageGrid
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
                  />} settings={<CompressSidebar
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
                  />} gridClassName="lg:grid-cols-[minmax(0,1fr)_320px]" /></>
              )}
        </div>
      </div>
    </main>
  );
};

export default BatchImageCompressor;
