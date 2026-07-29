import type { ChangeEvent } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Orientation, SlicePlan } from '@/pages/split/types';

interface SplitSettingsCardProps {
  hasSourceImage: boolean;
  isProcessing: boolean;
  hvMode: 'ratio' | 'count';
  hvRatioW: number;
  hvRatioH: number;
  hvCount: number;
  overlapPercent: number;
  aspectW: number;
  aspectH: number;
  activePreviewOrientation: Orientation;
  sourceNaturalWidth?: number;
  sourceNaturalHeight?: number;
  verticalPlan: SlicePlan | null;
  horizontalPlan: SlicePlan | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onHvModeChange: (value: 'ratio' | 'count') => void;
  onHvRatioWChange: (value: number) => void;
  onHvRatioHChange: (value: number) => void;
  onHvCountChange: (value: number) => void;
  onOverlapPercentChange: (value: number) => void;
  onAspectWChange: (value: number) => void;
  onAspectHChange: (value: number) => void;
  onVerticalSplit: () => void;
  onHorizontalSplit: () => void;
  onGridSplit: () => void;
}

export function SplitSettingsCard(props: SplitSettingsCardProps) {
  const {
    hasSourceImage,
    isProcessing,
    hvMode,
    hvRatioW,
    hvRatioH,
    hvCount,
    overlapPercent,
    aspectW,
    aspectH,
    activePreviewOrientation,
    sourceNaturalWidth,
    sourceNaturalHeight,
    verticalPlan,
    horizontalPlan,
    onFileChange,
    onHvModeChange,
    onHvRatioWChange,
    onHvRatioHChange,
    onHvCountChange,
    onOverlapPercentChange,
    onAspectWChange,
    onAspectHChange,
    onVerticalSplit,
    onHorizontalSplit,
    onGridSplit,
  } = props;

  const preferVertical = Boolean(
    sourceNaturalWidth && sourceNaturalHeight && sourceNaturalWidth > sourceNaturalHeight * 1.5
  );
  const preferHorizontal = Boolean(
    sourceNaturalWidth && sourceNaturalHeight && sourceNaturalHeight > sourceNaturalWidth * 1.5
  );

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>切片设置</CardTitle>
        <CardDescription>上传图片后选择切割方式</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">1. 上传长图</label>
            <input
              type="file"
              accept="image/*"
              aria-label="上传要切片的长图"
              title="上传要切片的长图"
              onChange={onFileChange}
              className="block text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">2. 水平/竖直切割</label>
            <div className="flex items-center gap-3">
              <Select value={hvMode} onValueChange={(value) => onHvModeChange(value as 'ratio' | 'count')}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="选择模式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ratio">按比例</SelectItem>
                  <SelectItem value="count">按数量</SelectItem>
                </SelectContent>
              </Select>

              {hvMode === 'ratio' ? (
                <>
                  <input
                    type="number"
                    value={hvRatioW}
                    min={1}
                    aria-label="切片比例宽度"
                    title="切片比例宽度"
                    onChange={(event) => onHvRatioWChange(Number(event.target.value))}
                    className="h-9 w-20 rounded-md border border-input px-3 text-sm"
                  />
                  <span className="font-bold">:</span>
                  <input
                    type="number"
                    value={hvRatioH}
                    min={1}
                    aria-label="切片比例高度"
                    title="切片比例高度"
                    onChange={(event) => onHvRatioHChange(Number(event.target.value))}
                    className="h-9 w-20 rounded-md border border-input px-3 text-sm"
                  />
                </>
              ) : (
                <input
                  type="number"
                  value={hvCount}
                  min={1}
                  aria-label="切片数量"
                  title="切片数量"
                  onChange={(event) => onHvCountChange(Number(event.target.value))}
                  className="h-9 w-24 rounded-md border border-input px-3 text-sm"
                />
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">重叠比例 (%)</span>
              <input
                type="number"
                value={overlapPercent}
                min={0}
                max={90}
                aria-label="重叠比例"
                title="重叠比例"
                onChange={(event) => onOverlapPercentChange(Number(event.target.value))}
                className="h-9 w-24 rounded-md border border-input px-3 text-sm"
              />
            </div>

            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-1">
                <Button
                  onClick={onVerticalSplit}
                  disabled={!hasSourceImage || isProcessing}
                  variant={activePreviewOrientation === 'vertical' ? 'default' : 'outline'}
                  className={`h-9 ${preferVertical ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                >
                  {isProcessing ? '生成中...' : '纵向分列 (切宽度)'}
                </Button>
                {verticalPlan && (
                  <span className="text-center text-[10px] text-slate-500">
                    预计 {verticalPlan.numSlices} 张 ({verticalPlan.tileSize}x{sourceNaturalHeight})
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <Button
                  onClick={onHorizontalSplit}
                  disabled={!hasSourceImage || isProcessing}
                  variant={activePreviewOrientation === 'horizontal' ? 'default' : 'outline'}
                  className={`h-9 ${preferHorizontal ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                >
                  {isProcessing ? '生成中...' : '横向分行 (切高度)'}
                </Button>
                {horizontalPlan && (
                  <span className="text-center text-[10px] text-slate-500">
                    预计 {horizontalPlan.numSlices} 张 ({sourceNaturalWidth}x{horizontalPlan.tileSize})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">3. 按比例网格 (列 : 行)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={aspectW}
                min={1}
                aria-label="网格列数"
                title="网格列数"
                onChange={(event) => onAspectWChange(Number(event.target.value))}
                className="h-9 w-20 rounded-md border border-input px-3 text-sm"
              />
              <span className="font-bold">:</span>
              <input
                type="number"
                value={aspectH}
                min={1}
                aria-label="网格行数"
                title="网格行数"
                onChange={(event) => onAspectHChange(Number(event.target.value))}
                className="h-9 w-20 rounded-md border border-input px-3 text-sm"
              />
              <span className="text-xs text-slate-500">切片之间不重叠</span>
              <Button onClick={onGridSplit} disabled={!hasSourceImage || isProcessing} className="ml-auto h-9">
                {isProcessing ? '生成中...' : '按比例网格切割'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
