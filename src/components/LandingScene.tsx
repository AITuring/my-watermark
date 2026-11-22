/* eslint-disable react/no-unknown-property -- React Three Fiber uses Three.js object properties in JSX. */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { RefObject } from 'react';

type PlanetSpec = { name: string; distance: number; radius: number; period: number; phase: number; tilt: number; colors: string[]; gas?: boolean; rings?: boolean; earth?: boolean };
const PLANET_LABELS: Record<string, string> = { Mercury: '水星', Venus: '金星', Earth: '地球', Mars: '火星', Jupiter: '木星', Saturn: '土星', Uranus: '天王星', Neptune: '海王星' };
const PLANETS: PlanetSpec[] = [
    { name: 'Mercury', distance: 2.8, radius: .13, period: 15, phase: .4, tilt: .01, colors: ['#66635e', '#b0a99b'] },
    { name: 'Venus', distance: 3.8, radius: .24, period: 24, phase: 2.5, tilt: .04, colors: ['#ad8653', '#eddbac'], gas: true },
    { name: 'Earth', distance: 5, radius: .26, period: 36, phase: 4.1, tilt: .41, colors: [], earth: true },
    { name: 'Mars', distance: 6.3, radius: .19, period: 49, phase: 1.2, tilt: .44, colors: ['#6c3825', '#c58055'] },
    { name: 'Jupiter', distance: 8.6, radius: .79, period: 100, phase: 5.7, tilt: .05, colors: ['#aa765b', '#e3c9a4', '#8c6656', '#f1debf'], gas: true },
    { name: 'Saturn', distance: 11.5, radius: .65, period: 145, phase: 2.8, tilt: .47, colors: ['#b4a07b', '#e6d9b5', '#c1ae88'], gas: true, rings: true },
    { name: 'Uranus', distance: 14, radius: .43, period: 205, phase: 4.7, tilt: 1.71, colors: ['#83b7bb', '#b3d6d4'], gas: true },
    { name: 'Neptune', distance: 16, radius: .42, period: 255, phase: .6, tilt: .49, colors: ['#234e9c', '#5187c5'], gas: true },
];

