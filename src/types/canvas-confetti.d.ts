declare module "canvas-confetti" {
    interface ConfettiOptions {
        particleCount?: number;
        spread?: number;
        angle?: number;
        startVelocity?: number;
        decay?: number;
        gravity?: number;
        drift?: number;
        ticks?: number;
        scalar?: number;
        zIndex?: number;
        origin?: {
            x?: number;
            y?: number;
        };
        colors?: string[];
        shapes?: string[];
        disableForReducedMotion?: boolean;
    }

    export default function confetti(options?: ConfettiOptions): Promise<null>;
}
