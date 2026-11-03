import historyIcon from "@/assets/history/thumbnails/split_002.webp?url";

export { historyIcon };

const publicBase = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

export const historyImages = Object.values(
    import.meta.glob("@/assets/history/thumbnails/split_*.webp", { eager: true, as: "url" })
);

export const wenwuTypeIcons = Object.fromEntries(
    Object.entries(
        import.meta.glob("@/assets/wenwu-type/thumbnails/*.webp", { eager: true, as: "url" })
    ).map(([path, url]) => [
        (path.split("/").pop() || "").replace(".webp", ""),
        url as string,
    ])
) as Record<string, string>;

export const eraIcons = Object.fromEntries(
    Object.entries(
        import.meta.glob("@/assets/era/thumbnails/*.webp", { eager: true, as: "url" })
    ).map(([path, url]) => [
        (path.split("/").pop() || "").replace(".webp", ""),
        url as string,
    ])
) as Record<string, string>;

export const resolveArtifactImageUrl = (imagePath?: string) => {
    const fileName = imagePath?.split("/").pop();

    if (!fileName) return undefined;

    return `${publicBase}wenwu/artifacts/${encodeURIComponent(fileName)}`;
};
