import { useCallback, useEffect, useRef, useState } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { DEFAULT_MAP_CENTER } from "@/pages/photo-exif/constants";
import type { GpsPoint, MapInstanceLike, MapLoadState, MapSdkLike, MarkerLike } from "@/pages/photo-exif/types";
import { extractLngLat } from "@/pages/photo-exif/utils";

let amapSdkPromise: Promise<MapSdkLike> | null = null;

const loadAmapSdk = async (): Promise<MapSdkLike> => {
    if (!amapSdkPromise) {
        (window as Window & { _AMapSecurityConfig?: Record<string, string> })._AMapSecurityConfig = {
            securityJsCode: "8d5961ba4c131a09904cab742029ca42",
        };
        amapSdkPromise = AMapLoader.load({
            key: "55b6c2fbb0875490d011d74ad99aac31",
            version: "2.0",
            plugins: ["AMap.Geocoder", "AMap.PlaceSearch"],
        }) as Promise<MapSdkLike>;
    }
    return amapSdkPromise;
};

interface UsePhotoExifMapOptions {
    point: GpsPoint | null;
    title: string;
    draggable: boolean;
    errorMessage: string;
    onPointSelect: (point: GpsPoint) => void;
}

export const usePhotoExifMap = ({
    point,
    title,
    draggable,
    errorMessage,
    onPointSelect,
}: UsePhotoExifMapOptions) => {
    const [mapState, setMapState] = useState<MapLoadState>({
        loading: false,
        error: null,
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapInstanceLike | null>(null);
    const markerRef = useRef<MarkerLike | null>(null);
    const onPointSelectRef = useRef(onPointSelect);

    useEffect(() => {
        onPointSelectRef.current = onPointSelect;
    }, [onPointSelect]);

    const reverseGeocodePoint = useCallback(reverseGeocodePointWithAmap, []);

    const searchLocationPoint = useCallback(searchLocationPointWithAmap, []);

    useEffect(() => {
        if (!containerRef.current) return;

        let cancelled = false;
        const renderMap = async () => {
            setMapState({ loading: true, error: null });
            try {
                const sdk = await loadAmapSdk();
                if (cancelled || !containerRef.current) return;

                if (!mapRef.current) {
                    mapRef.current = new sdk.Map(containerRef.current, {
                        zoom: 15,
                        center: [point?.lng ?? DEFAULT_MAP_CENTER.lng, point?.lat ?? DEFAULT_MAP_CENTER.lat],
                    });
                    mapRef.current.on("click", (event: unknown) => {
                        if (!draggable) return;
                        const nextPoint = extractLngLat((event as { lnglat?: unknown } | null | undefined)?.lnglat);
                        if (nextPoint) {
                            onPointSelectRef.current(nextPoint);
                        }
                    });
                }

                mapRef.current.clearMap();
                markerRef.current = null;
                mapRef.current.setZoomAndCenter(15, [point?.lng ?? DEFAULT_MAP_CENTER.lng, point?.lat ?? DEFAULT_MAP_CENTER.lat]);
                if (point) {
                    const marker = new sdk.Marker({
                        position: [point.lng, point.lat],
                        title,
                        draggable,
                    } as Record<string, unknown>);
                    marker.on("dragend", (event: unknown) => {
                        if (!draggable) return;
                        const markerEvent = event as { lnglat?: unknown; target?: { getPosition?: () => unknown } } | null | undefined;
                        const nextPoint = extractLngLat(markerEvent?.lnglat ?? markerEvent?.target?.getPosition?.());
                        if (nextPoint) {
                            onPointSelectRef.current(nextPoint);
                        }
                    });
                    markerRef.current = marker;
                    mapRef.current.add(marker);
                }

                if (!cancelled) {
                    setMapState({ loading: false, error: null });
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setMapState({ loading: false, error: errorMessage });
                }
            }
        };

        void renderMap();
        return () => {
            cancelled = true;
        };
    }, [draggable, errorMessage, point, title]);

    useEffect(() => () => {
        mapRef.current?.destroy?.();
    }, []);

    return {
        containerRef,
        mapState,
        reverseGeocodePoint,
        searchLocationPoint,
    };
};

export const reverseGeocodePointWithAmap = async (targetPoint: GpsPoint): Promise<string> => {
    const sdk = await loadAmapSdk();
    return new Promise((resolve) => {
        const geocoder = new sdk.Geocoder({});
        geocoder.getAddress([targetPoint.lng, targetPoint.lat], (status, result) => {
            if (status === "complete") {
                const geocodeResult = result as { regeocode?: { formattedAddress?: unknown } } | undefined;
                resolve(String(geocodeResult?.regeocode?.formattedAddress ?? "").trim());
                return;
            }
            resolve("");
        });
    });
};

export const searchLocationPointWithAmap = async (keyword: string): Promise<{ point: GpsPoint; title: string } | null> => {
    const sdk = await loadAmapSdk();
    return new Promise((resolve) => {
        const placeSearch = new sdk.PlaceSearch({
            pageSize: 8,
            extensions: "base",
        } as Record<string, unknown>);
        placeSearch.search(keyword, (status, result) => {
            const placeSearchResult = result as { poiList?: { pois?: Array<{ location?: unknown; name?: unknown }> } } | undefined;
            if (status === "complete" && placeSearchResult?.poiList?.pois?.length) {
                const poi = placeSearchResult.poiList.pois[0];
                const pointValue = extractLngLat(poi?.location);
                if (pointValue) {
                    resolve({
                        point: pointValue,
                        title: String(poi?.name ?? keyword).trim() || keyword,
                    });
                    return;
                }
            }

            const geocoder = new sdk.Geocoder({});
            geocoder.getLocation(keyword, (geoStatus, geoResult) => {
                const geocodeResult = geoResult as { geocodes?: Array<{ location?: unknown }> } | undefined;
                if (geoStatus === "complete" && geocodeResult?.geocodes?.length) {
                    const geoPoint = extractLngLat(geocodeResult.geocodes[0]?.location);
                    if (geoPoint) {
                        resolve({ point: geoPoint, title: keyword });
                        return;
                    }
                }
                resolve(null);
            });
        });
    });
};
