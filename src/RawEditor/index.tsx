import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageState, defaultImageState, RawMetadata } from './types';
import { RawDecoder } from './engine/RawDecoder';
import { ImagePipeline } from './engine/ImagePipeline';
import { ControlPanel } from './components/ControlPanel';
import { CropWorkspace, CropRect } from './components/CropWorkspace';
import { useHistoryManager } from './components/HistoryManager';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Download, Undo2, Redo2, Languages, ZoomIn, ZoomOut, RotateCcw, Keyboard, Hand, Crop, SlidersHorizontal, Wand2, Pipette, FlipHorizontal2, FlipVertical2, RotateCw } from "lucide-react";
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
  const [activeTool, setActiveTool] = useState<'adjust' | 'hand' | 'crop' | 'mask' | 'picker'>('adjust');
  const [rightPanelPage, setRightPanelPage] = useState<'adjust' | 'crop' | 'mask' | 'picker'>('adjust');
  const [cropPreset, setCropPreset] = useState('free');
  const [cropRect, setCropRect] = useState<CropRect>({ x0: 0, y0: 0, x1: 1, y1: 1 });
  const [cropEnabled, setCropEnabled] = useState(false);
  const [cropStraighten, setCropStraighten] = useState(0);
  const [cropQuarterTurns, setCropQuarterTurns] = useState(0);
  const [cropFlipX, setCropFlipX] = useState(false);
  const [cropFlipY, setCropFlipY] = useState(false);
  const [uprightMode, setUprightMode] = useState<'off' | 'auto' | 'horizontal' | 'vertical' | 'full'>('off');
  const [cropGeomVertical, setCropGeomVertical] = useState(0);
  const [cropGeomHorizontal, setCropGeomHorizontal] = useState(0);
  const [cropGeomRotate, setCropGeomRotate] = useState(0);
  const [cropGeomAspect, setCropGeomAspect] = useState(0);
  const [cropGeomScale, setCropGeomScale] = useState(100);
  const [cropGeomOffsetX, setCropGeomOffsetX] = useState(0);
  const [cropGeomOffsetY, setCropGeomOffsetY] = useState(0);

  const isDragging = useRef(false);
  const isMinimapDragging = useRef(false);
  const isSplitDragging = useRef(false);
  const spacePressedRef = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastDragTs = useRef(0);
  const panVelocity = useRef({ x: 0, y: 0 });
  const inertiaRaf = useRef<number | null>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  type EditorSnapshot = {
    image: ImageState;
    cropRect: CropRect;
    cropEnabled: boolean;
    cropStraighten: number;
    cropQuarterTurns: number;
    cropFlipX: boolean;
    cropFlipY: boolean;
    uprightMode: 'off' | 'auto' | 'horizontal' | 'vertical' | 'full';
    cropGeomVertical: number;
    cropGeomHorizontal: number;
    cropGeomRotate: number;
    cropGeomAspect: number;
    cropGeomScale: number;
    cropGeomOffsetX: number;
    cropGeomOffsetY: number;
  };

  const initialSnapshot: EditorSnapshot = {
    image: { ...defaultImageState, curve: defaultImageState.curve.map(p => ({ ...p })) },
    cropRect: { x0: 0, y0: 0, x1: 1, y1: 1 },
    cropEnabled: false,
    cropStraighten: 0,
    cropQuarterTurns: 0,
    cropFlipX: false,
    cropFlipY: false,
    uprightMode: 'off',
    cropGeomVertical: 0,
    cropGeomHorizontal: 0,
    cropGeomRotate: 0,
    cropGeomAspect: 0,
    cropGeomScale: 100,
    cropGeomOffsetX: 0,
    cropGeomOffsetY: 0,
  };

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

  const clientToUv = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
    const { sx, sy } = getContainScale();
    const z = transform.current.zoom;
    const px = (ndcX - transform.current.pan.x) / (sx * z);
    const py = (ndcY - transform.current.pan.y) / (sy * z);
    return {
      x: Math.min(Math.max((px + 1) / 2, 0), 1),
      y: Math.min(Math.max((py + 1) / 2, 0), 1),
    };
  }, [getContainScale]);

  const uvToPercent = useCallback((uvX: number, uvY: number) => {
    const { sx, sy } = getContainScale();
    const z = transform.current.zoom;
    const px = uvX * 2 - 1;
    const py = uvY * 2 - 1;
    const ndcX = px * sx * z + transform.current.pan.x;
    const ndcY = py * sy * z + transform.current.pan.y;
    return {
      left: ((ndcX + 1) * 0.5) * 100,
      top: ((1 - ndcY) * 0.5) * 100,
    };
  }, [getContainScale]);

  const commitCrop = useCallback((enabled: boolean, rect = cropRect) => {
    if (!pipeline) return;
    pipeline.setCropRect(enabled, rect);
    setCropEnabled(enabled);
  }, [pipeline, cropRect]);

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

  const cloneSnapshot = (snap: EditorSnapshot): EditorSnapshot => ({
    image: cloneState(snap.image),
    cropRect: { ...snap.cropRect },
    cropEnabled: snap.cropEnabled,
    cropStraighten: snap.cropStraighten,
    cropQuarterTurns: snap.cropQuarterTurns,
    cropFlipX: snap.cropFlipX,
    cropFlipY: snap.cropFlipY,
    uprightMode: snap.uprightMode,
    cropGeomVertical: snap.cropGeomVertical,
    cropGeomHorizontal: snap.cropGeomHorizontal,
    cropGeomRotate: snap.cropGeomRotate,
    cropGeomAspect: snap.cropGeomAspect,
    cropGeomScale: snap.cropGeomScale,
    cropGeomOffsetX: snap.cropGeomOffsetX,
    cropGeomOffsetY: snap.cropGeomOffsetY,
  });

  const makeSnapshot = (image: ImageState, overrides?: Partial<EditorSnapshot>): EditorSnapshot => ({
    image: cloneState(overrides?.image ?? image),
    cropRect: { ...(overrides?.cropRect ?? cropRect) },
    cropEnabled: overrides?.cropEnabled ?? cropEnabled,
    cropStraighten: overrides?.cropStraighten ?? cropStraighten,
    cropQuarterTurns: overrides?.cropQuarterTurns ?? cropQuarterTurns,
    cropFlipX: overrides?.cropFlipX ?? cropFlipX,
    cropFlipY: overrides?.cropFlipY ?? cropFlipY,
    uprightMode: overrides?.uprightMode ?? uprightMode,
    cropGeomVertical: overrides?.cropGeomVertical ?? cropGeomVertical,
    cropGeomHorizontal: overrides?.cropGeomHorizontal ?? cropGeomHorizontal,
    cropGeomRotate: overrides?.cropGeomRotate ?? cropGeomRotate,
    cropGeomAspect: overrides?.cropGeomAspect ?? cropGeomAspect,
    cropGeomScale: overrides?.cropGeomScale ?? cropGeomScale,
    cropGeomOffsetX: overrides?.cropGeomOffsetX ?? cropGeomOffsetX,
    cropGeomOffsetY: overrides?.cropGeomOffsetY ?? cropGeomOffsetY,
  });

  const isSameState = (a: ImageState, b: ImageState): boolean => {
    if (
      a.exposure !== b.exposure || a.contrast !== b.contrast || a.highlights !== b.highlights || a.shadows !== b.shadows ||
      a.whites !== b.whites || a.blacks !== b.blacks || a.temperature !== b.temperature || a.tint !== b.tint ||
      a.saturation !== b.saturation || a.vibrance !== b.vibrance || a.clarity !== b.clarity || a.dehaze !== b.dehaze ||
      a.sharpness !== b.sharpness || a.curve.length !== b.curve.length
    ) return false;
    for (let i = 0; i < a.curve.length; i++) {
      if (a.curve[i].x !== b.curve[i].x || a.curve[i].y !== b.curve[i].y) return false;
    }
    return true;
  };

  const isSameSnapshot = (a: EditorSnapshot, b: EditorSnapshot): boolean => (
    isSameState(a.image, b.image) &&
    a.cropRect.x0 === b.cropRect.x0 && a.cropRect.y0 === b.cropRect.y0 && a.cropRect.x1 === b.cropRect.x1 && a.cropRect.y1 === b.cropRect.y1 &&
    a.cropEnabled === b.cropEnabled && a.cropStraighten === b.cropStraighten && a.cropQuarterTurns === b.cropQuarterTurns &&
    a.cropFlipX === b.cropFlipX && a.cropFlipY === b.cropFlipY && a.uprightMode === b.uprightMode &&
    a.cropGeomVertical === b.cropGeomVertical && a.cropGeomHorizontal === b.cropGeomHorizontal &&
    a.cropGeomRotate === b.cropGeomRotate && a.cropGeomAspect === b.cropGeomAspect && a.cropGeomScale === b.cropGeomScale &&
    a.cropGeomOffsetX === b.cropGeomOffsetX && a.cropGeomOffsetY === b.cropGeomOffsetY
  );

  const {
    push: pushHistory,
    undo: undoHistory,
    redo: redoHistory,
    reset: resetHistory,
    canUndo,
    canRedo,
  } = useHistoryManager<EditorSnapshot>({
    storageKey: 'raw-editor-history-stack-v1',
    mergeWindowMs: 1200,
    initial: initialSnapshot,
    clone: cloneSnapshot,
    equals: isSameSnapshot,
  });

  const applySnapshot = (snap: EditorSnapshot) => {
    setImageState(cloneState(snap.image));
    setCropRect({ ...snap.cropRect });
    setCropEnabled(snap.cropEnabled);
    setCropStraighten(snap.cropStraighten);
    setCropQuarterTurns(snap.cropQuarterTurns);
    setCropFlipX(snap.cropFlipX);
    setCropFlipY(snap.cropFlipY);
    setUprightMode(snap.uprightMode);
    setCropGeomVertical(snap.cropGeomVertical);
    setCropGeomHorizontal(snap.cropGeomHorizontal);
    setCropGeomRotate(snap.cropGeomRotate);
    setCropGeomAspect(snap.cropGeomAspect);
    setCropGeomScale(snap.cropGeomScale);
    setCropGeomOffsetX(snap.cropGeomOffsetX);
    setCropGeomOffsetY(snap.cropGeomOffsetY);
  };

  const applyState = (nextState: ImageState, trackHistory = true) => {
    setImageState(nextState);
    if (trackHistory) pushHistory(makeSnapshot(nextState));
  };

  const handleUndo = () => {
    if (!hasImage) return;
    const prev = undoHistory();
    if (prev) applySnapshot(prev);
  };

  const handleRedo = () => {
    if (!hasImage) return;
    const next = redoHistory();
    if (next) applySnapshot(next);
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
    if (!pipeline || !hasImage) return;
    commitCrop(cropEnabled, cropRect);
    const angle = cropQuarterTurns * 90 + cropStraighten;
    pipeline.setCropTransform(angle, cropFlipX, cropFlipY);
    pipeline.setCropGeometry({
      vertical: cropGeomVertical * 0.0012,
      horizontal: cropGeomHorizontal * 0.0012,
      rotate: cropGeomRotate,
      aspect: 1 + cropGeomAspect * 0.01,
      scale: Math.max(cropGeomScale, 1) * 0.01,
      offsetX: cropGeomOffsetX * 0.0025,
      offsetY: cropGeomOffsetY * 0.0025,
    });
  }, [pipeline, hasImage, cropEnabled, cropRect, commitCrop, cropQuarterTurns, cropStraighten, cropFlipX, cropFlipY, cropGeomVertical, cropGeomHorizontal, cropGeomRotate, cropGeomAspect, cropGeomScale, cropGeomOffsetX, cropGeomOffsetY]);

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          if (!hasImage || !pipeline || activeTool === 'crop') return;
          const modeScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 160 : 1;
          const normalizedDelta = e.deltaY * modeScale;
          const fineTune = e.shiftKey ? 0.38 : 1;
          const factor = Math.exp(-normalizedDelta * WHEEL_SENSITIVITY * fineTune);
          applyZoomAtPoint(e.clientX, e.clientY, transform.current.zoom * factor);
      };

      canvas.addEventListener('wheel', onWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', onWheel);
  }, [hasImage, pipeline, applyZoomAtPoint, activeTool]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && hasImage) {
        e.preventDefault();
        setIsSpacePreviewing(true);
        spacePressedRef.current = true;
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
        spacePressedRef.current = false;
      }
    };

    const onWindowBlur = () => {
      setIsSpacePreviewing(false);
      spacePressedRef.current = false;
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
      const canPan = activeTool === 'hand' || spacePressedRef.current;
      if (!canPan) return;

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
          canvasRef.current.style.cursor = activeTool === 'hand' ? 'grab' : 'default';
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
      const visibleRatio = (viewW * viewH) / Math.max(imageW * imageH, 1e-6);
      const zoomedRatio = 1 - Math.min(Math.max(visibleRatio, 0), 1);
      return { width, height, imageW, imageH, offsetX, offsetY, viewportX, viewportY, viewW, viewH, zoomedRatio };
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

  const switchTool = (tool: 'adjust' | 'hand' | 'crop' | 'mask' | 'picker') => {
    setActiveTool(tool);
    if (tool === 'crop' || tool === 'mask' || tool === 'picker') {
      setRightPanelPage(tool);
    } else {
      setRightPanelPage('adjust');
    }
  };

  const cropPixelRatio = useMemo(() => {
    const w = Math.abs(cropRect.x1 - cropRect.x0) * imageAspect;
    const h = Math.abs(cropRect.y1 - cropRect.y0);
    if (h <= 1e-6) return 0;
    return w / h;
  }, [cropRect, imageAspect]);

  const cropPresetRatio = useMemo(() => {
    if (cropPreset === 'free') return null;
    if (cropPreset === 'origin') return imageAspect;
    const [w, h] = cropPreset.split(':').map(Number);
    if (!w || !h) return imageAspect;
    return w / h;
  }, [cropPreset, imageAspect]);

  const applyCropPreset = (preset: string) => {
    setCropPreset(preset);
    if (preset === 'free') return;
    const target = preset === 'origin'
      ? imageAspect
      : (() => {
          const [w, h] = preset.split(':').map(Number);
          return w > 0 && h > 0 ? w / h : imageAspect;
        })();
    const uvRatio = target / Math.max(imageAspect, 1e-6);
    const x0 = Math.min(cropRect.x0, cropRect.x1);
    const y0 = Math.min(cropRect.y0, cropRect.y1);
    const x1 = Math.max(cropRect.x0, cropRect.x1);
    const y1 = Math.max(cropRect.y0, cropRect.y1);
    const cx = (x0 + x1) * 0.5;
    const cy = (y0 + y1) * 0.5;
    let w = Math.max(0.02, x1 - x0);
    let h = Math.max(0.02, y1 - y0);
    if (w / h > uvRatio) w = h * uvRatio;
    else h = w / uvRatio;
    const nx0 = Math.max(0, cx - w * 0.5);
    const ny0 = Math.max(0, cy - h * 0.5);
    const nx1 = Math.min(1, nx0 + w);
    const ny1 = Math.min(1, ny0 + h);
    setCropRect({ x0: nx0, y0: ny0, x1: nx1, y1: ny1 });
  };

  const applyCropSelection = () => {
    const w = Math.abs(cropRect.x1 - cropRect.x0);
    const h = Math.abs(cropRect.y1 - cropRect.y0);
    if (w < 0.01 || h < 0.01) {
      toast.error('裁剪区域过小');
      return;
    }
    setCropEnabled(true);
    pushHistory(makeSnapshot(imageState, { cropEnabled: true }), false);
    setActiveTool('adjust');
    setRightPanelPage('adjust');
  };

  const handleCropStraightenChange = (v: number) => {
    setCropStraighten(v);
    pushHistory(makeSnapshot(imageState, { cropStraighten: v }), true);
  };

  const handleCropRotateCW = () => {
    const next = (cropQuarterTurns + 1) % 4;
    setCropQuarterTurns(next);
    pushHistory(makeSnapshot(imageState, { cropQuarterTurns: next }), false);
  };

  const handleCropRotateCCW = () => {
    const next = (cropQuarterTurns + 3) % 4;
    setCropQuarterTurns(next);
    pushHistory(makeSnapshot(imageState, { cropQuarterTurns: next }), false);
  };

  const handleCropFlipH = () => {
    const next = !cropFlipX;
    setCropFlipX(next);
    pushHistory(makeSnapshot(imageState, { cropFlipX: next }), false);
  };

  const handleCropFlipV = () => {
    const next = !cropFlipY;
    setCropFlipY(next);
    pushHistory(makeSnapshot(imageState, { cropFlipY: next }), false);
  };

  const setCropGeomValue = (patch: Partial<EditorSnapshot>, allowMerge = true) => {
    if (patch.cropGeomVertical !== undefined) setCropGeomVertical(patch.cropGeomVertical);
    if (patch.cropGeomHorizontal !== undefined) setCropGeomHorizontal(patch.cropGeomHorizontal);
    if (patch.cropGeomRotate !== undefined) setCropGeomRotate(patch.cropGeomRotate);
    if (patch.cropGeomAspect !== undefined) setCropGeomAspect(patch.cropGeomAspect);
    if (patch.cropGeomScale !== undefined) setCropGeomScale(patch.cropGeomScale);
    if (patch.cropGeomOffsetX !== undefined) setCropGeomOffsetX(patch.cropGeomOffsetX);
    if (patch.cropGeomOffsetY !== undefined) setCropGeomOffsetY(patch.cropGeomOffsetY);
    if (patch.uprightMode !== undefined) setUprightMode(patch.uprightMode);
    pushHistory(makeSnapshot(imageState, patch), allowMerge);
  };


  const clampNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const setCropGeomFromInput = (
    key: 'cropGeomVertical' | 'cropGeomHorizontal' | 'cropGeomRotate' | 'cropGeomAspect' | 'cropGeomScale' | 'cropGeomOffsetX' | 'cropGeomOffsetY',
    raw: string,
    min: number,
    max: number,
  ) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    setCropGeomValue({ [key]: clampNum(parsed, min, max), uprightMode: 'off' } as Partial<EditorSnapshot>);
  };

  const renderUprightIcon = (mode: 'off' | 'auto' | 'horizontal' | 'vertical' | 'full') => {
    const common = { className: 'w-4 h-4', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    if (mode === 'off') return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M8 8l8 8" /></svg>;
    if (mode === 'auto') return <svg {...common}><path d="M4 18l4-12h1l4 12" /><path d="M6.5 12h4" /><path d="M15 17h5" /><path d="M17.5 7v10" /></svg>;
    if (mode === 'horizontal') return <svg {...common}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>;
    if (mode === 'vertical') return <svg {...common}><path d="M7 4v16" /><path d="M12 4v16" /><path d="M17 4v16" /></svg>;
    return <svg {...common}><path d="M4 12h16" /><path d="M12 4v16" /><path d="M7 7h10v10H7z" /></svg>;
  };

  const applyUpright = (mode: 'off' | 'auto' | 'horizontal' | 'vertical' | 'full') => {
    const ratioDelta = Math.max(-1, Math.min(1, (cropPixelRatio - imageAspect) / Math.max(imageAspect, 1e-6)));
    if (mode === 'off') {
      setCropGeomValue({ uprightMode: 'off', cropGeomVertical: 0, cropGeomHorizontal: 0, cropGeomRotate: 0, cropGeomAspect: 0, cropGeomScale: 100, cropGeomOffsetX: 0, cropGeomOffsetY: 0 });
      return;
    }
    if (mode === 'horizontal') {
      setCropGeomValue({ uprightMode: 'horizontal', cropGeomVertical: 0, cropGeomHorizontal: 0, cropGeomRotate: -cropStraighten * 0.8, cropGeomAspect: 0, cropGeomScale: 104, cropGeomOffsetX: 0, cropGeomOffsetY: 0 });
      return;
    }
    if (mode === 'vertical') {
      setCropGeomValue({ uprightMode: 'vertical', cropGeomVertical: ratioDelta * 22, cropGeomHorizontal: 0, cropGeomRotate: -cropStraighten * 0.4, cropGeomAspect: ratioDelta * 8, cropGeomScale: 106, cropGeomOffsetX: 0, cropGeomOffsetY: 0 });
      return;
    }
    if (mode === 'full') {
      setCropGeomValue({ uprightMode: 'full', cropGeomVertical: ratioDelta * 28, cropGeomHorizontal: -ratioDelta * 10, cropGeomRotate: -cropStraighten * 0.9, cropGeomAspect: ratioDelta * 18, cropGeomScale: 110, cropGeomOffsetX: 0, cropGeomOffsetY: 0 });
      return;
    }
    setCropGeomValue({ uprightMode: 'auto', cropGeomVertical: ratioDelta * 16, cropGeomHorizontal: -ratioDelta * 6, cropGeomRotate: -cropStraighten * 0.55, cropGeomAspect: ratioDelta * 10, cropGeomScale: 105, cropGeomOffsetX: 0, cropGeomOffsetY: 0 });
  };

  const resetCrop = () => {
    const nextCropRect = { x0: 0, y0: 0, x1: 1, y1: 1 };
    setCropRect(nextCropRect);
    setCropEnabled(false);
    setCropPreset('free');
    setCropStraighten(0);
    setCropQuarterTurns(0);
    setCropFlipX(false);
    setCropFlipY(false);
    setUprightMode('off');
    setCropGeomVertical(0);
    setCropGeomHorizontal(0);
    setCropGeomRotate(0);
    setCropGeomAspect(0);
    setCropGeomScale(100);
    setCropGeomOffsetX(0);
    setCropGeomOffsetY(0);
    pushHistory(makeSnapshot(imageState, {
      cropRect: nextCropRect,
      cropEnabled: false,
      cropStraighten: 0,
      cropQuarterTurns: 0,
      cropFlipX: false,
      cropFlipY: false,
      uprightMode: 'off',
      cropGeomVertical: 0,
      cropGeomHorizontal: 0,
      cropGeomRotate: 0,
      cropGeomAspect: 0,
      cropGeomScale: 100,
      cropGeomOffsetX: 0,
      cropGeomOffsetY: 0,
    }));
  };

  const cancelCropEdit = () => {
    setActiveTool('adjust');
    setRightPanelPage('adjust');
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
      setCropRect({ x0: 0, y0: 0, x1: 1, y1: 1 });
      setCropEnabled(false);
      setCropStraighten(0);
      setCropQuarterTurns(0);
      setCropFlipX(false);
      setCropFlipY(false);
      setUprightMode('off');
      setCropGeomVertical(0);
      setCropGeomHorizontal(0);
      setCropGeomRotate(0);
      setCropGeomAspect(0);
      setCropGeomScale(100);
      setCropGeomOffsetX(0);
      setCropGeomOffsetY(0);
      setHasImage(true);
      setRightPanelPage('adjust');
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
      resetHistory(makeSnapshot(initialState, {
        cropRect: { x0: 0, y0: 0, x1: 1, y1: 1 },
        cropEnabled: false,
        cropStraighten: 0,
        cropQuarterTurns: 0,
        cropFlipX: false,
        cropFlipY: false,
        uprightMode: 'off',
        cropGeomVertical: 0,
        cropGeomHorizontal: 0,
        cropGeomRotate: 0,
        cropGeomAspect: 0,
        cropGeomScale: 100,
        cropGeomOffsetX: 0,
        cropGeomOffsetY: 0,
      }));
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

  const handleExport = async () => {
    if (!pipeline) return;
    try {
        let url = '';
        if (cropEnabled) {
          pipeline.setCropRect(false, cropRect);
          url = pipeline.exportFullRes();
          pipeline.setCropRect(true, cropRect);
        } else {
          url = pipeline.exportFullRes();
        }

        let finalUrl = url;
        if (cropEnabled && metadata) {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('crop image load failed'));
            el.src = url;
          });
          const x0 = Math.min(cropRect.x0, cropRect.x1);
          const y0 = Math.min(cropRect.y0, cropRect.y1);
          const x1 = Math.max(cropRect.x0, cropRect.x1);
          const y1 = Math.max(cropRect.y0, cropRect.y1);
          const sx = Math.round(x0 * metadata.width);
          const sy = Math.round(y0 * metadata.height);
          const sw = Math.max(1, Math.round((x1 - x0) * metadata.width));
          const sh = Math.max(1, Math.round((y1 - y0) * metadata.height));
          const c = document.createElement('canvas');
          c.width = sw;
          c.height = sh;
          const ctx = c.getContext('2d');
          if (!ctx) throw new Error('canvas context missing');
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          finalUrl = c.toDataURL('image/png', 1);
        }

        const link = document.createElement('a');
        link.download = `edited-image-${Date.now()}.png`;
        link.href = finalUrl;
        link.click();
        toast.success(t.exportSuccess);
    } catch (e) {
        toast.error(t.exportFail);
    }
  };

  return (
    <div className="flex h-screen bg-[#2b2b2b] text-zinc-200 overflow-hidden font-sans">
      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full">

        <div className="h-10 border-b border-zinc-700 bg-[#3a3a3a] flex items-center px-3 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-medium text-zinc-200 truncate max-w-[280px]">{metadata?.name || t.rawStudio}</span>
            {metadata?.exif?.model && <span className="text-[11px] text-zinc-400 truncate max-w-[180px]">{String(metadata.exif.model)}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <TooltipProvider delayDuration={0}>
              <Tooltip open={hotkeyTipOpen} onOpenChange={setHotkeyTipOpen}>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setHotkeyTipOpen((v) => !v)} title="快捷键"><Keyboard className="w-4 h-4" /></Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="max-w-xs text-xs leading-relaxed whitespace-pre-line">{'空格：按住预览原图\nB：切换 Before/After 分屏\nH：切换热区叠加\n双击分屏手柄：回中\n⌘/Ctrl+Z：撤销\n⇧⌘/Ctrl+Z：重做'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setLang(l => l === 'en' ? 'zh' : 'en')} title="Switch Language"><Languages className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleUndo} disabled={!hasImage || !canUndo} title={`${t.undo} (⌘/Ctrl+Z)`}><Undo2 className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleRedo} disabled={!hasImage || !canRedo} title={`${t.redo} (⇧⌘/Ctrl+Z)`}><Redo2 className="w-4 h-4" /></Button>
            <Button size="sm" variant={compareMode === 'split' ? 'default' : 'outline'} className="h-8 px-2.5" onClick={() => setCompareMode((m) => (m === 'split' ? 'off' : 'split'))} disabled={!hasImage}>对比</Button>
            <Button size="sm" variant={showHeatOverlay ? 'default' : 'outline'} className="h-8 px-2.5" onClick={() => setShowHeatOverlay((v) => !v)} disabled={!hasImage}>热区</Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
              <label className="cursor-pointer flex items-center justify-center">
                <Upload className="w-4 h-4" />
                <input type="file" className="hidden" accept="image/*,.dng,.cr2,.cr3,.nef,.nrw,.arw,.sr2,.srf,.raf,.orf,.rw2,.pef,.iiq,.3fr,.srw" onChange={handleFileChange} />
              </label>
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={handleExport} disabled={!hasImage}><Download className="w-4 h-4 mr-1.5" />{t.export}</Button>
          </div>
        </div>

        {/* Canvas Area */}
        <div ref={containerRef} className="flex-1 relative bg-[#1f1f1f] overflow-hidden flex items-center justify-center">
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
            className={`max-w-full max-h-full shadow-2xl transition-opacity duration-500 ${hasImage ? 'opacity-100' : 'opacity-0'} ${activeTool === 'hand' ? 'cursor-grab' : activeTool === 'crop' ? 'cursor-crosshair' : 'cursor-default'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          <CropWorkspace
            visible={hasImage && activeTool === 'crop'}
            imageAspect={imageAspect}
            lockedAspectRatio={cropPresetRatio}
            cropRect={cropRect}
            cropEnabled={cropEnabled}
            straighten={cropStraighten}
            onStraightenChange={handleCropStraightenChange}
            onRotateCW={handleCropRotateCW}
            onRotateCCW={handleCropRotateCCW}
            onFlipH={handleCropFlipH}
            onFlipV={handleCropFlipV}
            onCropRectChange={setCropRect}
            onApply={applyCropSelection}
            onReset={resetCrop}
            onCancel={cancelCropEdit}
            clientToUv={clientToUv}
            uvToPercent={uvToPercent}
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

          {hasImage && minimap && minimap.zoomedRatio >= 0.3 && (
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
              <div className="absolute bottom-0 inset-x-0 h-9 bg-[#343434] border-t border-zinc-700 flex items-center justify-between px-3 text-xs text-zinc-300">
                <div className="flex items-center gap-1.5">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => zoomAtCenter(1 / 1.2)} title="Zoom Out"><ZoomOut className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => zoomAtCenter(1.2)} title="Zoom In"><ZoomIn className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={resetView}>适应</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => commitTransform(2, transform.current.pan)}>1:1</Button>
                </div>
                <div className="text-[11px] text-zinc-400 tracking-wide">缩放 {Math.round(uiZoom * 100)}% · 平移 X {uiPan.x.toFixed(2)} / Y {uiPan.y.toFixed(2)} · 裁切比 {cropPixelRatio.toFixed(2)}:1</div>
              </div>
          )}
        </div>
      </div>

      <div className="w-[372px] bg-[#3b3b3b] border-l border-zinc-700 h-full flex text-zinc-200">
        <div className="flex-1 min-w-0 border-r border-zinc-700">
          {rightPanelPage === 'adjust' && (
            <ControlPanel state={imageState} onChange={applyState} lang={lang} histogram={histogram} metadata={metadata} />
          )}
          {rightPanelPage === 'crop' && (
            <div className="h-full overflow-auto px-3 py-3 space-y-4">
              <div className="h-11 px-4 border-b border-zinc-700 font-medium text-sm flex items-center">裁剪</div>
              <div className="space-y-2 border-b border-zinc-700 pb-3">
                <div className="text-xs text-zinc-300">预设</div>
                <Select value={cropPreset} onValueChange={applyCropPreset}>
                  <SelectTrigger className="h-9 border-zinc-600 bg-[#2f2f2f]"><SelectValue placeholder="预设" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">自由</SelectItem>
                    <SelectItem value="origin">原始比例</SelectItem>
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="4:3">4:3</SelectItem>
                    <SelectItem value="3:2">3:2</SelectItem>
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="16:10">16:10</SelectItem>
                    <SelectItem value="10:16">10:16</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-zinc-400">当前比例 {cropPixelRatio.toFixed(2)}:1</div>
              </div>
              <div className="space-y-2 border-b border-zinc-700 pb-3">
                <div className="flex items-center justify-between text-xs"><span>角度</span><span className="px-2 py-0.5 rounded bg-[#2a2a2a] border border-zinc-600">{cropStraighten.toFixed(2)}</span></div>
                <Slider value={[cropStraighten]} min={-15} max={15} step={0.1} onValueChange={([v]) => handleCropStraightenChange(v)} />
              </div>
              <div className="space-y-2 border-b border-zinc-700 pb-3">
                <div className="text-lg font-semibold">旋转和翻转</div>
                <div className="grid grid-cols-4 gap-2">
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleCropRotateCCW}><RotateCcw className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleCropRotateCW}><RotateCw className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleCropFlipH}><FlipHorizontal2 className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleCropFlipV}><FlipVertical2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="space-y-3 border-b border-zinc-700 pb-4">
                <div className="text-lg font-semibold">Upright</div>
                <div className="grid grid-cols-5 gap-1.5 rounded-md bg-[#2f2f2f] p-1 border border-zinc-700">
                  <button className={`h-8 rounded flex items-center justify-center ${uprightMode === 'off' ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-300 hover:bg-zinc-700/60'}`} onClick={() => applyUpright('off')} title="禁用">{renderUprightIcon('off')}</button>
                  <button className={`h-8 rounded flex items-center justify-center ${uprightMode === 'auto' ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-300 hover:bg-zinc-700/60'}`} onClick={() => applyUpright('auto')} title="自动">{renderUprightIcon('auto')}</button>
                  <button className={`h-8 rounded flex items-center justify-center ${uprightMode === 'horizontal' ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-300 hover:bg-zinc-700/60'}`} onClick={() => applyUpright('horizontal')} title="水平">{renderUprightIcon('horizontal')}</button>
                  <button className={`h-8 rounded flex items-center justify-center ${uprightMode === 'vertical' ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-300 hover:bg-zinc-700/60'}`} onClick={() => applyUpright('vertical')} title="垂直">{renderUprightIcon('vertical')}</button>
                  <button className={`h-8 rounded flex items-center justify-center ${uprightMode === 'full' ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-300 hover:bg-zinc-700/60'}`} onClick={() => applyUpright('full')} title="完整">{renderUprightIcon('full')}</button>
                </div>
              </div>
              <div className="space-y-3 border-b border-zinc-700 pb-4">
                <div className="text-lg font-semibold">手动转换</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs"><span>垂直</span><input className="w-20 h-8 px-2 rounded bg-[#2a2a2a] border border-zinc-600 text-right" value={cropGeomVertical.toFixed(0)} onChange={(e) => setCropGeomFromInput('cropGeomVertical', e.target.value, -100, 100)} /></div>
                  <Slider value={[cropGeomVertical]} min={-100} max={100} step={1} onValueChange={([v]) => setCropGeomValue({ cropGeomVertical: v, uprightMode: 'off' })} />
                  <div className="flex items-center justify-between text-xs"><span>水平</span><input className="w-20 h-8 px-2 rounded bg-[#2a2a2a] border border-zinc-600 text-right" value={cropGeomHorizontal.toFixed(0)} onChange={(e) => setCropGeomFromInput('cropGeomHorizontal', e.target.value, -100, 100)} /></div>
                  <Slider value={[cropGeomHorizontal]} min={-100} max={100} step={1} onValueChange={([v]) => setCropGeomValue({ cropGeomHorizontal: v, uprightMode: 'off' })} />
                  <div className="flex items-center justify-between text-xs"><span>旋转</span><input className="w-20 h-8 px-2 rounded bg-[#2a2a2a] border border-zinc-600 text-right" value={cropGeomRotate.toFixed(1)} onChange={(e) => setCropGeomFromInput('cropGeomRotate', e.target.value, -45, 45)} /></div>
                  <Slider value={[cropGeomRotate]} min={-45} max={45} step={0.1} onValueChange={([v]) => setCropGeomValue({ cropGeomRotate: v, uprightMode: 'off' })} />
                  <div className="flex items-center justify-between text-xs"><span>长宽比</span><input className="w-20 h-8 px-2 rounded bg-[#2a2a2a] border border-zinc-600 text-right" value={cropGeomAspect.toFixed(0)} onChange={(e) => setCropGeomFromInput('cropGeomAspect', e.target.value, -100, 100)} /></div>
                  <Slider value={[cropGeomAspect]} min={-100} max={100} step={1} onValueChange={([v]) => setCropGeomValue({ cropGeomAspect: v, uprightMode: 'off' })} />
                  <div className="flex items-center justify-between text-xs"><span>缩放</span><input className="w-20 h-8 px-2 rounded bg-[#2a2a2a] border border-zinc-600 text-right" value={cropGeomScale.toFixed(0)} onChange={(e) => setCropGeomFromInput('cropGeomScale', e.target.value, 50, 150)} /></div>
                  <Slider value={[cropGeomScale]} min={50} max={150} step={1} onValueChange={([v]) => setCropGeomValue({ cropGeomScale: v, uprightMode: 'off' })} />
                  <div className="flex items-center justify-between text-xs"><span>横向补正</span><input className="w-20 h-8 px-2 rounded bg-[#2a2a2a] border border-zinc-600 text-right" value={cropGeomOffsetX.toFixed(0)} onChange={(e) => setCropGeomFromInput('cropGeomOffsetX', e.target.value, -100, 100)} /></div>
                  <Slider value={[cropGeomOffsetX]} min={-100} max={100} step={1} onValueChange={([v]) => setCropGeomValue({ cropGeomOffsetX: v, uprightMode: 'off' })} />
                  <div className="flex items-center justify-between text-xs"><span>纵向补正</span><input className="w-20 h-8 px-2 rounded bg-[#2a2a2a] border border-zinc-600 text-right" value={cropGeomOffsetY.toFixed(0)} onChange={(e) => setCropGeomFromInput('cropGeomOffsetY', e.target.value, -100, 100)} /></div>
                  <Slider value={[cropGeomOffsetY]} min={-100} max={100} step={1} onValueChange={([v]) => setCropGeomValue({ cropGeomOffsetY: v, uprightMode: 'off' })} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={resetCrop}>重置</Button>
                <Button size="sm" variant="ghost" onClick={cancelCropEdit}>取消</Button>
                <Button size="sm" variant="default" className="ml-auto" onClick={applyCropSelection}>完成</Button>
              </div>
            </div>
          )}
          {(rightPanelPage === 'mask' || rightPanelPage === 'picker') && (
            <div className="h-full flex items-center justify-center text-sm text-zinc-400">该页面正在完善中</div>
          )}
        </div>
        <div className="w-12 flex flex-col items-center gap-2 py-3 bg-[#3f3f3f]">
          <Button size="icon" variant={activeTool === 'crop' ? 'default' : 'ghost'} className="h-9 w-9" onClick={() => switchTool('crop')}><Crop className="w-4 h-4" /></Button>
          <Button size="icon" variant={activeTool === 'adjust' ? 'default' : 'ghost'} className="h-9 w-9" onClick={() => switchTool('adjust')}><SlidersHorizontal className="w-4 h-4" /></Button>
          <Button size="icon" variant={activeTool === 'hand' ? 'default' : 'ghost'} className="h-9 w-9" onClick={() => switchTool('hand')}><Hand className="w-4 h-4" /></Button>
          <Button size="icon" variant={activeTool === 'mask' ? 'default' : 'ghost'} className="h-9 w-9" onClick={() => switchTool('mask')}><Wand2 className="w-4 h-4" /></Button>
          <Button size="icon" variant={activeTool === 'picker' ? 'default' : 'ghost'} className="h-9 w-9" onClick={() => switchTool('picker')}><Pipette className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
};

export default RawEditor;
