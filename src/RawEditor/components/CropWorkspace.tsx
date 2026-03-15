import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type CropRect = { x0: number; y0: number; x1: number; y1: number };

type Handle = 'move' | 'new' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

type Props = {
  visible: boolean;
  imageAspect: number;
  cropRect: CropRect;
  cropEnabled: boolean;
  straighten: number;
  onStraightenChange: (v: number) => void;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onCropRectChange: (rect: CropRect) => void;
  onApply: () => void;
  onReset: () => void;
  onCancel: () => void;
  clientToUv: (clientX: number, clientY: number) => { x: number; y: number } | null;
  uvToPercent: (uvX: number, uvY: number) => { left: number; top: number };
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const minSize = 0.015;

const normalizeRect = (r: CropRect): CropRect => ({
  x0: Math.min(r.x0, r.x1),
  y0: Math.min(r.y0, r.y1),
  x1: Math.max(r.x0, r.x1),
  y1: Math.max(r.y0, r.y1),
});



export const CropWorkspace: React.FC<Props> = ({
  visible,
  imageAspect,
  cropRect,
  cropEnabled,
  straighten,
  onStraightenChange,
  onRotateCW,
  onRotateCCW,
  onFlipH,
  onFlipV,
  onCropRectChange,
  onApply,
  onReset,
  onCancel,
  clientToUv,
  uvToPercent,
}) => {
  const [preset, setPreset] = useState('free');
  const [lockRatio, setLockRatio] = useState(false);
  const [invertAspect, setInvertAspect] = useState(false);
  const [minSizeHint, setMinSizeHint] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    mode: Handle;
    startUv: { x: number; y: number };
    startRect: CropRect;
  } | null>(null);

  const aspect = useMemo(() => {
    if (!lockRatio) return null;
    if (preset === 'free') return null;
    const base = preset === 'original'
      ? Math.max(imageAspect, 0.01)
      : (() => {
          const [w, h] = preset.split(':').map(Number);
          if (!w || !h) return null;
          return w / h;
        })();
    if (!base) return null;
    return invertAspect ? 1 / base : base;
  }, [preset, lockRatio, imageAspect, invertAspect]);

  const uvAspect = useMemo(() => {
    if (!aspect) return null;
    return aspect / Math.max(imageAspect, 1e-6);
  }, [aspect, imageAspect]);

  const box = useMemo(() => {
    const r = normalizeRect(cropRect);
    const a = uvToPercent(r.x0, r.y0);
    const b = uvToPercent(r.x1, r.y1);
    return {
      left: Math.min(a.left, b.left),
      top: Math.min(a.top, b.top),
      width: Math.max(Math.abs(a.left - b.left), 0.5),
      height: Math.max(Math.abs(a.top - b.top), 0.5),
    };
  }, [cropRect, uvToPercent]);

  const fitRectToAspect = useCallback((rect: CropRect, ratio: number): CropRect => {
    const r = normalizeRect(rect);
    const cx = (r.x0 + r.x1) * 0.5;
    const cy = (r.y0 + r.y1) * 0.5;
    let w = Math.max(r.x1 - r.x0, minSize);
    let h = Math.max(r.y1 - r.y0, minSize);
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;

    w = Math.min(w, 1);
    h = Math.min(h, 1);

    let x0 = cx - w / 2;
    let y0 = cy - h / 2;
    let x1 = cx + w / 2;
    let y1 = cy + h / 2;

    if (x0 < 0) { x1 -= x0; x0 = 0; }
    if (y0 < 0) { y1 -= y0; y0 = 0; }
    if (x1 > 1) { const d = x1 - 1; x0 -= d; x1 = 1; }
    if (y1 > 1) { const d = y1 - 1; y0 -= d; y1 = 1; }

    return normalizeRect({ x0: clamp01(x0), y0: clamp01(y0), x1: clamp01(x1), y1: clamp01(y1) });
  }, []);

  const applyAspectToRect = (r: CropRect, mode: Handle, startRect: CropRect): CropRect => {
    if (!uvAspect) return r;
    const nr = normalizeRect(r);

    if (mode === 'e' || mode === 'w') {
      const cx = (nr.x0 + nr.x1) * 0.5;
      const cy = (startRect.y0 + startRect.y1) * 0.5;
      const w = Math.max(nr.x1 - nr.x0, minSize);
      const h = w / uvAspect;
      return normalizeRect({ x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });
    }

    if (mode === 'n' || mode === 's') {
      const cx = (startRect.x0 + startRect.x1) * 0.5;
      const cy = (nr.y0 + nr.y1) * 0.5;
      const h = Math.max(nr.y1 - nr.y0, minSize);
      const w = h * uvAspect;
      return normalizeRect({ x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });
    }

    const s = normalizeRect(startRect);
    let ax = s.x0;
    let ay = s.y0;
    if (mode === 'nw') { ax = s.x1; ay = s.y1; }
    if (mode === 'ne') { ax = s.x0; ay = s.y1; }
    if (mode === 'sw') { ax = s.x0; ay = s.y0; }
    if (mode === 'se' || mode === 'new') { ax = s.x0; ay = s.y0; }

    let px = mode === 'new' ? nr.x1 : (mode.includes('w') ? nr.x0 : nr.x1);
    let py = mode === 'new' ? nr.y1 : (mode.includes('n') ? nr.y0 : nr.y1);

    let dx = px - ax;
    let dy = py - ay;
    const sx = dx >= 0 ? 1 : -1;
    const sy = dy >= 0 ? 1 : -1;
    dx = Math.abs(dx);
    dy = Math.abs(dy);

    if (dx / Math.max(dy, 1e-6) > uvAspect) dy = dx / uvAspect;
    else dx = dy * uvAspect;

    px = ax + dx * sx;
    py = ay + dy * sy;
    return normalizeRect({ x0: ax, y0: ay, x1: px, y1: py });
  };

  const safeRect = (r: CropRect): CropRect => {
    const snap = (v: number) => {
      const targets = [0, 1, 1 / 3, 2 / 3, 0.5];
      const tol = 0.012;
      for (const t of targets) {
        if (Math.abs(v - t) <= tol) return t;
      }
      return v;
    };

    const nr = normalizeRect({
      x0: snap(clamp01(r.x0)),
      y0: snap(clamp01(r.y0)),
      x1: snap(clamp01(r.x1)),
      y1: snap(clamp01(r.y1)),
    });

    let clampedByMin = false;
    if (nr.x1 - nr.x0 < minSize) { nr.x1 = Math.min(1, nr.x0 + minSize); clampedByMin = true; }
    if (nr.y1 - nr.y0 < minSize) { nr.y1 = Math.min(1, nr.y0 + minSize); clampedByMin = true; }
    setMinSizeHint(clampedByMin);

    return normalizeRect(nr);
  };

  const updateByDrag = (mode: Handle, uv: { x: number; y: number }, startRect: CropRect, startUv: { x: number; y: number }) => {
    const s = normalizeRect(startRect);
    let next = { ...s };

    if (mode === 'move') {
      const dx = uv.x - startUv.x;
      const dy = uv.y - startUv.y;
      const w = s.x1 - s.x0;
      const h = s.y1 - s.y0;
      next = {
        x0: clamp01(s.x0 + dx),
        y0: clamp01(s.y0 + dy),
        x1: clamp01(s.x0 + dx + w),
        y1: clamp01(s.y0 + dy + h),
      };
      if (next.x1 > 1) { const d = next.x1 - 1; next.x0 -= d; next.x1 -= d; }
      if (next.y1 > 1) { const d = next.y1 - 1; next.y0 -= d; next.y1 -= d; }
      if (next.x0 < 0) { const d = -next.x0; next.x0 += d; next.x1 += d; }
      if (next.y0 < 0) { const d = -next.y0; next.y0 += d; next.y1 += d; }
      onCropRectChange(safeRect(next));
      return;
    }

    if (mode === 'new') next = { x0: startUv.x, y0: startUv.y, x1: uv.x, y1: uv.y };
    if (mode.includes('n')) next.y0 = uv.y;
    if (mode.includes('s')) next.y1 = uv.y;
    if (mode.includes('w')) next.x0 = uv.x;
    if (mode.includes('e')) next.x1 = uv.x;

    next = applyAspectToRect(next, mode, s);
    onCropRectChange(safeRect(next));
  };

  useEffect(() => {
    if (!visible || !uvAspect) return;
    const fitted = fitRectToAspect(cropRect, uvAspect);
    const changed =
      Math.abs(fitted.x0 - cropRect.x0) > 1e-4 ||
      Math.abs(fitted.y0 - cropRect.y0) > 1e-4 ||
      Math.abs(fitted.x1 - cropRect.x1) > 1e-4 ||
      Math.abs(fitted.y1 - cropRect.y1) > 1e-4;
    if (changed) onCropRectChange(fitted);
  }, [visible, uvAspect, cropRect, onCropRectChange, fitRectToAspect]);

  useEffect(() => {
    if (!visible) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active) return;
      const uv = clientToUv(e.clientX, e.clientY);
      if (!uv) return;
      updateByDrag(d.mode, uv, d.startRect, d.startUv);
    };
    const onUp = () => {
      if (dragRef.current) dragRef.current.active = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [visible, clientToUv, uvAspect, cropRect]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onApply();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onApply, onCancel]);

  if (!visible) return null;

  const startDrag = (mode: Handle, e: React.PointerEvent) => {
    const uv = clientToUv(e.clientX, e.clientY);
    if (!uv) return;
    dragRef.current = { active: true, mode, startUv: uv, startRect: cropRect };
    if (mode === 'new') onCropRectChange({ x0: uv.x, y0: uv.y, x1: uv.x, y1: uv.y });
  };

  return (
    <>
      <div className="absolute inset-0 z-30 pointer-events-auto" onPointerDown={(e) => startDrag('new', e)}>
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute bg-black/35" style={{ left: 0, top: 0, width: `${box.left}%`, height: '100%' }} />
        <div className="absolute bg-black/35" style={{ left: `${box.left + box.width}%`, top: 0, width: `${Math.max(0, 100 - box.left - box.width)}%`, height: '100%' }} />
        <div className="absolute bg-black/35" style={{ left: `${box.left}%`, top: 0, width: `${box.width}%`, height: `${box.top}%` }} />
        <div className="absolute bg-black/35" style={{ left: `${box.left}%`, top: `${box.top + box.height}%`, width: `${box.width}%`, height: `${Math.max(0, 100 - box.top - box.height)}%` }} />

        <div
          className="absolute border border-white/90 bg-transparent"
          style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
          onPointerDown={(e) => { e.stopPropagation(); startDrag('move', e); }}
        >
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/40" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/40" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/40" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/40" />

          {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as Handle[]).map((h) => {
            const pos: Record<string, string> = {
              nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
              n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
              ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
              e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
              se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
              s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
              sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
              w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
            };
            return (
              <div
                key={h}
                className={`absolute w-3 h-3 rounded-full border border-white bg-[#111]/80 ${pos[h]}`}
                onPointerDown={(e) => { e.stopPropagation(); startDrag(h, e); }}
              />
            );
          })}
        </div>

        {cropEnabled && (
          <div className="absolute left-3 bottom-3 text-[11px] text-zinc-200 bg-black/55 px-2 py-1 rounded border border-white/20">
            已应用裁切
          </div>
        )}
        {minSizeHint && (
          <div className="absolute left-3 bottom-10 text-[11px] text-amber-100 bg-amber-900/60 px-2 py-1 rounded border border-amber-400/40">
            已触发最小裁剪尺寸限制
          </div>
        )}
      </div>
    </>
  );
};
