import { useCallback, useEffect, useRef, useState } from "react";

export function useSmoothProgress() {
    const [smoothProgress, setSmoothProgress] = useState(0);
    const progressRef = useRef(0);
    const animationRef = useRef<number | null>(null);

    const updateProgressSmoothly = useCallback((targetProgress: number) => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }

        const animate = () => {
            const currentProgress = progressRef.current;
            const diff = targetProgress - currentProgress;

            if (Math.abs(diff) < 0.5) {
                progressRef.current = targetProgress;
                setSmoothProgress(targetProgress);
                return;
            }

            const nextProgress = currentProgress + diff * 0.05;
            progressRef.current = nextProgress;
            setSmoothProgress(nextProgress);
            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);
    }, []);

    const resetProgress = useCallback(() => {
        setSmoothProgress(0);
        progressRef.current = 0;
    }, []);

    useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    return {
        smoothProgress,
        progressRef,
        updateProgressSmoothly,
        resetProgress,
    };
}
