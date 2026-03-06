import React, { useEffect, useRef, useState } from 'react';
import { ImageState, defaultImageState, RawMetadata } from './types';
import { RawDecoder } from './engine/RawDecoder';
import { ImagePipeline } from './engine/ImagePipeline';
import { ControlPanel } from './components/ControlPanel';
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Download, Undo2, Redo2, Languages, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
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
  // UI State for display only (throttled/batched by React)
  const [uiZoom, setUiZoom] = useState(1);

  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const t = translations[lang];

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

  // Handle Window Resize
  useEffect(() => {
      const handleResize = () => {
          if (containerRef.current && pipeline) {
              pipeline.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
          }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, [pipeline]);

  // Handle Wheel Event (Non-passive for prevention)
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          if (!hasImage || !pipeline) return;

          const zoomSensitivity = 0.001;
          const currentZoom = transform.current.zoom;
          const newZoom = Math.min(Math.max(0.1, currentZoom - e.deltaY * zoomSensitivity), 10);

          transform.current.zoom = newZoom;
          pipeline.updateTransform(newZoom, transform.current.pan);

          // Update UI state (React will batch this, but visual update is instant via pipeline)
          setUiZoom(newZoom);
      };

      canvas.addEventListener('wheel', onWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', onWheel);
  }, [hasImage, pipeline]);

  // Sync State with Pipeline
  useEffect(() => {
    if (pipeline) {
      pipeline.updateState(imageState);
      // Debounce histogram update slightly to avoid too many reads
      const timer = setTimeout(() => {
          setHistogram(pipeline.getHistogramData());
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [imageState, pipeline]);

  // Handle Pan (Pointer Events)
  const handlePointerDown = (e: React.PointerEvent) => {
      if (!hasImage) return;
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (canvasRef.current) {
          canvasRef.current.setPointerCapture(e.pointerId);
          canvasRef.current.style.cursor = 'grabbing';
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDragging.current || !hasImage || !pipeline) return;

      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;

      lastMousePos.current = { x: e.clientX, y: e.clientY };

      if (containerRef.current) {
          const { width, height } = containerRef.current.getBoundingClientRect();
          const currentZoom = transform.current.zoom;

          const newPan = {
              x: transform.current.pan.x + (dx / width * 2.0) / currentZoom,
              y: transform.current.pan.y - (dy / height * 2.0) / currentZoom // WebGL Y is up, Screen Y is down
          };

          transform.current.pan = newPan;
          pipeline.updateTransform(currentZoom, newPan);
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      isDragging.current = false;
      if (canvasRef.current) {
          canvasRef.current.releasePointerCapture(e.pointerId);
          canvasRef.current.style.cursor = 'grab';
      }
  };




  const resetView = () => {
      transform.current = { zoom: 1, pan: { x: 0, y: 0 } };
      setUiZoom(1);
      if (pipeline) {
          pipeline.updateTransform(1, { x: 0, y: 0 });
      }
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

      setImageState(initialState);
      pipeline.updateState(initialState);
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
                 <Button size="icon" variant="ghost" onClick={resetView} disabled={!hasImage} title="Reset View">
                    <RotateCcw className="w-4 h-4" />
                </Button>
                <div className="w-px h-4 bg-border mx-2" />
                 <Button size="icon" variant="ghost" onClick={() => setLang(l => l === 'en' ? 'zh' : 'en')} title="Switch Language">
                    <Languages className="w-4 h-4" />
                </Button>
                 <Button size="icon" variant="ghost" disabled title={t.undo}>
                    <Undo2 className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled title={t.redo}>
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

          {hasImage && (
              <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur text-white text-xs px-2 py-1 rounded border border-white/10 pointer-events-none select-none">
                  {Math.round(uiZoom * 100)}%
              </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <ControlPanel state={imageState} onChange={setImageState} lang={lang} histogram={histogram} metadata={metadata} />
    </div>
  );
};

export default RawEditor;
