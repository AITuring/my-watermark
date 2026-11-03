import React, { lazy, Suspense, useEffect, useState } from 'react';

const LandingScene = lazy(() => import('./LandingScene'));
class SceneBoundary extends React.Component<{children: React.ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

interface ThreeLandingProps {
    getRootProps: any;
    getInputProps: any;
}

export default function ThreeLanding({ getRootProps, getInputProps }: ThreeLandingProps) {
  const [showScene, setShowScene] = useState(false);
  useEffect(() => {
    // Paint the functional upload control before fetching decorative WebGL.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShowScene(true));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, []);
  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden z-10">
      <div className="absolute inset-0 z-0 bg-black">
        {showScene && <SceneBoundary><Suspense fallback={null}><LandingScene /></Suspense></SceneBoundary>}
      </div>

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
         <div className="pointer-events-auto">
             <div
                {...getRootProps()}
                className="group relative flex flex-col items-center justify-center p-12 transition-all duration-300 hover:scale-105 cursor-pointer"
             >
                <input {...getInputProps()} />
                <div className="absolute inset-0 bg-black/40 rounded-full blur-xl group-hover:bg-black/60 transition-all duration-500" />

                <div className="relative bg-white/[0.02] backdrop-blur-[2px] border border-white/10 px-8 py-5 rounded-2xl shadow-lg overflow-hidden group-hover:border-white/20 transition-all duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className="p-2 rounded-full bg-white/5 text-blue-200 group-hover:text-white group-hover:bg-blue-500/20 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" x2="12" y1="3" y2="15" />
                            </svg>
                        </div>
                        <div className="text-sm font-medium text-white/80 tracking-wide">
                            选择图片
                        </div>
                    </div>
                </div>
             </div>
         </div>
      </div>
    </div>
  )
}
