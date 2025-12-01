import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface GenerativeBackgroundHandle {
    addDuck: (x: number, y: number) => void;
}

const GenerativeBackground = forwardRef<GenerativeBackgroundHandle, {}>((props, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const addDuckInternal = useRef<((x: number, y: number) => void) | null>(null);

    useImperativeHandle(ref, () => ({
        addDuck: (clientX, clientY) => {
            if (addDuckInternal.current && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const x = clientX - rect.left;
                const y = clientY - rect.top;
                addDuckInternal.current(x, y);
            }
        }
    }));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('resize', resize);
        resize();

        // --- Duck SVG Image ---
        const duckSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 36 36"><path fill="#D99E82" d="M12.75 17.75c1.226 2.195 1.856-1.361 9.312-2.625s13.729 4.454 13.859 5.413c.132.958-4.447 9.462-9.462 9.462H10.75c-4.143 0-7.022-7.224-4-11.438c0 0 4.5-3.5 6-.812"/><path fill="#C1694F" d="M13.008 18.136C8.02 25.073 6.969 30 10.75 30c-4.143 0-6.578-6.188-4.468-11.031c.463-1.064 1.758-2.492 1.758-2.492l4.179-.008c.162.32.599 1.365.789 1.667"/><path fill="#E1E8ED" d="M20.062 22.75c6.672-2.682 15.729-3.171 15.859-2.212c.132.958-4.447 9.462-9.462 9.462H11.813c-4.143 0 1.232-4.429 8.249-7.25"/><path fill="#292F33" d="M25.359 21.125c6-1.312 10.468-1.282 10.563-.587c.079.578-1.559 3.907-3.973 6.454c2.204-2.804 1.42-6.113-6.59-5.867"/><path fill="#3E721D" d="M7.125 6.125c1.562-4.938 10.44-4.143 10.062.688c-.378 4.829-6.453 7.859-4.179 11.323c-1.586 1.38-5.016.913-6.727.833a156 156 0 0 1 1.812-3.406c2.916-5.235-2.131-5.764-.968-9.438"/><path fill="#FFCC4D" d="M1.893 9.045c.568-1.1.549.106 3.352.142c1.554.021 1.463-.56 1.664-1.621c.041-.223.776 1.616 2.061 1.807c3.554.531 1.879 1.94 0 2.261c-.901.154-2.01.318-3.938.155c-2.519-.212-3.768-1.528-3.139-2.744"/><path fill="#F5F8FA" d="M12.502 16.625c.044.625.506 1.511.506 1.511c-1.016 1.474-5.643 3.017-7.354 2.93a7.7 7.7 0 0 1 .627-2.097c1.844-.471 4.661-1.071 6.221-2.344"/><path fill="#292F33" d="M11.708 6.151a1.296 1.296 0 1 1-2.591 0a1.296 1.296 0 0 1 2.591 0"/></svg>`;
        const duckImg = new Image();
        duckImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(duckSvg)}`;

        // --- Noise Function (Simplex-like pseudo noise) ---
        const perm = new Uint8Array(512);
        const p = new Uint8Array(256);
        for(let i=0; i<256; i++) p[i] = i;
        // Shuffle
        for(let i=255; i>0; i--) {
            const r = Math.floor(Math.random() * (i+1));
            [p[i], p[r]] = [p[r], p[i]];
        }
        for(let i=0; i<512; i++) perm[i] = p[i & 255];

        const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
        const lerp = (t: number, a: number, b: number) => a + t * (b - a);
        const grad = (hash: number, x: number, y: number, z: number) => {
            const h = hash & 15;
            const u = h < 8 ? x : y;
            const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        };

        const noise = (x: number, y: number, z: number) => {
            const X = Math.floor(x) & 255;
            const Y = Math.floor(y) & 255;
            const Z = Math.floor(z) & 255;
            x -= Math.floor(x);
            y -= Math.floor(y);
            z -= Math.floor(z);
            const u = fade(x);
            const v = fade(y);
            const w = fade(z);
            const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
            const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;

            return lerp(w,
                lerp(v, lerp(u, grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z)),
                    lerp(u, grad(perm[AB], x, y + 1, z), grad(perm[BB], x - 1, y + 1, z))),
                lerp(v, lerp(u, grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1)),
                    lerp(u, grad(perm[AB + 1], x, y + 1, z - 1), grad(perm[BB + 1], x - 1, y + 1, z - 1))));
        };

        // --- Duck System ---
        interface Duck {
            layerIndex: number;
            x: number; // Screen X
            y: number;
            rotation: number;
            scale: number;
            direction: number; // 1 or -1
        }
        const ducks: Duck[] = [];

        const spawnDuck = (clickX: number, clickY: number) => {
             // Find closest layer
            let closestDist = Infinity;
            let closestLayerIndex = -1;

            layers.forEach((layer, index) => {
                const dist = Math.abs(layer.baseY - clickY);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestLayerIndex = index;
                }
            });

            if (closestLayerIndex !== -1) {
                const layer = layers[closestLayerIndex];
                // Scale based on depth (progress)
                const progress = layer.baseY / height;
                const scale = 0.6 + progress * 0.8;

                ducks.push({
                    layerIndex: closestLayerIndex,
                    x: clickX,
                    y: layer.baseY,
                    rotation: 0,
                    scale: scale,
                    direction: 1 // Always move right (downstream)
                });
            }
        };
        addDuckInternal.current = spawnDuck;

        const handleMouseDown = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            const clickX = e.clientX - rect.left;
            spawnDuck(clickX, clickY);
        };
        window.addEventListener('mousedown', handleMouseDown);

        // --- Smooth Flowing Water System (No Looping) ---

        interface Point {
            x: number;
            y: number; // Actual render Y
            baseY: number; // Original grid Y
        }

        interface WaterLayer {
            baseY: number;
            speedMultiplier: number;
            ampMultiplier: number;
            pointGap: number; // Store for optimization
            points: Point[];
        }

        const layers: WaterLayer[] = [];

        const initLayers = () => {
            layers.length = 0;
            // Perspective setup:
            // Top (Horizon): Gap is smaller
            // Bottom (Foreground): Gap is larger

            let currentY = 0;
            let gap = 15;
            const height = window.innerHeight;
            const width = window.innerWidth;

            while (currentY < height + 50) {
                // Non-linear gap for perspective
                // As we go down (y increases), gap increases
                const progress = currentY / height;
                gap = 15 + progress * 25; // Gap ranges from 15px to 40px

                const points: Point[] = [];
                const pointGap = 10 + progress * 10; // Point resolution also drops for foreground (optimization + style)

                for (let x = -50; x < width + 50; x += pointGap) {
                    points.push({ x, y: currentY, baseY: currentY });
                }

                layers.push({
                    baseY: currentY,
                    // Foreground moves faster and has higher amplitude
                    speedMultiplier: 0.5 + progress * 1.0,
                    ampMultiplier: 0.3 + progress * 1.5,
                    pointGap,
                    points
                });

                currentY += gap;
            }
        };
        initLayers();

        let time = 0;

        const animate = () => {
            // Clear
            ctx.fillStyle = '#f4f1ea';
            ctx.fillRect(0, 0, width, height);

            time += 0.015; // Consistent time step

            layers.forEach((layer, i) => {
                ctx.beginPath();

                // Visual style based on depth
                // Foreground: Darker, thicker
                // Background: Lighter, thinner
                const progress = layer.baseY / height;
                ctx.strokeStyle = `rgba(40, 45, 50, ${0.2 + progress * 0.4})`;
                ctx.lineWidth = 0.8 + progress * 1.2;

                let first = true;

                for (let j = 0; j < layer.points.length; j++) {
                    const p = layer.points[j];

                    // --- Wave Function Summation ---
                    // We sum multiple sine waves to create a complex but smooth surface
                    // No X-displacement to strictly prevent looping/knotting

                    // 1. The Swell (Long, Slow)
                    // Use (- time) for Left -> Right flow
                    const wave1 = Math.sin(p.x * 0.002 - time * layer.speedMultiplier) * 20;

                    // 2. The Chop (Medium, Faster)
                    const wave2 = Math.sin(p.x * 0.006 - time * layer.speedMultiplier * 1.5 + i * 0.2) * 10;

                    // 3. The Ripple (Short, Fast)
                    const wave3 = Math.sin(p.x * 0.015 - time * layer.speedMultiplier * 2.0) * 4;

                    // 4. Noise (Texture)
                    // Adds organic irregularity so it doesn't look like pure math
                    const n = noise(p.x * 0.005, i * 0.1, time * 0.2) * 10;

                    // Combine
                    const displacement = (wave1 + wave2 + wave3 + n) * layer.ampMultiplier;
                    p.y = layer.baseY + displacement;

                    if (first) {
                        ctx.moveTo(p.x, p.y);
                        first = false;
                    } else {
                         // Smooth curves
                        const prevP = layer.points[j - 1];
                        const midX = (prevP.x + p.x) / 2;
                        const midY = (prevP.y + p.y) / 2;
                        ctx.quadraticCurveTo(prevP.x, prevP.y, midX, midY);
                    }
                }

                // Finish line
                const lastP = layer.points[layer.points.length - 1];
                ctx.lineTo(lastP.x, lastP.y);
                ctx.stroke();
            });

            // Update and Draw Ducks
            // Iterate backwards to safely splice
            for (let i = ducks.length - 1; i >= 0; i--) {
                const duck = ducks[i];
                const layer = layers[duck.layerIndex];

                if (!layer) {
                    ducks.splice(i, 1);
                    continue;
                }

                // Drift logic
                duck.x += duck.direction * 0.3;

                // Optimized Positioning (O(1))
                // Calculate index based on grid structure
                const startX = -50;
                const exactIndex = (duck.x - startX) / layer.pointGap;
                const index1 = Math.floor(exactIndex);
                const index2 = index1 + 1;

                if (index1 >= 0 && index2 < layer.points.length) {
                    const p1 = layer.points[index1];
                    const p2 = layer.points[index2];
                    const t = exactIndex - index1;

                    // Interpolate Y
                    duck.y = p1.y + (p2.y - p1.y) * t;

                    // Calculate rotation
                    const slope = (p2.y - p1.y) / (p2.x - p1.x);
                    duck.rotation = Math.atan(slope);
                } else {
                    // Off grid
                    ducks.splice(i, 1);
                    continue;
                }

                // Screen bounds check
                if (duck.x < -50 || duck.x > width + 50) {
                    ducks.splice(i, 1);
                    continue;
                }

                // Draw Duck - SVG Image
                ctx.save();
                ctx.translate(duck.x, duck.y);
                ctx.rotate(duck.rotation);
                ctx.scale(duck.scale, duck.scale);

                // The Duck SVG faces LEFT by default.
                // Since we are moving RIGHT (direction = 1), we MUST flip it to face Right.
                ctx.scale(-1, 1);

                // Draw the image centered
                // SVG is 32x32, but we want to center it.
                // Let's offset by -16, -16 relative to the translated point
                // We also offset Y slightly (-10) to make it sit "on" the water rather than "in" it
                ctx.drawImage(duckImg, -16, -24, 32, 32);

                ctx.restore();
            }

            animationId = requestAnimationFrame(animate);
        };

        let animationId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousedown', handleMouseDown);
            cancelAnimationFrame(animationId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            style={{ opacity: 0.6 }} // Subtle blending
        />
    );
});

export default GenerativeBackground;
