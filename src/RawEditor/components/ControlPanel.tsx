import React from 'react';
import { ImageState } from '../types';
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface ControlPanelProps {
  state: ImageState;
  onChange: (newState: ImageState) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ state, onChange }) => {
  const handleChange = (key: keyof ImageState, value: number) => {
    onChange({ ...state, [key]: value });
  };

  return (
    <div className="w-80 bg-background border-l h-full flex flex-col">
      <div className="p-4 border-b font-semibold">Adjustments</div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          
          {/* Light Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Light</h3>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>Exposure</Label>
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
                  <Label>Contrast</Label>
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
                  <Label>Highlights</Label>
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
                  <Label>Shadows</Label>
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
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Color</h3>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>Temp</Label>
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
                  <Label>Tint</Label>
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
                  <Label>Vibrance</Label>
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
                  <Label>Saturation</Label>
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