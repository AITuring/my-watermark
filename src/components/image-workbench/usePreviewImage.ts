import { useEffect, useState } from "react";

export function usePreviewImage(src: string) {
    const [loaded, setLoaded] = useState<{ src: string; image: HTMLImageElement } | null>(null);
    useEffect(() => {
        if (!src) return;
        let active = true;
        const image = new Image();
        image.onload = () => { if (active) setLoaded({ src, image }); };
        image.src = src;
        return () => { active = false; };
    }, [src]);
    return loaded?.src === src ? loaded.image : null;
}
