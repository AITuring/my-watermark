import type React from "react";

import type { AspectRatio } from "../types";

type GalleryCanvasContainerProps = {
    containerProps: {
        style?: React.CSSProperties;
        children?: React.ReactNode;
    };
    galleryRef: React.RefObject<HTMLDivElement | null>;
    wallColor: string;
    tiltAngle: number;
    tiltScale: number;
    outerPadding: number;
    showPagePreview: boolean;
    selectedRatio: AspectRatio | null;
    overlayBounds: number[];
    vignette: boolean;
};

export function GalleryCanvasContainer({
    containerProps,
    galleryRef,
    wallColor,
    tiltAngle,
    tiltScale,
    outerPadding,
    showPagePreview,
    selectedRatio,
    overlayBounds,
    vignette,
}: GalleryCanvasContainerProps) {
    return (
        <div
            ref={galleryRef}
            id="container"
            style={{
                position: "relative",
                overflow: "hidden",
                backgroundColor: wallColor,
                backgroundImage: `
                    radial-gradient(at 50% 0%, rgba(255,255,255,0.15) 0%, transparent 50%),
                    radial-gradient(at 50% 100%, rgba(0,0,0,0.1) 0%, transparent 50%),
                    linear-gradient(120deg, rgba(255,255,255,0.05) 0%, transparent 40%),
                    radial-gradient(circle at 80% 20%, rgba(255,255,255,0.05), transparent 30%)
                `,
                boxShadow: "inset 0 0 100px rgba(0,0,0,0.05)",
                minHeight: "100vh",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0.04,
                    pointerEvents: "none",
                    backgroundImage:
                        'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'1\'/%3E%3C/svg%3E")',
                    backgroundRepeat: "repeat",
                    zIndex: 0,
                }}
            />

            <div
                id="tilt-wrapper"
                style={{
                    position: "relative",
                    display: "inline-block",
                    transform: `rotate(${tiltAngle}deg) scale(${tiltScale})`,
                    transformOrigin: "center",
                    transition: "transform 300ms ease",
                    willChange: "transform",
                    zIndex: 1,
                }}
            >
                <div
                    {...containerProps}
                    id="gallery"
                    style={{
                        ...(containerProps?.style ?? {}),
                        padding: `${outerPadding}px`,
                        boxSizing: "border-box",
                    }}
                >
                    {containerProps?.children}
                </div>

                {showPagePreview &&
                    selectedRatio?.width &&
                    overlayBounds.length > 0 && (
                        <div
                            id="page-overlay"
                            style={{
                                position: "absolute",
                                inset: 0,
                                pointerEvents: "none",
                            }}
                        >
                            {overlayBounds.map((y, index) => (
                                <div
                                    key={index}
                                    style={{
                                        position: "absolute",
                                        top: `${y}px`,
                                        left: 0,
                                        right: 0,
                                        height: 0,
                                        borderTop:
                                            "2px dashed rgba(255,0,0,0.5)",
                                    }}
                                />
                            ))}
                        </div>
                    )}
            </div>

            {vignette && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background:
                            "radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%)",
                    }}
                />
            )}
        </div>
    );
}
