/** SI units. Linear shallow-water perturbations on a prescribed steady current.
 * Staggered fluxes, upwind advection, reflecting banks, absorbing end strips.
 * The meander is visually mapped from a rectangular computational channel.
 */
export const NX = 72, NZ = 216, WIDTH = 9, LENGTH = 48;
export const DX = WIDTH / NX, DZ = LENGTH / NZ, G = 9.81;
export const center = (z: number) => 1.65 * Math.sin(z * .115) + .5 * Math.sin(z * .29);
export const breadth = (z: number) => 4.05 + .4 * Math.sin(z * .21 + .5);
export const obstacles = [{ x: -1.65, z: 3, r: .65 }, { x: 1.25, z: -8, r: .48 }, { x: -.55, z: 14, r: .4 }];
export interface RiverSettings { discharge: number; depth: number; wind: number; sun: number; playing: boolean }
export const defaults: RiverSettings = { discharge: 4.8, depth: .65, wind: 1.8, sun: 38, playing: true };
export function meanSpeed(s: RiverSettings) { return s.discharge / (WIDTH * s.depth * (0.35 + 0.65 * 2 / 3)); }
export class RiverPhysics {
    height = new Float32Array(NX * NZ);
    flow = new Float32Array(NX * NZ * 4);
    private u = new Float32Array((NX + 1) * NZ);
    private v = new Float32Array(NX * (NZ + 1));
    private next = new Float32Array(NX * NZ);
    private foamPrev = new Float32Array(NX * NZ);
    private foamNext = new Float32Array(NX * NZ);
    solid = new Uint8Array(NX * NZ);
    private pulse = new Float32Array(NX * NZ);
    private envelope = new Float32Array(NX * NZ);
    time = 0;
    readonly dx: number;
    readonly dz: number;
    constructor(readonly width=WIDTH,readonly length=LENGTH) {
        this.dx=width/NX;this.dz=length/NZ;
        for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
            const x = (i + .5) * DX - WIDTH / 2, z = (j + .5) * DZ - LENGTH / 2;
            this.solid[j * NX + i] = obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r) ? 1 : 0;
        }
    }
    reset() { this.height.fill(0); this.u.fill(0); this.v.fill(0); this.flow.fill(0); this.foamPrev.fill(0); this.foamNext.fill(0); this.time = 0; }
    splash(x: number, z: number, amplitude = .085) {
        const variance=Math.max(.015,.13*(this.width/WIDTH)**2);
        let total=0,weights=0;
        for (let j=0;j<NZ;j++) for (let i=0;i<NX;i++) {
            const k=j*NX+i;
            const r2=((i+.5)*this.dx-this.width/2-x)**2+((j+.5)*this.dz-this.length/2-z)**2;
            const envelope=this.solid[k]?0:Math.exp(-r2/variance);
            this.envelope[k]=envelope;this.pulse[k]=(1-r2/variance)*envelope;
            total+=this.pulse[k];weights+=envelope;
        }
        // Discrete correction conserves volume even beside rocks/banks or on coarse grids.
        if(weights===0)return;
        for(let k=0;k<this.height.length;k++)this.height[k]+=amplitude*(this.pulse[k]-total/weights*this.envelope[k]);
    }
    step(dt: number, s: RiverSettings) {
        const h = this.height, speed = s.discharge / (this.width*s.depth*(.35+.65*2/3));
        this.time += dt;
        for (let j = NZ - 1; j >= 0; j--) for (let i = 1; i < NX; i++) {
            const k = j * NX + i, f = j * (NX + 1) + i;
            this.u[f] = this.solid[k] || this.solid[k - 1] ? 0 : (this.u[f] - dt * G * (h[k] - h[k - 1]) / this.dx - dt * speed * (this.u[f] - (j ? this.u[f - NX - 1] : 0)) / this.dz) * Math.exp(-dt * .7);
        }
        for (let j = NZ - 1; j >= 1; j--) for (let i = 0; i < NX; i++) {
            const k = j * NX + i;
            this.v[k] = this.solid[k] || this.solid[k - NX] ? 0 : (this.v[k] - dt * G * (h[k] - h[k - NX]) / this.dz - dt * speed * (this.v[k] - this.v[k - NX]) / this.dz) * Math.exp(-dt * .7);
        }
        for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
            const k = j * NX + i;
            if (this.solid[k]) { this.next[k] = 0; continue; }
            const lateral = (i + .5) / NX * 2 - 1;
            const depth = s.depth * (.35 + .65 * (1 - lateral * lateral));
            const current = speed * (1.25 - .6 * lateral * lateral) / 1.094255319;
            const depthLeft = s.depth * (1 - .65 * (i / NX * 2 - 1) ** 2);
            const depthRight = s.depth * (1 - .65 * ((i + 1) / NX * 2 - 1) ** 2);
            const divergence = (depthRight * this.u[j * (NX + 1) + i + 1] - depthLeft * this.u[j * (NX + 1) + i]) / this.dx + depth * (this.v[k + NX] - this.v[k]) / this.dz;
            const upstream = j ? h[k - NX] : 0;
            const absorption = Math.max(0, 1 - Math.min(j, NZ - 1 - j) / 18);
            this.next[k] = (h[k] - dt * divergence - dt * current * (h[k] - upstream) / this.dz) * Math.exp(-dt * (absorption * 5 + .12));
        }
        this.height.set(this.next);
        this.updateFlowField(dt, speed, s.depth);
    }
    private updateFlowField(dt: number, speed: number, baseDepth: number) {
        const decay = Math.exp(-dt * (.16 + speed * .025));
        for (let k = 0; k < this.foamPrev.length; k++) this.foamPrev[k] = this.flow[k * 4 + 2];
        const sampleFoam = (x: number, z: number) => {
            const fx = Math.max(0, Math.min(NX - 1.001, x)), fz = Math.max(0, Math.min(NZ - 1.001, z));
            const x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
            const at = (ix: number, iz: number) => this.foamPrev[(Math.max(0, Math.min(NZ - 1, iz)) * NX) + Math.max(0, Math.min(NX - 1, ix))];
            return (at(x0, z0) * (1 - tx) + at(x0 + 1, z0) * tx) * (1 - tz) + (at(x0, z0 + 1) * (1 - tx) + at(x0 + 1, z0 + 1) * tx) * tz;
        };
        for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
            const k = j * NX + i, f = k * 4;
            if (this.solid[k]) { this.flow[f] = this.flow[f + 1] = this.flow[f + 2] = this.flow[f + 3] = 0; continue; }
            const uc = (this.u[j * (NX + 1) + i] + this.u[j * (NX + 1) + i + 1]) * .5;
            const lateral = (i + .5) / NX * 2 - 1;
            const perturbV = (this.v[k] + this.v[k + NX]) * .5;
            const vc = perturbV + speed * (1.25 - .6 * lateral * lateral) / 1.094255319;
            const left = i ? this.height[k - 1] : this.height[k], right = i + 1 < NX ? this.height[k + 1] : this.height[k];
            const up = j ? this.height[k - NX] : this.height[k], down = j + 1 < NZ ? this.height[k + NX] : this.height[k];
            const slope = Math.hypot((right - left) / (2 * this.dx), (down - up) / (2 * this.dz));
            const shear = Math.min(1, Math.hypot(uc, perturbV) / Math.max(.15, speed) * .8);
            const bank = i === 0 || i === NX - 1 || (i && this.solid[k - 1]) || (i + 1 < NX && this.solid[k + 1]) ? 1 : 0;
            const obstacleWake = bank * Math.min(1, Math.hypot(uc, vc) / Math.max(.1, speed));
            const source = Math.min(1, slope * 2.8 + shear * .32 + obstacleWake * .42);
            const backX = i - uc * dt / this.dx, backZ = j - vc * dt / this.dz;
            const carried = sampleFoam(backX, backZ) * decay;
            this.foamNext[k] = Math.max(0, Math.min(1, carried + source * dt * (1.8 + baseDepth * .25)));
            this.flow[f] = uc / Math.max(.1, speed);
            this.flow[f + 1] = vc / Math.max(.1, speed);
            this.flow[f + 2] = this.foamNext[k];
            this.flow[f + 3] = Math.max(0, Math.min(1, 1 - Math.abs((i + .5) / NX * 2 - 1) * .7));
        }
    }
    advance(delta: number, s: RiverSettings) {
        // CFL bounds both wave propagation and transport at every setting.
        const limit = .28 * Math.min(this.dx, this.dz) / (Math.sqrt(G * s.depth) + s.discharge / (this.width*s.depth*(.35+.65*2/3)) * 1.25);
        const duration = Math.min(delta, .05), steps = Math.ceil(duration / limit);
        for (let i = 0; i < steps; i++) this.step(duration / steps, s);
    }
}
