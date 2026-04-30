import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import AMapLoader from "@amap/amap-jsapi-loader";

type ParsedDay = {
    day: number;
    places: string[];
};

type GeocodedPoint = {
    name: string;
    lng: number;
    lat: number;
};

type ResolvedRoute = {
    day: number;
    rawPlaces: string[];
    points: GeocodedPoint[];
};

type RenderRoute = {
    day: number;
    rawPlaces: string[];
    points: GeocodedPoint[];
    color: string;
    center: { lng: number; lat: number } | null;
};

const DAY_COLORS = [
    "#ff5d5d",
    "#f0932b",
    "#f9ca24",
    "#6ab04c",
    "#22a6b3",
    "#686de0",
    "#be2edd",
    "#eb4d4b",
];
const AMAP_KEY_PAIRS = [
    {
        key: "7a9513e700e06c00890363af1bd2d926",
        securityJsCode: "3ba01835420271d5405dccba5e089b46",
    },
    {
        key: "55b6c2fbb0875490d011d74ad99aac31",
        securityJsCode: "8d5961ba4c131a09904cab742029ca42",
    },
] as const;
const DEFAULT_REGION_HINT = "山西省临汾市";
const MAX_DISTANCE_FROM_REGION_KM = 180;
const MAX_DAILY_SEGMENT_KM = 220;

const DEFAULT_ROUTE = `D1：临汾博物馆—灵光寺琉璃塔（国七）—陶寺遗址（国三）与陶寺博物馆—襄汾普净寺（国六）—新绛福胜寺（国五）—汾城古建筑群（国六）
D2：广胜寺（国一）—霍州鼓楼（国八）—霍州州署大堂（国四）—霍州观音庙（国六）—霍州千佛崖（市保）—洪洞净石宫（国七）
D3：姑射山仙洞沟碧岩寺（省四）—坟上村石刻/晋定王墓—王曲东岳庙（国六）—东羊后土庙（国六）—魏村牛王庙戏台（国四）`;

const sanitizeToken = (value: string) =>
    value
        .trim()
        .replace(/（[^）]*）/g, "")
        .replace(/\([^)]*\)/g, "")
        .replace(/（.*$/g, "")
        .replace(/\(.*$/g, "")
        .replace(/[：:]/g, " ")
        .replace(/[()（）【】\[\]《》"“”'‘’]/g, "")
        .replace(/[·、]/g, " ")
        .replace(/\s+/g, "")
        .trim();

const splitPlaceTokens = (routeBody: string) => {
    const roughTokens = routeBody
        .split(/(?:->|→|=>|＞|>|到|—|－|–|,|，|;|；|\/|\|)/g)
        .map((token) => token.trim())
        .filter(Boolean);

    if (roughTokens.length > 1) {
        return roughTokens.map((token) => sanitizeToken(token)).filter(Boolean);
    }
    return routeBody
        .split(/\s+/g)
        .map((token) => sanitizeToken(token))
        .filter(Boolean);
};

const parseRouteInput = (input: string): ParsedDay[] =>
    input
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            let day = index + 1;
            let routeBody = line;

            const cnDayMatch = line.match(/^第?\s*(\d+)\s*天?\s*[：:\-]?\s*(.*)$/i);
            const dDayMatch = line.match(/^d\s*(\d+)\s*[：:\-]?\s*(.*)$/i);
            const enDayMatch = line.match(/^day\s*(\d+)\s*[：:\-]?\s*(.*)$/i);

            if (cnDayMatch) {
                day = Number(cnDayMatch[1]) || day;
                routeBody = cnDayMatch[2] || "";
            } else if (dDayMatch) {
                day = Number(dDayMatch[1]) || day;
                routeBody = dDayMatch[2] || "";
            } else if (enDayMatch) {
                day = Number(enDayMatch[1]) || day;
                routeBody = enDayMatch[2] || "";
            }

            const places = splitPlaceTokens(routeBody);
            return { day, places };
        })
        .filter((item) => item.places.length > 0);

let amapSdkPromise: Promise<any | null> | null = null;
const ensureAmapSdk = async () => {
    if (amapSdkPromise) return amapSdkPromise;
    amapSdkPromise = (async () => {
        for (const credential of AMAP_KEY_PAIRS) {
            try {
                (window as any)._AMapSecurityConfig = {
                    securityJsCode: credential.securityJsCode,
                };
                const AMap = await AMapLoader.load({
                    key: credential.key,
                    version: "2.0",
                    plugins: ["AMap.Geocoder", "AMap.PlaceSearch"],
                });
                return AMap;
            } catch {
                continue;
            }
        }
        return null;
    })();
    return amapSdkPromise;
};

const extractLngLat = (location: any): { lng: number; lat: number } | null => {
    if (!location) return null;
    if (typeof location.lng === "number" && typeof location.lat === "number") {
        return { lng: location.lng, lat: location.lat };
    }
    if (typeof location.getLng === "function" && typeof location.getLat === "function") {
        return { lng: Number(location.getLng()), lat: Number(location.getLat()) };
    }
    if (typeof location === "string" && location.includes(",")) {
        const [lngStr, latStr] = location.split(",");
        const lng = Number(lngStr);
        const lat = Number(latStr);
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
            return { lng, lat };
        }
    }
    return null;
};

