import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas as CanvasSource, useFrame, extend } from '@react-three/fiber';

const Canvas = CanvasSource as unknown as React.FC<any>;
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

// Shader Definition matching temp.html simple point rendering
const ParticleMaterial = shaderMaterial(
  {
    uTime: 0,
    uPixelRatio: 1,
    uBrightness: 1,
  },
  // Vertex Shader
  `
    uniform float uTime;
    uniform float uPixelRatio;
    attribute float size;
    attribute vec3 color;
    varying vec3 vColor;

    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (700.0 / -mvPosition.z) * uPixelRatio; // Slightly smaller points to avoid overbright full views
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment Shader
  `
    uniform float uBrightness;
    varying vec3 vColor;

    void main() {
      float d = distance(gl_PointCoord, vec2(0.5));
      if (d > 0.5) discard;
      float b = clamp(uBrightness, 0.3, 2.3);
      vec3 baseColor = vColor * 0.65 * b;
      float alpha = (1.0 - d * 2.0) * 0.75 * b;
      gl_FragColor = vec4(baseColor, alpha);
    }
  `
);

extend({ ParticleMaterial });

const COUNT = 150000; // Keep 150k for performance safety, temp.html used 200k

type ArtifactTheme = 'gold' | 'verdigris';

const Particles = ({ modelUrl, rotation, scale, theme }: { modelUrl: string | null; rotation: { x: number; y: number }; scale: number; theme: ArtifactTheme }) => {
  const mesh = useRef<THREE.Points>(null);
  const material = useRef<any>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  // Simulation State
  const targets = useRef({
    positions: new Float32Array(COUNT * 3),
    colors: new Float32Array(COUNT * 3),
    sizes: new Float32Array(COUNT)
  });

  // Initialize Arrays
  useEffect(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const siz = new Float32Array(COUNT);

    // Initial Nebula State
    for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        pos[i3] = (Math.random() - 0.5) * 800;
        pos[i3+1] = (Math.random() - 0.5) * 800;
        pos[i3+2] = (Math.random() - 0.5) * 800;

        col[i3] = 0.1; col[i3+1] = 0.4; col[i3+2] = 0.6;
        siz[i] = Math.random() < 0.05 ? 0.35 : 0.08;
    }

    // Set initial targets to match
    targets.current.positions.set(pos);
    targets.current.colors.set(col);
    targets.current.sizes.set(siz);

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(siz, 1));

    setGeometry(geo);
  }, []);

  // Mode Switching Logic
  useEffect(() => {
    if (!modelUrl) {
        // Nebula Mode
        console.log("[Particles] Switching to Nebula Mode");
        const { positions, colors, sizes } = targets.current;
        for (let i = 0; i < COUNT; i++) {
            const i3 = i * 3;
            const r = 50 + Math.random() * 100;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);

            positions[i3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i3+1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i3+2] = r * Math.cos(phi);

            const isAccent = Math.random() > 0.85;
            // Nebula palette stays teal with a few warmer sparks
            if (isAccent) {
              colors[i3] = 0.9; colors[i3+1] = 0.8; colors[i3+2] = 0.3;
            } else {
              colors[i3] = 0.05; colors[i3+1] = 0.5; colors[i3+2] = 0.55;
            }

            sizes[i] = Math.random() < 0.05 ? 0.35 : 0.08;
        }
    } else {
        // Model Mode
        console.log("[Particles] Loading Model:", modelUrl);
        const loader = new OBJLoader();
        loader.load(modelUrl, (obj) => {
            let sampleMesh: THREE.Mesh | null = null;
            obj.traverse((child) => {
                if ((child as THREE.Mesh).isMesh && !sampleMesh) sampleMesh = child as THREE.Mesh;
            });

            if (sampleMesh) {
                // Normalize Mesh
                sampleMesh.geometry.computeBoundingBox();
                const bbox = sampleMesh.geometry.boundingBox!;
                const center = new THREE.Vector3();
                bbox.getCenter(center);
                const size = new THREE.Vector3();
                bbox.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z);
                const scaleFactor = 55.0 / maxDim; // Match temp.html scale ~55

                // Create Sampler
                const sampler = new MeshSurfaceSampler(sampleMesh).build();
                const tempPos = new THREE.Vector3();
                const { positions, colors, sizes } = targets.current;
                const bodyCount = Math.floor(COUNT * 0.9);

                for (let i = 0; i < COUNT; i++) {
                    const i3 = i * 3;
                    if (i < bodyCount) {
                        sampler.sample(tempPos);
                        // Apply normalization logic manually since we didn't transform geometry
                        const tx = (tempPos.x - center.x) * scaleFactor;
                        const ty = (tempPos.y - center.y) * scaleFactor;
                        const tz = (tempPos.z - center.z) * scaleFactor;
                        const jitter = 0.02;

                        positions[i3] = tx + (Math.random() - 0.5) * jitter;
                        positions[i3+1] = ty + (Math.random() - 0.5) * jitter;
                        positions[i3+2] = tz + (Math.random() - 0.5) * jitter;

                        const accent = Math.random() > 0.8;
                        if (theme === 'gold') {
                          // Sun wheel: warm golden body with cyan glints
                          if (accent) {
                            colors[i3] = 0.15; colors[i3+1] = 0.85; colors[i3+2] = 0.9;
                          } else {
                            colors[i3] = 0.9; colors[i3+1] = 0.75; colors[i3+2] = 0.28;
                          }
                        } else {
                          // Other bronzes: verdigris base with occasional gold highlights
                          if (accent) {
                            colors[i3] = 0.9; colors[i3+1] = 0.8; colors[i3+2] = 0.35;
                          } else {
                            colors[i3] = 0.08; colors[i3+1] = 0.7; colors[i3+2] = 0.55;
                          }
                        }

                        const rand = Math.random();
                        if (rand > 0.98) sizes[i] = 0.16;
                        else if (rand > 0.9) sizes[i] = 0.09;
                        else sizes[i] = 0.045;
                    } else {
                        // Ring/Orbit
                        const r = 100 + Math.random() * 150;
                        const theta = Math.random() * Math.PI * 2;
                        positions[i3] = r * Math.cos(theta);
                        positions[i3+1] = (Math.random() - 0.5) * 300; // Height variation
                        positions[i3+2] = r * Math.sin(theta);

                        if (theme === 'gold') {
                          colors[i3] = 0.85; colors[i3+1] = 0.7; colors[i3+2] = 0.28;
                        } else {
                          colors[i3] = 0.08; colors[i3+1] = 0.55; colors[i3+2] = 0.5;
                        }
                        sizes[i] = 0.06;
                    }
                }
            }
        });
    }
  }, [modelUrl, theme]);

  useFrame((state) => {
    if (!geometry || !mesh.current) return;

    // 1. Interpolate Attributes (CPU Animation)
    const pos = geometry.attributes.position.array as Float32Array;
    const col = geometry.attributes.color.array as Float32Array;
    const siz = geometry.attributes.size.array as Float32Array;

    const tPos = targets.current.positions;
    const tCol = targets.current.colors;
    const tSiz = targets.current.sizes;

    // Using a loop unroll or just simple loop.
    // Optimization: Do this only if needed? temp.html does it always.
    // 150k iterations is fine.
    for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        // Position lerp 0.06
        pos[i3] += (tPos[i3] - pos[i3]) * 0.06;
        pos[i3+1] += (tPos[i3+1] - pos[i3+1]) * 0.06;
        pos[i3+2] += (tPos[i3+2] - pos[i3+2]) * 0.06;

        // Color lerp 0.04
        col[i3] += (tCol[i3] - col[i3]) * 0.04;
        col[i3+1] += (tCol[i3+1] - col[i3+1]) * 0.04;
        col[i3+2] += (tCol[i3+2] - col[i3+2]) * 0.04;

        // Size lerp 0.06
        siz[i] += (tSiz[i] - siz[i]) * 0.06;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;

    // 2. Uniforms
    const normalizedScale = THREE.MathUtils.clamp((scale - 0.05) / (4.0 - 0.05), 0, 1);
    const boosted = Math.pow(normalizedScale, 2.0);
    const brightness = 0.3 + boosted * 2.0;

    if (material.current) {
        material.current.uTime = state.clock.elapsedTime;
        material.current.uPixelRatio = Math.min(window.devicePixelRatio, 2);
        material.current.uBrightness = brightness;
    }

    // 3. Global Rotation & Scale (Gesture)
    // Lerp rotation/scale here to match temp.html's animate loop
    // Note: mesh.rotation is handled by R3F typically, but here we do it manually or via props
    // temp.html does: points.material.uniforms.uRotation.value = currentRotationY
    // But it ALSO rotates the positions in Vertex Shader using uRotation!
    // Wait, temp.html vertex shader:
    // float s = sin(uRotation); float c = cos(uRotation);
    // mat2 rot = mat2(c, -s, s, c); pos.xz = rot * pos.xz;
    // So the mesh itself doesn't rotate, the vertex shader rotates the points.

    // However, GestureController passes us 'rotation' props.
    // Let's stick to rotating the Mesh object for simplicity and performance in R3F,
    // unless exact shader parity is required.
    // temp.html shader rotation is around Y axis.
    // Let's use mesh.rotation.y = rotation.y

    mesh.current.rotation.y = THREE.MathUtils.lerp(mesh.current.rotation.y, rotation.y, 0.1);
    mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, rotation.x, 0.1); // Add X for tilt

    const currentScale = mesh.current.scale.x;
    const newScale = THREE.MathUtils.lerp(currentScale, scale, 0.1);
    mesh.current.scale.set(newScale, newScale, newScale);
  });

  if (!geometry) return null;

  return (
    <points ref={mesh} geometry={geometry}>
      {/* @ts-ignore */}
      <particleMaterial ref={material} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

interface ArtifactCanvasProps {
  modelUrl: string | null;
  rotation: { x: number; y: number };
  scale: number;
  theme: ArtifactTheme;
}

export const ArtifactCanvas: React.FC<ArtifactCanvasProps> = ({ modelUrl, rotation, scale, theme }) => {
  return (
    <div className="w-full h-full bg-[#000406]">
      <Canvas camera={{ position: [0, 0, 22], fov: 40 }}>
        <fog attach="fog" args={['#000406', 15, 40]} />
        <ambientLight intensity={0.5} />

        {/* Pass null for modelUrl to trigger nebula mode initially or when no model selected */}
        <Particles modelUrl={modelUrl || null} rotation={rotation} scale={scale} theme={theme} />

        <EffectComposer multisampling={0}>
          <Bloom
            luminanceThreshold={1.2}
            luminanceSmoothing={0.7}
            intensity={0.15}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
