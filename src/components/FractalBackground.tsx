import React, { useRef, useMemo } from 'react';
import { Canvas as CanvasSource, useFrame, useThree } from '@react-three/fiber';

// Workaround for React 18/19 type mismatch
const Canvas = CanvasSource as unknown as React.FC<any>;
import { Color, Vector2 } from 'three';
import * as THREE from 'three';

const FragmentShader = `
uniform float time;
uniform vec2 resolution;
uniform vec3 uColor1;
uniform vec3 uColor2;
varying vec2 vUv;

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= resolution.x / resolution.y;

    float r = length(uv);
    float a = atan(uv.y, uv.x);

    float t = time * 0.5;

    // Linear / Wireframe style
    // Radial spiral lines
    float s1 = sin(16.0 * a + log(r) * 5.0 - t);
    // Concentric-ish spiral lines
    float s2 = sin(log(r) * 20.0 + t);

    float lines = 0.0;
    // Sharp edges for linear look (thin lines)
    lines += smoothstep(0.05, 0.0, abs(s1));
    lines += smoothstep(0.05, 0.0, abs(s2));

    lines = clamp(lines, 0.0, 1.0);

    // Center fade and outer vignette
    float alpha = smoothstep(0.0, 0.2, r) * (1.0 - smoothstep(1.0, 2.5, r));

    vec3 color = mix(uColor1, uColor2, lines * alpha);

    gl_FragColor = vec4(color, 1.0);
}
`;

const VertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FractalPlane: React.FC<{ isDark: boolean }> = ({ isDark }) => {
    const mesh = useRef<THREE.Mesh>(null);
    const { viewport, size } = useThree();

    const uniforms = useMemo(
        () => ({
            time: { value: 0 },
            resolution: { value: new Vector2(size.width, size.height) },
            uColor1: { value: new Color('#ffffff') },
            uColor2: { value: new Color('#000000') },
        }),
        []
    );

    useFrame((state) => {
        if (mesh.current) {
            const material = mesh.current.material as THREE.ShaderMaterial;
            material.uniforms.time.value = state.clock.getElapsedTime();
            material.uniforms.resolution.value.set(size.width, size.height);

            // Dynamic color switching
            const targetColor1 = isDark ? new Color('#000000') : new Color('#ffffff');
            const targetColor2 = isDark ? new Color('#ffffff') : new Color('#000000');

            material.uniforms.uColor1.value.lerp(targetColor1, 0.1);
            material.uniforms.uColor2.value.lerp(targetColor2, 0.1);
        }
    });

    return (
        <mesh ref={mesh} scale={[viewport.width, viewport.height, 1]}>
            <planeGeometry args={[1, 1]} />
            <shaderMaterial
                fragmentShader={FragmentShader}
                vertexShader={VertexShader}
                uniforms={uniforms}
                transparent={true}
            />
        </mesh>
    );
};

function useDarkMode() {
    const [isDark, setIsDark] = React.useState(false);
    React.useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('dark'));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    return isDark;
}

export const FractalBackground: React.FC = () => {
    const isDark = useDarkMode();
    return (
        <div className="absolute inset-0 -z-10 w-full h-full pointer-events-none">
            <Canvas camera={{ position: [0, 0, 1] }}>
                <FractalPlane isDark={isDark} />
            </Canvas>
        </div>
    );
};