const distanceKm = (
    a: { lng: number; lat: number },
    b: { lng: number; lat: number },
) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
};

const detectCityHint = (regionHint: string) => {
    const matches = regionHint.match(/[\u4e00-\u9fa5]{2,}(?:市|州|县|区)/g);
    if (!matches || matches.length === 0) return "全国";
    return matches[matches.length - 1];
};

const geocodeByAmapSdk = async (placeName: string, regionHint: string): Promise<GeocodedPoint | null> => {
    const AMap = await ensureAmapSdk();
    if (!AMap) return null;
    const cleanRegion = regionHint.trim();
    const cityHint = detectCityHint(cleanRegion);
    const queryCandidates = Array.from(
        new Set(
            [
                cleanRegion ? `${cleanRegion}${placeName}` : "",
                cleanRegion ? `${cleanRegion} ${placeName}` : "",
                placeName,
            ]
                .map((item) => item.trim())
                .filter(Boolean),
        ),
    );

    return new Promise((resolve) => {
        let settled = false;
        const finish = (value: GeocodedPoint | null) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        const timeoutId = window.setTimeout(() => {
            finish(null);
        }, 8000);

        const geocoder = new AMap.Geocoder({
            city: cityHint,
        });
        const geocodeOne = (query: string) =>
            new Promise<GeocodedPoint | null>((resolveOne) => {
                geocoder.getLocation(query, (status: string, result: any) => {
                    if (status === "complete" && result?.geocodes?.length) {
                        const position = extractLngLat(result.geocodes[0].location);
                        if (position) {
                            resolveOne({ name: placeName, lng: position.lng, lat: position.lat });
                            return;
                        }
                    }
                    resolveOne(null);
                });
            });

        const searchOne = (query: string, strictCity: boolean) =>
            new Promise<GeocodedPoint | null>((resolveOne) => {
                const placeSearch = new AMap.PlaceSearch({
                    city: cityHint,
                    citylimit: strictCity,
                    pageSize: 1,
                    extensions: "base",
                });
                placeSearch.search(query, (searchStatus: string, searchResult: any) => {
                    if (searchStatus === "complete" && searchResult?.poiList?.pois?.length) {
                        const poi = searchResult.poiList.pois[0];
                        const position = extractLngLat(poi?.location);
                        if (position) {
                            resolveOne({ name: placeName, lng: position.lng, lat: position.lat });
                            return;
                        }
                    }
                    resolveOne(null);
                });
            });

        (async () => {
            for (const query of queryCandidates) {
                const geocodeHit = await geocodeOne(query);
                if (geocodeHit) {
                    window.clearTimeout(timeoutId);
                    finish(geocodeHit);
                    return;
                }
                const strictSearchHit = await searchOne(query, true);
                if (strictSearchHit) {
                    window.clearTimeout(timeoutId);
                    finish(strictSearchHit);
                    return;
                }
            }
            for (const query of queryCandidates) {
                const relaxedSearchHit = await searchOne(query, false);
                if (relaxedSearchHit) {
                    window.clearTimeout(timeoutId);
                    finish(relaxedSearchHit);
                    return;
                }
            }
            window.clearTimeout(timeoutId);
            finish(null);
        })();
    });
};

