import type { SplitLoadingStatus as LoadingStatus } from '@/pages/split/hooks/useImageSplitter';
import './split-loading-status.css';

export function SplitLoadingStatus({ status }: { status: LoadingStatus }) {
  const determinate = status.total !== undefined && status.total > 0 && status.completed !== undefined;
  const percent = determinate ? Math.min(100, Math.max(0, status.completed! / status.total! * 100)) : 0;

  return (
    <div className="split-loading rounded-xl border border-primary/25 bg-primary/5 px-4 py-3" role="status" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <div className="split-loading-tiles" aria-hidden="true"><span /><span /><span /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">{status.title}<span className="split-loading-dots" aria-hidden="true">…</span></p>
            {determinate && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{Math.round(percent)}%</span>}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={status.detail}>{status.detail}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/10" role="progressbar"
        aria-label={status.title} aria-valuemin={determinate ? 0 : undefined} aria-valuemax={determinate ? 100 : undefined}
        aria-valuenow={determinate ? Math.round(percent) : undefined}>
        <div className={determinate ? 'split-loading-progress' : 'split-loading-progress split-loading-progress-indeterminate'}
          style={determinate ? { transform: `scaleX(${percent / 100})` } : undefined} />
      </div>
    </div>
  );
}
