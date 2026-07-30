import { Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageCard } from './ImageCard';
import type { CompressedImage, CompressionAction, ImageConfigPatch } from '../types';

type CompressImageGridProps = {
  images: CompressedImage[];
  expandedImageId: string | null;
  isCompressing: boolean;
  isExporting: boolean;
  compressionAction: CompressionAction;
  activeImageId: string | null;
  imagesExceedingTargetCount: number;
  openFilePicker: () => void;
  onForceCompress: () => void;
  onBatchExport: () => void;
  onRemoveImage: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onUpdateImageConfig: (id: string, config: ImageConfigPatch) => void;
  onSingleCompress: (id: string) => void;
};

const CompressImageGrid = ({
  images,
  expandedImageId,
  isCompressing,
  isExporting,
  compressionAction,
  activeImageId,
  imagesExceedingTargetCount,
  openFilePicker,
  onForceCompress,
  onBatchExport,
  onRemoveImage,
  onToggleExpanded,
  onUpdateImageConfig,
  onSingleCompress,
}: CompressImageGridProps) => (
  <div className="space-y-4 lg:min-w-0">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-slate-900">图片列表 ({images.length})</h3>
      <Button
        type="button"
        onClick={openFilePicker}
        disabled={isCompressing}
        className="h-10 rounded-2xl bg-slate-900 px-4 text-white hover:bg-slate-800"
      >
        <Plus className="mr-2 h-4 w-4" />
        添加图片
      </Button>
    </div>
    {images.some((image) => image.compressedFile) && (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm">
        <div className="text-sm text-slate-600">
          {imagesExceedingTargetCount > 0 ? `还有 ${imagesExceedingTargetCount} 张未达标` : '当前结果已达标'}
        </div>
        <div className="flex flex-wrap gap-2">
          {imagesExceedingTargetCount > 0 && (
            <Button
              onClick={onForceCompress}
              disabled={isCompressing || isExporting}
              className="h-10 rounded-2xl bg-orange-600 px-4 hover:bg-orange-700"
            >
              {isCompressing && compressionAction === 'force'
                ? '强制压缩中...'
                : `强制压到目标体积 (${imagesExceedingTargetCount})`}
            </Button>
          )}
          <Button
            onClick={onBatchExport}
            disabled={isExporting}
            className="h-10 rounded-2xl bg-emerald-600 px-4 hover:bg-emerald-700"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? '导出中...' : '批量导出'}
          </Button>
        </div>
      </div>
    )}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {images.map((image) => (
        <ImageCard
          key={image.id}
          image={image}
          isExpanded={expandedImageId === image.id}
          isCompressing={isCompressing}
          compressionAction={compressionAction}
          activeImageId={activeImageId}
          onRemove={onRemoveImage}
          onToggleExpanded={onToggleExpanded}
          onUpdateConfig={onUpdateImageConfig}
          onSingleCompress={onSingleCompress}
        />
      ))}
    </div>
  </div>
);

export default CompressImageGrid;
