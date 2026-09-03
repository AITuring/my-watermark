import { useEffect, useId, useState } from 'react';
import type { ChangeEvent } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  splitMethod: 'axis' | 'grid';
  hvMode: 'ratio' | 'count';
  hvRatioW: number;
  hvRatioH: number;
  hvCount: number;
  overlapPercent: number;
  gridRatioW: number | null;
  gridRatioH: number | null;
  aspectW: number;
  aspectH: number;
  activePreviewOrientation: Orientation;
  sourceNaturalWidth?: number;
  sourceNaturalHeight?: number;
  sourceFileName?: string;
  verticalPlan: SlicePlan | null;
  horizontalPlan: SlicePlan | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSplitMethodChange: (value: 'axis' | 'grid') => void;
  onHvModeChange: (value: 'ratio' | 'count') => void;
  onHvRatioWChange: (value: number) => void;
  onHvRatioHChange: (value: number) => void;
  onHvCountChange: (value: number) => void;
  onOverlapPercentChange: (value: number) => void;
  onGridRatioWChange: (value: number | null) => void;
  onGridRatioHChange: (value: number | null) => void;
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
    splitMethod,
    hvMode,
    hvRatioW,
    hvRatioH,
    hvCount,
    overlapPercent,
    gridRatioW,
    gridRatioH,
    aspectW,
    aspectH,
    activePreviewOrientation,
    sourceNaturalWidth,
    sourceNaturalHeight,
    sourceFileName,
    verticalPlan,
    horizontalPlan,
    onFileChange,
    onSplitMethodChange,
    onHvModeChange,
    onHvRatioWChange,
    onHvRatioHChange,
    onHvCountChange,
    onOverlapPercentChange,
    onGridRatioWChange,
    onGridRatioHChange,
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
  const numberInputClassName =
    'h-9 border-border/80 bg-background text-foreground placeholder:text-muted-foreground dark:bg-card/80 dark:shadow-none';
  const fileInputId = useId();
  const currentMethodLabel = splitMethod === 'axis' ? '连续切长图' : '规则网格切块';
  const [hvRatioWDraft, setHvRatioWDraft] = useState(String(hvRatioW));
  const [hvRatioHDraft, setHvRatioHDraft] = useState(String(hvRatioH));
  const [hvCountDraft, setHvCountDraft] = useState(String(hvCount));
  const [overlapPercentDraft, setOverlapPercentDraft] = useState(String(overlapPercent));
  const [gridRatioWDraft, setGridRatioWDraft] = useState(gridRatioW === null ? '' : String(gridRatioW));
  const [gridRatioHDraft, setGridRatioHDraft] = useState(gridRatioH === null ? '' : String(gridRatioH));
  const [aspectWDraft, setAspectWDraft] = useState(String(aspectW));
  const [aspectHDraft, setAspectHDraft] = useState(String(aspectH));

  useEffect(() => {
    setHvRatioWDraft(String(hvRatioW));
  }, [hvRatioW]);

  useEffect(() => {
    setHvRatioHDraft(String(hvRatioH));
  }, [hvRatioH]);

  useEffect(() => {
    setHvCountDraft(String(hvCount));
  }, [hvCount]);

  useEffect(() => {
    setOverlapPercentDraft(String(overlapPercent));
  }, [overlapPercent]);

  useEffect(() => {
    setGridRatioWDraft(gridRatioW === null ? '' : String(gridRatioW));
  }, [gridRatioW]);

  useEffect(() => {
    setGridRatioHDraft(gridRatioH === null ? '' : String(gridRatioH));
  }, [gridRatioH]);

  useEffect(() => {
    setAspectWDraft(String(aspectW));
  }, [aspectW]);

  useEffect(() => {
    setAspectHDraft(String(aspectH));
  }, [aspectH]);

  const handleNumberInputFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };
  const handleNumberInputWheel = (event: React.WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
  };

  const sanitizeIntegerDraft = (rawValue: string) => {
    const digitsOnly = rawValue.replace(/[^\d]/g, '');
    return digitsOnly.replace(/^0+(?=\d)/, '');
  };

  const clampIntegerValue = (value: number, options: { min: number; max?: number }) => {
    return options.max === undefined
      ? Math.max(options.min, value)
      : Math.min(options.max, Math.max(options.min, value));
  };

  const handleIntegerDraftChange = (
    rawValue: string,
    setDraft: (value: string) => void,
    onChange: (value: number) => void,
    options: { min: number; max?: number }
  ) => {
    const normalized = sanitizeIntegerDraft(rawValue);
    setDraft(normalized);

    if (normalized === '') {
      return;
    }

    const parsedValue = Number(normalized);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    onChange(clampIntegerValue(parsedValue, options));
  };

  const commitIntegerDraft = (
    draftValue: string,
    setDraft: (value: string) => void,
    onChange: (value: number) => void,
    options: { min: number; max?: number }
  ) => {
    const normalized = sanitizeIntegerDraft(draftValue);
    const nextValue = normalized === '' ? options.min : clampIntegerValue(Number(normalized), options);
    setDraft(String(nextValue));
    onChange(nextValue);
  };

  const handleOptionalIntegerDraftChange = (
    rawValue: string,
    setDraft: (value: string) => void,
    onChange: (value: number | null) => void,
    options: { min: number; max?: number }
  ) => {
    const normalized = sanitizeIntegerDraft(rawValue);
    setDraft(normalized);

    if (normalized === '') {
      onChange(null);
      return;
    }

    const parsedValue = Number(normalized);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    onChange(clampIntegerValue(parsedValue, options));
  };

  const commitOptionalIntegerDraft = (
    draftValue: string,
    setDraft: (value: string) => void,
    onChange: (value: number | null) => void,
    options: { min: number; max?: number }
  ) => {
    const normalized = sanitizeIntegerDraft(draftValue);

    if (normalized === '') {
      setDraft('');
      onChange(null);
      return;
    }

    const nextValue = clampIntegerValue(Number(normalized), options);
    setDraft(String(nextValue));
    onChange(nextValue);
  };

  return (
    <Card className="h-fit">
      <CardHeader className="space-y-1 px-4 pb-3 pt-4">
        <CardTitle className="text-lg">切片设置</CardTitle>
        <CardDescription className="text-[11px]">左侧保留必要操作，预览在右侧完成。</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border/60 px-4 pb-4">
        <section className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 pb-4">
          <div className="flex h-6 w-6 items-center justify-center self-start rounded-full bg-primary text-[10px] font-semibold text-primary-foreground shadow-sm">
            1
          </div>
          <div className="space-y-2.5">
            <div className="space-y-0.5 px-3">
              <div className="text-sm font-semibold text-foreground">上传长图</div>
              <p className="text-[11px] text-muted-foreground">选择一张要切片的图片。</p>
            </div>
            <input
              id={fileInputId}
              type="file"
              accept="image/*"
              aria-label="上传要切片的长图"
              title="上传要切片的长图"
              onClick={(event) => {
                event.currentTarget.value = '';
              }}
              onChange={onFileChange}
              className="sr-only"
            />
            <div className="flex flex-col gap-2">
              <label
                htmlFor={fileInputId}
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-primary/25 bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-[background-color,box-shadow,transform] hover:bg-primary/92 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 dark:border-primary/20 dark:bg-primary dark:hover:bg-primary/88"
              >
                选择文件
              </label>
              <div className="flex h-9 min-w-0 items-center rounded-lg border border-border/70 bg-muted/45 px-3 text-[11px] text-muted-foreground dark:bg-card/65">
                <span className="truncate">{sourceFileName || '未选择文件'}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 py-4">
          <div className="flex h-6 w-6 items-center justify-center self-start rounded-full bg-primary text-[10px] font-semibold text-primary-foreground shadow-sm">
            2
          </div>
          <div className="space-y-2.5">
            <div className="space-y-0.5 px-3">
              <div className="text-sm font-semibold text-foreground">切割方式</div>
              <p className="text-[11px] text-muted-foreground">二选一，只保留当前方式参数。</p>
            </div>
            <div className="grid gap-2">
            <button
              type="button"
              onClick={() => onSplitMethodChange('axis')}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                splitMethod === 'axis'
                  ? 'border-primary/45 bg-primary/10 shadow-sm'
                  : 'border-border/70 bg-background/40 hover:bg-accent/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">连续切长图</span>
                {splitMethod === 'axis' && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    当前
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">适合长截图、海报、条漫，结果通常是 1 x N。</p>
            </button>

            <button
              type="button"
              onClick={() => onSplitMethodChange('grid')}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                splitMethod === 'grid'
                  ? 'border-primary/45 bg-primary/10 shadow-sm'
                  : 'border-border/70 bg-background/40 hover:bg-accent/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">规则网格切块</span>
                {splitMethod === 'grid' && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    当前
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">适合九宫格、多宫格拼图，结果通常是 M x N。</p>
            </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 pt-4">
          <div className="flex h-6 w-6 items-center justify-center self-start rounded-full bg-primary text-[10px] font-semibold text-primary-foreground shadow-sm">
            3
          </div>
          <div className="space-y-3">
            <div className="space-y-0.5 px-3">
              <div className="text-sm font-semibold text-foreground">参数与执行</div>
              <p className="text-[11px] text-muted-foreground">
                当前模式：{currentMethodLabel}
              </p>
            </div>
            {splitMethod === 'axis' ? (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground">连续切成长条，可按宽度或高度切。</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={hvMode} onValueChange={(value) => onHvModeChange(value as 'ratio' | 'count')}>
                    <SelectTrigger className="h-9 w-36">
                      <SelectValue placeholder="选择模式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ratio">按比例</SelectItem>
                      <SelectItem value="count">按数量</SelectItem>
                    </SelectContent>
                  </Select>

                  {hvMode === 'ratio' ? (
                    <>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={hvRatioWDraft}
                        aria-label="切片比例宽度"
                        title="切片比例宽度"
                        onFocus={handleNumberInputFocus}
                        onWheel={handleNumberInputWheel}
                        onBlur={() =>
                          commitIntegerDraft(hvRatioWDraft, setHvRatioWDraft, onHvRatioWChange, { min: 1 })
                        }
                        onChange={(event) =>
                          handleIntegerDraftChange(event.target.value, setHvRatioWDraft, onHvRatioWChange, { min: 1 })
                        }
                        className={`w-20 ${numberInputClassName}`}
                      />
                      <span className="text-sm font-bold">:</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={hvRatioHDraft}
                        aria-label="切片比例高度"
                        title="切片比例高度"
                        onFocus={handleNumberInputFocus}
                        onWheel={handleNumberInputWheel}
                        onBlur={() =>
                          commitIntegerDraft(hvRatioHDraft, setHvRatioHDraft, onHvRatioHChange, { min: 1 })
                        }
                        onChange={(event) =>
                          handleIntegerDraftChange(event.target.value, setHvRatioHDraft, onHvRatioHChange, { min: 1 })
                        }
                        className={`w-20 ${numberInputClassName}`}
                      />
                    </>
                  ) : (
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={hvCountDraft}
                      aria-label="切片数量"
                      title="切片数量"
                      onFocus={handleNumberInputFocus}
                      onWheel={handleNumberInputWheel}
                      onBlur={() =>
                        commitIntegerDraft(hvCountDraft, setHvCountDraft, onHvCountChange, { min: 1 })
                      }
                      onChange={(event) =>
                        handleIntegerDraftChange(event.target.value, setHvCountDraft, onHvCountChange, { min: 1 })
                      }
                      className={`w-24 ${numberInputClassName}`}
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[11px] text-muted-foreground">重叠比例 (%)</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={overlapPercentDraft}
                    aria-label="重叠比例"
                    title="重叠比例"
                    onFocus={handleNumberInputFocus}
                    onWheel={handleNumberInputWheel}
                    onBlur={() =>
                      commitIntegerDraft(
                        overlapPercentDraft,
                        setOverlapPercentDraft,
                        onOverlapPercentChange,
                        { min: 0, max: 90 }
                      )
                    }
                    onChange={(event) =>
                      handleIntegerDraftChange(
                        event.target.value,
                        setOverlapPercentDraft,
                        onOverlapPercentChange,
                        { min: 0, max: 90 }
                      )
                    }
                    className={`w-24 ${numberInputClassName}`}
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex flex-col gap-1">
                    <Button
                      onClick={onVerticalSplit}
                      disabled={!hasSourceImage || isProcessing}
                      variant={activePreviewOrientation === 'vertical' ? 'default' : 'outline'}
                      className={`h-9 justify-between text-sm ${preferVertical ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-background' : ''}`}
                    >
                      {isProcessing ? '生成中...' : '按宽度连续切'}
                    </Button>
                    {verticalPlan && (
                      <span className="text-[10px] leading-4 text-muted-foreground">
                        预计 {verticalPlan.numSlices} 张，单张约 {verticalPlan.tileSize} x {sourceNaturalHeight}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <Button
                      onClick={onHorizontalSplit}
                      disabled={!hasSourceImage || isProcessing}
                      variant={activePreviewOrientation === 'horizontal' ? 'default' : 'outline'}
                      className={`h-9 justify-between text-sm ${preferHorizontal ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-background' : ''}`}
                    >
                      {isProcessing ? '生成中...' : '按高度连续切'}
                    </Button>
                    {horizontalPlan && (
                      <span className="text-[10px] leading-4 text-muted-foreground">
                        预计 {horizontalPlan.numSlices} 张，单张约 {sourceNaturalWidth} x {horizontalPlan.tileSize}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  原图外框保持不变，内部按网格铺满；填写比例后单张切片会尽量保持目标比例。
                </p>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[11px] text-muted-foreground">可选切片比例</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={gridRatioWDraft}
                      placeholder="宽"
                      aria-label="规则网格切片比例宽度"
                      title="规则网格切片比例宽度"
                      onFocus={handleNumberInputFocus}
                      onWheel={handleNumberInputWheel}
                      onBlur={() =>
                        commitOptionalIntegerDraft(
                          gridRatioWDraft,
                          setGridRatioWDraft,
                          onGridRatioWChange,
                          { min: 1 }
                        )
                      }
                      onChange={(event) =>
                        handleOptionalIntegerDraftChange(
                          event.target.value,
                          setGridRatioWDraft,
                          onGridRatioWChange,
                          { min: 1 }
                        )
                      }
                      className={`w-20 ${numberInputClassName}`}
                    />
                    <span className="text-sm font-bold">:</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={gridRatioHDraft}
                      placeholder="高"
                      aria-label="规则网格切片比例高度"
                      title="规则网格切片比例高度"
                      onFocus={handleNumberInputFocus}
                      onWheel={handleNumberInputWheel}
                      onBlur={() =>
                        commitOptionalIntegerDraft(
                          gridRatioHDraft,
                          setGridRatioHDraft,
                          onGridRatioHChange,
                          { min: 1 }
                        )
                      }
                      onChange={(event) =>
                        handleOptionalIntegerDraftChange(
                          event.target.value,
                          setGridRatioHDraft,
                          onGridRatioHChange,
                          { min: 1 }
                        )
                      }
                      className={`w-20 ${numberInputClassName}`}
                    />
                  </div>
                  <p className="text-[10px] leading-4 text-muted-foreground">
                    宽高都填写后，会在原图外框内按该比例铺满切片；相邻切片可通过重叠来覆盖整张图。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[11px] text-muted-foreground">规则网格</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={aspectWDraft}
                    aria-label="网格列数"
                    title="网格列数"
                    onFocus={handleNumberInputFocus}
                    onWheel={handleNumberInputWheel}
                    onBlur={() =>
                      commitIntegerDraft(aspectWDraft, setAspectWDraft, onAspectWChange, { min: 1 })
                    }
                    onChange={(event) =>
                      handleIntegerDraftChange(event.target.value, setAspectWDraft, onAspectWChange, { min: 1 })
                    }
                    className={`w-20 ${numberInputClassName}`}
                  />
                  <span className="text-sm font-bold">:</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={aspectHDraft}
                    aria-label="网格行数"
                    title="网格行数"
                    onFocus={handleNumberInputFocus}
                    onWheel={handleNumberInputWheel}
                    onBlur={() =>
                      commitIntegerDraft(aspectHDraft, setAspectHDraft, onAspectHChange, { min: 1 })
                    }
                    onChange={(event) =>
                      handleIntegerDraftChange(event.target.value, setAspectHDraft, onAspectHChange, { min: 1 })
                    }
                    className={`w-20 ${numberInputClassName}`}
                  />
                  <span className="text-[11px] text-muted-foreground">预计 {Math.max(1, aspectW) * Math.max(1, aspectH)} 张</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[11px] text-muted-foreground">重叠比例 (%)</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={overlapPercentDraft}
                    aria-label="规则网格重叠比例"
                    title="规则网格重叠比例"
                    onFocus={handleNumberInputFocus}
                    onWheel={handleNumberInputWheel}
                    onBlur={() =>
                      commitIntegerDraft(
                        overlapPercentDraft,
                        setOverlapPercentDraft,
                        onOverlapPercentChange,
                        { min: 0, max: 90 }
                      )
                    }
                    onChange={(event) =>
                      handleIntegerDraftChange(
                        event.target.value,
                        setOverlapPercentDraft,
                        onOverlapPercentChange,
                        { min: 0, max: 90 }
                      )
                    }
                    className={`w-24 ${numberInputClassName}`}
                  />
                  <span className="text-[11px] text-muted-foreground">外框不变，内部按需要重叠</span>
                </div>
                <Button
                  onClick={onGridSplit}
                  disabled={!hasSourceImage || isProcessing}
                  className="h-9 w-full text-sm"
                >
                  {isProcessing ? '生成中...' : '生成规则网格'}
                </Button>
              </div>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
