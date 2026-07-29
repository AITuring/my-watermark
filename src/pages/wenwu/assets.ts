import historyIcon from "@/assets/history/split_002.png";

export { historyIcon };

const publicBase = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

export const historyImages = Object.values(
    import.meta.glob("@/assets/history/split_*.jpg", { eager: true, as: "url" })
);

export const wenwuTypeIcons = Object.fromEntries(
    Object.entries(
        import.meta.glob("@/assets/wenwu-type/*.png", { eager: true, as: "url" })
    ).map(([path, url]) => [
        (path.split("/").pop() || "").replace(".png", ""),
        url as string,
    ])
) as Record<string, string>;

export const eraIcons = Object.fromEntries(
    Object.entries(
        import.meta.glob("@/assets/era/*.png", { eager: true, as: "url" })
    ).map(([path, url]) => [
        (path.split("/").pop() || "").replace(".png", ""),
        url as string,
    ])
) as Record<string, string>;

export const resolveArtifactImageUrl = (imagePath?: string) => {
    const fileName = imagePath?.split("/").pop();

    if (!fileName) return undefined;

    return `${publicBase}wenwu/artifacts/${encodeURIComponent(fileName)}`;
};
