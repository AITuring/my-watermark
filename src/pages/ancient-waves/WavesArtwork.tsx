import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { ShallowWater } from "./ShallowWater";
import { tracedWavePaths } from "./tracedPaths";

const WIDTH = 1532;
const HEIGHT = 964;
const PAINTING = { x: 69, y: 39, width: 1380, height: 896 };

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

const waveVertexShader = `
uniform sampler2D uFlow;
varying vec2 vUv;
varying vec2 vSlope;
varying float vWave;

// Raised, curved crest bands follow the major arcs in the painting.
float crest(vec2 p, vec4 shape, float rise, float height) {
    float dx = (p.x - shape.x) / shape.z;
    float center = shape.y - rise * exp(-dx * dx);
    float across = (p.y - center) / shape.w;
    float extent = exp(-pow(abs(dx) * 0.72, 4.0));
    return height * exp(-across * across) * extent;
}

float paintedRelief(vec2 p) {
    float h = 0.0;
    h += crest(p, vec4(425.0, 490.0, 290.0, 52.0), 90.0, 8.0);
    h += crest(p, vec4(800.0, 510.0, 300.0, 58.0), 100.0, 8.0);
    h += crest(p, vec4(1150.0, 490.0, 290.0, 55.0), 88.0, 7.0);
    h += crest(p, vec4(245.0, 610.0, 250.0, 72.0), 105.0, 17.0);
    h += crest(p, vec4(600.0, 660.0, 300.0, 75.0), 112.0, 17.0);
    h += crest(p, vec4(1010.0, 665.0, 270.0, 72.0), 105.0, 18.0);
    h += crest(p, vec4(160.0, 790.0, 260.0, 86.0), 100.0, 19.0);
    h += crest(p, vec4(515.0, 840.0, 270.0, 86.0), 110.0, 18.0);
    h += crest(p, vec4(850.0, 815.0, 255.0, 80.0), 93.0, 19.0);
    h += crest(p, vec4(1230.0, 820.0, 250.0, 78.0), 103.0, 18.0);
    return h;
}

vec2 waterState(vec2 p) {
    vec2 uv = clamp(vec2(p.x / 1380.0, p.y / 896.0), 0.0, 1.0);
    vec4 state = texture2D(uFlow, uv);
    return vec2(state.r - 0.5, (state.g - 0.5) * 70.0);
}

float surfaceHeight(vec2 p) {
    float activeWater = smoothstep(270.0, 490.0, p.y);
    return paintedRelief(p) + waterState(p).x * 230.0 * activeWater;
}

void main() {
    vUv = uv;
    vec2 p = vec2(uv.x * 1380.0, (1.0 - uv.y) * 896.0);
    vec2 state = waterState(p);
    float activeWater = smoothstep(270.0, 490.0, p.y);
    float height = surfaceHeight(p);
    float stepSize = 9.0;
    vSlope = vec2(
        (surfaceHeight(p + vec2(stepSize, 0.0)) - surfaceHeight(p - vec2(stepSize, 0.0))) / (2.0 * stepSize),
        (surfaceHeight(p + vec2(0.0, stepSize)) - surfaceHeight(p - vec2(0.0, stepSize))) / (2.0 * stepSize)
    );
    vWave = state.x * activeWater;
    // Only the solved free surface moves; paper and the major painted crests stay put.
    float edgeFade = smoothstep(0.0, 40.0, p.x)
        * (1.0 - smoothstep(1340.0, 1380.0, p.x))
        * (1.0 - smoothstep(856.0, 896.0, p.y));
    gl_Position = projectionMatrix * modelViewMatrix
        * vec4(position.xy + vec2(state.y * 0.85, state.x * 225.0) * activeWater * edgeFade, height, 1.0);
}
`;

const waveFragmentShader = `
uniform sampler2D uPaper;
uniform sampler2D uInk;
uniform vec2 uViewport;
varying vec2 vUv;
varying vec2 vSlope;
varying float vWave;

void main() {
    vec2 point = vec2(vUv.x * 1380.0, (1.0 - vUv.y) * 896.0);
    float waveDepth = smoothstep(290.0, 650.0, point.y);
    vec4 ink = texture2D(uInk, vUv);
    // Read paper in screen space so the mount and grain never move with the water.
    vec2 paperUv = gl_FragCoord.xy / uViewport;
    vec3 paper = texture2D(uPaper, paperUv).rgb;
    vec3 normal = normalize(vec3(-vSlope.x, -vSlope.y, 1.0));
    float diffuse = dot(normal, normalize(vec3(-0.58, -0.30, 0.76)));
    float reliefShade = clamp((diffuse - 0.72) * 1.5, -0.28, 0.22);
    float shaded = 1.0 + waveDepth * reliefShade + clamp(vWave * 0.12, -0.025, 0.045);
    vec3 color = mix(paper * shaded, ink.rgb, ink.a);
    gl_FragColor = vec4(color, 1.0);
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

function makeInkTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = PAINTING.width;
    canvas.height = PAINTING.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    context.fillStyle = "rgba(52, 56, 50, 0.62)";
    context.fill(new Path2D(tracedWavePaths));

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
        let ink: THREE.CanvasTexture;
        try {
            paper = makePaperTexture();
            ink = makeInkTexture();
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
        renderer.domElement.setAttribute("aria-label", "无题字的原画水纹；墨线上的流动从左向右传递");
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
        const flow = new THREE.DataTexture(water.rgba, water.columns, water.rows, THREE.RGBAFormat);
        flow.minFilter = THREE.LinearFilter;
        flow.magFilter = THREE.LinearFilter;
        flow.generateMipmaps = false;
        flow.needsUpdate = true;

        const waterScene = new THREE.Scene();
        const waterCamera = new THREE.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 1, 1000);
        waterCamera.position.z = 500;
        waterCamera.lookAt(0, 0, 0);
        const waveGeometry = new THREE.PlaneGeometry(PAINTING.width, PAINTING.height, 140, 105);
        const waveMaterial = new THREE.ShaderMaterial({
            vertexShader: waveVertexShader,
            fragmentShader: waveFragmentShader,
            uniforms: {
                uPaper: { value: paper },
                uInk: { value: ink },
                uFlow: { value: flow },
                uViewport: { value: new THREE.Vector2(1, 1) },
            },
            depthTest: false,
            depthWrite: false,
        });
        const waveMesh = new THREE.Mesh(waveGeometry, waveMaterial);
        waveMesh.position.set(PAINTING.x + PAINTING.width / 2 - WIDTH / 2,
            HEIGHT / 2 - PAINTING.y - PAINTING.height / 2, 0);
        waveMesh.frustumCulled = false;
        waterScene.add(waveMesh);

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
            renderer.getDrawingBufferSize(waveMaterial.uniforms.uViewport.value);
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
                    accumulator -= 1 / 60;
                }
                water.writePixels();
                flow.needsUpdate = true;
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
            waveGeometry.dispose();
            waveMaterial.dispose();
            flow.dispose();
            paper.dispose();
            ink.dispose();
            renderer.dispose();
        };
    }, [canvasRef]);

    return <div className="ancient-waves-canvas" ref={containerRef} />;
}
