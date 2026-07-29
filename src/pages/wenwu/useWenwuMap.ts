import { useCallback, useEffect, useRef, useState } from "react";

import {
    AUTO_LOCATE_ON_LOAD,
    ENABLE_PROVINCE_HOVER,
    PRESET_LOCATIONS,
} from "./constants";
import { deduceCityFromName, extractMuseumNames, normalizeMuseumQuery } from "./utils";
import type { Artifact, LocationCoordinate } from "./types";

interface UseWenwuMapOptions {
    artifacts: Artifact[];
    filteredArtifacts: Artifact[];
    activeArtifact: Artifact | null;
    isArtifactPanelOpen: boolean;
}

const DEFAULT_MAP_CENTER: [number, number] = [116.397428, 39.90923];
const DEFAULT_MAP_ZOOM = 5;
const FOCUSED_MAP_ZOOM = 14;
const AMAP_SCRIPT_SRC =
    "https://webapi.amap.com/maps?v=1.4.15&key=7a9513e700e06c00890363af1bd2d926&plugin=AMap.Geocoder,AMap.PlaceSearch,AMap.MarkerClusterer";

const buildInfoWindowHtml = (
    museum: string,
    museumArtifacts: Artifact[],
    allMuseumArtifacts: Artifact[]
) => `
    <div class="info-window">
      <div class="info-header">
        <span class="info-icon">🏛️</span>
        <h4 class="info-title">${museum}</h4>
      </div>
      <div class="info-stats">
        <span class="chip">馆藏总数 ${allMuseumArtifacts.length}</span>
      </div>
      <div class="artifact-list">
        ${museumArtifacts
            .map(
                (artifact) =>
                    `<div class="artifact-item" onclick="window.openArtifact(${artifact.id})" style="cursor: pointer;" title="点击查看详情">${artifact.name}</div>`
            )
            .join("")}
      </div>
    </div>
`;

