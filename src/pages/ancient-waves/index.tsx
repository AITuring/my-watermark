import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Pause, Play } from "lucide-react";
import { Link } from "react-router-dom";
import WavesArtwork from "./WavesArtwork";
import "./index.css";

export default function AncientWaves() {
    const artworkRef = useRef<HTMLCanvasElement | null>(null);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(
        () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    const [motionOverride, setMotionOverride] = useState<boolean | null>(null);
    const isPlaying = motionOverride ?? !prefersReducedMotion;

    useEffect(() => {
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const updatePreference = () => setPrefersReducedMotion(preference.matches);
        preference.addEventListener("change", updatePreference);
        return () => preference.removeEventListener("change", updatePreference);
    }, []);

    function downloadPng() {
        if (!artworkRef.current) return;
        artworkRef.current.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "古画水纹-当前画面.png";
            document.body.append(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, "image/png");
    }

    return (
        <main className="ancient-waves-page">
            <div className="ancient-waves-shell">
                <header className="ancient-waves-header">
                    <div className="ancient-waves-heading">
                        <Link className="ancient-waves-back" to="/" aria-label="返回应用库"><ArrowLeft size={19} /></Link>
                        <div>
                            <p className="ancient-waves-eyebrow">WAVE MOTION STUDY</p>
                            <h1>古画水纹</h1>
                        </div>
                    </div>
                    <div className="ancient-waves-actions">
                        <button
                            className="ancient-waves-motion"
                            type="button"
                            onClick={() => setMotionOverride(!isPlaying)}
                            aria-label={isPlaying ? "暂停水流" : "播放水流"}
                            aria-pressed={isPlaying}
                        >
                            {isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                            {isPlaying ? "暂停" : "播放"}
                        </button>
                        <button className="ancient-waves-download" type="button" onClick={downloadPng}>
                            <Download size={17} aria-hidden="true" />
                            保存当前画面
                        </button>
                    </div>
                </header>
                <section className="ancient-waves-stage" aria-label="古画水纹线描作品">
                    <WavesArtwork playing={isPlaying} canvasRef={artworkRef} />
                </section>
                <p className="ancient-waves-caption">原画浪纹 · 流动自左向右 · 无题字与印章</p>
            </div>
        </main>
    );
}
