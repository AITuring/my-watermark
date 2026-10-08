import { forwardRef } from "react";
import { tracedWavePaths } from "./tracedPaths";

const WavesArtwork = forwardRef<SVGSVGElement>(function WavesArtwork(_, ref) {
    return (
        <svg
            ref={ref}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1532 964"
            role="img"
            aria-label="无题字的古画水纹 SVG：深浅层叠的海浪绘于赭灰色纸上"
        >
            <defs>
                <linearGradient id="mount" x1="0" y1="0" x2="0.9" y2="1">
                    <stop offset="0" stopColor="#d7cbb8" />
                    <stop offset="0.55" stopColor="#d1c4b0" />
                    <stop offset="1" stopColor="#c7bba8" />
                </linearGradient>
                <linearGradient id="paper" x1="0" y1="0" x2="0.72" y2="1">
                    <stop offset="0" stopColor="#988a75" />
                    <stop offset="0.54" stopColor="#877e6c" />
                    <stop offset="1" stopColor="#766e60" />
                </linearGradient>
                <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#403f36" stopOpacity="0.03" />
                    <stop offset="0.45" stopColor="#45463c" stopOpacity="0.015" />
                    <stop offset="1" stopColor="#2e302a" stopOpacity="0.12" />
                </linearGradient>
                <filter id="paperGrain" x="0" y="0" width="100%" height="100%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.52" numOctaves="3" seed="8" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0" />
                    <feComponentTransfer><feFuncA type="linear" slope="0.13" /></feComponentTransfer>
                </filter>
                <clipPath id="paintingClip"><rect x="69" y="39" width="1380" height="896" /></clipPath>
            </defs>
            <rect width="1532" height="964" fill="url(#mount)" />
            <rect width="1532" height="964" fill="#fff" filter="url(#paperGrain)" opacity="0.56" />
            <rect x="67" y="37" width="1384" height="900" fill="#584f43" opacity="0.16" />
            <rect x="69" y="39" width="1380" height="896" fill="url(#paper)" />
            <g clipPath="url(#paintingClip)">
                <rect x="69" y="39" width="1380" height="896" fill="url(#wash)" />
                <rect x="69" y="39" width="1380" height="896" fill="#fff" filter="url(#paperGrain)" opacity="0.8" />
                <path d="M 762 39 C 757 251 763 477 760 935" stroke="#332f2a" strokeWidth="22" opacity="0.035" fill="none" />
                <path d="M 752 39 C 755 251 749 477 755 935" stroke="#c9bba2" strokeWidth="9" opacity="0.045" fill="none" />
                <g transform="translate(69 39)">
                    <path d={tracedWavePaths} fill="#343832" opacity="0.62" />
                </g>
            </g>
        </svg>
    );
});

export default WavesArtwork;
