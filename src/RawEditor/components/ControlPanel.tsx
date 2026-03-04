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
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, w, h);

        if (data.r.length === 0) return;

        // Draw modes: Additive blending for RGB
        ctx.globalCompositeOperation = 'screen';

        const drawChannel = (channel: number[], color: string) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let i = 0; i < 256; i++) {
                const x = (i / 255) * w;
                const val = channel[i]; // normalized 0-1
                const y = h - (val * h * 0.9); // 0.9 scale to avoid clipping
                ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.fill();
        };

        drawChannel(data.r, 'rgba(255, 0, 0, 0.5)');
        drawChannel(data.g, 'rgba(0, 255, 0, 0.5)');
        drawChannel(data.b, 'rgba(0, 0, 255, 0.5)');

        // Draw White (Luminance approximation or just intersection) - simplified as intersection via blend mode
        // For 'screen' blend mode, overlap becomes white-ish.

        ctx.globalCompositeOperation = 'source-over';
    }, [data]);

    return <canvas ref={canvasRef} width={320} height={120} className="w-full h-32 rounded bg-zinc-900 border border-zinc-800" />;
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
              <div className="mb-6 space-y-3 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 text-xs text-muted-foreground">
                   <div className="flex items-center gap-2">
                      <Maximize className="w-3 h-3" />
                      <span>{metadata.width} x {metadata.height}</span>
                      <span className="ml-auto opacity-70">{formatSize(metadata.size)}</span>
                  </div>
                  {metadata.exif.model && (
                      <div className="flex items-center gap-2">
                          <Camera className="w-3 h-3" />
                          <span className="truncate" title={metadata.exif.model}>{metadata.exif.model}</span>
                      </div>
                  )}
                   {metadata.exif.lens && (
                      <div className="flex items-center gap-2 pl-5">
                          <span className="truncate opacity-80" title={metadata.exif.lens}>{metadata.exif.lens}</span>
                      </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-800/50">
                      {metadata.exif.fNumber && (
                          <div className="flex flex-col items-center gap-1">
                              <Aperture className="w-3 h-3" />
                              <span>f/{metadata.exif.fNumber}</span>
                          </div>
                      )}
                       {metadata.exif.exposureTime && (
                          <div className="flex flex-col items-center gap-1">
                              <Timer className="w-3 h-3" />
                              <span>{metadata.exif.exposureTime}s</span>
                          </div>
                      )}
                       {metadata.exif.iso && (
                          <div className="flex flex-col items-center gap-1">
                              <Gauge className="w-3 h-3" />
                              <span>ISO {metadata.exif.iso}</span>
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
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