function random(seed: number) {
    let value = seed;
    return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

function surfaceTexture(spec: PlanetSpec) {
    const canvas = document.createElement('canvas');
    const width = 2048, height = 1024;
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const data = ctx.createImageData(width, height);
    const palette = spec.colors.map((c) => new THREE.Color(c));
    const rng = random(spec.name.charCodeAt(0) * 971);
    const color = new THREE.Color();
    for (let y = 0; y < height; y++) {
        const latitude = y / height * Math.PI;
        for (let x = 0; x < width; x++) {
            const longitude = x / width * Math.PI * 2;
            const turbulence = Math.sin(longitude * 8 + Math.sin(latitude * 22)) * .12 + Math.cos(longitude * 19 - latitude * 9) * .04;
            let n = spec.gas ? .5 + .27 * Math.sin(latitude * 47 + turbulence * 4) + .13 * Math.sin(latitude * 103 + turbulence * 3) : .5 + .2 * Math.sin(longitude * 13 + Math.sin(latitude * 8) * 3) * Math.sin(latitude * 19) + .2 * (rng() - .5);
            if (spec.name === 'Neptune' || spec.name === 'Uranus') n = .55 + .045 * Math.sin(latitude * 17 + turbulence) + .015 * Math.sin(latitude * 43);
            const position = THREE.MathUtils.clamp(n, 0, .999) * (palette.length - 1);
            color.copy(palette[Math.floor(position)]).lerp(palette[Math.min(palette.length - 1, Math.floor(position) + 1)], position % 1);
            color.convertLinearToSRGB();
            const grain = .94 + rng() * .12;
            const i = (y * width + x) * 4;
            data.data[i] = color.r * 255 * grain;
            data.data[i + 1] = color.g * 255 * grain;
            data.data[i + 2] = color.b * 255 * grain;
            data.data[i + 3] = 255;
        }
    }
    ctx.putImageData(data, 0, 0);
    ctx.scale(width / 512, height / 256);
    if (!spec.gas) {
        for (let i = 0; i < 220; i++) {
            const x = rng() * 512, y = rng() * 256, radius = 1 + rng() * 6;
            ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = 'rgba(25,18,14,.12)'; ctx.fill();
            ctx.strokeStyle = 'rgba(239,215,186,.16)'; ctx.lineWidth = .6; ctx.stroke();
        }
    }
    if (spec.name === 'Jupiter' || spec.name === 'Neptune') {
        const jovian = spec.name === 'Jupiter';
        ctx.save(); ctx.translate(330, jovian ? 158 : 145); ctx.scale(jovian ? 2.1 : 1.8, 1);
        const storm = ctx.createRadialGradient(0, 0, 1, 0, 0, jovian ? 14 : 10);
        storm.addColorStop(0, jovian ? '#9b4931' : '#183c74');
        storm.addColorStop(.45, jovian ? '#bd6542' : '#21497e');
        storm.addColorStop(.8, jovian ? '#d99870' : '#3c6fa6');
        storm.addColorStop(1, jovian ? 'rgba(217,152,112,0)' : 'rgba(60,111,166,0)');
        ctx.fillStyle = storm; ctx.fillRect(-16, -16, 32, 32);
        if (jovian) {
            for (let i = 0; i < 5; i++) {
                ctx.beginPath(); ctx.ellipse(0, 0, 4 + i * 1.7, 3 + i * 1.8, .12 * i, 0, Math.PI * 2);
                ctx.strokeStyle = i % 2 ? 'rgba(115,46,24,.35)' : 'rgba(243,189,138,.45)'; ctx.lineWidth = .7; ctx.stroke();
            }
        }
        ctx.restore();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping; texture.anisotropy = 8;
    return texture;
}

function useOwnedTexture(factory: () => THREE.Texture, dependencies: unknown[]) {
    // Factories are stable for the lifetime of each named celestial body.
    const texture = useMemo(factory, dependencies);
    useEffect(() => () => texture.dispose(), [texture]);
    return texture;
}

function StarField() {
    const geometry = useMemo(() => {
        const rng = random(1093), positions = new Float32Array(3600 * 3), colors = new Float32Array(3600 * 3);
        const tones = ['#d7e5ff', '#fff6e7', '#f5c5a1', '#a8c5f2'].map((c) => new THREE.Color(c));
        for (let i = 0; i < 3600; i++) {
            const longitude = rng() * Math.PI * 2, z = rng() * 2 - 1, r = 100 + rng() * 120;
            positions.set([Math.sqrt(1 - z * z) * Math.cos(longitude) * r, z * r, Math.sqrt(1 - z * z) * Math.sin(longitude) * r], i * 3);
            const color = tones[Math.floor(rng() * tones.length)].clone().multiplyScalar(.25 + Math.pow(rng(), 3) * 1.3);
            colors.set([color.r, color.g, color.b], i * 3);
        }
        const result = new THREE.BufferGeometry(); result.setAttribute('position', new THREE.BufferAttribute(positions, 3)); result.setAttribute('color', new THREE.BufferAttribute(colors, 3)); return result;
    }, []);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return <points geometry={geometry}><pointsMaterial vertexColors size={.17} sizeAttenuation transparent opacity={.85} depthWrite={false} /></points>;
}

function Sun({ motion }: { motion: boolean }) {
    const loaded = useLoader(THREE.TextureLoader, '/textures/sun.webp');
    const texture = useOwnedTexture(() => { const t = loaded.clone(); t.colorSpace = THREE.SRGBColorSpace; return t; }, [loaded]);
    const ref = useRef<THREE.Mesh>(null);
    const glow = useOwnedTexture(() => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        gradient.addColorStop(0, 'rgba(255,244,201,1)'); gradient.addColorStop(.22, 'rgba(255,210,110,.65)'); gradient.addColorStop(.42, 'rgba(255,157,51,.15)'); gradient.addColorStop(1, 'rgba(255,120,30,0)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(canvas);
    }, []);
    useFrame((_, delta) => { if (motion && ref.current) ref.current.rotation.y += Math.min(delta, .05) * .035; });
    return <group>
        <mesh ref={ref}><sphereGeometry args={[1.08, 96, 64]} /><meshBasicMaterial map={texture} color="#fff1ce" toneMapped={false} /></mesh>
        <sprite scale={[7, 7, 1]}><spriteMaterial map={glow} blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} /></sprite>
        <pointLight intensity={650} decay={2} color="#fff4e4" />
    </group>;
}

function SaturnRings({ radius }: { radius: number }) {
    const texture = useOwnedTexture(() => {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 1;
        const ctx = canvas.getContext('2d')!, rng = random(819);
        for (let x = 0; x < 512; x++) {
            const t = x / 512, gap = (t > .57 && t < .61) || (t > .88 && t < .895);
            ctx.fillStyle = `rgba(192,176,146,${gap ? .025 : (.25 + rng() * .5) * Math.sin(Math.PI * t)})`; ctx.fillRect(x, 0, 1, 1);
        }
        const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
    }, []);
    const geometry = useMemo(() => {
        const g = new THREE.RingGeometry(radius * 1.28, radius * 2.35, 160);
        const positions = g.attributes.position, uv = g.attributes.uv;
        for (let i = 0; i < positions.count; i++) uv.setXY(i, (Math.hypot(positions.getX(i), positions.getY(i)) / radius - 1.28) / 1.07, .5);
        return g;
    }, [radius]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}><meshStandardMaterial map={texture} emissiveMap={texture} emissive="#9e8c70" emissiveIntensity={.45} transparent opacity={.95} side={THREE.DoubleSide} roughness={1} depthWrite={false} /></mesh>;
}

function NeptuneRings({ radius }: { radius: number }) {
    return <group rotation={[-Math.PI / 2, 0, 0]}>
        {[1.65, 1.85, 2.15, 2.55].map((scale, index) => <mesh key={scale}>
            <ringGeometry args={[radius * scale, radius * (scale + (index === 0 ? .08 : .018)), 192]} />
            <meshBasicMaterial color="#93a7ba" transparent opacity={index === 0 ? .11 : .38} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>)}
        <mesh rotation={[0, 0, .4]}><ringGeometry args={[radius * 2.54, radius * 2.58, 32, 1, 0, .48]} /><meshBasicMaterial color="#b2bec9" transparent opacity={.6} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    </group>;
}

function Planet({ spec, motion, onFocus, focused }: { spec: PlanetSpec; motion: boolean; onFocus: (name: string) => void; focused: boolean }) {
    const earth = useLoader(THREE.TextureLoader, '/textures/earth.webp');
    const texture = useOwnedTexture(() => {
        if (!spec.earth) return surfaceTexture(spec);
        const t = earth.clone(); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
    }, [spec, earth]);
    const orbit = useRef<THREE.Group>(null), body = useRef<THREE.Group>(null), moon = useRef<THREE.Group>(null);
    const elapsed = useRef(0), spinTime = useRef(0), rotationOffset = useRef(0);
    useEffect(() => {
        if (!focused || !orbit.current || (spec.name !== 'Jupiter' && spec.name !== 'Neptune')) return;
        orbit.current.updateWorldMatrix(true, false);
        const lightDirection = orbit.current.worldToLocal(new THREE.Vector3()).normalize();
        lightDirection.applyAxisAngle(new THREE.Vector3(0, 0, 1), -spec.tilt);
        const spotAngle = Math.atan2(Math.sin(330 / 512 * Math.PI * 2), -Math.cos(330 / 512 * Math.PI * 2));
        rotationOffset.current = spotAngle - Math.atan2(lightDirection.z, lightDirection.x) - spinTime.current * .06;
    }, [focused, spec]);
    useFrame((_, delta) => {
        if (motion) elapsed.current += Math.min(delta, .05);
        if (motion && !focused) spinTime.current += Math.min(delta, .05);
        const angle = elapsed.current / spec.period * Math.PI * 2 + spec.phase;
        if (orbit.current) orbit.current.position.set(Math.cos(angle) * spec.distance, 0, Math.sin(angle) * spec.distance);
        if (body.current) body.current.rotation.y = rotationOffset.current + spinTime.current * (spec.gas ? .06 : .035);
        if (moon.current) moon.current.rotation.y = elapsed.current * .2;
    });
    return <group ref={orbit} name={`planet-${spec.name}`} onClick={(event) => { event.stopPropagation(); onFocus(spec.name); }} position={[Math.cos(spec.phase) * spec.distance, 0, Math.sin(spec.phase) * spec.distance]}>
        <group rotation={[0, 0, spec.tilt]}>
            <group ref={body}><mesh><sphereGeometry args={[spec.radius, 96, 64]} /><meshStandardMaterial map={texture} roughness={spec.earth ? .65 : 1} metalness={0} /></mesh></group>
            {spec.rings && <SaturnRings radius={spec.radius} />}
            {spec.name === 'Neptune' && <NeptuneRings radius={spec.radius} />}
            {spec.earth && <mesh scale={1.035}><sphereGeometry args={[spec.radius, 32, 24]} /><meshBasicMaterial color="#79b9ef" side={THREE.BackSide} transparent opacity={.13} depthWrite={false} /></mesh>}
        </group>
        {spec.earth && <group ref={moon} rotation={[.09, 0, 0]}><mesh position={[.65, 0, 0]}><sphereGeometry args={[.065, 20, 16]} /><meshStandardMaterial color="#aaa69f" roughness={1} /></mesh></group>}
    </group>;
}

function OrbitPath({ distance }: { distance: number }) {
    const geometry = useMemo(() => {
        const points = Array.from({ length: 193 }, (_, i) => new THREE.Vector3(Math.cos(i / 192 * Math.PI * 2) * distance, 0, Math.sin(i / 192 * Math.PI * 2) * distance));
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [distance]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return <lineLoop><primitive object={geometry} attach="geometry" /><lineBasicMaterial color="#8294aa" transparent opacity={.15} depthWrite={false} /></lineLoop>;
}

function AsteroidBelt() {
    const ref = useRef<THREE.InstancedMesh>(null);
    useEffect(() => {
        if (!ref.current) return;
        const rng = random(93), matrix = new THREE.Object3D();
        for (let i = 0; i < 650; i++) {
            const angle = rng() * Math.PI * 2, radius = 7.05 + rng() * .8;
            matrix.position.set(Math.cos(angle) * radius, (rng() - .5) * .18, Math.sin(angle) * radius);
            matrix.rotation.set(rng() * 6, rng() * 6, rng() * 6); matrix.scale.setScalar(.008 + rng() * .018); matrix.updateMatrix(); ref.current.setMatrixAt(i, matrix.matrix);
        }
        ref.current.instanceMatrix.needsUpdate = true;
    }, []);
    return <instancedMesh ref={ref} args={[undefined, undefined, 650]} frustumCulled={false}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#898076" roughness={1} /></instancedMesh>;
}

function CameraFollow({ focused, controls, reducedMotion }: { focused: string; controls: RefObject<OrbitControlsImpl>; reducedMotion: boolean }) {
    const { camera, scene, size, invalidate } = useThree();
    const transitionTime = useRef(0);
    const transition = useRef(true), previous = useRef(new THREE.Vector3());
    const scratch = useMemo(() => ({ target: new THREE.Vector3(), offset: new THREE.Vector3(), next: new THREE.Vector3() }), []);
    useEffect(() => { transition.current = true; transitionTime.current = 0; invalidate(); }, [focused, size.width, size.height, invalidate]);
    useFrame((_, delta) => {
        const control = controls.current;
        if (!control) return;
        const spec = PLANETS.find((planet) => planet.name === focused);
        const object = focused ? scene.getObjectByName(`planet-${focused}`) : null;
        if (focused && !object) { invalidate(); return; }
        const { target, offset, next } = scratch;
        if (object) { object.updateWorldMatrix(true, false); object.getWorldPosition(target); } else target.set(0, 0, 0);
        if (transition.current) {
            if (spec) {
                // Approach from the sunward side so surface details are lit on arrival.
                offset.copy(target).negate().normalize().multiplyScalar(spec.radius * 6);
                offset.y += spec.radius * 2.5;
                offset.multiplyScalar(Math.max(1, .8 / (size.width / size.height)));
            } else {
                const scale = Math.max(1, 1.2 / (size.width / Math.max(1, size.height)));
                offset.set(0, 18 * scale, 29 * scale);
            }
            next.copy(target).add(offset);
            const alpha = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, .05) * 7);
            camera.position.lerp(next, alpha); control.target.lerp(target, alpha);
            transitionTime.current += Math.min(delta, .05);
            if (reducedMotion || transitionTime.current > 1.3) {
                camera.position.copy(next); control.target.copy(target); transition.current = false;
            }
            invalidate();
        } else if (object) {
            offset.copy(target).sub(previous.current);
            camera.position.add(offset); control.target.add(offset);
        }
        previous.current.copy(target);
        control.update();
    });
    return null;
}

export default function LandingScene() {
    const [focused, setFocused] = useState('');
    const controls = useRef<OrbitControlsImpl>(null);
    const focusedRadius = PLANETS.find((planet) => planet.name === focused)?.radius;
    const [pixelRatio, setPixelRatio] = useState(() => window.devicePixelRatio || 1);
    useEffect(() => {
        const updateResolution = () => setPixelRatio(window.devicePixelRatio || 1);
        window.addEventListener('resize', updateResolution);
        return () => window.removeEventListener('resize', updateResolution);
    }, []);
    const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)'), update = () => setReducedMotion(media.matches);
        media.addEventListener('change', update); return () => media.removeEventListener('change', update);
    }, []);
    return <>
    <div className="pointer-events-auto absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-slate-950/85 p-2 text-xs text-white sm:left-6 sm:top-6">
        <select aria-label="观察行星" className="h-9 rounded-lg border border-white/20 bg-slate-900 px-3 text-sm text-white" value={focused} onChange={(event) => setFocused(event.target.value)}>
            <option value="">太阳系全景</option>{PLANETS.map((planet) => <option key={planet.name} value={planet.name}>{PLANET_LABELS[planet.name]}</option>)}
        </select>
        {focused && <button type="button" className="h-9 rounded-lg px-3 hover:bg-white/10" onClick={() => setFocused('')}>返回全景</button>}
        <span className="px-2 text-white/60">{focused ? '镜头跟随 · 拖动旋转 · 滚轮缩放' : '点击行星观察细节'}</span>
    </div>
    {/* @ts-expect-error Fiber bundles React 19 types; this application uses React 18 types. */}
    <Canvas camera={{ position: [0, 22, 33], fov: 49, near: .1, far: 500 }} dpr={pixelRatio} gl={{ antialias: true, powerPreference: 'high-performance' }} frameloop={reducedMotion ? 'demand' : 'always'}>
        <color attach="background" args={['#020408']} />
        <ambientLight intensity={.1} />
        <Suspense fallback={null}>
            <StarField />
            <group rotation={[.08, 0, -.12]}><Sun motion={!reducedMotion} />{PLANETS.map((spec) => <group key={spec.name}>{!focused && <OrbitPath distance={spec.distance} />}<Planet spec={spec} motion={!reducedMotion} onFocus={setFocused} focused={focused === spec.name} /></group>)}{!focused && <AsteroidBelt />}</group>
        </Suspense>
        <OrbitControls ref={controls} enableZoom enablePan minDistance={focusedRadius ? focusedRadius * 1.6 : 3} maxDistance={120} zoomSpeed={.65} enableDamping minPolarAngle={.05} maxPolarAngle={Math.PI - .05} autoRotate={!focused && !reducedMotion} autoRotateSpeed={.12} />
        <CameraFollow focused={focused} controls={controls} reducedMotion={reducedMotion} />
    </Canvas></>;
}
