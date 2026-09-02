import React, { useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";

import { resolveArtifactImageUrl } from "./assets";
import { artifactImageCatalog } from "./artifactImageCatalog";
import type { Artifact } from "./types";
import { extractMuseumNames } from "./utils";

const STORAGE_PREFIX = "wenwu:artifact-image:v4:";

const runtimeCache = new Map<number, string>();
const pendingRequests = new Map<number, Promise<string | null>>();

const readStoredImageUrl = (artifactId: number) => {
    if (typeof window === "undefined") return undefined;

    try {
        return (
            window.localStorage.getItem(`${STORAGE_PREFIX}${artifactId}`) ||
            undefined
        );
    } catch {
        return undefined;
    }
};

const writeStoredImageUrl = (artifactId: number, imageUrl: string | null) => {
    if (typeof window === "undefined") return;

    try {
        if (imageUrl) {
            window.localStorage.setItem(`${STORAGE_PREFIX}${artifactId}`, imageUrl);
        } else {
            window.localStorage.removeItem(`${STORAGE_PREFIX}${artifactId}`);
        }
    } catch {
        // localStorage 不可用时退化为内存缓存
    }
};

const buildWikipediaSummaryUrl = (title: string) =>
    `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        title
    )}`;

const buildWikipediaPageImagesUrl = (title: string) =>
    `https://zh.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=original&titles=${encodeURIComponent(
        title
    )}`;

const fetchWikipediaThumbnail = async (title: string) => {
    try {
        const response = await fetch(buildWikipediaSummaryUrl(title), {
            headers: {
                Accept: "application/json",
            },
        });

        if (!response.ok) return null;

        const payload = await response.json();
        return (
            payload?.thumbnail?.source ||
            payload?.originalimage?.source ||
            null
        );
    } catch {
        // ignore and fall through to the pageimages fallback below
    }

    try {
        const response = await fetch(buildWikipediaPageImagesUrl(title), {
            headers: {
                Accept: "application/json",
            },
        });

        if (!response.ok) return null;

        const payload = await response.json();
        const page = Object.values(payload?.query?.pages || {})[0] as
            | { original?: { source?: string } }
            | undefined;
        return page?.original?.source || null;
    } catch {
        return null;
    }
};

const lookupArtifactImage = async (artifact: Artifact) => {
    const catalogEntry = artifactImageCatalog[artifact.id];
    const localImageUrl = resolveArtifactImageUrl(
        catalogEntry?.localImage || artifact.image
    );

    if (localImageUrl) return localImageUrl;
    if (catalogEntry?.remoteImage) return catalogEntry.remoteImage;

    if (!catalogEntry?.wikipediaTitle) return null;

    return fetchWikipediaThumbnail(catalogEntry.wikipediaTitle);
};

const resolveArtifactImage = async (artifact: Artifact) => {
    const catalogEntry = artifactImageCatalog[artifact.id];
    const localImageUrl = resolveArtifactImageUrl(
        catalogEntry?.localImage || artifact.image
    );

    if (localImageUrl) {
        runtimeCache.set(artifact.id, localImageUrl);
        return localImageUrl;
    }

    if (catalogEntry?.remoteImage) {
        runtimeCache.set(artifact.id, catalogEntry.remoteImage);
        return catalogEntry.remoteImage;
    }

    if (runtimeCache.has(artifact.id)) {
        return runtimeCache.get(artifact.id) || null;
    }

    const storedImageUrl = readStoredImageUrl(artifact.id);
    if (storedImageUrl !== undefined) {
        runtimeCache.set(artifact.id, storedImageUrl);
        return storedImageUrl;
    }

    if (!pendingRequests.has(artifact.id)) {
        pendingRequests.set(
            artifact.id,
            lookupArtifactImage(artifact).then((imageUrl) => {
                if (imageUrl) {
                    runtimeCache.set(artifact.id, imageUrl);
                }
                writeStoredImageUrl(artifact.id, imageUrl);
                pendingRequests.delete(artifact.id);
                return imageUrl;
            })
        );
    }

    return pendingRequests.get(artifact.id) ?? null;
};

export const useArtifactImage = (
    artifact: Artifact | null,
    enabled: boolean
) => {
    const catalogEntry = artifact ? artifactImageCatalog[artifact.id] : undefined;
    const localImageUrl = useMemo(
        () =>
            artifact
                ? resolveArtifactImageUrl(
                      catalogEntry?.localImage || artifact.image
                  )
                : undefined,
        [artifact, catalogEntry]
    );

    const [imageUrl, setImageUrl] = useState<string | null | undefined>(() => {
        if (!artifact) return undefined;
        return localImageUrl ?? runtimeCache.get(artifact.id);
    });

    useEffect(() => {
        if (!artifact) {
            setImageUrl(undefined);
            return;
        }

        if (localImageUrl) {
            setImageUrl(localImageUrl);
            return;
        }

        if (!enabled) return;

        let isCancelled = false;

        void resolveArtifactImage(artifact).then((resolvedUrl) => {
            if (!isCancelled) {
                setImageUrl(resolvedUrl);
            }
        });

        return () => {
            isCancelled = true;
        };
    }, [artifact, enabled, localImageUrl]);

    return imageUrl;
};

interface ArtifactImageProps {
    artifact: Artifact;
    alt: string;
    className: string;
    imageClassName: string;
    eager?: boolean;
}

export const ArtifactImage: React.FC<ArtifactImageProps> = ({
    artifact,
    alt,
    className,
    imageClassName,
    eager = false,
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState(eager);
    const [hasError, setHasError] = useState(false);
    const imageUrl = useArtifactImage(artifact, isVisible || eager);
    const museumName = extractMuseumNames(artifact.collectionLocation)[0];
    const catalogEntry = artifactImageCatalog[artifact.id];
    const placeholderText =
        catalogEntry?.status === "pending"
            ? "静态图待补充"
            : museumName || "暂无配图";

    useEffect(() => {
        if (eager || isVisible) return;

        const target = containerRef.current;
        if (!target || typeof IntersectionObserver === "undefined") {
            setIsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: "240px 0px" }
        );

        observer.observe(target);

        return () => observer.disconnect();
    }, [eager, isVisible]);

    useEffect(() => {
        setHasError(false);
    }, [artifact.id, imageUrl]);

    return (
        <div
            ref={containerRef}
            className={`${className} relative overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800`}
        >
            {imageUrl && !hasError ? (
                <img
                    src={imageUrl}
                    alt={alt}
                    loading={eager ? "eager" : "lazy"}
                    referrerPolicy="no-referrer"
                    className={`${imageClassName} block`}
                    onError={() => setHasError(true)}
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/75 text-slate-500 shadow-sm dark:bg-slate-900/75 dark:text-slate-300">
                        <ImageIcon className="h-5 w-5" />
                    </div>
                    <p className="line-clamp-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {placeholderText}
                    </p>
                </div>
            )}
        </div>
    );
};
