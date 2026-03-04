import React, { useEffect, useRef, useState } from 'react';
import { ImageState, defaultImageState, RawMetadata } from './types';
import { RawDecoder } from './engine/RawDecoder';
import { ImagePipeline } from './engine/ImagePipeline';
import { ControlPanel } from './components/ControlPanel';
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Download, Undo2, Redo2, Languages } from "lucide-react";
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

  const t = translations[lang];

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pipeline) return;

    setIsLoading(true);
    try {
      const decoder = new RawDecoder();
      const rawImage = await decoder.decode(file);
      pipeline.loadImage(rawImage);
      setHasImage(true);
      setImageState(defaultImageState);
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
                    <input type="file" className="hidden" accept="image/*,.dng,.cr2,.nef,.arw" onChange={handleFileChange} />
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
            className={`max-w-full max-h-full shadow-2xl transition-opacity duration-500 ${hasImage ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>
      </div>

      {/* Right Sidebar */}
      <ControlPanel state={imageState} onChange={setImageState} lang={lang} histogram={histogram} metadata={metadata} />
    </div>
  );
};

export default RawEditor;
