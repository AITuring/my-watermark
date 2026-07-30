import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { RESIZE_PERCENT_PRESETS, TARGET_SIZE_PRESETS } from '../constants';
import type { CompressionAction } from '../types';
import { formatFileSize, formatResizeLabel } from '../utils';

type CompressSidebarProps = {
  imageCount: number;
  compressedCount: number;
  imagesExceedingTargetCount: number;
  totalSavedBytes: number;
  normalizedTargetSizeMB: number;
  resizePercent: number[];
  isCompressing: boolean;
  isExporting: boolean;
  compressionAction: CompressionAction;
  compressionProgress: number;
  onTargetSizeChange: (value: number) => void;
  onResizePercentChange: (value: number[]) => void;
  onBatchCompress: () => void;
  onRouteTransfer: (target: 'watermark' | 'crop') => void;
  onClearAll: () => void;
};

const CompressSidebar = ({
  imageCount,
  compressedCount,
  imagesExceedingTargetCount,
  totalSavedBytes,
  normalizedTargetSizeMB,
  resizePercent,
  isCompressing,
  isExporting,
  compressionAction,
  compressionProgress,
  onTargetSizeChange,
  onResizePercentChange,
  onBatchCompress,
  onRouteTransfer,
  onClearAll,
}: CompressSidebarProps) => (
  <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
    <div className="flex flex-wrap gap-2 rounded-[20px] border border-slate-200/80 bg-white/88 p-3 shadow-sm backdrop-blur-sm">
      <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-600">
        {imageCount} 张
      </Badge>
      <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-600">
        已压缩 {compressedCount}
      </Badge>
      {imagesExceedingTargetCount > 0 && (
        <Badge className="rounded-full bg-orange-500 text-white hover:bg-orange-500">
          未达标 {imagesExceedingTargetCount}
        </Badge>
      )}
      {totalSavedBytes > 0 && (
        <Badge className="rounded-full bg-emerald-500 text-white hover:bg-emerald-500">
          已节省 {formatFileSize(totalSavedBytes)}
        </Badge>
      )}
    </div>

    <div className="space-y-4 rounded-[24px] border border-slate-200/80 bg-white/92 p-4 shadow-sm">
      <div>
        <div className="text-sm font-medium text-slate-900">批量设置</div>
        <div className="mt-1 text-xs text-slate-500">修改后会立即同步到左侧图片列表</div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-800">目标体积</label>
          <span className="text-sm font-semibold text-slate-900">{normalizedTargetSizeMB} MB</span>
        </div>
        <Input
          type="number"
          min={0.1}
          step={0.5}
          value={normalizedTargetSizeMB}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value)) {
              onTargetSizeChange(Math.max(value, 0.1));
            }
          }}
          disabled={isCompressing}
          className="h-10 rounded-2xl border-slate-200 bg-white/90"
        />
        <div className="flex flex-wrap gap-2">
          {TARGET_SIZE_PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant="outline"
              size="sm"
              disabled={isCompressing}
              onClick={() => onTargetSizeChange(preset)}
              className={`rounded-full border-slate-200 bg-white px-3 ${
                Math.abs(normalizedTargetSizeMB - preset) < 0.001
                  ? 'border-sky-500 bg-sky-50 text-sky-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {preset} MB
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-800">输出尺寸</label>
          <span className="text-sm font-semibold text-slate-900">
            {formatResizeLabel(Math.round(resizePercent[0]))}
          </span>
        </div>
        <Slider
          value={resizePercent}
          onValueChange={onResizePercentChange}
          max={100}
          min={10}
          step={5}
          className="w-full"
          disabled={isCompressing}
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>更小 (10%)</span>
          <span>原尺寸 (100%)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {RESIZE_PERCENT_PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant="outline"
              size="sm"
              disabled={isCompressing}
              onClick={() => onResizePercentChange([preset])}
              className={`rounded-full border-slate-200 bg-white px-3 ${
                Math.round(resizePercent[0]) === preset
                  ? 'border-sky-500 bg-sky-50 text-sky-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {preset}%
            </Button>
          ))}
        </div>
      </div>

      {isCompressing && (
        <div className="space-y-2 rounded-[18px] border border-sky-200 bg-sky-50/90 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-800">
              {compressionAction === 'force'
                ? '强制压缩进度'
                : compressionAction === 'single'
                  ? '单张压缩进度'
                  : '压缩进度'}
            </span>
            <span className="font-semibold text-slate-900">{Math.round(compressionProgress)}%</span>
          </div>
          <Progress value={compressionProgress} className="w-full" />
        </div>
      )}
    </div>

    <div className="space-y-3 rounded-[24px] border border-slate-200/80 bg-slate-900 p-4 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
      <div className="text-sm text-slate-300">
        目标 {normalizedTargetSizeMB} MB · {formatResizeLabel(Math.round(resizePercent[0]))}
      </div>
      <Button
        onClick={onBatchCompress}
        disabled={isCompressing}
        className="h-11 rounded-2xl bg-sky-500 text-white hover:bg-sky-600"
      >
        {isCompressing && compressionAction === 'normal' ? '压缩中...' : '开始压缩'}
      </Button>
      <Button
        onClick={() => onRouteTransfer('watermark')}
        variant="outline"
        disabled={isCompressing || isExporting}
        className="h-10 rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
      >
        发送到水印
      </Button>
      <Button
        onClick={() => onRouteTransfer('crop')}
        variant="outline"
        disabled={isCompressing || isExporting}
        className="h-10 rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
      >
        发送到裁切
      </Button>
      <Button
        onClick={onClearAll}
        variant="outline"
        disabled={isCompressing}
        className="h-10 rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        清空
      </Button>
    </div>
  </div>
);

export default CompressSidebar;
