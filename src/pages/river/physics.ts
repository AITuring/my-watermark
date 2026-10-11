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
    private u = new Float32Array((NX + 1) * NZ);
    private v = new Float32Array(NX * (NZ + 1));
    private next = new Float32Array(NX * NZ);
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
    reset() { this.height.fill(0); this.u.fill(0); this.v.fill(0); this.time = 0; }
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
    }
    advance(delta: number, s: RiverSettings) {
        // CFL bounds both wave propagation and transport at every setting.
        const limit = .28 * Math.min(this.dx, this.dz) / (Math.sqrt(G * s.depth) + s.discharge / (this.width*s.depth*(.35+.65*2/3)) * 1.25);
        const duration = Math.min(delta, .05), steps = Math.ceil(duration / limit);
        for (let i = 0; i < steps; i++) this.step(duration / steps, s);
    }
}
