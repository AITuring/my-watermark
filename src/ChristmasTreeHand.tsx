import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas as CanvasSource, useFrame } from "@react-three/fiber";

// Workaround for React 18/19 type mismatch
const Canvas = CanvasSource as unknown as React.FC<any>;
import { Points, PointMaterial, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";


function distance(a: any, b: any) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function generateTree(count: number) {
  const H = 12;
  const R = 6;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const green = new THREE.Color("#16a34a");
  const red = new THREE.Color("#ef4444");
  const gold = new THREE.Color("#f59e0b");
  const brown = new THREE.Color("#8B5A2B");
  for (let i = 0; i < count; i++) {
    const t = Math.random();
    let x, y, z, c: THREE.Color;
    if (t < 0.08) {
      y = -H * 0.35 + Math.random() * H * 0.25;
      const r = 0.4 + Math.random() * 0.25;
      const th = Math.random() * Math.PI * 2;
      x = r * Math.cos(th) * 0.6;
      z = r * Math.sin(th) * 0.6;
      c = brown;
    } else {
      const h = Math.pow(Math.random(), 0.7);
      y = h * H - H * 0.4;
      const base = R * (1 - h);
      const ring = base * Math.pow(Math.random(), 0.35);
      const swirl = h * 5;
      const th = Math.random() * Math.PI * 2 + swirl;
      x = ring * Math.cos(th);
      z = ring * Math.sin(th);
      const rdm = Math.random();
      if (rdm < 0.86) c = green;
      else if (rdm < 0.93) c = red;
      else c = gold;
    }
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  return { positions, colors };
}

function generateScatter(count: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const w = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 10 * Math.cbrt(w);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  return positions;
}

function TreePoints({ scatter }: { scatter: boolean }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const count = 9000;
  const { positions: treePos, colors } = useMemo(() => generateTree(count), []);
  const scatterPos = useMemo(() => generateScatter(count), []);
  const current = useRef<Float32Array>(new Float32Array(treePos));
  const target = useRef<Float32Array>(scatter ? scatterPos : treePos);
  const speed = 3;
  useEffect(() => {
    target.current = scatter ? scatterPos : treePos;
  }, [scatter, scatterPos, treePos]);
  useFrame((_, delta) => {
    const p = current.current;
    const t = target.current;
    const n = p.length;
    const k = Math.min(1, delta * speed);
    for (let i = 0; i < n; i++) {
      p[i] += (t[i] - p[i]) * k;
    }
    const attr = (pointsRef.current.geometry as THREE.BufferGeometry).getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    attr.array = p;
    attr.needsUpdate = true;
    pointsRef.current.rotation.y += delta * 0.15;
  });
  return (
    <Points ref={pointsRef} positions={current.current} colors={colors} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        vertexColors
        size={0.12}
        sizeAttenuation
        depthWrite={false}
        opacity={0.85}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

function useHandGesture() {
  const [open, setOpen] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let hands: any;
    let camera: any;
    let smooth = 0;
    const onResults = (res: any) => {
      const lm = res.multiHandLandmarks?.[0];
      if (!lm) return;
      const wrist = lm[0];
      const indexBase = lm[5];
      const pinkyBase = lm[17];
      const palmWidth = distance(indexBase, pinkyBase) + 1e-6;
      const tips = [lm[8], lm[12], lm[16], lm[20]];
      const avg = tips.reduce((s, t) => s + distance(t, wrist), 0) / tips.length;
      const score = avg / palmWidth;
      const isOpen = score > 1.7;
      smooth = 0.9 * smooth + 0.1 * (isOpen ? 1 : 0);
      if (smooth > 0.7 && open !== true) setOpen(true);
      else if (smooth < 0.3 && open !== false) setOpen(false);
    };
    const run = async () => {
      hands = new Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      hands.onResults(onResults);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      camera = new Camera(videoRef.current!, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current! });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    };
    run();
    return () => {
      try {
        camera?.stop && camera.stop();
      } catch {}
      try {
        const s = videoRef.current?.srcObject as MediaStream | null;
        s?.getTracks()?.forEach((t) => t.stop());
      } catch {}
      try {
        hands?.close && hands.close();
      } catch {}
    };
  }, []);
  return { videoRef, open };
}

export default function ChristmasTreeHand() {
  const { videoRef, open } = useHandGesture();
  const scatter = open === true;
  return (
    <div className="w-screen h-screen bg-black text-white relative overflow-hidden">
      <Canvas camera={{ position: [0, 6, 18], fov: 45 }}>
        <ambientLight intensity={1.2} />
        <pointLight position={[0, 10, 10]} intensity={1.5} color="#ffffff" decay={1} distance={50} />
        <TreePoints scatter={scatter} />
        <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 4} autoRotate={false} />
      </Canvas>
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-md">
        <div className={`w-2 h-2 rounded-full ${scatter ? "bg-red-400" : "bg-green-400"}`} />
        <div className="text-sm">{open === null ? "初始化中" : scatter ? "手掌张开：散开" : "握拳：合拢"}</div>
      </div>
      <video ref={videoRef} playsInline muted className="absolute right-4 bottom-4 w-40 h-28 rounded-lg opacity-20" />
    </div>
  );
}
