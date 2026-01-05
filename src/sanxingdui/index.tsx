import React, { useState, useEffect, useCallback } from 'react';
import { ArtifactCanvas } from './ArtifactCanvas';
import { GestureController } from './GestureController';
import { Upload, Info, Camera, Box, Sparkles, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Import local assets
// @ts-ignore
import maskGoldUrl from '@/assets/obj/戴金面罩青铜人头像.obj?url';
// @ts-ignore
import figureUrl from '@/assets/obj/青铜大力人像.obj?url';
// @ts-ignore
import sunWheelUrl from '@/assets/obj/青铜太阳轮.obj?url';
// @ts-ignore
import maskEyesUrl from '@/assets/obj/青铜纵目面具.obj?url';

interface ModelFile {
  name: string;
  url: string;
  originalName: string;
}

const descriptions: Record<string, string> = {
  '戴金面罩青铜人头像': "This bronze head, overlaid with a gold mask, symbolizes the supreme status of the figure, likely a shaman-king. The gold mask, extremely thin and fragile, represents a connection to the divine sun, distinguishing this figure from ordinary nobility.",
  '青铜大力人像': "The Great Standing Figure, towering and majestic, stands on a pedestal. His oversized hands likely once held a ritual object, perhaps an elephant tusk or a jade cong. His elaborate robe, decorated with dragon and cloud patterns, signifies his role as a high priest.",
  '青铜太阳轮': "The Bronze Sun Wheel, with its five spokes, is a direct representation of the sun worship that was central to the Ancient Shu religion. It resembles a chariot wheel but was strictly a ritual object, symbolizing the passage of time and the cycle of life.",
  '青铜纵目面具': "The gigantic Bronze Mask with Protruding Eyes (Cancong) is the most iconic artifact. The exaggerated cylindrical eyes and large ears suggest a deity or ancestor with supernatural sensory powers—clairvoyance and clairaudience—capable of seeing and hearing across worlds."
};


const generateDescription = async (model: ModelFile): Promise<string> => {
  // Simulating API latency
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (descriptions[model.originalName]) {
    return descriptions[model.originalName];
  }

  // Fallback for uploaded files
  const prompts = [
    `In the mists of the Ancient Shu kingdom, this artifact emerges from the sacrificial pits of Sanxingdui. Its bronze eyes gaze across three millennia, witnessing the rise and fall of civilizations.`,
    `Behold this masterpiece of bronze casting from the Shu people. Note the exaggerated features, a hallmark of Sanxingdui artistry, suggesting a reverence for sensory perception—seeing the unseen, hearing the unheard.`,
    `From the depths of the earth, this artifact returns to the light. Its form, forged in fire and faith, speaks of a sophisticated hierarchy and a spiritual world teeming with mythical beasts and sun birds.`
  ];
  return prompts[Math.floor(Math.random() * prompts.length)];
};

const Sanxingdui: React.FC = () => {
  const [models, setModels] = useState<ModelFile[]>([
    { name: 'Bronze Head with Gold Mask', url: maskGoldUrl, originalName: '戴金面罩青铜人头像' },
    { name: 'Bronze Standing Figure', url: figureUrl, originalName: '青铜大力人像' },
    { name: 'Bronze Sun Wheel', url: sunWheelUrl, originalName: '青铜太阳轮' },
    { name: 'Bronze Mask with Protruding Eyes', url: maskEyesUrl, originalName: '青铜纵目面具' },
  ]);

  const [currentModelIndex, setCurrentModelIndex] = useState<number>(1); // Start in Nebula Mode (-1)
  const [description, setDescription] = useState<string>('System silent. Nebula standby mode active.');
  const [loadingDesc, setLoadingDesc] = useState(false);

  // Gesture State
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false); // Hidden by default

  const [isDragging, setIsDragging] = useState(false);
  const [lastPointer, setLastPointer] = useState<{ x: number; y: number } | null>(null);

  const currentTheme: 'gold' | 'verdigris' =
    currentModelIndex >= 0 && models[currentModelIndex].originalName === '青铜太阳轮'
      ? 'gold'
      : 'verdigris';

  // Double click to toggle Nebula/Model
  useEffect(() => {
      const handleDoubleClick = () => {
          if (models.length > 0) {
             // If in nebula mode, go to first model. If in model mode, go to next?
             // temp.html: doubleclick -> reconstructModel((active + 1) % len) OR if empty -> nebula.
             // actually temp.html says: if models > 0 reconstruct next.
             // But let's implement: Nebula <-> Model switch or Next Model.
             if (currentModelIndex === -1) handleSelectModel(0);
             else handleNextModel();
          }
      };
      window.addEventListener('dblclick', handleDoubleClick);
      return () => window.removeEventListener('dblclick', handleDoubleClick);
  }, [models, currentModelIndex]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newModels: ModelFile[] = [];
      Array.from(files).forEach(file => {
        if (file.name.toLowerCase().endsWith('.obj')) {
          newModels.push({
            name: file.name.replace('.obj', ''),
            url: URL.createObjectURL(file),
            originalName: file.name.replace('.obj', '')
          });
        }
      });

      setModels(prev => [...prev, ...newModels]);
      setShowSidebar(true);
    }
  };

  const handleSelectModel = useCallback(async (index: number) => {
    if (index < -1 || index >= models.length) return;

    setCurrentModelIndex(index);

    if (index === -1) {
        setDescription('System silent. Nebula standby mode active.');
        return;
    }

    const model = models[index];
    setLoadingDesc(true);
    try {
      const desc = await generateDescription(model);
      setDescription(desc);
    } catch (e) {
      setDescription('Failed to consult the oracle.');
    } finally {
      setLoadingDesc(false);
    }
  }, [models]);

  const handleNextModel = useCallback(() => {
    if (models.length === 0) return;
    const nextIndex = (currentModelIndex + 1) % models.length;
    handleSelectModel(nextIndex);
  }, [currentModelIndex, models, handleSelectModel]);

  return (
    <div className="w-full h-screen bg-[#020617] overflow-hidden text-white font-sans selection:bg-cyan-500/30 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.18),transparent_55%)]">
      {/* 3D Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <ArtifactCanvas
          modelUrl={currentModelIndex >= 0 ? models[currentModelIndex].url : null}
          rotation={rotation}
          scale={scale}
          theme={currentTheme}
        />
      </div>

      {/* Mouse Interaction Layer (drag to rotate, wheel to zoom) */}
      <div
        className="absolute inset-0 z-5"
        onMouseDown={(e) => {
          if (currentModelIndex < 0) return;
          setIsDragging(true);
          setLastPointer({ x: e.clientX, y: e.clientY });
        }}
        onMouseMove={(e) => {
          if (!isDragging || currentModelIndex < 0 || !lastPointer) return;
          const dx = e.clientX - lastPointer.x;
          const dy = e.clientY - lastPointer.y;
          setLastPointer({ x: e.clientX, y: e.clientY });
          setRotation((prev) => ({
            x: prev.x + dy * 0.005,
            y: prev.y + dx * 0.005,
          }));
        }}
        onMouseUp={() => {
          setIsDragging(false);
          setLastPointer(null);
        }}
        onMouseLeave={() => {
          setIsDragging(false);
          setLastPointer(null);
        }}
        onWheel={(e) => {
          if (currentModelIndex < 0) return;
          e.preventDefault();
          setScale((prev) => {
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const next = prev + delta;
            return Math.max(0.05, Math.min(4, next));
          });
        }}
      />

      {/* Scanlines / Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none z-10 opacity-25 bg-[linear-gradient(rgba(15,23,42,0)_50%,rgba(34,211,238,0.06)_50%)] bg-[length:100%_4px]"></div>
      <div className="fixed inset-0 pointer-events-none z-5 opacity-20 bg-[linear-gradient(to_right,rgba(15,23,42,0.7)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.7)_1px,transparent_1px)] bg-[size:80px_80px]"></div>
      <div className="fixed inset-0 pointer-events-none z-5 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0)_0,rgba(0,0,0,0.9)_80%)]"></div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full p-12 flex justify-between items-start z-20 pointer-events-none">
        <div>
            <div className="w-12 h-0.5 bg-gradient-to-r from-yellow-500 via-cyan-400 to-transparent mb-4"></div>
            <h1 className="text-3xl font-extralight tracking-[0.5em] mb-2 uppercase drop-shadow-[0_0_25px_rgba(34,211,238,0.75)] text-white/90">Sanxingdui</h1>
            <h2 className="text-lg font-light tracking-[0.2em] text-white/50">沉睡三千年，一醒惊天下。</h2>
        </div>
        <button
            onClick={() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }}
            className="pointer-events-auto p-3 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur border border-white/10 transition-all"
        >
            <Sparkles className="w-5 h-5 text-white/60" />
        </button>
      </header>

      {/* Footer Info */}
      <footer className="absolute bottom-0 left-0 w-full p-12 flex justify-between items-end z-20 pointer-events-none">
         <div className="space-y-4 pointer-events-auto">
             <button
               onClick={() => setGestureEnabled((prev) => !prev)}
               className="px-4 py-2 rounded-full bg-white/5/80 hover:bg-white/10 border border-cyan-400/40 text-[10px] tracking-[0.2em] uppercase text-white/70 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
             >
               {gestureEnabled ? "手势控制：开启" : "手势控制：关闭"}
             </button>
         </div>
         <div className="text-right flex flex-col items-end">
             <div className="text-[8px] text-white/30 tracking-[0.3em] uppercase mb-1">Current Artifact</div>
             <div className="text-sm font-light tracking-[0.2em] text-white/90">
                 {currentModelIndex === -1 ? "星云待机模式" : models[currentModelIndex].name}
             </div>
         </div>
      </footer>

      {/* Corner HUD brackets */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute left-10 top-10 w-10 h-10 border-l border-t border-cyan-400/50"></div>
        <div className="absolute right-10 bottom-10 w-10 h-10 border-r border-b border-cyan-400/40"></div>
      </div>

      {/* Left HUD metrics */}
      <div className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 z-20 text-[10px] text-cyan-300/80 font-mono space-y-1">
        <div className="tracking-[0.25em] uppercase text-white/40 mb-1">Telemetry</div>
        <div>ROT-X {rotation.x.toFixed(2)}</div>
        <div>ROT-Y {rotation.y.toFixed(2)}</div>
        <div>SCALE {scale.toFixed(2)}</div>
      </div>

      {/* Sidebar Toggle */}
      <button
        onClick={() => setShowSidebar(true)}
        className="absolute left-6 top-1/2 -translate-y-1/2 z-40 p-5 group pointer-events-auto"
      >
          <div className="flex flex-col gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-cyan-400 transition-colors"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-cyan-400 transition-colors"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-cyan-400 transition-colors"></div>
          </div>
      </button>

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-80 bg-black/80 backdrop-blur-xl border-r border-white/10 z-50 transition-transform duration-500 flex flex-col p-10 ${showSidebar ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex justify-between items-center mb-10">
            <span className="text-xs tracking-[0.4em] text-white/60 uppercase">Archives / 档案库</span>
            <button onClick={() => setShowSidebar(false)} className="text-[10px] text-cyan-400 uppercase hover:text-cyan-300">Close</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-none">
            <div
                onClick={() => handleSelectModel(-1)}
                className={`p-4 border rounded-2xl cursor-pointer transition-all flex justify-between group ${currentModelIndex === -1 ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-white/5 border-white/5 hover:bg-cyan-500/10'}`}
            >
                 <span className="text-[10px] text-white/50 group-hover:text-white uppercase">NEBULA MODE</span>
            </div>
            {models.map((m, i) => (
                <div
                    key={i}
                    onClick={() => handleSelectModel(i)}
                    className={`p-4 border rounded-2xl cursor-pointer transition-all flex justify-between group ${currentModelIndex === i ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-white/5 border-white/5 hover:bg-cyan-500/10'}`}
                >
                    <span className="text-[10px] text-white/50 group-hover:text-white uppercase">{m.name}</span>
                </div>
            ))}
        </div>

        <div className="mt-8">
            <label className="block p-5 border border-dashed border-white/20 rounded-2xl text-center cursor-pointer hover:border-cyan-400 transition-all group">
                <span className="text-[9px] text-white/40 group-hover:text-cyan-400 tracking-widest uppercase">+ 导入 OBJ 文件</span>
                <input type="file" multiple accept=".obj" className="hidden" onChange={handleFileUpload} />
            </label>
        </div>
      </div>

      {/* Info Panel (Right Center) */}
      <div className={`absolute right-12 top-1/2 -translate-y-1/2 w-96 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.24),rgba(15,23,42,0.98))] backdrop-blur-xl border border-cyan-400/40 shadow-[0_0_60px_rgba(34,211,238,0.35)] p-10 rounded-[2.5rem] z-30 transition-all duration-700 ${currentModelIndex === -1 ? 'opacity-0 translate-x-12' : 'opacity-100 translate-x-0'}`}>
        <div className="text-[8px] text-yellow-400 tracking-[0.5em] mb-6 uppercase">Asset Record</div>
        <h3 className="text-2xl font-light mb-6 border-b border-white/10 pb-6 tracking-wide text-white drop-shadow-[0_0_18px_rgba(34,211,238,0.55)]">
            {currentModelIndex >= 0 ? models[currentModelIndex].name : ''}
        </h3>
        <p className="text-xs leading-relaxed text-white/70 font-light text-justify italic">
            {loadingDesc ? "Decoding ancient scripts..." : description}
        </p>
      </div>

      {gestureEnabled && (
        <div className="absolute bottom-12 left-12 z-40">
          <GestureController
            onRotate={setRotation}
            onScale={setScale}
            onSwitch={handleNextModel}
          />
        </div>
      )}
    </div>
  );
};

export default Sanxingdui;
