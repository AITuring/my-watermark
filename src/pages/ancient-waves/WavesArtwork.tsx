import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { AnimatedInk } from "./AnimatedInk";
import { BreakingWater } from "./BreakingWater";
import { ShallowWater } from "./ShallowWater";

const WIDTH = 1532;
const HEIGHT = 964;
const PAINTING = { x: 69, y: 39, width: 1380, height: 896 };
const MAX_BREAK_SEGMENTS = 1200;

const paperVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const paperFragmentShader = `
uniform sampler2D uPaper;
varying vec2 vUv;
void main() {
    gl_FragColor = texture2D(uPaper, vUv);
    #include <colorspace_fragment>
}
`;

function makePaperTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D is unavailable");

    const mount = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
    mount.addColorStop(0, "#d7cbb8");
    mount.addColorStop(0.55, "#d1c4b0");
    mount.addColorStop(1, "#c7bba8");
    context.fillStyle = mount;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = "rgba(54, 45, 37, 0.12)";
    context.fillRect(67, 37, 1384, 900);

    const paper = context.createLinearGradient(69, 39, 1449, 935);
    paper.addColorStop(0, "#988a75");
    paper.addColorStop(0.54, "#877e6c");
    paper.addColorStop(1, "#766e60");
    context.fillStyle = paper;
    context.fillRect(PAINTING.x, PAINTING.y, PAINTING.width, PAINTING.height);

    const wash = context.createLinearGradient(0, 39, 0, 935);
    wash.addColorStop(0, "rgba(64, 63, 54, 0.03)");
    wash.addColorStop(0.5, "rgba(69, 70, 60, 0.015)");
    wash.addColorStop(1, "rgba(46, 48, 42, 0.12)");
    context.fillStyle = wash;
    context.fillRect(PAINTING.x, PAINTING.y, PAINTING.width, PAINTING.height);

    const fold = context.createLinearGradient(742, 0, 774, 0);
    fold.addColorStop(0, "rgba(35, 32, 28, 0)");
    fold.addColorStop(0.45, "rgba(35, 32, 28, 0.045)");
    fold.addColorStop(0.62, "rgba(231, 218, 192, 0.04)");
    fold.addColorStop(1, "rgba(231, 218, 192, 0)");
    context.fillStyle = fold;
    context.fillRect(742, 39, 32, 896);

    const pixels = context.getImageData(0, 0, WIDTH, HEIGHT);
    let seed = 1701;
    for (let i = 0; i < pixels.data.length; i += 4) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        const grain = ((seed >>> 24) - 128) * 0.035;
        pixels.data[i] += grain;
        pixels.data[i + 1] += grain;
        pixels.data[i + 2] += grain;
    }
    context.putImageData(pixels, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

interface WavesArtworkProps {
    playing: boolean;
    canvasRef: MutableRefObject<HTMLCanvasElement | null>;
}

export default function WavesArtwork({ playing, canvasRef }: WavesArtworkProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playingRef = useRef(playing);

    useEffect(() => {
        playingRef.current = playing;
    }, [playing]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let renderer: THREE.WebGLRenderer;
        let paper: THREE.CanvasTexture;
        try {
            paper = makePaperTexture();
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
        } catch (error) {
            container.textContent = "当前浏览器无法显示水纹动画";
            console.error(error);
            return;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.autoClear = false;
        renderer.domElement.setAttribute("role", "img");
        renderer.domElement.setAttribute("aria-label", "无题字的原画水纹；每根墨线随波浪起伏，浪尖向右翻卷破碎");
        container.append(renderer.domElement);
        canvasRef.current = renderer.domElement;

        const paperScene = new THREE.Scene();
        const paperCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const paperGeometry = new THREE.PlaneGeometry(2, 2);
        const paperMaterial = new THREE.ShaderMaterial({
            vertexShader: paperVertexShader,
            fragmentShader: paperFragmentShader,
            uniforms: { uPaper: { value: paper } },
            depthTest: false,
            depthWrite: false,
        });
        paperScene.add(new THREE.Mesh(paperGeometry, paperMaterial));

        const water = new ShallowWater();
        const breakingWater = new BreakingWater();

        const waterScene = new THREE.Scene();
        const waterCamera = new THREE.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 1, 1000);
        waterCamera.position.z = 500;
        waterCamera.lookAt(0, 0, 0);
        const animatedInk = new AnimatedInk();
        animatedInk.updateGeometry();
        waterScene.add(animatedInk.mesh);

        // A separate particle surface can fold over itself; a height-field mesh cannot.
        const breakPositions = new Float32Array(MAX_BREAK_SEGMENTS * 6 * 3);
        const breakAttribute = new THREE.BufferAttribute(breakPositions, 3);
        breakAttribute.setUsage(THREE.DynamicDrawUsage);
        const breakGeometry = new THREE.BufferGeometry();
        breakGeometry.setAttribute("position", breakAttribute);
        breakGeometry.setDrawRange(0, 0);
        const breakMaterial = new THREE.MeshBasicMaterial({
            color: 0x343832,
            transparent: true,
            opacity: 0.72,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        const breakMesh = new THREE.Mesh(breakGeometry, breakMaterial);
        breakMesh.renderOrder = 5;
        breakMesh.frustumCulled = false;
        waterScene.add(breakMesh);

        const updateBreakingGeometry = () => {
            let segments = 0;
            breakingWater.forEachInkSegment((ax, ay, bx, by, width) => {
                if (segments >= MAX_BREAK_SEGMENTS || ax < 0 || bx >= PAINTING.width
                    || ay < 0 || by < 0 || ay >= PAINTING.height || by >= PAINTING.height) return;
                const dx = bx - ax;
                const dy = by - ay;
                const length = Math.hypot(dx, dy);
                if (length < 0.01) return;
                const nx = -dy / length * width * 0.5;
                const ny = dx / length * width * 0.5;
                const x1 = PAINTING.x + ax + nx - WIDTH / 2;
                const y1 = HEIGHT / 2 - PAINTING.y - ay - ny;
                const x2 = PAINTING.x + ax - nx - WIDTH / 2;
                const y2 = HEIGHT / 2 - PAINTING.y - ay + ny;
                const x3 = PAINTING.x + bx + nx - WIDTH / 2;
                const y3 = HEIGHT / 2 - PAINTING.y - by - ny;
                const x4 = PAINTING.x + bx - nx - WIDTH / 2;
                const y4 = HEIGHT / 2 - PAINTING.y - by + ny;
                const offset = segments * 18;
                breakPositions.set([
                    x1, y1, 80, x2, y2, 80, x3, y3, 80,
                    x3, y3, 80, x2, y2, 80, x4, y4, 80,
                ], offset);
                segments++;
            });
            breakGeometry.setDrawRange(0, segments * 6);
            breakAttribute.needsUpdate = true;
        };

        const render = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            renderer.setViewport(0, 0, width, height);
            renderer.clear();
            renderer.render(paperScene, paperCamera);
            renderer.clearDepth();
            renderer.render(waterScene, waterCamera);
        };
        const resize = () => {
            renderer.setSize(container.clientWidth, container.clientHeight, false);
            render();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();

        let frame = 0;
        let accumulator = 0;
        let previous = performance.now();
        const animate = (now: number) => {
            const delta = Math.min((now - previous) / 1000, 0.05);
            previous = now;
            if (playingRef.current) {
                accumulator += delta;
                while (accumulator >= 1 / 60) {
                    water.step(1 / 60);
                    breakingWater.step(1 / 60, water);
                    animatedInk.step(water, 1 / 60);
                    accumulator -= 1 / 60;
                }
                animatedInk.updateGeometry();
                updateBreakingGeometry();
                render();
            }
            frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            canvasRef.current = null;
            container.removeChild(renderer.domElement);
            paperGeometry.dispose();
            paperMaterial.dispose();
            animatedInk.dispose();
            breakGeometry.dispose();
            breakMaterial.dispose();
            paper.dispose();
            renderer.dispose();
        };
    }, [canvasRef]);

    return <div className="ancient-waves-canvas" ref={containerRef} />;
}
