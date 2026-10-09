const INFLOW_SOURCES = [
    { centerY: 430, width: 80, period: 8.7, phase: 0.5, amplitude: 0.22 },
    { centerY: 570, width: 100, period: 10.4, phase: 3.2, amplitude: 0.26 },
    { centerY: 735, width: 105, period: 9.6, phase: 5.1, amplitude: 0.28 },
    { centerY: 850, width: 72, period: 11.3, phase: 2.0, amplitude: 0.22 },
] as const;

/** Linearized, depth-averaged shallow water on a finite-volume grid.
 *
 * eta_t + div(q + U eta ex) = 0
 * q_t + div(U q ex + c² eta I) = -drag q + external momentum
 *
 * Each internal face has one Rusanov flux applied with opposite signs to
 * adjacent cells. This conserves surface volume in the interior. The right
 * boundary is open; the left boundary supplies right-going disturbances.
 */
export class ShallowWater {
    readonly columns = 112;
    readonly rows = 72;
    readonly rgba = new Uint8Array(this.columns * this.rows * 4);

    private readonly dx = 1380 / (this.columns - 1);
    private readonly dy = 896 / (this.rows - 1);
    private readonly c = 55;
    private readonly current = 58;
    private readonly eta = new Float32Array(this.columns * this.rows);
    private readonly qx = new Float32Array(this.columns * this.rows);
    private readonly qy = new Float32Array(this.columns * this.rows);
    private readonly nextEta = new Float32Array(this.columns * this.rows);
    private readonly nextQx = new Float32Array(this.columns * this.rows);
    private readonly nextQy = new Float32Array(this.columns * this.rows);
    private time = 0;

    constructor() {
        // Initial crests lie under the corresponding arcs in the drawing.
        this.seedCrest(180, 605, 95, 63, 65, 0.18);
        this.seedCrest(510, 660, 110, 78, 75, 0.16);
        this.seedCrest(780, 770, 110, 78, 80, 0.20);
        this.seedCrest(1080, 680, 100, 65, 68, 0.15);
        this.writePixels();
    }

    private seedCrest(cx: number, cy: number, sx: number, sy: number, rise: number, amplitude: number) {
        for (let row = 0; row < this.rows; row++) {
            const y = row * this.dy;
            for (let col = 0; col < this.columns; col++) {
                const x = col * this.dx;
                const arcY = cy - rise * Math.exp(-(((x - cx) / (sx * 1.8)) ** 2));
                const pulse = amplitude * Math.exp(-(((x - cx) / sx) ** 2) - (((y - arcY) / sy) ** 2));
                const index = row * this.columns + col;
                this.eta[index] += pulse;
                this.qx[index] += this.c * pulse;
            }
        }
    }

