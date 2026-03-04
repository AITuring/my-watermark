import React from 'react';
import { ImageState, RawMetadata } from '../types';
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { translations, Language } from '../locales';
import { Camera, Aperture, Timer, Gauge, Maximize } from "lucide-react";

interface ControlPanelProps {
  state: ImageState;
  onChange: (newState: ImageState) => void;
  lang: Language;
  histogram?: { r: number[]; g: number[]; b: number[] };
  metadata?: RawMetadata;
}

const Histogram: React.FC<{ data: { r: number[]; g: number[]; b: number[] } }> = ({ data }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, w, h);

        if (!data || !data.r || data.r.length === 0) return;

        // Draw modes: Additive blending for RGB
        ctx.globalCompositeOperation = 'screen';

        const drawChannel = (channel: number[], color: string) => {
            if (!channel) return;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, h);

            // Find max value in this channel to normalize relative to itself or global max?
            // Usually histograms are normalized to the peak count.
            // But we already receive normalized data (0..1) from pipeline?
            // Let's assume input is 0..1.
            // To make it more visible (log scale), we boost low values.

            for (let i = 0; i < 256; i++) {
                const x = (i / 255) * w;
                // Logarithmic scaling for better visibility
                // val is 0..1.
                // log1p(val * 100) / log1p(100) -> maps 0->0, 1->1, but boosts small values
                const rawVal = channel[i] || 0;
                const val = Math.log1p(rawVal * 50) / Math.log1p(50);

                const y = h - (val * h * 0.95);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fill();
        };

        drawChannel(data.r, '#ef4444');
        drawChannel(data.g, '#22c55e');
        drawChannel(data.b, '#3b82f6');

        ctx.globalCompositeOperation = 'source-over';
    }, [data]);

    return <canvas ref={canvasRef} width={300} height={100} className="w-full h-32 rounded bg-zinc-950 border border-zinc-800" />;
};

export const ControlPanel: React.FC<ControlPanelProps> = ({ state, onChange, lang, histogram, metadata }) => {
  const t = translations[lang];

  const handleChange = (key: keyof ImageState, value: number) => {
    onChange({ ...state, [key]: value });
  };

  const formatSize = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-80 bg-background border-l h-full flex flex-col">
      <div className="p-4 border-b font-semibold">{t.adjustments}</div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Metadata */}
          {metadata && (
              <div className="mb-6 space-y-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800 shadow-sm">
                   <div className="flex items-center justify-between text-xs font-medium text-zinc-300 border-b border-zinc-800/50 pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Maximize className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{metadata.width} x {metadata.height}</span>
                      </div>
                      <span className="opacity-70 font-mono">{formatSize(metadata.size)}</span>
                  </div>

                  {metadata.exif.model && (
                      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                          <Camera className="w-4 h-4 text-primary" />
                          <span className="truncate" title={metadata.exif.model}>{metadata.exif.model}</span>
                      </div>
                  )}

                  {metadata.exif.lens && (
                    <div className="text-xs text-zinc-400 pl-6 truncate" title={metadata.exif.lens}>
                        {metadata.exif.lens}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-3 mt-1">
                      {metadata.exif.fNumber && (
                          <div className="flex flex-col items-center gap-1 bg-zinc-900/50 p-2 rounded border border-zinc-800/50">
                              <Aperture className="w-3.5 h-3.5 text-zinc-500" />
                              <span className="text-xs font-mono font-medium text-zinc-300">{metadata.exif.fNumber}</span>
                          </div>
                      )}
                       {metadata.exif.exposureTime && (
                          <div className="flex flex-col items-center gap-1 bg-zinc-900/50 p-2 rounded border border-zinc-800/50">
                              <Timer className="w-3.5 h-3.5 text-zinc-500" />
                              <span className="text-xs font-mono font-medium text-zinc-300">{metadata.exif.exposureTime}s</span>
                          </div>
                      )}
                       {metadata.exif.iso && (
                          <div className="flex flex-col items-center gap-1 bg-zinc-900/50 p-2 rounded border border-zinc-800/50">
                              <Gauge className="w-3.5 h-3.5 text-zinc-500" />
                              <span className="text-xs font-mono font-medium text-zinc-300">ISO {metadata.exif.iso}</span>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* Histogram */}
          {histogram && (
              <div className="mb-4">
                  <Histogram data={histogram} />
              </div>
          )}

          {/* Light Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">{t.light}</h3>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>{t.exposure}</Label>
                  <span className="text-muted-foreground">{state.exposure.toFixed(2)}</span>
                </div>
                <Slider
                  value={[state.exposure]}
                  min={-4}
                  max={4}
                  step={0.05}
                  onValueChange={([v]) => handleChange('exposure', v)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>{t.contrast}</Label>
                  <span className="text-muted-foreground">{state.contrast.toFixed(2)}</span>
                </div>
                <Slider
                  value={[state.contrast]}
                  min={-1}
                  max={1}
                  step={0.01}
                  onValueChange={([v]) => handleChange('contrast', v)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>{t.highlights}</Label>
                  <span className="text-muted-foreground">{state.highlights.toFixed(2)}</span>
                </div>
                <Slider
                  value={[state.highlights]}
                  min={-1}
                  max={1}
                  step={0.01}
                  onValueChange={([v]) => handleChange('highlights', v)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>{t.shadows}</Label>
                  <span className="text-muted-foreground">{state.shadows.toFixed(2)}</span>
                </div>
                <Slider
                  value={[state.shadows]}
                  min={-1}
                  max={1}
                  step={0.01}
                  onValueChange={([v]) => handleChange('shadows', v)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Color Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">{t.color}</h3>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>{t.temperature}</Label>
                  <span className="text-muted-foreground">{state.temperature.toFixed(0)} K</span>
                </div>
                <Slider
                  className="[&_.range]:bg-gradient-to-r [&_.range]:from-blue-500 [&_.range]:via-white [&_.range]:to-yellow-500"
                  value={[state.temperature]}
                  min={2000}
                  max={10000}
                  step={50}
                  onValueChange={([v]) => handleChange('temperature', v)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>{t.tint}</Label>
                  <span className="text-muted-foreground">{state.tint.toFixed(0)}</span>
                </div>
                <Slider
                  className="[&_.range]:bg-gradient-to-r [&_.range]:from-green-500 [&_.range]:via-white [&_.range]:to-pink-500"
                  value={[state.tint]}
                  min={-100}
                  max={100}
                  step={1}
                  onValueChange={([v]) => handleChange('tint', v)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>{t.vibrance}</Label>
                  <span className="text-muted-foreground">{state.vibrance.toFixed(2)}</span>
                </div>
                <Slider
                  value={[state.vibrance]}
                  min={-1}
                  max={1}
                  step={0.01}
                  onValueChange={([v]) => handleChange('vibrance', v)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>{t.saturation}</Label>
                  <span className="text-muted-foreground">{state.saturation.toFixed(2)}</span>
                </div>
                <Slider
                  value={[state.saturation]}
                  min={-1}
                  max={1}
                  step={0.01}
                  onValueChange={([v]) => handleChange('saturation', v)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>{t.sharpness}</Label>
                  <span className="text-muted-foreground">{state.sharpness.toFixed(2)}</span>
                </div>
                <Slider
                  value={[state.sharpness]}
                  min={0}
                  max={2}
                  step={0.05}
                  onValueChange={([v]) => handleChange('sharpness', v)}
                />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
