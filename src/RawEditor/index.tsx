import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageState, defaultImageState, RawMetadata } from './types';
import { RawDecoder } from './engine/RawDecoder';
import { ImagePipeline } from './engine/ImagePipeline';
import { ControlPanel } from './components/ControlPanel';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Upload, Download, Undo2, Redo2, Languages, ZoomIn, ZoomOut, RotateCcw, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { translations, Language } from './locales';

const RawEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pipeline, setPipeline] = useState<ImagePipeline | null>(null);
  const [imageState, setImageState] = useState<ImageState>(defaultImageState);
  const [isLoading, setIsLoading] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [lang, setLang] = useState<Language>('zh');
  const [histogram, setHistogram] = useState<{ r: number[]; g: number[]; b: number[] } | undefined>(undefined);
  const [metadata, setMetadata] = useState<RawMetadata | undefined>(undefined);

  // Viewport Transform State
  // Use refs for hot path (render loop) to avoid React re-render lag
  const transform = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const [uiZoom, setUiZoom] = useState(1);
  const [uiPan, setUiPan] = useState({ x: 0, y: 0 });
  const [imageAspect, setImageAspect] = useState(1);
  const [minimapSrc, setMinimapSrc] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<'off' | 'split'>('off');
  const [splitX, setSplitX] = useState(0.5);
  const [showHeatOverlay, setShowHeatOverlay] = useState(false);
  const [isSpacePreviewing, setIsSpacePreviewing] = useState(false);
  const [hotkeyTipOpen, setHotkeyTipOpen] = useState(false);

  const isDragging = useRef(false);
  const isMinimapDragging = useRef(false);
  const isSplitDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastDragTs = useRef(0);
  const panVelocity = useRef({ x: 0, y: 0 });
  const inertiaRaf = useRef<number | null>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ImageState[]>([{ ...defaultImageState, curve: defaultImageState.curve.map(p => ({ ...p })) }]);
  const redoRef = useRef<ImageState[]>([]);
  const lastCommitTimeRef = useRef(0);

  const t = translations[lang];
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 12;
  const WHEEL_SENSITIVITY = 0.001;
  const SPLIT_X_STORAGE_KEY = 'raw-editor-split-x';

  const stopInertia = useCallback(() => {
    if (inertiaRaf.current !== null) {
      cancelAnimationFrame(inertiaRaf.current);
      inertiaRaf.current = null;
    }
  }, []);

  const createMinimapDataUrl = useCallback((rawData: Float32Array, srcW: number, srcH: number) => {
    const maxEdge = 256;
    const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imageData = ctx.createImageData(w, h);
    const out = imageData.data;
    for (let y = 0; y < h; y++) {
      const sy = Math.min(srcH - 1, Math.floor((y / h) * srcH));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(srcW - 1, Math.floor((x / w) * srcW));
        const si = (sy * srcW + sx) * 4;
        const di = (y * w + x) * 4;
        const r = Math.pow(Math.max(0, Math.min(1, rawData[si])), 1 / 2.2);
        const g = Math.pow(Math.max(0, Math.min(1, rawData[si + 1])), 1 / 2.2);
        const b = Math.pow(Math.max(0, Math.min(1, rawData[si + 2])), 1 / 2.2);
        out[di] = Math.round(r * 255);
        out[di + 1] = Math.round(g * 255);
        out[di + 2] = Math.round(b * 255);
        out[di + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.82);
  }, []);

  const getContainScale = useCallback(() => {
    if (!containerRef.current || !imageAspect) return { sx: 1, sy: 1 };
    const rect = containerRef.current.getBoundingClientRect();
    const containerAspect = rect.width / Math.max(rect.height, 1);
    if (containerAspect > imageAspect) {
      return { sx: imageAspect / containerAspect, sy: 1 };
    }
    return { sx: 1, sy: containerAspect / imageAspect };
  }, [imageAspect]);

  const clampPan = useCallback((pan: { x: number; y: number }, zoom: number) => {
    const { sx, sy } = getContainScale();
    const limitX = Math.max(0, sx * zoom - 1);
    const limitY = Math.max(0, sy * zoom - 1);
    return {
      x: Math.min(Math.max(pan.x, -limitX), limitX),
      y: Math.min(Math.max(pan.y, -limitY), limitY),
    };
  }, [getContainScale]);

  const commitTransform = useCallback((zoom: number, pan: { x: number; y: number }) => {
    if (!pipeline) return;
    const clampedZoom = Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
    const clampedPan = clampPan(pan, clampedZoom);
    transform.current = { zoom: clampedZoom, pan: clampedPan };
    pipeline.updateTransform(clampedZoom, clampedPan);
    setUiZoom(clampedZoom);
    setUiPan(clampedPan);
  }, [pipeline, clampPan]);

  const startInertia = useCallback(() => {
    stopInertia();
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - prev) / 1000));
      prev = now;
      const decay = Math.pow(0.08, dt);
      panVelocity.current.x *= decay;
      panVelocity.current.y *= decay;
      const speed = Math.hypot(panVelocity.current.x, panVelocity.current.y);
      if (speed < 0.02) {
        stopInertia();
        return;
      }
      const nextPan = {
        x: transform.current.pan.x + panVelocity.current.x * dt,
        y: transform.current.pan.y + panVelocity.current.y * dt,
      };
      commitTransform(transform.current.zoom, nextPan);
      inertiaRaf.current = requestAnimationFrame(tick);
    };
    inertiaRaf.current = requestAnimationFrame(tick);
  }, [commitTransform, stopInertia]);

  const applyZoomAtPoint = useCallback((clientX: number, clientY: number, targetZoom: number) => {
    if (!hasImage || !containerRef.current || !pipeline) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
    const { sx, sy } = getContainScale();
    const z0 = transform.current.zoom;
    const z1 = Math.min(Math.max(targetZoom, MIN_ZOOM), MAX_ZOOM);
    const pan0 = transform.current.pan;
    const worldX = (ndcX - pan0.x) / (sx * z0);
    const worldY = (ndcY - pan0.y) / (sy * z0);
    const nextPan = {
      x: ndcX - worldX * sx * z1,
      y: ndcY - worldY * sy * z1,
    };
    commitTransform(z1, nextPan);
  }, [hasImage, pipeline, getContainScale, commitTransform]);

  const getRawBaselineByModel = (model?: string): Partial<ImageState> => {
    const m = (model || '').toLowerCase();

    if (m.includes('ilce-7rm5') || m.includes('a7r v') || m.includes('a7rv')) {
      return {
        contrast: 0.08,
        highlights: -0.04,
        shadows: 0.04,
        whites: 0.03,
        blacks: -0.04,
        vibrance: 0.03,
        saturation: 0,
        sharpness: 0.18,
      };
    }

    return {
      contrast: 0.06,
      highlights: -0.03,
      shadows: 0.03,
      whites: 0.02,
      blacks: -0.03,
      vibrance: 0.02,
      saturation: 0,
      sharpness: 0.15,
    };
  };

  const cloneState = (state: ImageState): ImageState => ({
    ...state,
    curve: state.curve.map((p) => ({ ...p })),
  });

  const isSameState = (a: ImageState, b: ImageState): boolean => {
    if (
      a.exposure !== b.exposure ||
      a.contrast !== b.contrast ||
      a.highlights !== b.highlights ||
      a.shadows !== b.shadows ||
      a.whites !== b.whites ||
      a.blacks !== b.blacks ||
      a.temperature !== b.temperature ||
      a.tint !== b.tint ||
      a.saturation !== b.saturation ||
      a.vibrance !== b.vibrance ||
      a.clarity !== b.clarity ||
      a.dehaze !== b.dehaze ||
      a.sharpness !== b.sharpness ||
      a.curve.length !== b.curve.length
    ) return false;

    for (let i = 0; i < a.curve.length; i++) {
      if (a.curve[i].x !== b.curve[i].x || a.curve[i].y !== b.curve[i].y) return false;
    }
    return true;
  };

  const pushHistory = (nextState: ImageState) => {
    const now = performance.now();
    const history = historyRef.current;
    const last = history[history.length - 1];

    if (last && isSameState(last, nextState)) return;

    if (history.length > 1 && now - lastCommitTimeRef.current < 140) {
      history[history.length - 1] = cloneState(nextState);
    } else {
      history.push(cloneState(nextState));
      if (history.length > 200) {
        history.shift();
      }
    }

    redoRef.current = [];
    lastCommitTimeRef.current = now;
  };

  const applyState = (nextState: ImageState, trackHistory = true) => {
    setImageState(nextState);
    if (trackHistory) {
      pushHistory(nextState);
    }
  };

  const handleUndo = () => {
    const history = historyRef.current;
    if (!hasImage || history.length <= 1) return;

    const current = history.pop();
    if (current) {
      redoRef.current.push(cloneState(current));
    }

    const prev = history[history.length - 1];
    if (prev) {
      applyState(cloneState(prev), false);
    }
  };

  const handleRedo = () => {
    if (!hasImage || redoRef.current.length === 0) return;
    const next = redoRef.current.pop();
    if (!next) return;

    historyRef.current.push(cloneState(next));
    applyState(cloneState(next), false);
  };

  // Initialize Pipeline
  useEffect(() => {
    if (canvasRef.current && !pipeline) {
      const newPipeline = new ImagePipeline(canvasRef.current);
      setPipeline(newPipeline);

      // Initial resize
      if (containerRef.current) {
          const { clientWidth, clientHeight } = containerRef.current;
          newPipeline.resize(clientWidth, clientHeight);
      }

      return () => {
        newPipeline.dispose();
      };
    }
  }, [canvasRef, pipeline]);

  useEffect(() => {
      const handleResize = () => {
          if (containerRef.current && pipeline) {
              pipeline.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
              commitTransform(transform.current.zoom, transform.current.pan);
          }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, [pipeline, commitTransform]);

  useEffect(() => {
    return () => stopInertia();
  }, [stopInertia]);

  useEffect(() => {
    const saved = window.localStorage.getItem(SPLIT_X_STORAGE_KEY);
    if (!saved) return;
    const parsed = Number(saved);
    if (!Number.isFinite(parsed)) return;
    setSplitX(Math.min(Math.max(parsed, 0), 1));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SPLIT_X_STORAGE_KEY, String(splitX));
  }, [splitX]);

  useEffect(() => {
    if (!pipeline || !hasImage) return;
    pipeline.setCompareOptions(isSpacePreviewing ? 'before' : compareMode, splitX, showHeatOverlay);
  }, [pipeline, hasImage, compareMode, splitX, showHeatOverlay, isSpacePreviewing]);

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          if (!hasImage || !pipeline) return;
          const modeScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 160 : 1;
          const normalizedDelta = e.deltaY * modeScale;
          const fineTune = e.shiftKey ? 0.38 : 1;
          const factor = Math.exp(-normalizedDelta * WHEEL_SENSITIVITY * fineTune);
          applyZoomAtPoint(e.clientX, e.clientY, transform.current.zoom * factor);
      };

      canvas.addEventListener('wheel', onWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', onWheel);
  }, [hasImage, pipeline, applyZoomAtPoint]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && hasImage) {
        e.preventDefault();
        setIsSpacePreviewing(true);
        return;
      }

      const key = e.key.toLowerCase();
      if (hasImage && !e.metaKey && !e.ctrlKey) {
        if (key === 'b') {
          e.preventDefault();
          setCompareMode((m) => (m === 'split' ? 'off' : 'split'));
          return;
        }
        if (key === 'h') {
          e.preventDefault();
          setShowHeatOverlay((v) => !v);
          return;
        }
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !hasImage) return;

      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePreviewing(false);
      }
    };

    const onWindowBlur = () => {
      setIsSpacePreviewing(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [hasImage, imageState]);

  // Sync State with Pipeline
  useEffect(() => {
    if (!pipeline) return;

    pipeline.updateState(imageState);

    const histogramTimer = window.setTimeout(() => {
      setHistogram(pipeline.getHistogramData());
    }, 50);

    let minimapTimer: number | undefined;
    if (hasImage) {
      minimapTimer = window.setTimeout(() => {
        const preview = pipeline.exportMinimapPreview(320, 200);
        if (preview) {
          setMinimapSrc(preview);
        }
      }, 90);
    }

    return () => {
      window.clearTimeout(histogramTimer);
      if (minimapTimer !== undefined) {
        window.clearTimeout(minimapTimer);
      }
    };
  }, [imageState, pipeline, hasImage]);

  // Handle Pan (Pointer Events)
  const handlePointerDown = (e: React.PointerEvent) => {
      if (!hasImage) return;
      stopInertia();
      panVelocity.current = { x: 0, y: 0 };
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      lastDragTs.current = performance.now();
      if (canvasRef.current) {
          canvasRef.current.setPointerCapture(e.pointerId);
          canvasRef.current.style.cursor = 'grabbing';
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDragging.current || !hasImage || !pipeline || !containerRef.current) return;

      const now = performance.now();
      const dt = Math.max(0.001, (now - lastDragTs.current) / 1000);
      lastDragTs.current = now;

      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      const { width, height } = containerRef.current.getBoundingClientRect();
      const currentZoom = transform.current.zoom;
      const deltaPan = {
          x: (dx / width * 2.0) / currentZoom,
          y: -(dy / height * 2.0) / currentZoom
      };
      panVelocity.current = {
          x: deltaPan.x / dt,
          y: deltaPan.y / dt,
      };

      commitTransform(currentZoom, {
          x: transform.current.pan.x + deltaPan.x,
          y: transform.current.pan.y + deltaPan.y,
      });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (Math.hypot(panVelocity.current.x, panVelocity.current.y) > 0.25) {
          startInertia();
      }
      if (canvasRef.current) {
          canvasRef.current.releasePointerCapture(e.pointerId);
          canvasRef.current.style.cursor = 'grab';
      }
  };




  const zoomAtCenter = (factor: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      applyZoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, transform.current.zoom * factor);
  };

  const minimap = useMemo(() => {
      if (!hasImage || !imageAspect) return null;
      const width = 168;
      const height = 112;
      let imageW = width;
      let imageH = width / imageAspect;
      if (imageH > height) {
          imageH = height;
          imageW = height * imageAspect;
      }
      const offsetX = (width - imageW) / 2;
      const offsetY = (height - imageH) / 2;
      const { sx, sy } = getContainScale();
      const z = uiZoom;
      const centerX = Math.min(Math.max(0.5 - uiPan.x / (2 * sx * z), 0), 1);
      const centerY = Math.min(Math.max(0.5 + uiPan.y / (2 * sy * z), 0), 1);
      const viewW = Math.max(8, imageW / z);
      const viewH = Math.max(8, imageH / z);
      const viewportX = Math.min(offsetX + imageW - viewW, Math.max(offsetX, offsetX + centerX * imageW - viewW / 2));
      const viewportY = Math.min(offsetY + imageH - viewH, Math.max(offsetY, offsetY + centerY * imageH - viewH / 2));
      return { width, height, imageW, imageH, offsetX, offsetY, viewportX, viewportY, viewW, viewH };
  }, [hasImage, imageAspect, uiZoom, uiPan, getContainScale]);

  const updatePanFromMinimap = (clientX: number, clientY: number) => {
      if (!minimap || !minimapRef.current) return;
      const rect = minimapRef.current.getBoundingClientRect();
      const localX = clientX - rect.left - minimap.offsetX;
      const localY = clientY - rect.top - minimap.offsetY;
      const nx = Math.min(Math.max(localX / minimap.imageW, 0), 1);
      const ny = Math.min(Math.max(localY / minimap.imageH, 0), 1);
      const { sx, sy } = getContainScale();
      const z = transform.current.zoom;
      commitTransform(z, {
        x: (0.5 - nx) * 2 * sx * z,
        y: (ny - 0.5) * 2 * sy * z,
      });
  };

  const updateSplitFromClientX = (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = (clientX - rect.left) / Math.max(rect.width, 1);
      setSplitX(Math.min(Math.max(next, 0), 1));
  };

  const resetView = () => {
      commitTransform(1, { x: 0, y: 0 });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pipeline) return;

    const isRawFile = /\.(cr2|cr3|nef|nrw|arw|sr2|srf|dng|raf|orf|rw2|pef|iiq|3fr|srw)$/i.test(file.name);

    setIsLoading(true);
    try {
      const decoder = new RawDecoder();
      const rawImage = await decoder.decode(file);
      pipeline.loadImage(rawImage);
      setImageAspect(rawImage.width / Math.max(rawImage.height, 1));
      setMinimapSrc(createMinimapDataUrl(rawImage.data, rawImage.width, rawImage.height));
      setHasImage(true);
      resetView();

      const model = rawImage.metadata?.exif?.model as string | undefined;
      const useRawBaseline = ((import.meta as any).env?.VITE_RAW_AUTO_BASELINE as string | undefined) === '1';
      const initialState = isRawFile
        ? {
            ...defaultImageState,
            ...(useRawBaseline ? getRawBaselineByModel(model) : {}),
          }
        : defaultImageState;

      applyState(initialState, false);
      pipeline.updateState(initialState);
      historyRef.current = [cloneState(initialState)];
      redoRef.current = [];
      lastCommitTimeRef.current = performance.now();
      setHistogram(pipeline.getHistogramData());
      setMetadata(rawImage.metadata);
      toast.success(`${t.loaded} ${file.name}`);
    } catch (error) {
      console.error("Failed to load image:", error);
      toast.error(t.failedLoad);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!pipeline) return;
    try {
        const url = pipeline.exportFullRes(); // Use full resolution export
        const link = document.createElement('a');
        link.download = `edited-image-${Date.now()}.png`;
        link.href = url;
        link.click();
        toast.success(t.exportSuccess);
    } catch (e) {
        toast.error(t.exportFail);
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full">
        {/* Toolbar */}
        <div className="h-12 border-b bg-muted/30 flex items-center px-4 justify-between">
            <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight">{t.rawStudio}</span>
            </div>

            <div className="flex items-center gap-2">
                 <Button size="icon" variant="ghost" onClick={() => zoomAtCenter(1.2)} disabled={!hasImage} title="Zoom In">
                    <ZoomIn className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => zoomAtCenter(1 / 1.2)} disabled={!hasImage} title="Zoom Out">
                    <ZoomOut className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={resetView} disabled={!hasImage} title="Reset View">
                    <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={compareMode === 'split' ? 'default' : 'ghost'}
                  className={compareMode === 'split' ? 'shadow-sm' : ''}
                  onClick={() => setCompareMode((m) => (m === 'split' ? 'off' : 'split'))}
                  disabled={!hasImage}
                >
                  Before/After
                </Button>
                <Button
                  size="sm"
                  variant={showHeatOverlay ? 'default' : 'ghost'}
                  className={showHeatOverlay ? 'shadow-sm' : ''}
                  onClick={() => setShowHeatOverlay((v) => !v)}
                  disabled={!hasImage}
                >
                  热区
                </Button>
                <TooltipProvider delayDuration={0}>
                  <Tooltip open={hotkeyTipOpen} onOpenChange={setHotkeyTipOpen}>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setHotkeyTipOpen((v) => !v)}
                        title="快捷键"
                      >
                        <Keyboard className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs text-xs leading-relaxed whitespace-pre-line">
                      {'空格：按住预览原图\nB：切换 Before/After 分屏\nH：切换热区叠加\n双击分屏手柄：回中\n⌘/Ctrl+Z：撤销\n⇧⌘/Ctrl+Z：重做'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="w-px h-4 bg-border mx-2" />
                 <Button size="icon" variant="ghost" onClick={() => setLang(l => l === 'en' ? 'zh' : 'en')} title="Switch Language">
                    <Languages className="w-4 h-4" />
                </Button>
                 <Button size="icon" variant="ghost" onClick={handleUndo} disabled={!hasImage || historyRef.current.length <= 1} title={`${t.undo} (⌘/Ctrl+Z)`}>
                    <Undo2 className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={handleRedo} disabled={!hasImage || redoRef.current.length === 0} title={`${t.redo} (⇧⌘/Ctrl+Z)`}>
                    <Redo2 className="w-4 h-4" />
                </Button>
                <div className="w-px h-4 bg-border mx-2" />
                <Button size="sm" variant="outline" onClick={handleExport} disabled={!hasImage}>
                    <Download className="w-4 h-4 mr-2" />
                    {t.export}
                </Button>
            </div>
        </div>

        {/* Canvas Area */}
        <div ref={containerRef} className="flex-1 relative bg-[#1e1e1e] overflow-hidden flex items-center justify-center">
          {!hasImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 z-10">
              <div className="border-2 border-dashed border-zinc-700 rounded-xl p-12 flex flex-col items-center hover:border-zinc-500 transition-colors">
                <Upload className="w-16 h-16 mb-4 opacity-50" />
                <h3 className="text-xl font-medium mb-2">{t.noImage}</h3>
                <p className="mb-6 text-sm opacity-70">{t.supportText}</p>
                <Button asChild variant="secondary">
                  <label className="cursor-pointer">
                    {t.openFile}
                    <input type="file" className="hidden" accept="image/*,.dng,.cr2,.cr3,.nef,.nrw,.arw,.sr2,.srf,.raf,.orf,.rw2,.pef,.iiq,.3fr,.srw" onChange={handleFileChange} />
                  </label>
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="flex flex-col items-center">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
                  <p className="text-white font-medium">{t.processing}</p>
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-full shadow-2xl transition-opacity duration-500 ${hasImage ? 'opacity-100 cursor-grab' : 'opacity-0'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          {hasImage && compareMode === 'split' && !isSpacePreviewing && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-4 left-4 text-[11px] px-2 py-1 rounded bg-black/55 text-white border border-white/20 tracking-wide">Before · 原图</div>
              <div className="absolute top-4 right-4 text-[11px] px-2 py-1 rounded bg-black/55 text-white border border-white/20 tracking-wide">After · 修改后</div>
              <div className="absolute top-0 bottom-0 w-px bg-white/80" style={{ left: `${splitX * 100}%` }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-14 rounded-full border border-white/80 bg-black/50 pointer-events-auto cursor-ew-resize"
                style={{ left: `${splitX * 100}%` }}
                onPointerDown={(e) => {
                  isSplitDragging.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  updateSplitFromClientX(e.clientX);
                }}
                onPointerMove={(e) => {
                  if (!isSplitDragging.current) return;
                  updateSplitFromClientX(e.clientX);
                }}
                onPointerUp={(e) => {
                  isSplitDragging.current = false;
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }}
                onPointerCancel={() => {
                  isSplitDragging.current = false;
                }}
                onDoubleClick={() => {
                  setSplitX(0.5);
                }}
              />
            </div>
          )}

          {hasImage && minimap && (
              <div
                ref={minimapRef}
                className="absolute bottom-4 left-4 bg-black/55 backdrop-blur rounded-md border border-white/20 shadow-lg p-1.5 select-none touch-none"
                onPointerDown={(e) => {
                  stopInertia();
                  isMinimapDragging.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  updatePanFromMinimap(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (!isMinimapDragging.current) return;
                  updatePanFromMinimap(e.clientX, e.clientY);
                }}
                onPointerUp={(e) => {
                  isMinimapDragging.current = false;
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }}
                onPointerCancel={() => {
                  isMinimapDragging.current = false;
                }}
              >
                <div className="relative" style={{ width: minimap.width, height: minimap.height }}>
                  <div className="absolute rounded-sm bg-zinc-900 overflow-hidden" style={{ left: minimap.offsetX, top: minimap.offsetY, width: minimap.imageW, height: minimap.imageH }}>
                    {minimapSrc && <img src={minimapSrc} alt="minimap" className="w-full h-full object-cover pointer-events-none" draggable={false} />}
                  </div>
                  <div
                    className="absolute border border-white/90 rounded-sm bg-white/10"
                    style={{ left: minimap.viewportX, top: minimap.viewportY, width: minimap.viewW, height: minimap.viewH }}
                  />
                </div>
              </div>
          )}

          {hasImage && (
              <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur text-white text-xs px-2 py-1 rounded border border-white/10 pointer-events-none select-none">
                  {Math.round(uiZoom * 100)}%
              </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <ControlPanel state={imageState} onChange={applyState} lang={lang} histogram={histogram} metadata={metadata} />
    </div>
  );
};

export default RawEditor;