    step(dt: number) {
        // With these grid units, dt = 1/60 s gives CFL < 0.2 in both axes.
        const fx = dt / this.dx;
        const fy = dt / this.dy;
        const waveSpeedX = this.current + this.c;
        const waveSpeedY = this.c;
        const pressure = this.c * this.c;
        const width = this.columns;
        const height = this.rows;
        this.nextEta.set(this.eta);
        this.nextQx.set(this.qx);
        this.nextQy.set(this.qy);

        for (let row = 0; row < height; row++) {
            const offset = row * width;
            for (let col = 0; col < width - 1; col++) {
                const left = offset + col;
                const right = left + 1;
                const eL = this.eta[left];
                const eR = this.eta[right];
                const xL = this.qx[left];
                const xR = this.qx[right];
                const yL = this.qy[left];
                const yR = this.qy[right];
                const mass = 0.5 * (xL + xR + this.current * (eL + eR)) - 0.5 * waveSpeedX * (eR - eL);
                const momentumX = 0.5 * (pressure * (eL + eR) + this.current * (xL + xR))
                    - 0.5 * waveSpeedX * (xR - xL);
                const momentumY = 0.5 * this.current * (yL + yR) - 0.5 * waveSpeedX * (yR - yL);
                this.nextEta[left] -= fx * mass;
                this.nextEta[right] += fx * mass;
                this.nextQx[left] -= fx * momentumX;
                this.nextQx[right] += fx * momentumX;
                this.nextQy[left] -= fx * momentumY;
                this.nextQy[right] += fx * momentumY;
            }
        }

        for (let row = 0; row < height - 1; row++) {
            const offset = row * width;
            for (let col = 0; col < width; col++) {
                const top = offset + col;
                const bottom = top + width;
                const eT = this.eta[top];
                const eB = this.eta[bottom];
                const yT = this.qy[top];
                const yB = this.qy[bottom];
                const mass = 0.5 * (yT + yB) - 0.5 * waveSpeedY * (eB - eT);
                const momentumY = 0.5 * pressure * (eT + eB) - 0.5 * waveSpeedY * (yB - yT);
                this.nextEta[top] -= fy * mass;
                this.nextEta[bottom] += fy * mass;
                this.nextQy[top] -= fy * momentumY;
                this.nextQy[bottom] += fy * momentumY;
            }
        }

        // Reflective top and bottom: normal mass flux is zero, while the
        // pressure flux reverses the transverse momentum at each wall.
        for (let col = 0; col < width; col++) {
            const top = col;
            const bottom = (height - 1) * width + col;
            this.nextQy[top] += fy * (pressure * this.eta[top] - waveSpeedY * this.qy[top]);
            this.nextQy[bottom] -= fy * (pressure * this.eta[bottom] + waveSpeedY * this.qy[bottom]);
        }

        // The left edge admits a right-going characteristic; the right edge
        // lets its outgoing flux leave the painted domain.
        for (let row = 0; row < height; row++) {
            const y = row * this.dy;
            const input = this.inflow(this.time, y);
            const left = row * width;
            const eL = input;
            const xL = this.c * input;
            const eR = this.eta[left];
            const xR = this.qx[left];
            const massIn = 0.5 * (xL + xR + this.current * (eL + eR)) - 0.5 * waveSpeedX * (eR - eL);
            const momentumIn = 0.5 * (pressure * (eL + eR) + this.current * (xL + xR))
                - 0.5 * waveSpeedX * (xR - xL);
            const transverseIn = 0.5 * this.current * this.qy[left] - 0.5 * waveSpeedX * this.qy[left];
            this.nextEta[left] += fx * massIn;
            this.nextQx[left] += fx * momentumIn;
            this.nextQy[left] += fx * transverseIn;

            const right = left + width - 1;
            this.nextEta[right] -= fx * (this.qx[right] + this.current * this.eta[right]);
            this.nextQx[right] -= fx * (pressure * this.eta[right] + this.current * this.qx[right]);
            this.nextQy[right] -= fx * this.current * this.qy[right];
        }

        const drag = Math.exp(-0.20 * dt);
        for (let index = 0; index < this.eta.length; index++) {
            this.eta[index] = this.nextEta[index];
            this.qx[index] = this.nextQx[index] * drag;
            this.qy[index] = this.nextQy[index] * drag;
        }
        this.time += dt;
    }

    private inflow(time: number, y: number) {
        // Unequal timing prevents the whole picture from rising in unison.
        let value = 0;
        for (const source of INFLOW_SOURCES) {
            const cycle = ((time - source.phase) % source.period + source.period) % source.period;
            const distance = Math.min(cycle, source.period - cycle);
            const temporal = Math.exp(-((distance / 0.52) ** 2));
            const transverse = Math.exp(-(((y - source.centerY) / source.width) ** 2));
            value += source.amplitude * temporal * transverse;
        }
        return value;
    }

    writePixels() {
        for (let index = 0; index < this.eta.length; index++) {
            const out = index * 4;
            this.rgba[out] = Math.max(0, Math.min(255, Math.round((this.eta[index] + 0.5) * 255)));
            this.rgba[out + 1] = Math.max(0, Math.min(255, Math.round((this.qx[index] / 70 + 0.5) * 255)));
            this.rgba[out + 2] = Math.max(0, Math.min(255, Math.round((this.qy[index] / 70 + 0.5) * 255)));
            this.rgba[out + 3] = 255;
        }
    }
}
