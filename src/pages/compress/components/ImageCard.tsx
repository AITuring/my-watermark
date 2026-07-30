import { memo } from 'react';
import { ArrowRight, ChevronDown, Settings2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import type { CompressedImage, CompressionAction, ImageConfigPatch } from '../types';
import {
  formatFileSize,
  formatResolution,
  formatResizeLabel,
  getCompressionRatio,
  getImageStatus,
  getImageTargetBytes,
  getTargetResolution,
} from '../utils';

type ImageCardProps = {
  image: CompressedImage;
  isExpanded: boolean;
  isCompressing: boolean;
  compressionAction: CompressionAction;
  activeImageId: string | null;
  onRemove: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onUpdateConfig: (id: string, config: ImageConfigPatch) => void;
  onSingleCompress: (id: string) => void;
};

const ImageCardComponent = ({
  image,
  isExpanded,
  isCompressing,
  compressionAction,
  activeImageId,
  onRemove,
  onToggleExpanded,
  onUpdateConfig,
  onSingleCompress,
}: ImageCardProps) => {
  const imageStatus = getImageStatus(image);
  const targetResolution = getTargetResolution(image);

  return (
    <Card className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.07)]">
      <div className="relative aspect-video overflow-hidden bg-slate-100">
        <img
          src={image.preview}
          alt={image.originalFile.name}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <Badge className={`rounded-full border px-2 py-0.5 text-[11px] ${imageStatus.className}`}>
            {imageStatus.label}
          </Badge>
          <Button
            onClick={() => onRemove(image.id)}
            variant="destructive"
            size="sm"
            className="h-7 w-7 rounded-full p-0 shadow-md"
            disabled={isCompressing}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {image.outputScalePercent !== null && (
          <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
            <Badge
              variant="outline"
              className="rounded-full border-white/30 bg-black/45 px-2 py-0.5 text-[11px] text-white backdrop-blur"
            >
              {formatResizeLabel(image.outputScalePercent)}
            </Badge>
            {image.compressedFile && (
              <Badge
                variant="outline"
                className="rounded-full border-white/30 bg-black/45 px-2 py-0.5 text-[11px] text-white backdrop-blur"
              >
                节省 {getCompressionRatio(image.originalSize, image.compressedSize)}
              </Badge>
            )}
          </div>
        )}
      </div>
      <CardContent className="space-y-2.5 p-3">
        <div className="space-y-0.5">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <p
                className="truncate text-[13px] font-medium text-slate-900"
                title={image.originalFile.name}
              >
                {image.originalFile.name}
              </p>
              <p className="text-[11px] text-slate-500">
                目标 {image.targetSizeMB} MB · {formatResizeLabel(image.resizePercent)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCompressing}
              onClick={() => onToggleExpanded(image.id)}
              className="h-7 rounded-full border-slate-200 bg-white px-2.5 text-[12px] text-slate-600"
            >
              <Settings2 className="mr-1 h-3.5 w-3.5" />
              单张设置
              <ChevronDown
                className={`ml-1 h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </Button>
          </div>
        </div>
        {isExpanded && (
          <div className="space-y-2.5 rounded-[18px] border border-slate-200/80 bg-slate-50/80 p-2.5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>单张目标体积</span>
                <span className="font-medium text-slate-900">{image.targetSizeMB} MB</span>
              </div>
              <Input
                type="number"
                min={0.1}
                step={0.5}
                value={image.targetSizeMB}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    onUpdateConfig(image.id, { targetSizeMB: Math.max(value, 0.1) });
                  }
                }}
                disabled={isCompressing}
                className="h-9 rounded-xl border-slate-200 bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>单张输出尺寸</span>
                <span className="font-medium text-slate-900">{formatResizeLabel(image.resizePercent)}</span>
              </div>
              <Slider
                value={[image.resizePercent]}
                onValueChange={(value) => onUpdateConfig(image.id, { resizePercent: Math.round(value[0]) })}
                max={100}
                min={10}
                step={5}
                className="w-full"
                disabled={isCompressing}
              />
            </div>
            <Button
              type="button"
              onClick={() => onSingleCompress(image.id)}
              disabled={isCompressing}
              className="h-9 w-full rounded-xl bg-slate-900 text-[13px] text-white hover:bg-slate-800"
            >
              {isCompressing && compressionAction === 'single' && activeImageId === image.id
                ? '压缩中...'
                : '压缩这张'}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
          <div className="rounded-[16px] bg-slate-50 p-2.5">
            <div className="text-slate-500">原始大小</div>
            <div className="mt-0.5 text-[13px] font-semibold text-slate-900">
              {formatFileSize(image.originalSize)}
            </div>
          </div>
          <div className="rounded-[16px] bg-slate-50 p-2.5">
            <div className="text-slate-500">压缩后</div>
            <div className="mt-0.5 text-[13px] font-semibold text-slate-900">
              {image.compressedFile ? formatFileSize(image.compressedSize) : '--'}
            </div>
          </div>
        </div>
        <div className="rounded-[16px] border border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-2.5 py-2">
          <div className="mb-1 text-[10px] font-medium text-slate-500">分辨率</div>
          <div className="flex items-center gap-1 text-[12px] font-semibold text-slate-900">
            <span className="rounded-full bg-white px-2 py-0.5 shadow-sm shadow-slate-200/60">
              {formatResolution(image.originalWidth, image.originalHeight)}
            </span>
            <ArrowRight className="h-3 w-3 text-slate-400" />
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-white shadow-sm shadow-slate-300/40">
              {formatResolution(targetResolution.width, targetResolution.height)}
            </span>
          </div>
        </div>
        {image.compressedFile && (
          <div className="space-y-1.5 rounded-[16px] border border-slate-200/80 bg-slate-50/80 p-2.5 text-[11px] text-slate-600">
            <div className="flex justify-between">
              <span>输出尺寸</span>
              <span className="font-medium text-slate-900">{formatResizeLabel(image.outputScalePercent)}</span>
            </div>
            <div className="flex justify-between">
              <span>节省体积</span>
              <span className="font-medium text-emerald-600">
                {formatFileSize(Math.max(image.originalSize - image.compressedSize, 0))}
              </span>
            </div>
            <div className="flex justify-between">
              <span>结果状态</span>
              <span
                className={`font-medium ${
                  image.compressedSize > getImageTargetBytes(image) ? 'text-orange-600' : 'text-emerald-600'
                }`}
              >
                {image.compressedSize > getImageTargetBytes(image) ? '仍高于目标体积' : '已达目标体积'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const ImageCard = memo(ImageCardComponent);
ImageCard.displayName = 'ImageCard';
