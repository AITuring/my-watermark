import * as THREE from "three";
import type { ShallowWater } from "./ShallowWater";
import { tracedWaveLines } from "./tracedLines";

const MOUNT_WIDTH = 1532;
const MOUNT_HEIGHT = 964;
const PAINTING = { x: 69, y: 39, width: 1380, height: 896 };
const INK_SURFACE_SCALE = 75;

interface Stroke {
    points: ReadonlyArray<readonly [number, number]>;
    moved: Float32Array;
    normals: Float32Array;
    displacement: Float32Array;
    materialX: Float32Array;
    meanVelocity: Float32Array;
    restElevation: Float32Array;
    halfWidth: number;
}

/** Every ink vertex samples the same conserved water surface at its painted
 * position. A shared displacement field keeps adjoining contours together.
 */
export class AnimatedInk {
    readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    readonly strokeCount: number;
    private readonly strokes: Stroke[];
    private readonly positions: Float32Array;
    private readonly positionAttribute: THREE.BufferAttribute;
    private readonly waterSample = new Float32Array(2);

    constructor(private readonly water: ShallowWater) {
        this.strokes = tracedWaveLines.map((points) => {
            const meanY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
            const restElevation = new Float32Array(points.length);
            const displacement = new Float32Array(points.length * 2);
            for (let index = 0; index < points.length; index++) {
                const [x, y] = points[index];
                this.water.sampleMotion(x, y, this.waterSample);
                restElevation[index] = this.waterSample[0];
            }
            return {
                points,
                moved: new Float32Array(points.length * 2),
                normals: new Float32Array(points.length * 2),
                displacement,
                materialX: new Float32Array(points.length),
                meanVelocity: new Float32Array(points.length),
                restElevation,
                halfWidth: (meanY < 500 ? 0.85 : 1.12),
            };
        });
        this.step(0);
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

    step(dt: number) {
        void dt;
        for (const stroke of this.strokes) {
            const { points, displacement, materialX, meanVelocity, restElevation } = stroke;
            for (let index = 0; index < points.length; index++) {
                const [x, y] = points[index];
                this.water.sampleMotion(x + materialX[index], y, this.waterSample);
                // Show the local orbital excursion in a frame following the
                // mean current, so the painting's margin stays in place.
                const velocity = this.waterSample[1] / Math.max(0.05, 1 + this.waterSample[0]);
                meanVelocity[index] += Math.min(1, dt / 1.1) * (velocity - meanVelocity[index]);
                materialX[index] = 1.1 * meanVelocity[index];
                displacement[index * 2] = materialX[index];
                displacement[index * 2 + 1] = -INK_SURFACE_SCALE
                    * (this.waterSample[0] - restElevation[index]);
            }
        }
    }

    updateGeometry() {
        let cursor = 0;
        for (const stroke of this.strokes) {
            const { points, moved, normals } = stroke;
            for (let index = 0; index < points.length; index++) {
                const [x, y] = points[index];
                moved[index * 2] = x + stroke.displacement[index * 2];
                moved[index * 2 + 1] = y + stroke.displacement[index * 2 + 1];
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
