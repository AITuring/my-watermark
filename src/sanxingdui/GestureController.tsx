import React, { useEffect, useRef, useState } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

interface GestureControllerProps {
  onRotate: (rotation: { x: number; y: number }) => void;
  onScale: (scale: number) => void;
  onSwitch: () => void;
}

export const GestureController: React.FC<GestureControllerProps> = ({ onRotate, onScale, onSwitch }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const okGestureTimer = useRef<number | null>(null);
  const [okProgress, setOkProgress] = useState(0);
  const lastSwitchTime = useRef<number>(0);

  // State for continuous rotation and relative scaling
  const currentRotation = useRef({ x: 0, y: 0 });
  const scaleState = useRef<{ baseDist: number | null; baseScale: number }>({ baseDist: null, baseScale: 1.0 });
  const currentScale = useRef(1.0);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          await hands.send({ image: videoRef.current });
        }
      },
      width: 320,
      height: 240,
    });

    camera.start().then(() => setLoading(false));

    return () => {
      camera.stop();
    };
  }, []);

  const onResults = (results: Results) => {
    if (!canvasRef.current) return;

    const canvasCtx = canvasRef.current.getContext('2d');
    if (canvasCtx) {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        canvasCtx.scale(-1, 1);
        canvasCtx.translate(-canvasRef.current.width, 0);
        canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
        canvasCtx.restore();
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];

      // 1. Rotation (Continuous accumulation based on Palm X)
      // temp.html: currentRotationY += (lm[0].x - 0.5) * 0.1;
      const palmX = landmarks[0].x;
      const palmY = landmarks[0].y;

      currentRotation.current.y += (palmX - 0.5) * 0.05; // 0.05 sensitivity
      currentRotation.current.x += (palmY - 0.5) * 0.05;

      onRotate({ x: currentRotation.current.x, y: currentRotation.current.y });

      // Helper for distance
      const dist = (i1: number, i2: number) => {
          const p1 = landmarks[i1];
          const p2 = landmarks[i2];
          return Math.hypot(p1.x - p2.x, p1.y - p2.y);
      };

      // 2. Scale (Relative Logic)
      // temp.html: if (isFingersExtended && pinchDist > palmSize * 0.8) ...
      const thumbIndexDist = dist(4, 8);
      const palmSize = dist(0, 5);

      // Check if fingers are extended (Index and Middle tips above dips)
      // Note: Y increases downwards in MediaPipe coords? Yes.
      // temp.html: lm[12].y < lm[9].y && lm[16].y < lm[13].y
      const isScalingPose = landmarks[12].y < landmarks[9].y && landmarks[16].y < landmarks[13].y;

      if (isScalingPose && thumbIndexDist > palmSize * 0.8) {
         if (scaleState.current.baseDist === null) {
             scaleState.current.baseDist = thumbIndexDist;
             scaleState.current.baseScale = currentScale.current;
         }

         const scaleFactor = thumbIndexDist / scaleState.current.baseDist;
         const target = Math.max(0.3, Math.min(3.0, scaleState.current.baseScale * scaleFactor));
         currentScale.current = target;
         onScale(target);
      } else {
         scaleState.current.baseDist = null;
      }

      // 3. OK Gesture Detection (Switch)
      // temp.html: dist(4, 8) < 0.06 && lm[12].y < lm[10].y
      const isPinch = thumbIndexDist < 0.06;
      // Middle finger extended: Tip(12) above PIP(10) (y is smaller)
      const isMiddleExtended = landmarks[12].y < landmarks[10].y;

      const isOk = isPinch && isMiddleExtended;

      if (isOk) {
        if (!okGestureTimer.current) {
            // Debounce switch
            if (Date.now() - lastSwitchTime.current > 3000) {
                const startTime = Date.now();
                okGestureTimer.current = window.setInterval(() => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(100, (elapsed / 1500) * 100);
                    setOkProgress(progress);

                    if (elapsed >= 1500) {
                        onSwitch();
                        lastSwitchTime.current = Date.now();
                        if (okGestureTimer.current) {
                            clearInterval(okGestureTimer.current);
                            okGestureTimer.current = null;
                        }
                        setOkProgress(0);
                    }
                }, 16);
            }
        }
      } else {
        if (okGestureTimer.current) {
            clearInterval(okGestureTimer.current);
            okGestureTimer.current = null;
            setOkProgress(0);
        }
      }
    } else {
        // No hands
        if (okGestureTimer.current) {
            clearInterval(okGestureTimer.current);
            okGestureTimer.current = null;
            setOkProgress(0);
        }
        scaleState.current.baseDist = null;
    }
  };

  return (
    <div className="relative w-48 h-36 bg-black/50 rounded-lg overflow-hidden border border-white/20 backdrop-blur-md shadow-2xl">
      <video ref={videoRef} className="absolute top-0 left-0 w-full h-full object-cover opacity-50 -scale-x-100" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" width={320} height={240} />

      {loading && <div className="absolute inset-0 flex items-center justify-center text-xs text-cyan-400 font-mono">Init AI...</div>}

      {okProgress > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
             <svg width="60" height="60" viewBox="0 0 60 60">
               <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
               <circle
                 cx="30" cy="30" r="26"
                 fill="none"
                 stroke="#00FFFF"
                 strokeWidth="4"
                 strokeDasharray="163"
                 strokeDashoffset={163 - (163 * okProgress) / 100}
                 strokeLinecap="round"
                 transform="rotate(-90 30 30)"
               />
             </svg>
             <span className="absolute text-[10px] text-cyan-400 font-bold tracking-widest mt-1">SWITCHING</span>
        </div>
      )}
    </div>
  );
};
