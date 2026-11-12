import { useEffect, useState } from "react";

/** Keep the previous frame visible until its replacement is decoded. */
export function useStableWatermarkImage(url: string) {
    const [image, setImage] = useState<HTMLImageElement>();
    useEffect(() => {
        if (!url) { setImage(undefined); return; }
        let cancelled = false;
        const next = new Image();
        next.crossOrigin = "anonymous";
        next.onload = async () => {
            try { await next.decode(); } catch { /* onload already succeeded */ }
            if (!cancelled) setImage(next);
        };
        next.src = url;
        return () => { cancelled = true; next.onload = null; };
    }, [url]);
    return image;
}
