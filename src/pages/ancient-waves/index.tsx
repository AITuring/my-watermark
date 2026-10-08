import { useRef } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "react-router-dom";
import WavesArtwork from "./WavesArtwork";
import "./index.css";

export default function AncientWaves() {
    const artworkRef = useRef<SVGSVGElement>(null);

    function downloadSvg() {
        if (!artworkRef.current) return;
        const svg = new XMLSerializer().serializeToString(artworkRef.current);
        const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "古画水纹-线描.svg";
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return (
        <main className="ancient-waves-page">
            <div className="ancient-waves-shell">
                <header className="ancient-waves-header">
                    <div className="ancient-waves-heading">
                        <Link className="ancient-waves-back" to="/" aria-label="返回应用库"><ArrowLeft size={19} /></Link>
                        <div>
                            <p className="ancient-waves-eyebrow">SVG LINE STUDY</p>
                            <h1>古画水纹</h1>
                        </div>
                    </div>
                    <button className="ancient-waves-download" type="button" onClick={downloadSvg}>
                        <Download size={17} aria-hidden="true" />
                        下载 SVG
                    </button>
                </header>
                <section className="ancient-waves-stage" aria-label="古画水纹线描作品">
                    <WavesArtwork ref={artworkRef} />
                </section>
                <p className="ancient-waves-caption">以线条重现层叠潮纹 · 无题字与印章</p>
            </div>
        </main>
    );
}
