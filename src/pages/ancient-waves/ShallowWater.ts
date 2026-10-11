const INFLOW_SOURCES = [
    { centerY: 430, width: 80, period: 8.7, phase: 0.5, amplitude: 0.22 },
    { centerY: 570, width: 100, period: 10.4, phase: 3.2, amplitude: 0.26 },
    { centerY: 735, width: 105, period: 9.6, phase: 5.1, amplitude: 0.28 },
    { centerY: 850, width: 72, period: 11.3, phase: 2.0, amplitude: 0.22 },
] as const;

/** Nonlinear, depth-averaged shallow water on a finite-volume grid.
 *
 * h = 1 + eta, u = U + qx / h, v = qy / h.
 * h_t + div(h velocity) = 0; momentum uses the hydrostatic pressure h²/2.
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
    // c² = gH in the same painted coordinate system as the breaking jets.
    private readonly c = 80;
    private readonly current = 58;
    private readonly eta = new Float32Array(this.columns * this.rows);
    private readonly qx = new Float32Array(this.columns * this.rows);
    private readonly qy = new Float32Array(this.columns * this.rows);
    private readonly nextEta = new Float32Array(this.columns * this.rows);
    private readonly nextQx = new Float32Array(this.columns * this.rows);
    private readonly nextQy = new Float32Array(this.columns * this.rows);
    private time = 0;

    constructor() {
        // Initial water elevation follows the staggered bands of painted
        // crests so the simulation starts with wave energy across the scroll.
        this.seedCrest(470, 420, 115, 75, 55, 0.09);
        this.seedCrest(830, 450, 125, 80, 65, 0.10);
        this.seedCrest(1170, 480, 125, 85, 60, 0.09);
        this.seedCrest(180, 605, 95, 63, 65, 0.18);
        this.seedCrest(775, 570, 110, 75, 65, 0.09);
        this.seedCrest(1180, 615, 120, 80, 70, 0.09);
        this.seedCrest(510, 660, 110, 78, 75, 0.16);
        this.seedCrest(250, 750, 110, 80, 70, 0.10);
        this.seedCrest(780, 770, 110, 78, 80, 0.20);
        this.seedCrest(1080, 680, 100, 65, 68, 0.15);
        this.seedCrest(600, 830, 105, 78, 70, 0.10);
        this.seedCrest(1130, 830, 115, 75, 65, 0.10);
        this.writePixels();
    }

    private seedCrest(cx: number, cy: number, sx: number, sy: number, rise: number, amplitude: number) {
        for (let row = 0; row < this.rows; row++) {
            const y = row * this.dy;
            for (let col = 0; col < this.columns; col++) {
                const x = col * this.dx;
                const arcY = cy - rise * Math.exp(-(((x - cx) / (sx * 1.8)) ** 2));
                const envelope = Math.exp(-(((x - cx) / sx) ** 2) - (((y - arcY) / sy) ** 2));
                const pulse = 3 * amplitude * envelope * Math.cos(2 * Math.PI * (x - cx) / (3 * sx));
                const index = row * this.columns + col;
                this.eta[index] += pulse;
                this.qx[index] += this.c * pulse;
            }
        }
    }

    step(dt: number) {
        // The Rusanov speed follows local depth and velocity; at 60 Hz the
        // initial CFL number is below 0.2 in either grid direction.
        const fx = dt / this.dx;
        const fy = dt / this.dy;
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
                const hL = Math.max(0.05, 1 + eL);
                const hR = Math.max(0.05, 1 + eR);
                const waveSpeedX = Math.max(
                    Math.abs(this.current + xL / hL) + this.c * Math.sqrt(hL),
                    Math.abs(this.current + xR / hR) + this.c * Math.sqrt(hR),
                );
                const mass = 0.5 * (xL + xR + this.current * (eL + eR)) - 0.5 * waveSpeedX * (eR - eL);
                const momentumX = 0.5 * (this.current * (xL + xR)
                    + xL * xL / hL + xR * xR / hR
                    + pressure * (eL + eR + 0.5 * (eL * eL + eR * eR)))
                    - 0.5 * waveSpeedX * (xR - xL);
                const momentumY = 0.5 * (this.current * (yL + yR)
                    + xL * yL / hL + xR * yR / hR)
                    - 0.5 * waveSpeedX * (yR - yL);
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
                const xT = this.qx[top];
                const xB = this.qx[bottom];
                const yT = this.qy[top];
                const yB = this.qy[bottom];
                const hT = Math.max(0.05, 1 + eT);
                const hB = Math.max(0.05, 1 + eB);
                const waveSpeedY = Math.max(
                    Math.abs(yT / hT) + this.c * Math.sqrt(hT),
                    Math.abs(yB / hB) + this.c * Math.sqrt(hB),
                );
                const mass = 0.5 * (yT + yB) - 0.5 * waveSpeedY * (eB - eT);
                const momentumX = 0.5 * (xT * yT / hT + xB * yB / hB)
                    - 0.5 * waveSpeedY * (xB - xT);
                const momentumY = 0.5 * (yT * yT / hT + yB * yB / hB
                    + pressure * (eT + eB + 0.5 * (eT * eT + eB * eB)))
                    - 0.5 * waveSpeedY * (yB - yT);
                this.nextEta[top] -= fy * mass;
                this.nextEta[bottom] += fy * mass;
                this.nextQx[top] -= fy * momentumX;
                this.nextQx[bottom] += fy * momentumX;
                this.nextQy[top] -= fy * momentumY;
                this.nextQy[bottom] += fy * momentumY;
            }
        }

        // Reflective top and bottom: normal mass flux is zero, while the
        // pressure flux reverses the transverse momentum at each wall.
        for (let col = 0; col < width; col++) {
            const top = col;
            const bottom = (height - 1) * width + col;
            const eTop = this.eta[top];
            const eBottom = this.eta[bottom];
            const topSpeed = Math.abs(this.qy[top] / Math.max(0.05, 1 + eTop))
                + this.c * Math.sqrt(Math.max(0.05, 1 + eTop));
            const bottomSpeed = Math.abs(this.qy[bottom] / Math.max(0.05, 1 + eBottom))
                + this.c * Math.sqrt(Math.max(0.05, 1 + eBottom));
            this.nextQy[top] += fy * (pressure * (eTop + 0.5 * eTop * eTop) - topSpeed * this.qy[top]);
            this.nextQy[bottom] -= fy * (pressure * (eBottom + 0.5 * eBottom * eBottom)
                + bottomSpeed * this.qy[bottom]);
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
            const hL = Math.max(0.05, 1 + eL);
            const hR = Math.max(0.05, 1 + eR);
            const waveSpeedX = Math.max(
                Math.abs(this.current + xL / hL) + this.c * Math.sqrt(hL),
                Math.abs(this.current + xR / hR) + this.c * Math.sqrt(hR),
            );
            const massIn = 0.5 * (xL + xR + this.current * (eL + eR)) - 0.5 * waveSpeedX * (eR - eL);
            const momentumIn = 0.5 * (this.current * (xL + xR)
                + xL * xL / hL + xR * xR / hR
                + pressure * (eL + eR + 0.5 * (eL * eL + eR * eR)))
                - 0.5 * waveSpeedX * (xR - xL);
            const transverseIn = 0.5 * (this.current * this.qy[left]
                + xR * this.qy[left] / hR - waveSpeedX * this.qy[left]);
            this.nextEta[left] += fx * massIn;
            this.nextQx[left] += fx * momentumIn;
            this.nextQy[left] += fx * transverseIn;

            const right = left + width - 1;
            const rightElevation = this.eta[right];
            const rightQx = this.qx[right];
            const rightQy = this.qy[right];
            const rightDepth = Math.max(0.05, 1 + rightElevation);
            this.nextEta[right] -= fx * (this.qx[right] + this.current * this.eta[right]);
            this.nextQx[right] -= fx * (this.current * rightQx + rightQx * rightQx / rightDepth
                + pressure * (rightElevation + 0.5 * rightElevation * rightElevation));
            this.nextQy[right] -= fx * (this.current * rightQy + rightQx * rightQy / rightDepth);
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
            const phase = distance / 0.52;
            const temporal = (1 - 2 * phase * phase) * Math.exp(-(phase * phase));
            const transverse = Math.exp(-(((y - source.centerY) / source.width) ** 2));
            value += 2 * source.amplitude * temporal * transverse;
        }
        return value;
    }

    sample(x: number, y: number) {
        const gx = Math.max(0, Math.min(this.columns - 1.001, x / this.dx));
        const gy = Math.max(0, Math.min(this.rows - 1.001, y / this.dy));
        const col = Math.floor(gx);
        const row = Math.floor(gy);
        const tx = gx - col;
        const ty = gy - row;
        const index = row * this.columns + col;
        const interpolate = (field: Float32Array) => {
            const top = field[index] * (1 - tx) + field[index + 1] * tx;
            const bottom = field[index + this.columns] * (1 - tx) + field[index + this.columns + 1] * tx;
            return top * (1 - ty) + bottom * ty;
        };
        const elevation = interpolate(this.eta);
        const depth = Math.max(0.05, 1 + elevation);
        return {
            elevation,
            velocityX: this.current + interpolate(this.qx) / depth,
            velocityY: interpolate(this.qy) / depth,
        };
    }

    waveSpeed(x: number, y: number) {
        const state = this.sample(x, y);
        return state.velocityX + this.c * Math.sqrt(Math.max(0.05, 1 + state.elevation));
    }

    /** Reuse the caller's buffer while updating thousands of separate ink vertices. */
    sampleMotion(x: number, y: number, result: Float32Array) {
        const gx = Math.max(0, Math.min(this.columns - 1.001, x / this.dx));
        const gy = Math.max(0, Math.min(this.rows - 1.001, y / this.dy));
        const col = Math.floor(gx);
        const row = Math.floor(gy);
        const tx = gx - col;
        const ty = gy - row;
        const index = row * this.columns + col;
        const a = (1 - tx) * (1 - ty);
        const b = tx * (1 - ty);
        const c = (1 - tx) * ty;
        const d = tx * ty;
        result[0] = this.eta[index] * a + this.eta[index + 1] * b
            + this.eta[index + this.columns] * c + this.eta[index + this.columns + 1] * d;
        result[1] = this.qx[index] * a + this.qx[index + 1] * b
            + this.qx[index + this.columns] * c + this.qx[index + this.columns + 1] * d;
    }

    /** Exchange a parcel's water volume with the four neighboring cells. */
    exchange(x: number, y: number, level: number, horizontalVelocity: number) {
        const gx = Math.max(0, Math.min(this.columns - 1.001, x / this.dx));
        const gy = Math.max(0, Math.min(this.rows - 1.001, y / this.dy));
        const col = Math.floor(gx);
        const row = Math.floor(gy);
        const tx = gx - col;
        const ty = gy - row;
        const base = row * this.columns + col;
        const cells = [base, base + 1, base + this.columns, base + this.columns + 1];
        const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
        for (let index = 0; index < 4; index++) {
            const amount = level * weights[index];
            this.eta[cells[index]] += amount;
            this.qx[cells[index]] += amount * (horizontalVelocity - this.current);
        }
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