export const useWenwuMap = ({
    artifacts,
    filteredArtifacts,
    activeArtifact,
    isArtifactPanelOpen,
}: UseWenwuMapOptions) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const clustererRef = useRef<any>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const infoWindowRef = useRef<any | null>(null);
    const hoverTimerRef = useRef<number | null>(null);
    const geocodeRunIdRef = useRef(0);
    const hasAutoLocatedRef = useRef(false);
    const provincePolygonsRef = useRef<Record<string, any[]>>({});
    const locationCacheRef = useRef<Map<string, LocationCoordinate>>(new Map());
    const artifactsRef = useRef(artifacts);
    const filteredArtifactsRef = useRef(filteredArtifacts);

    const [isLoadingMap, setIsLoadingMap] = useState(false);
    const [currentProvince, setCurrentProvince] = useState<string | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    artifactsRef.current = artifacts;
    filteredArtifactsRef.current = filteredArtifacts;

    const closeInfoWindow = useCallback(() => {
        try {
            infoWindowRef.current?.close();
        } catch {}
    }, []);

    const getOrCreateInfoWindow = useCallback(() => {
        if (!window.AMap) return null;
        if (!infoWindowRef.current) {
            infoWindowRef.current = new window.AMap.InfoWindow({
                isCustom: true,
                offset: new window.AMap.Pixel(0, -12),
                autoMove: true,
                closeWhenClickMap: true,
            });
        }
        return infoWindowRef.current;
    }, []);

    const geocodeLocation = useCallback(
        async (address: string): Promise<LocationCoordinate | null> => {
            const cityHint = deduceCityFromName(address) || null;
            const normalized = normalizeMuseumQuery(address);
            const cacheKey = `${normalized}__${cityHint || "全国"}`;
            const cached = locationCacheRef.current.get(cacheKey);

            if (cached) {
                return { ...cached, artifacts: [...cached.artifacts] };
            }

            if (!PRESET_LOCATIONS[normalized]) return null;

            const [lng, lat] = PRESET_LOCATIONS[normalized];
            const coordinate: LocationCoordinate = {
                lng,
                lat,
                address: normalized,
                artifacts: [],
            };

            locationCacheRef.current.set(cacheKey, coordinate);
            return { ...coordinate, artifacts: [] };
        },
        []
    );

    const focusMuseumForArtifact = useCallback(
        async (artifact: Artifact) => {
            const mapInstance = mapInstanceRef.current;
            if (!mapInstance || !window.AMap) return;

            const museums = extractMuseumNames(artifact.collectionLocation);
            const museum = museums[0] || artifact.collectionLocation;
            if (!museum) return;

            const coordinate = await geocodeLocation(museum);
            if (!coordinate) return;

            mapInstance.setZoomAndCenter(FOCUSED_MAP_ZOOM, [
                coordinate.lng,
                coordinate.lat,
            ]);

            const museumArtifacts = filteredArtifactsRef.current.filter((item) =>
                item.collectionLocation.includes(museum)
            );
            const allMuseumArtifacts = artifactsRef.current.filter((item) =>
                item.collectionLocation.includes(museum)
            );

            closeInfoWindow();

            const infoWindow = getOrCreateInfoWindow();
            if (!infoWindow) return;

            infoWindow.setContent(
                buildInfoWindowHtml(museum, museumArtifacts, allMuseumArtifacts)
            );
            infoWindow.open(mapInstance, [coordinate.lng, coordinate.lat]);
        },
        [closeInfoWindow, geocodeLocation, getOrCreateInfoWindow]
    );

    const updateMapMarkers = useCallback(async () => {
        const mapInstance = mapInstanceRef.current;
        if (!mapInstance || !window.AMap) return;

        geocodeRunIdRef.current += 1;
        const runId = geocodeRunIdRef.current;
        closeInfoWindow();

        const markers: any[] = [];
        const coordinates: [number, number][] = [];
        const currentFilteredArtifacts = filteredArtifactsRef.current;
        const currentArtifacts = artifactsRef.current;
        const filteredMuseums = new Set<string>();

        currentFilteredArtifacts.forEach((artifact) => {
            const museums = extractMuseumNames(artifact.collectionLocation);
            museums.forEach((museum) => filteredMuseums.add(museum));
        });

        for (const museum of Array.from(filteredMuseums)) {
            if (runId !== geocodeRunIdRef.current) return;

            const museumArtifacts = currentFilteredArtifacts.filter((artifact) =>
                artifact.collectionLocation.includes(museum)
            );

            if (museumArtifacts.length === 0) continue;

            const allMuseumArtifacts = currentArtifacts.filter((artifact) =>
                artifact.collectionLocation.includes(museum)
            );

            const coordinate = await geocodeLocation(museum);
            if (runId !== geocodeRunIdRef.current) return;
            if (!coordinate) continue;

            coordinate.artifacts = museumArtifacts;
            coordinates.push([coordinate.lng, coordinate.lat]);

            const marker = new window.AMap.Marker({
                position: [coordinate.lng, coordinate.lat],
                content: `
                  <div class="museum-marker" title="${museum}">
                    <svg class="museum-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="28" height="28" style="color:#2563eb;filter: drop-shadow(0 2px 6px rgba(37, 99, 235, 0.35));">
                      <path d="M12 3 3 8v2h18V8L12 3zm-7 9h2v7H5v-7zm4 0h2v7H9v-7zm4 0h2v7h-2v-7zm4 0h2v7h-2v-7z"/>
                    </svg>
                  </div>
                `,
                offset: new window.AMap.Pixel(-14, -28),
                clickable: true,
                bubble: true,
                cursor: "pointer",
                zIndex: 120,
            });

            const scheduleClose = () => {
                if (hoverTimerRef.current) {
                    clearTimeout(hoverTimerRef.current);
                }
                hoverTimerRef.current = window.setTimeout(() => {
                    closeInfoWindow();
                }, 120);
            };

            const openInfo = () => {
                if (hoverTimerRef.current) {
                    clearTimeout(hoverTimerRef.current);
                    hoverTimerRef.current = null;
                }

                const infoWindow = getOrCreateInfoWindow();
                if (!infoWindow) return;

                infoWindow.setContent(
                    buildInfoWindowHtml(museum, museumArtifacts, allMuseumArtifacts)
                );
                infoWindow.open(mapInstance, marker.getPosition());

                setTimeout(() => {
                    const panel = document.querySelector(
                        ".info-window"
                    ) as HTMLElement | null;
                    if (!panel) return;
                    panel.onmouseenter = () => {
                        if (hoverTimerRef.current) {
                            clearTimeout(hoverTimerRef.current);
                            hoverTimerRef.current = null;
                        }
                    };
                    panel.onmouseleave = () => {
                        scheduleClose();
                    };
                }, 0);
            };

            marker.on("mouseover", openInfo);
            marker.on("mouseout", scheduleClose);
            marker.on("click", () => {
                if (hoverTimerRef.current) {
                    clearTimeout(hoverTimerRef.current);
                    hoverTimerRef.current = null;
                }
                openInfo();
            });

            markers.push(marker);
        }

        if (runId !== geocodeRunIdRef.current) return;

        if (!clustererRef.current) {
            clustererRef.current = new window.AMap.MarkerClusterer(
                mapInstance,
                markers,
                {
                    gridSize: 80,
                    maxZoom: 15,
                    averageCenter: true,
                    renderClusterMarker: (context: any) => {
                        const count = context.count;
                        const div = document.createElement("div");
                        div.className = "cluster-marker";
                        div.innerHTML = `<span class="cluster-count">${count}</span>`;
                        context.marker.setOffset(
                            new window.AMap.Pixel(-20, -20)
                        );
                        context.marker.setContent(div);
                    },
                }
            );
        } else {
            clustererRef.current.clearMarkers();
            clustererRef.current.addMarkers(markers);
        }

        if (coordinates.length === 1) {
            const [lng, lat] = coordinates[0];
            mapInstance.setZoomAndCenter(FOCUSED_MAP_ZOOM, [lng, lat]);
        } else if (coordinates.length > 1) {
            mapInstance.setFitView(null, false, [60, 60, 60, 60]);
        } else {
            mapInstance.setZoomAndCenter(DEFAULT_MAP_ZOOM, DEFAULT_MAP_CENTER);
        }
    }, [closeInfoWindow, geocodeLocation, getOrCreateInfoWindow]);

    useEffect(() => {
        const initializeMap = () => {
            if (!mapContainerRef.current) {
                setTimeout(() => {
                    if (
                        mapContainerRef.current &&
                        window.AMap &&
                        !mapInstanceRef.current
                    ) {
                        initializeMap();
                    }
                }, 200);
                return;
            }

            if (!window.AMap || mapInstanceRef.current) return;

            try {
                const map = new window.AMap.Map(mapContainerRef.current, {
                    zoom: DEFAULT_MAP_ZOOM,
                    center: DEFAULT_MAP_CENTER,
                    mapStyle: "amap://styles/whitesmoke",
                });

                const safeResize = () => {
                    try {
                        const anyMap = map as any;
                        if (typeof anyMap.resize === "function") {
                            anyMap.resize();
                        } else {
                            const center = map.getCenter();
                            const zoom = map.getZoom();
                            map.setZoom(zoom);
                            map.setCenter(center);
                        }
                    } catch {}
                };

                const onMapComplete = () => {
                    safeResize();
                    setTimeout(() => {
                        safeResize();
                        updateMapMarkers();
                    }, 0);
                };

                const onWinResize = () => {
                    safeResize();
                };

                const setupProvinceHover = (mapIns: any) => {
                    if (!window.AMap) return;
                    window.AMap.plugin("AMap.DistrictSearch", () => {
                        const ds = new window.AMap.DistrictSearch({
                            level: "country",
                            subdistrict: 1,
                            extensions: "all",
                        });
                        ds.search("中国", (status: string, result: any) => {
                            if (status !== "complete") return;
                            const provinces =
                                result?.districtList?.[0]?.districtList || [];
                            provinces.forEach((prov: any) => {
                                const sub = new window.AMap.DistrictSearch({
                                    level: "province",
                                    extensions: "all",
                                });
                                sub.search(
                                    prov.adcode,
                                    (st: string, res: any) => {
                                        if (st !== "complete") return;
                                        const district = res?.districtList?.[0];
                                        const boundaries =
                                            district?.boundaries || [];
                                        const polygons: any[] = [];
                                        boundaries.forEach((path: any) => {
                                            const polygon =
                                                new window.AMap.Polygon({
                                                    path,
                                                    zIndex: 10,
                                                    strokeWeight: 1,
                                                    strokeColor: "#cbd5e1",
                                                    fillOpacity: 0,
                                                    fillColor: "#bfdbfe",
                                                    bubble: true,
                                                    cursor: "pointer",
                                                });
                                            polygon.on("mouseover", () =>
                                                polygon.setOptions({
                                                    fillOpacity: 0.08,
                                                    strokeColor: "#60a5fa",
                                                })
                                            );
                                            polygon.on("mouseout", () =>
                                                polygon.setOptions({
                                                    fillOpacity: 0,
                                                    strokeColor: "#cbd5e1",
                                                })
                                            );
                                            polygons.push(polygon);
                                        });
                                        provincePolygonsRef.current[
                                            prov.adcode
                                        ] = polygons;
                                        polygons.forEach((polygon) =>
                                            polygon.setMap(mapIns)
                                        );
                                    }
                                );
                            });
                        });
                    });
                };

                const autoLocateAndFilterProvince = (mapIns: any) => {
                    if (!window.AMap || hasAutoLocatedRef.current) return;
                    window.AMap.plugin(
                        [
                            "AMap.Geolocation",
                            "AMap.Geocoder",
                            "AMap.DistrictSearch",
                        ],
                        () => {
                            const geolocation = new window.AMap.Geolocation({
                                enableHighAccuracy: true,
                                timeout: 5000,
                            });
                            geolocation.getCurrentPosition(
                                (status: string, result: any) => {
                                    if (status !== "complete") return;
                                    const position = result.position;
                                    const geocoder = new window.AMap.Geocoder({});
                                    geocoder.getAddress(
                                        position,
                                        (addressStatus: string, res: any) => {
                                            if (addressStatus !== "complete") {
                                                return;
                                            }

                                            const addressComponent =
                                                res?.regeocode?.addressComponent;
                                            const provinceName =
                                                addressComponent?.province ||
                                                addressComponent?.city ||
                                                addressComponent?.district ||
                                                "";
                                            if (!provinceName) return;

                                            hasAutoLocatedRef.current = true;
                                            setCurrentProvince(provinceName);

                                            const ds =
                                                new window.AMap.DistrictSearch(
                                                    {
                                                        level: "province",
                                                        extensions: "all",
                                                    }
                                                );
                                            ds.search(
                                                provinceName,
                                                (
                                                    districtStatus: string,
                                                    districtResult: any
                                                ) => {
                                                    if (
                                                        districtStatus !==
                                                        "complete"
                                                    ) {
                                                        return;
                                                    }
                                                    const district =
                                                        districtResult
                                                            ?.districtList?.[0];
                                                    const boundaries =
                                                        district?.boundaries ||
                                                        [];
                                                    if (!boundaries.length) {
                                                        return;
                                                    }
                                                    const tempPolygon =
                                                        new window.AMap.Polygon(
                                                            {
                                                                path: boundaries[0],
                                                            }
                                                        );
                                                    mapIns.setFitView([
                                                        tempPolygon,
                                                    ]);
                                                    tempPolygon.setMap(
                                                        null as any
                                                    );
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                };

                map.on("complete", onMapComplete);
                window.addEventListener("resize", onWinResize);

                if ("ResizeObserver" in window && mapContainerRef.current) {
                    const ro = new ResizeObserver(() => {
                        safeResize();
                    });
                    ro.observe(mapContainerRef.current);
                    resizeObserverRef.current = ro;
                }

                mapInstanceRef.current = map;
                setIsMapReady(true);

                if (ENABLE_PROVINCE_HOVER) {
                    setupProvinceHover(map);
                }
                if (AUTO_LOCATE_ON_LOAD) {
                    autoLocateAndFilterProvince(map);
                }

                const cleanup = () => {
                    window.removeEventListener("resize", onWinResize);
                    if (typeof (map as any).off === "function") {
                        (map as any).off("complete", onMapComplete);
                    }
                    if (resizeObserverRef.current) {
                        resizeObserverRef.current.disconnect();
                        resizeObserverRef.current = null;
                    }
                };
                (map as any).__wm_cleanup__ = cleanup;
            } catch (error) {
                console.error("地图初始化失败:", error);
            }
        };

        const loadAMapScript = () => {
            if (window.AMap) {
                initializeMap();
                return;
            }

            setIsLoadingMap(true);
            window._AMapSecurityConfig = {
                securityJsCode: "3ba01835420271d5405dccba5e089b46",
            };

            const script = document.createElement("script");
            script.src = AMAP_SCRIPT_SRC;
            script.async = true;
            script.onload = () => {
                initializeMap();
                setIsLoadingMap(false);
            };
            script.onerror = () => {
                console.error("高德地图加载失败");
                setIsLoadingMap(false);
            };
            document.head.appendChild(script);
        };

        const timer = setTimeout(() => {
            loadAMapScript();
        }, 100);

        return () => clearTimeout(timer);
    }, [updateMapMarkers]);

    useEffect(() => {
        if (!activeArtifact || !isArtifactPanelOpen || !isMapReady) return;
        focusMuseumForArtifact(activeArtifact);
    }, [activeArtifact, focusMuseumForArtifact, isArtifactPanelOpen, isMapReady]);

    useEffect(() => {
        if (!isMapReady) return;
        updateMapMarkers();
    }, [filteredArtifacts, isMapReady, updateMapMarkers]);

    useEffect(() => {
        closeInfoWindow();
    }, [closeInfoWindow, filteredArtifacts]);

    useEffect(() => {
        return () => {
            const mapInstance = mapInstanceRef.current;
            if (mapInstance && (mapInstance as any).__wm_cleanup__) {
                try {
                    (mapInstance as any).__wm_cleanup__();
                } catch {}
            }
            closeInfoWindow();
            infoWindowRef.current = null;
            mapInstanceRef.current = null;
        };
    }, [closeInfoWindow]);

    return {
        currentProvince,
        focusMuseumForArtifact,
        isLoadingMap,
        mapContainerRef,
    };
};
