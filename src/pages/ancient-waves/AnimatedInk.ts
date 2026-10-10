import * as THREE from "three";
import { ShallowWater } from "./ShallowWater";
import { tracedWaveLines } from "./tracedLines";

const MOUNT_WIDTH = 1532;
const MOUNT_HEIGHT = 964;
const PAINTING = { x: 69, y: 39, width: 1380, height: 896 };

interface Stroke {
    points: ReadonlyArray<readonly [number, number]>;
    moved: Float32Array;
    normals: Float32Array;
    displacement: Float32Array;
    velocity: Float32Array;
    nextDisplacement: Float32Array;
    sourceWeights: Float32Array;
    response: number;
    halfWidth: number;
    waveCoefficient: number;
    restoring: number;
    damping: number;
    driveFrequency: number;
    drivePhase: number;
    driveAmplitude: number;
    long: boolean;
}

/** Each traced wave contour is its own damped one-dimensional wave system.
 * Local water pressure and a left-side wavemaker excite it; contour geometry
 * determines its propagation speed, restoring force, and drag.
 */
export class AnimatedInk {
    readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    readonly strokeCount: number;
    private readonly strokes: Stroke[];
    private readonly positions: Float32Array;
    private readonly positionAttribute: THREE.BufferAttribute;
    private readonly sampledMotion = new Float32Array(2);
    private time = 0;

