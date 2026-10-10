import type { ShallowWater } from "./ShallowWater";

interface CrestSite {
    x: number;
    y: number;
    landingSlope: number;
    slopeThreshold: number;
    armed: boolean;
    lastBreak: number;
}

interface Parcel {
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    sequence: number;
    alive: boolean;
    mass: number;
    site?: CrestSite;
}

interface PlungingJet {
    site: CrestSite;
    age: number;
    launched: number;
    parcels: Parcel[];
}

const GRAVITY = 270; // Painting pixels per second squared.
const AIR_DRAG = 0.055;
const LAUNCH_RATE = 72;
const LAUNCH_COUNT = 72;
const LAUNCH_ANGLE = 68 * Math.PI / 180;
const PARCEL_MASS = 0.0004; // Relative to one shallow-water grid cell's volume.
const INK_SURFACE_SCALE = 75; // Match the moving ink contour, not the paper plane.

/** A free-surface jet is emitted only when a shallow-water crest steepens.
 * Each fluid parcel has a pressure-head launch speed, then follows gravity
 * and air drag. The jet disconnects when its front reenters the water.
 * This resolves an overturning lip and impact spray beyond a height field,
 * without pretending to be a full Navier-Stokes breaking-wave solver.
 */
export class BreakingWater {
    private readonly sites: CrestSite[] = [
        { x: 245, y: 560, landingSlope: 0.28, slopeThreshold: 0.10, armed: true, lastBreak: -10 },
        { x: 565, y: 640, landingSlope: 0.23, slopeThreshold: 0.055, armed: true, lastBreak: -10 },
        { x: 970, y: 630, landingSlope: 0.24, slopeThreshold: 0.075, armed: true, lastBreak: -10 },
        { x: 405, y: 755, landingSlope: 0.18, slopeThreshold: 0.075, armed: true, lastBreak: -10 },
        { x: 820, y: 765, landingSlope: 0.20, slopeThreshold: 0.045, armed: true, lastBreak: -10 },
    ];
    private readonly jets: PlungingJet[] = [];
    private readonly spray: Parcel[] = [];
    private time = 0;
    private completedBreaks = 0;

    step(dt: number, water: ShallowWater) {
        this.time += dt;
        for (const site of this.sites) {
            const state = water.sample(site.x, site.y);
            const ahead = water.sample(site.x + 12, site.y).elevation;
            const behind = water.sample(site.x - 12, site.y).elevation;
            const leadingSlope = -(ahead - behind) * 225 / 24;
            if (state.elevation < 0.025) site.armed = true;
            if (site.armed && state.elevation > 0.045 && leadingSlope > site.slopeThreshold
                && state.velocityX > 55 && this.time - site.lastBreak > 2.4) {
                this.jets.push({ site, age: 0, launched: 0, parcels: [] });
                site.lastBreak = this.time;
                site.armed = false;
                this.completedBreaks++;
            }
        }

        for (const jet of this.jets) {
            jet.age += dt;
            while (jet.launched < LAUNCH_COUNT && jet.launched / LAUNCH_RATE <= jet.age) {
                jet.parcels.push(this.launch(jet.site, jet.launched, water));
                jet.launched++;
            }
            for (const parcel of jet.parcels) {
                if (!parcel.alive) continue;
                this.integrate(parcel, dt);
                const landing = this.waterline(jet.site, parcel.x, water);
                if (parcel.age > 0.22 && parcel.vy > 0 && parcel.y >= landing) {
                    parcel.alive = false;
                    if (parcel.sequence % 3 === 0) this.impact(parcel, jet.site, landing, water);
                    else water.exchange(parcel.x, jet.site.y, parcel.mass, parcel.vx);
                }
            }
        }

        for (const parcel of this.spray) {
            if (!parcel.alive) continue;
            this.integrate(parcel, dt);
            const surface = parcel.site ? this.waterline(parcel.site, parcel.x, water) : 896;
            if (parcel.age > 1.15 || parcel.y > 896 || parcel.x > 1380
                || (parcel.age > 0.16 && parcel.vy > 0 && parcel.y >= surface)) {
                parcel.alive = false;
                if (parcel.site && parcel.x < 1380 && parcel.y < 896) {
                    water.exchange(parcel.x, parcel.site.y, parcel.mass, parcel.vx);
                }
            }
        }

        for (let index = this.jets.length - 1; index >= 0; index--) {
            const jet = this.jets[index];
            if (jet.launched === LAUNCH_COUNT && jet.parcels.every((parcel) => !parcel.alive)) {
                this.jets.splice(index, 1);
            }
        }
        for (let index = this.spray.length - 1; index >= 0; index--) {
            if (!this.spray[index].alive) this.spray.splice(index, 1);
        }
    }