const geocodeRegionCenter = async (regionHint: string): Promise<{ lng: number; lat: number } | null> => {
    const AMap = await ensureAmapSdk();
    if (!AMap) return null;
    const query = regionHint.trim();
    if (!query) return null;
    const cityHint = detectCityHint(query);
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value: { lng: number; lat: number } | null) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        const timeoutId = window.setTimeout(() => finish(null), 6000);
        const geocoder = new AMap.Geocoder({
            city: cityHint,
        });
        geocoder.getLocation(query, (status: string, result: any) => {
            if (status === "complete" && result?.geocodes?.length) {
                const position = extractLngLat(result.geocodes[0].location);
                if (position) {
                    window.clearTimeout(timeoutId);
                    finish(position);
                    return;
                }
            }
            window.clearTimeout(timeoutId);
            finish(null);
        });
    });
};

const calcCenter = (points: GeocodedPoint[]) => {
    if (!points.length) return null;
    const sum = points.reduce(
        (acc, point) => ({ lng: acc.lng + point.lng, lat: acc.lat + point.lat }),
        { lng: 0, lat: 0 },
    );
    return { lng: sum.lng / points.length, lat: sum.lat / points.length };
};

export default function TravelRouteMap() {
    const [routeInput, setRouteInput] = useState(DEFAULT_ROUTE);
    const [regionHint, setRegionHint] = useState(DEFAULT_REGION_HINT);
    const [resolvedRoutes, setResolvedRoutes] = useState<ResolvedRoute[]>([]);
    const [unresolvedPlaces, setUnresolvedPlaces] = useState<string[]>([]);
    const [isResolving, setIsResolving] = useState(false);
    const [resolveMessage, setResolveMessage] = useState("");
    const cacheRef = useRef(new Map<string, GeocodedPoint | null>());
    const regionCenterCacheRef = useRef(new Map<string, { lng: number; lat: number } | null>());

    const parsedDays = useMemo(() => parseRouteInput(routeInput), [routeInput]);

    useEffect(() => {
        let active = true;

        const resolveAll = async () => {
            if (!parsedDays.length) {
                setResolvedRoutes([]);
                setUnresolvedPlaces([]);
                setResolveMessage("");
                return;
            }

            const uniquePlaces = Array.from(
                new Set(parsedDays.flatMap((day) => day.places)),
            );

            setIsResolving(true);
            setResolveMessage("");

            const placeMap = new Map<string, GeocodedPoint | null>();
            const batchSize = 4;
            for (let i = 0; i < uniquePlaces.length; i += batchSize) {
                const batch = uniquePlaces.slice(i, i + batchSize);
                await Promise.all(
                    batch.map(async (place) => {
                        const cacheKey = `${regionHint.trim()}::${place}`;
                        if (cacheRef.current.has(cacheKey)) {
                            placeMap.set(place, cacheRef.current.get(cacheKey) ?? null);
                            return;
                        }
                        try {
                            const point = await geocodeByAmapSdk(place, regionHint);
                            cacheRef.current.set(cacheKey, point);
                            placeMap.set(place, point);
                        } catch {
                            cacheRef.current.set(cacheKey, null);
                            placeMap.set(place, null);
                        }
                    }),
                );
            }

            if (!active) return;

            const regionKey = regionHint.trim();
            if (!regionCenterCacheRef.current.has(regionKey)) {
                const center = await geocodeRegionCenter(regionKey);
                regionCenterCacheRef.current.set(regionKey, center);
            }
            const regionCenter = regionCenterCacheRef.current.get(regionKey) ?? null;

            const unresolvedSet = new Set<string>();
            const routes: ResolvedRoute[] = parsedDays.map((day) => {
                const points: GeocodedPoint[] = [];
                day.places.forEach((place) => {
                    const point = placeMap.get(place);
                    if (!point) {
                        unresolvedSet.add(place);
                        return;
                    }
                    if (regionCenter) {
                        const outOfRegion = distanceKm(point, regionCenter) > MAX_DISTANCE_FROM_REGION_KM;
                        if (outOfRegion) {
                            unresolvedSet.add(place);
                            return;
                        }
                    }
                    const prev = points[points.length - 1];
                    if (prev) {
                        const tooFar = distanceKm(prev, point) > MAX_DAILY_SEGMENT_KM;
                        if (tooFar) {
                            unresolvedSet.add(place);
                            return;
                        }
                    }
                    points.push(point);
                });
                return {
                    day: day.day,
                    rawPlaces: day.places,
                    points,
                };
            });
            const unresolved = uniquePlaces.filter(
                (place) => unresolvedSet.has(place) || !placeMap.get(place),
            );

            setResolvedRoutes(routes);
            setUnresolvedPlaces(unresolved);
            setIsResolving(false);
            if (unresolved.length > 0) {
                setResolveMessage(
                    `已启用区域与同日行程校验，过滤了 ${unresolved.length} 个不合理或未命中的点位。`,
                );
            } else {
                setResolveMessage("");
            }
        };

        resolveAll().finally(() => {
            if (active) setIsResolving(false);
        });

        return () => {
            active = false;
        };
    }, [parsedDays, regionHint]);

    const renderRoutes = useMemo<RenderRoute[]>(
        () =>
            resolvedRoutes.map((route, index) => ({
                day: route.day,
                rawPlaces: route.rawPlaces,
                points: route.points,
                color: DAY_COLORS[index % DAY_COLORS.length],
                center: calcCenter(route.points),
            })),
        [resolvedRoutes],
    );

    const usedPoints = useMemo(() => {
        const map = new Map<string, GeocodedPoint>();
        renderRoutes.forEach((route) => {
            route.points.forEach((point) => map.set(point.name, point));
        });
        return Array.from(map.values());
    }, [renderRoutes]);

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const amapRef = useRef<any>(null);
    const mapInstanceRef = useRef<any>(null);
    const mapOverlaysRef = useRef<any[]>([]);
    const [mapBootError, setMapBootError] = useState("");
    const [mapReady, setMapReady] = useState(false);
    const [overlayCount, setOverlayCount] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const initMap = async () => {
            if (!mapContainerRef.current || mapInstanceRef.current) return;
            const AMap = await ensureAmapSdk();
            if (cancelled) return;
            if (!AMap) {
                setMapBootError("高德底图加载失败，请刷新重试。");
                return;
            }
            amapRef.current = AMap;
            const map = new AMap.Map(mapContainerRef.current, {
                zoom: 5,
                center: [112.5, 35.8],
                mapStyle: "amap://styles/whitesmoke",
                viewMode: "3D",
                pitch: 20,
            });
            mapInstanceRef.current = map;
            map.on("complete", () => {
                if (typeof map.resize === "function") {
                    map.resize();
                }
                setMapReady(true);
            });
        };
        initMap();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const AMap = amapRef.current;
        const map = mapInstanceRef.current;
        if (!AMap || !map) return;

        try {
            setMapBootError("");
            if (mapOverlaysRef.current.length > 0) {
                map.remove(mapOverlaysRef.current);
            }
            setOverlayCount(0);

            const overlays: any[] = [];
            const allPositions: [number, number][] = [];

            renderRoutes.forEach((route) => {
                const routePath = route.points.map((point) => [point.lng, point.lat] as [number, number]);
                allPositions.push(...routePath);
                if (routePath.length >= 2) {
                    overlays.push(
                        new AMap.Polyline({
                            path: routePath,
                            strokeColor: route.color,
                            strokeWeight: 12,
                            strokeOpacity: 0.2,
                            lineJoin: "round",
                            lineCap: "round",
                            zIndex: 110,
                        }),
                    );
                    overlays.push(
                        new AMap.Polyline({
                            path: routePath,
                            strokeColor: route.color,
                            strokeWeight: 5,
                            strokeOpacity: 0.95,
                            strokeStyle: "dashed",
                            strokeDasharray: [8, 8],
                            lineJoin: "round",
                            lineCap: "round",
                            zIndex: 120,
                        }),
                    );
                }
                if (route.center) {
                    overlays.push(
                        new AMap.Marker({
                            position: [route.center.lng, route.center.lat],
                            offset: new AMap.Pixel(-36, -12),
                            zIndex: 150,
                            content: `<div style="background:#fff8ed;border:2px solid ${route.color};border-radius:999px;padding:4px 10px;font-weight:700;color:#4c3b28;box-shadow:0 6px 18px rgba(0,0,0,0.15);font-size:13px;white-space:nowrap;">Day ${route.day}</div>`,
                        }),
                    );
                }
            });

            usedPoints.forEach((point) => {
                overlays.push(
                    new AMap.CircleMarker({
                        center: [point.lng, point.lat],
                        radius: 6,
                        strokeColor: "#5f4a31",
                        strokeWeight: 2,
                        fillColor: "#fffdf8",
                        fillOpacity: 1,
                        zIndex: 130,
                    }),
                );
                overlays.push(
                    new AMap.Marker({
                        position: [point.lng, point.lat],
                        offset: new AMap.Pixel(8, -22),
                        zIndex: 140,
                        content: `<div style="color:#3f3121;font-weight:700;font-size:13px;text-shadow:0 0 4px rgba(255,255,255,0.95);white-space:nowrap;">${point.name}</div>`,
                    }),
                );
            });

            if (overlays.length > 0) {
                overlays.forEach((overlay) => {
                    if (overlay && typeof overlay.setMap === "function") {
                        overlay.setMap(map);
                    } else {
                        map.add(overlay);
                    }
                });
            }
            mapOverlaysRef.current = overlays;
            setOverlayCount(overlays.length);

            if (allPositions.length === 1) {
                map.setZoomAndCenter(12, allPositions[0]);
            } else if (allPositions.length > 1) {
                map.setFitView(overlays, false, [80, 80, 80, 80]);
            }
        } catch (error) {
            setMapBootError("路线图层渲染失败，请刷新后重试。");
            setOverlayCount(0);
        }
    }, [renderRoutes, usedPoints, mapReady]);

    return (
        <div className="min-h-screen bg-[#f5efe2] text-[#26201b] p-4 md:p-6">
            <style>{`
                .paper-noise::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    opacity: 0.18;
                    background-image:
                        radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.7) 0 1px, transparent 2px),
                        radial-gradient(circle at 70% 80%, rgba(0, 0, 0, 0.06) 0 1px, transparent 2px);
                    background-size: 14px 14px, 18px 18px;
                    mix-blend-mode: multiply;
                }
                .map-paper-overlay {
                    pointer-events: none;
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 40%),
                        radial-gradient(circle at 80% 80%, rgba(0,0,0,0.06), transparent 35%);
                    mix-blend-mode: multiply;
                }
            `}</style>

            <div className="max-w-[1500px] mx-auto grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
                <section className="rounded-3xl border border-[#d5c7ae] bg-[#fffaf0]/90 shadow-[0_18px_60px_-24px_rgba(58,36,15,0.45)] p-5 md:p-6 backdrop-blur-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">旅行路线 3D 手绘地图</h1>
                            <p className="text-sm text-[#6d5b46] mt-2">
                                自动识别景点名后调用高德地理编码定位，不依赖手工维护全量点位库。
                            </p>
                        </div>
                        <Icon icon="ph:mountains-bold" className="text-3xl text-[#7b6143]" />
                    </div>

                    <div className="mt-5 rounded-xl border border-[#d6c5ad] bg-[#fffdf7] px-3 py-2 text-xs text-[#6f5940]">
                        已复用项目内高德地图配置（来自 `Wenwu` / `RestaurantFinder`），无需再手动填写 Key。
                    </div>

                    <label htmlFor="route-input" className="block text-sm font-semibold mt-5 mb-2">
                        输入路线（支持 D1/第1天，支持 `—` `/` `-&gt;` 分隔）
                    </label>
                    <label htmlFor="region-hint" className="block text-sm font-semibold mt-3 mb-2">
                        区域约束（用于消除同名地点歧义）
                    </label>
                    <input
                        id="region-hint"
                        value={regionHint}
                        onChange={(event) => setRegionHint(event.target.value)}
                        className="w-full rounded-2xl border border-[#cbb89b] bg-[#fff8ea] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#d69452] shadow-inner"
                        placeholder="例如：山西省临汾市"
                    />
                    <textarea
                        id="route-input"
                        value={routeInput}
                        onChange={(event) => setRouteInput(event.target.value)}
                        className="w-full min-h-[220px] resize-y rounded-2xl border border-[#cbb89b] bg-[#fff8ea] p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-[#d69452] shadow-inner"
                        placeholder="第1天：北京 -> 西安&#10;第2天：西安 -> 成都 -> 重庆"
                    />

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-[#d6c5ad] bg-[#fffdf7] px-3 py-2">
                            <div className="text-[#7b6247]">已识别天数</div>
                            <div className="text-xl font-semibold">{parsedDays.length} 天</div>
                        </div>
                        <div className="rounded-xl border border-[#d6c5ad] bg-[#fffdf7] px-3 py-2">
                            <div className="text-[#7b6247]">已定位点位</div>
                            <div className="text-xl font-semibold">{usedPoints.length} 个</div>
                        </div>
                        <div className="rounded-xl border border-[#d6c5ad] bg-[#fffdf7] px-3 py-2 sm:col-span-2">
                            <div className="text-[#7b6247]">地图覆盖物</div>
                            <div className="text-xl font-semibold">{overlayCount} 个</div>
                        </div>
                    </div>

                    {isResolving ? (
                        <div className="mt-4 rounded-xl border border-[#acd3e9] bg-[#edf7ff] px-3 py-2 text-sm text-[#1e5f84]">
                            正在通过高德地理编码解析点位，请稍候...
                        </div>
                    ) : null}

                    {resolveMessage ? (
                        <div className="mt-4 rounded-xl border border-[#f4cf9e] bg-[#fff1de] px-3 py-2 text-sm text-[#8d4a19]">
                            {resolveMessage}
                        </div>
                    ) : null}

                    {unresolvedPlaces.length > 0 ? (
                        <div className="mt-4 rounded-xl border border-[#f4cf9e] bg-[#fff1de] px-3 py-2 text-sm text-[#8d4a19]">
                            未命中点位：{unresolvedPlaces.join("、")}
                        </div>
                    ) : (
                        <div className="mt-4 rounded-xl border border-[#cce6c5] bg-[#edf9ea] px-3 py-2 text-sm text-[#2f6d32]">
                            图例已校准：每一天颜色唯一，图例颜色与路径严格一一对应。
                        </div>
                    )}
                </section>

                <section className="relative rounded-3xl border border-[#d4c2a9] bg-[#f8f0df] p-4 md:p-6 shadow-[0_28px_70px_-26px_rgba(30,23,11,0.48)] overflow-hidden paper-noise">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-bold">中国旅行路线图</h2>
                            <p className="text-xs text-[#7b6247] mt-1">
                                基于真实高德底图绘制，点位与路线严格按真实经纬度落位。
                            </p>
                        </div>
                        <div className="hidden md:flex items-center gap-2 text-xs text-[#7b6247]">
                            <span className="inline-block w-3 h-3 rounded-full bg-[#7b6143]" />
                            手绘风格
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#c9b79f] bg-gradient-to-br from-[#fff7e8] to-[#f0dfc3] p-3 md:p-4 shadow-inner">
                        <div className="relative rounded-xl overflow-hidden border border-[#d3c1a5]">
                            <div ref={mapContainerRef} className="w-full h-[68vh] min-h-[420px]" />
                            <div className="map-paper-overlay" />
                        </div>
                        {mapBootError ? (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {mapBootError}
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {renderRoutes.map((route) => (
                            <div
                                key={`legend-row-${route.day}`}
                                className="rounded-xl border border-[#d2c2ab] bg-[#fff8eb]/90 px-3 py-2 text-sm"
                            >
                                <div className="flex items-center gap-2 font-semibold">
                                    <span
                                        className="inline-block w-3.5 h-3.5 rounded-full"
                                        style={{ backgroundColor: route.color }}
                                    />
                                    第 {route.day} 天
                                </div>
                                <div className="mt-1 text-[#6f5940]">
                                    {route.rawPlaces.join(" -> ")}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