    constructor() {
        this.strokes = tracedWaveLines.map((points) => {
            const meanY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
            const arclength = new Float32Array(points.length);
            let sourceIndex = 0;
            let leftmostX = Infinity;
            let minimumY = Infinity;
            let maximumY = -Infinity;
            for (let index = 1; index < points.length; index++) {
                arclength[index] = arclength[index - 1] + Math.hypot(
                    points[index][0] - points[index - 1][0],
                    points[index][1] - points[index - 1][1],
                );
            }
            for (let index = 0; index < points.length; index++) {
                if (points[index][0] < leftmostX) {
                    leftmostX = points[index][0];
                    sourceIndex = index;
                }
                minimumY = Math.min(minimumY, points[index][1]);
                maximumY = Math.max(maximumY, points[index][1]);
            }
            const totalLength = arclength[arclength.length - 1];
            const bend = Math.min(1, (maximumY - minimumY) / Math.max(20, totalLength));
            const naturalFrequency = Math.sqrt(270 * 2 * Math.PI
                / Math.max(100, Math.min(360, totalLength * 1.4)));
            const propagationSpeed = 48 + 23 * Math.min(1, totalLength / 250) + 8 * bend;
            const spacing = Math.max(2.5, totalLength / Math.max(1, points.length - 1));
            const long = totalLength >= 70;
            const sourceArc = arclength[sourceIndex];
            const sourceSpread = Math.max(12, Math.min(38, totalLength * 0.18));
            const sourceWeights = new Float32Array(points.length);
            for (let index = 0; index < points.length; index++) {
                const distance = (arclength[index] - sourceArc) / sourceSpread;
                sourceWeights[index] = long ? Math.exp(-(distance ** 2)) : 1;
            }
            return {
                points,
                moved: new Float32Array(points.length * 2),
                normals: new Float32Array(points.length * 2),
                displacement: new Float32Array(points.length),
                velocity: new Float32Array(points.length),
                nextDisplacement: new Float32Array(points.length),
                sourceWeights,
                response: 0.70 + 0.30 * Math.min(1, meanY / PAINTING.height),
                halfWidth: (meanY < 500 ? 0.85 : 1.12),
                waveCoefficient: (propagationSpeed / spacing) ** 2,
                restoring: (naturalFrequency * 0.72) ** 2,
                damping: 0.75 + 0.55 * bend + 0.25 * Math.min(1, totalLength / 250),
                driveFrequency: naturalFrequency * (0.62 + 0.12 * bend),
                drivePhase: leftmostX * 0.018 + meanY * 0.012 + totalLength * 0.019 + bend * 3,
                driveAmplitude: 3.5 + 5.5 * Math.min(1, totalLength / 200),
                long,
            };
        });
        this.strokeCount = this.strokes.length;
        const segmentCount = this.strokes.reduce((sum, stroke) => sum + stroke.points.length - 1, 0);
        this.positions = new Float32Array(segmentCount * 18);
        this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
        this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", this.positionAttribute);
        geometry.setDrawRange(0, segmentCount * 6);
        const material = new THREE.MeshBasicMaterial({
            color: 0x343832,
            transparent: true,
            opacity: 0.64,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.renderOrder = 2;
        this.mesh.frustumCulled = false;
    }

    step(water: ShallowWater, dt: number) {
        this.time += dt;
        for (const stroke of this.strokes) {
            const { points, displacement, velocity, nextDisplacement, sourceWeights } = stroke;
            const phase = stroke.driveFrequency * this.time + stroke.drivePhase;
            const incomingCrest = stroke.driveAmplitude
                * (Math.sin(phase) + 0.24 * Math.sin(2 * phase - 0.25));
            for (let index = 0; index < points.length; index++) {
                if (stroke.long && (index === 0 || index === points.length - 1)) {
                    velocity[index] = 0;
                    nextDisplacement[index] = 0;
                    continue;
                }
                const [x, y] = points[index];
                water.sampleMotion(x, y, this.sampledMotion);
                const left = displacement[Math.max(0, index - 1)];
                const right = displacement[Math.min(points.length - 1, index + 1)];
                const laplacian = left - 2 * displacement[index] + right;
                const waterPressure = -this.sampledMotion[0] * 65;
                const acceleration = stroke.waveCoefficient * laplacian
                    - stroke.restoring * displacement[index]
                    - stroke.damping * velocity[index]
                    + 6 * waterPressure * stroke.response
                    + 20 * sourceWeights[index] * (incomingCrest - displacement[index]);
                velocity[index] = Math.max(-95, Math.min(95, velocity[index] + acceleration * dt));
                nextDisplacement[index] = Math.max(-20, Math.min(20,
                    displacement[index] + velocity[index] * dt));
            }
            displacement.set(nextDisplacement);
        }
    }

    updateGeometry() {
        let cursor = 0;
        for (const stroke of this.strokes) {
            const { points, moved, normals } = stroke;
            for (let index = 0; index < points.length; index++) {
                const [x, y] = points[index];
                moved[index * 2] = x;
                const lowerEdgeResponse = Math.min(1, Math.max(0, (PAINTING.height - 1 - y) / 20));
                moved[index * 2 + 1] = y + stroke.displacement[index] * lowerEdgeResponse;
            }
            for (let index = 0; index < points.length; index++) {
                const before = Math.max(0, index - 1) * 2;
                const after = Math.min(points.length - 1, index + 1) * 2;
                const dx = moved[after] - moved[before];
                const dy = moved[after + 1] - moved[before + 1];
                const length = Math.max(0.001, Math.hypot(dx, dy));
                normals[index * 2] = -dy / length * stroke.halfWidth;
                normals[index * 2 + 1] = dx / length * stroke.halfWidth;
            }
            for (let index = 0; index < points.length - 1; index++) {
                const a = index * 2;
                const b = a + 2;
                const ax = PAINTING.x + moved[a] - MOUNT_WIDTH / 2;
                const ay = MOUNT_HEIGHT / 2 - PAINTING.y - moved[a + 1];
                const bx = PAINTING.x + moved[b] - MOUNT_WIDTH / 2;
                const by = MOUNT_HEIGHT / 2 - PAINTING.y - moved[b + 1];
                const anx = normals[a];
                const any = -normals[a + 1];
                const bnx = normals[b];
                const bny = -normals[b + 1];
                this.positions[cursor++] = ax + anx;
                this.positions[cursor++] = ay + any;
                this.positions[cursor++] = 20;
                this.positions[cursor++] = ax - anx;
                this.positions[cursor++] = ay - any;
                this.positions[cursor++] = 20;
                this.positions[cursor++] = bx + bnx;
                this.positions[cursor++] = by + bny;
                this.positions[cursor++] = 20;
                this.positions[cursor++] = bx + bnx;
                this.positions[cursor++] = by + bny;
                this.positions[cursor++] = 20;
                this.positions[cursor++] = ax - anx;
                this.positions[cursor++] = ay - any;
                this.positions[cursor++] = 20;
                this.positions[cursor++] = bx - bnx;
                this.positions[cursor++] = by - bny;
                this.positions[cursor++] = 20;
            }
        }
        this.positionAttribute.needsUpdate = true;
    }

    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
