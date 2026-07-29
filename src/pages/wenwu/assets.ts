import historyIcon from "@/assets/history/split_002.png";

export { historyIcon };

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

export const artifactImages = Object.fromEntries(
    Object.entries(
        import.meta.glob("@/assets/195/*", { eager: true, as: "url" })
    ).map(([path, url]) => [(path.split("/").pop() || ""), url as string])
) as Record<string, string>;