    private launch(site: CrestSite, sequence: number, water: ShallowWater): Parcel {
        const state = water.sample(site.x, site.y);
        const head = 24 + Math.max(0, state.elevation) * 260;
        const pressureSpeed = Math.sqrt(2 * GRAVITY * head);
        const taper = 1 - 0.10 * sequence / LAUNCH_COUNT;
        const parcel = {
            x: site.x,
            y: site.y - state.elevation * INK_SURFACE_SCALE,
            vx: state.velocityX + pressureSpeed * Math.cos(LAUNCH_ANGLE) * taper,
            vy: -pressureSpeed * Math.sin(LAUNCH_ANGLE) * taper,
            age: 0,
            sequence,
            alive: true,
            mass: PARCEL_MASS,
        };
        water.exchange(site.x, site.y, -parcel.mass, state.velocityX);
        return parcel;
    }

    private integrate(parcel: Parcel, dt: number) {
        const drag = Math.exp(-AIR_DRAG * dt);
        parcel.vx *= drag;
        parcel.vy = (parcel.vy + GRAVITY * dt) * drag;
        parcel.x += parcel.vx * dt;
        parcel.y += parcel.vy * dt;
        parcel.age += dt;
    }

    private waterline(site: CrestSite, x: number, water: ShallowWater) {
        const surface = water.sample(x, site.y).elevation;
        return site.y + site.landingSlope * (x - site.x) - surface * INK_SURFACE_SCALE;
    }

    private impact(parcel: Parcel, site: CrestSite, waterline: number, water: ShallowWater) {
        const speed = Math.hypot(parcel.vx, parcel.vy);
        const rebound = speed * 0.62;
        water.exchange(parcel.x, site.y, parcel.mass * 0.5, parcel.vx * 0.7);
        // Two droplets receive less than the impact kinetic energy; the rest
        // is dissipated into the lower water surface.
        this.spray.push({
            x: parcel.x, y: waterline,
            vx: parcel.vx * 0.32 + rebound * 0.25,
            vy: -rebound * 0.58,
            age: 0, sequence: 0, alive: true, site, mass: parcel.mass * 0.25,
        }, {
            x: parcel.x, y: waterline,
            vx: parcel.vx * 0.18 + rebound * 0.08,
            vy: -rebound * 0.72,
            age: 0, sequence: 0, alive: true, site, mass: parcel.mass * 0.25,
        });
    }

    forEachInkSegment(emit: (ax: number, ay: number, bx: number, by: number, width: number) => void) {
        for (const jet of this.jets) {
            for (let index = 1; index < jet.parcels.length; index++) {
                const a = jet.parcels[index - 1];
                const b = jet.parcels[index];
                const distance = Math.hypot(b.x - a.x, b.y - a.y);
                if (!a.alive || !b.alive || distance > 14) continue;
                const tip = Math.min(1, a.age / 1.25);
                emit(a.x, a.y, b.x, b.y, 4.2 - 1.7 * tip);
            }
        }
        for (const parcel of this.spray) {
            if (!parcel.alive) continue;
            const length = Math.max(3, 7 * (1 - parcel.age / 1.15));
            const speed = Math.max(1, Math.hypot(parcel.vx, parcel.vy));
            const ux = parcel.vx / speed;
            const uy = parcel.vy / speed;
            emit(parcel.x - ux * length, parcel.y - uy * length, parcel.x, parcel.y, 2.1);
        }
    }

    diagnostics() {
        let airborneVolume = 0;
        for (const jet of this.jets) {
            for (const parcel of jet.parcels) {
                if (parcel.alive) airborneVolume += parcel.mass;
            }
        }
        for (const parcel of this.spray) {
            if (parcel.alive) airborneVolume += parcel.mass;
        }
        return {
            breaks: this.completedBreaks,
            jets: this.jets.length,
            spray: this.spray.length,
            airborneVolume,
        };
    }
}
