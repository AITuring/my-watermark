import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, ExternalLink, Heart, RefreshCw, Sparkles, Star } from "lucide-react";

interface MuseumEvent {
  id: string;
  title: string;
  museum: string;
  city: string;
  start_date: string;
  end_date: string;
  highlights: string[];
  address: string;
  hall: string;
  fee: string;
  open_hours: string;
  city_slug: string;
  cover_url: string;
  poster_url: string;
  rating_stars: number;
  likes_count: number;
  source: string;
  source_url: string;
  updated_at: string;
  raw_excerpt: string;
}

interface OverviewCity {
  city: string;
  event_count: number;
}

interface OverviewMuseum {
  city: string;
  city_slug: string;
  museum: string;
  address: string;
  event_count: number;
}

interface OverviewResponse {
  cities: OverviewCity[];
  museums: OverviewMuseum[];
  events: MuseumEvent[];
  total: number;
  last_refresh: string;
  source?: string;
  events_total?: number;
  events_returned?: number;
}

const DEFAULT_BACKEND_URL = "http://localhost:8000";

function getBackendUrl() {
  return localStorage.getItem("museum_backend_url") || DEFAULT_BACKEND_URL;
}

function normalizeDateInput(value: string) {
  return value ? value : "";
}

function toISODate(dt: Date) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getNextMonthRangeFromToday() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start: toISODate(start), end: toISODate(end) };
}

function normalizeCityName(value: string) {
  return (value || "").replace(/市$/, "").trim();
}

function getEventStatus(startDate: string, endDate: string) {
  if (startDate && endDate && startDate === endDate) {
    return { label: "常设展", color: "bg-purple-100 text-purple-700" };
  }
  const today = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (today < start) return { label: "即将开始", color: "bg-indigo-100 text-indigo-700" };
  if (today > end) return { label: "已结束", color: "bg-slate-100 text-slate-600" };
  return { label: "进行中", color: "bg-emerald-100 text-emerald-700" };
}

function dateOverlaps(eventStart: string, eventEnd: string, queryStart: string, queryEnd: string) {
  if (!queryStart && !queryEnd) return true;
  const es = new Date(eventStart).getTime();
  const ee = new Date(eventEnd).getTime();
  if (Number.isNaN(es) || Number.isNaN(ee)) return true;
  const effectiveEnd = eventStart === eventEnd ? Number.POSITIVE_INFINITY : ee;
  const qs = queryStart ? new Date(queryStart).getTime() : null;
  const qe = queryEnd ? new Date(queryEnd).getTime() : null;
  if (qs !== null && effectiveEnd < qs) return false;
  if (qe !== null && es > qe) return false;
  return true;
}

function buildOverviewFromEvents(items: MuseumEvent[], source: string): OverviewResponse {
  const cityCounter = new Map<string, number>();
  const museumCounter = new Map<string, OverviewMuseum>();
  for (const event of items) {
    cityCounter.set(event.city, (cityCounter.get(event.city) || 0) + 1);
    const key = `${event.city}|${event.museum}|${event.address}`;
    const existing = museumCounter.get(key);
    if (existing) {
      existing.event_count += 1;
    } else {
      museumCounter.set(key, {
        city: event.city,
        city_slug: event.city_slug,
        museum: event.museum,
        address: event.address,
        event_count: 1,
      });
    }
  }
  const cities: OverviewCity[] = Array.from(cityCounter.entries())
    .map(([city, event_count]) => ({ city, event_count }))
    .sort((a, b) => b.event_count - a.event_count);
  const museums = Array.from(museumCounter.values()).sort((a, b) => b.event_count - a.event_count);
  return {
    cities,
    museums,
    events: items,
    total: items.length,
    last_refresh: items[0]?.updated_at || "",
    source,
    events_total: items.length,
    events_returned: items.length,
  };
}

const MuseumEventRadar: React.FC = () => {
  const backendUrl = getBackendUrl();
  const [city, setCity] = useState("北京");
  const [startDate, setStartDate] = useState(() => getNextMonthRangeFromToday().start);
  const [endDate, setEndDate] = useState(() => getNextMonthRangeFromToday().end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dataSource, setDataSource] = useState("json");
  const [data, setData] = useState<OverviewResponse | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any[]>([]);

  const fetchOverview = useCallback(
    async (options?: { forceRefresh?: boolean }) => {
      setLoading(true);
      setError("");
      try {
        const fallbackUrls = [
          "/backend/backend/data/exhibitions_latest.json",
          "/backend/data/exhibitions_latest.json",
          `${backendUrl}/api/museum/events/raw`,
        ];
        let localLoaded = false;
        for (const fallbackUrl of fallbackUrls) {
          try {
            const fallbackResp = await fetch(fallbackUrl, { signal: AbortSignal.timeout(8000) });
            if (!fallbackResp.ok) continue;
            const payload = (await fallbackResp.json()) as unknown;
            if (!Array.isArray(payload)) continue;
            const rows = payload as MuseumEvent[];
            const normalized = buildOverviewFromEvents(rows, fallbackUrl);
            setData(normalized);
            setDataSource("json");
            localLoaded = true;
            break;
          } catch {
            void 0;
          }
        }
        try {
          if (options?.forceRefresh) {
            await fetch(`${backendUrl}/api/museum/events/refresh`, {
              method: "POST",
              signal: AbortSignal.timeout(8000),
            });
          }
          const url = new URL(`${backendUrl}/api/museum/events/overview`);
          if (city.trim()) url.searchParams.set("city", city.trim());
          if (startDate) url.searchParams.set("start_date", normalizeDateInput(startDate));
          if (endDate) url.searchParams.set("end_date", normalizeDateInput(endDate));
          url.searchParams.set("event_limit", "1200");
          const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
          if (resp.ok) {
            const json = (await resp.json()) as OverviewResponse;
            setData({ ...json, source: "backend" });
            setDataSource("backend");
            setError("");
            return;
          }
        } catch {
          void 0;
        }
        if (localLoaded) {
          setError("当前使用本地 JSON 数据（后端未连接）");
        } else {
          setError("后端与本地 JSON 均不可用");
        }
      } finally {
        setLoading(false);
      }
    },
    [backendUrl, city, endDate, startDate]
  );

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchOverview();
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchOverview]);

  const cityOptions = useMemo(() => {
    return (data?.cities || []).map((item) => item.city).filter((item) => item && item !== "未知城市");
  }, [data]);

  const loadAMap = useCallback(async () => {
    if ((window as any).AMap) return (window as any).AMap;
    return await new Promise<any>((resolve, reject) => {
      (window as any)._AMapSecurityConfig = {
        securityJsCode: "3ba01835420271d5405dccba5e089b46",
      };
      const script = document.createElement("script");
      script.src = "https://webapi.amap.com/maps?v=1.4.15&key=7a9513e700e06c00890363af1bd2d926&plugin=AMap.Geocoder";
      script.async = true;
      script.onload = () => resolve((window as any).AMap);
      script.onerror = () => reject(new Error("地图脚本加载失败"));
      document.head.appendChild(script);
    });
  }, []);

  const detectCityByLocation = useCallback(async () => {
    if (!navigator.geolocation) return "北京";
    const coords = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => reject(new Error("定位失败")),
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
      );
    });
    const AMap = await loadAMap();
    const geocoder = new AMap.Geocoder({});
    const cityName = await new Promise<string>((resolve) => {
      geocoder.getAddress([coords.longitude, coords.latitude], (status: string, result: any) => {
        if (status !== "complete") {
          resolve("北京");
          return;
        }
        const component = result?.regeocode?.addressComponent || {};
        const c = component.city || component.province || "";
        if (Array.isArray(c)) {
          resolve(normalizeCityName(c[0] || "北京"));
          return;
        }
        resolve(normalizeCityName(String(c || "北京")));
      });
    });
    return cityName || "北京";
  }, [loadAMap]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detected = await detectCityByLocation();
        if (!cancelled && detected) {
          setCity(detected);
        }
      } catch {
        if (!cancelled) {
          setCity("北京");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detectCityByLocation]);

  const cityEvents = useMemo(() => {
    const cityKeyword = city.trim().toLowerCase();
    const filtered = (data?.events || []).filter((item) => {
      const passCity = !cityKeyword || `${item.city} ${item.city_slug}`.toLowerCase().includes(cityKeyword);
      if (!passCity) return false;
      const passDate = dateOverlaps(item.start_date, item.end_date, startDate, endDate);
      if (!passDate) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const likesDiff = (b.likes_count || 0) - (a.likes_count || 0);
      if (likesDiff !== 0) return likesDiff;
      const starsDiff = (b.rating_stars || 0) - (a.rating_stars || 0);
      if (starsDiff !== 0) return starsDiff;
      return a.start_date > b.start_date ? 1 : -1;
    });
  }, [city, data, endDate, startDate]);

  const cityMuseums = useMemo(() => {
    const dedup = new Map<string, OverviewMuseum>();
    for (const event of cityEvents) {
      const key = `${event.city}|${event.museum}|${event.address}`;
      const existing = dedup.get(key);
      if (existing) {
        existing.event_count += 1;
      } else {
        dedup.set(key, {
          city: event.city,
          city_slug: event.city_slug,
          museum: event.museum,
          address: event.address,
          event_count: 1,
        });
      }
    }
    return Array.from(dedup.values()).sort((a, b) => b.event_count - a.event_count);
  }, [cityEvents]);

  const timelineRange = useMemo(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
        return { min: start, max: end };
      }
    }
    const today = new Date();
    const weekLater = new Date();
    weekLater.setDate(today.getDate() + 7);
    return { min: today, max: weekLater };
  }, [endDate, startDate]);

  const ganttItems = useMemo(() => {
    if (!timelineRange) return [];
    const totalMs = Math.max(24 * 3600 * 1000, timelineRange.max.getTime() - timelineRange.min.getTime());
    const palette = [
      "bg-indigo-500/85",
      "bg-emerald-500/85",
      "bg-sky-500/85",
      "bg-violet-500/85",
      "bg-amber-500/85",
      "bg-rose-500/85",
      "bg-cyan-500/85",
      "bg-fuchsia-500/85",
    ];
    return cityEvents
      .slice()
      .filter((event) => event.start_date !== event.end_date)
      .sort((a, b) => {
        const likesDiff = (b.likes_count || 0) - (a.likes_count || 0);
        if (likesDiff !== 0) return likesDiff;
        const starsDiff = (b.rating_stars || 0) - (a.rating_stars || 0);
        if (starsDiff !== 0) return starsDiff;
        return a.start_date > b.start_date ? 1 : -1;
      })
      .slice(0, 120)
      .map((event, index) => {
        const rangeStartMs = timelineRange.min.getTime();
        const rangeEndMs = timelineRange.max.getTime();
        const startMs = new Date(event.start_date).getTime();
        const rawEndMs = new Date(event.end_date).getTime();
        const effectiveEndMs = Math.max(rawEndMs, startMs);
        const displayStartMs = Math.max(startMs, rangeStartMs);
        const displayEndMs = Math.min(effectiveEndMs, rangeEndMs);
        const left = Math.max(0, ((displayStartMs - rangeStartMs) / totalMs) * 100);
        const width = Math.max(2.4, ((Math.max(displayEndMs, displayStartMs) - displayStartMs) / totalMs) * 100);
        return {
          event,
          left,
          width,
          colorClass: palette[index % palette.length],
          label: `${event.museum}｜${event.title}`,
        };
      });
  }, [cityEvents, timelineRange]);

  const museumGroups = useMemo(() => {
    const map = new Map<string, { museum: string; address: string; events: MuseumEvent[] }>();
    for (const event of cityEvents) {
      const key = `${event.museum}|${event.address}`;
      const existing = map.get(key);
      if (existing) {
        existing.events.push(event);
      } else {
        map.set(key, {
          museum: event.museum,
          address: event.address,
          events: [event],
        });
      }
    }
    return Array.from(map.values())
      .map((group) => ({
        ...group,
        events: group.events.sort((a, b) => {
          const likesDiff = (b.likes_count || 0) - (a.likes_count || 0);
          if (likesDiff !== 0) return likesDiff;
          const starsDiff = (b.rating_stars || 0) - (a.rating_stars || 0);
          if (starsDiff !== 0) return starsDiff;
          return a.start_date > b.start_date ? 1 : -1;
        }),
      }))
      .sort((a, b) => a.museum.localeCompare(b.museum, "zh-CN"));
  }, [cityEvents]);

  const updateMap = useCallback(async () => {
    if (!mapContainerRef.current) return;
    if (!cityMuseums.length) return;
    try {
      const AMap = await loadAMap();
      if (!mapRef.current) {
        mapRef.current = new AMap.Map(mapContainerRef.current, {
          zoom: 10,
          center: [116.397428, 39.90923],
          mapStyle: "amap://styles/whitesmoke",
        });
      }
      markerRef.current.forEach((m) => m.setMap(null));
      markerRef.current = [];

      const geocoder = new AMap.Geocoder({ city: city || undefined });
      const geocodeOne = (address: string) =>
        new Promise<any>((resolve) => {
          geocoder.getLocation(address, (status: string, result: any) => {
            if (status === "complete" && result && result.geocodes && result.geocodes[0]) {
              resolve(result.geocodes[0].location);
            } else {
              resolve(null);
            }
          });
        });

      const points: any[] = [];
      for (const museum of cityMuseums.slice(0, 80)) {
        const location = await geocodeOne(museum.address || `${museum.city}${museum.museum}`);
        if (!location) continue;
        const marker = new AMap.Marker({
          position: [location.lng, location.lat],
          title: museum.museum,
        });
        marker.setMap(mapRef.current);
        markerRef.current.push(marker);
        points.push([location.lng, location.lat]);
      }
      if (points.length) {
        mapRef.current.setFitView(markerRef.current);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "地图加载失败");
    }
  }, [city, cityMuseums, loadAMap]);

  useEffect(() => {
    updateMap();
  }, [updateMap]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <Card className="border-0 bg-white/85 p-5 shadow-sm backdrop-blur md:p-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">临展雷达</h1>
            {/* <p className="text-sm text-slate-600">默认定位当前城市，定位失败则展示北京；支持按时间窗口筛选。</p> */}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
            <Input
              className="md:col-span-4"
              placeholder="城市（如 北京）"
              list="event-city-list"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <datalist id="event-city-list">
              {cityOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <Input
              className="md:col-span-4"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              className="md:col-span-4"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-500 md:grid-cols-3">
            <div>当前城市：{city || "北京"}</div>
            <div>最近同步：{data?.last_refresh || "暂无"}</div>
            {/* <div>数据来源：{dataSource}</div> */}
          </div>
        </Card>

        {error && (
          <Card className="border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            {error}
          </Card>
        )}

        <Card className="border-0 bg-white/90 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm text-slate-600">当前筛选共 {cityEvents.length} 场展览</div>
            <div className="text-xs text-slate-500">城市馆点 {cityMuseums.length} 个</div>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center text-slate-500">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              正在加载展览数据...
            </div>
          ) : cityEvents.length ? (
            <ScrollArea className="h-[64vh] pr-3">
              <div className="grid grid-cols-1 gap-3">
                <Card className="border border-slate-200 p-3">
                  <div className="mb-2 text-sm font-medium text-slate-800">临展时间甘特图</div>
                  {timelineRange ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>起点：{timelineRange.min.toISOString().slice(0, 10)}</span>
                        <span>终点：{timelineRange.max.toISOString().slice(0, 10)}</span>
                      </div>
                      <div className="space-y-3">
                        {ganttItems.map(({ event, left, width, colorClass, label }) => (
                          <div key={`g-${event.id}`} className="space-y-1.5">
                            <div className="truncate text-xs text-slate-600">{label}</div>
                            <div className="h-5 rounded bg-slate-100">
                              <div
                                className={`h-5 rounded ${colorClass}`}
                                style={{ marginLeft: `${left}%`, width: `${width}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>{event.start_date}</span>
                              <span>{event.end_date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">暂无可绘制的时间范围</div>
                  )}
                </Card>
                <Card className="border border-slate-200 p-3">
                  <div className="mb-2 text-sm font-medium text-slate-800">本地博物馆分布</div>
                  <div ref={mapContainerRef} className="h-[280px] w-full rounded-md bg-slate-100" />
                </Card>
                {museumGroups.map((group) => (
                  <Card key={`${group.museum}-${group.address}`} className="border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-base font-semibold text-slate-900">{group.museum}</div>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                        {group.events.length} 场
                      </Badge>
                    </div>
                    {group.address && (
                      <div className="mb-3 text-sm text-slate-500">{group.address}</div>
                    )}
                    <div className="space-y-3">
                      {group.events.map((event) => {
                        const status = getEventStatus(event.start_date, event.end_date);
                        return (
                          <div key={event.id} className="rounded-lg border border-slate-100 p-3">
                            <div className="flex gap-3">
                              {(event.cover_url || event.poster_url) && (
                                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                                  <img
                                    src={event.cover_url || event.poster_url}
                                    alt={event.title}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                  <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{event.title}</h3>
                                  <Badge className={status.color}>{status.label}</Badge>
                                </div>
                                <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  <span>{event.start_date} 至 {event.end_date}</span>
                                </div>
                                <div className="mb-2 flex items-center gap-3 text-xs text-slate-600">
                                  <span className="inline-flex items-center gap-1">
                                    <Heart className="h-3.5 w-3.5 text-rose-500" />
                                    {(event.likes_count || 0).toLocaleString()}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <Star className="h-3.5 w-3.5 text-amber-500" />
                                    {(event.rating_stars || 0).toFixed(1)}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {(event.highlights || []).slice(0, 3).map((h) => (
                                    <Badge key={`${event.id}-${h}`} variant="secondary" className="bg-slate-100 text-slate-700">
                                      <Sparkles className="mr-1 h-3 w-3" />
                                      {h}
                                    </Badge>
                                  ))}
                                </div>
                                {event.source_url && (
                                  <a
                                    href={event.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                                  >
                                    查看来源 <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-slate-500">
              暂无该城市该时间段展览数据。
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default MuseumEventRadar;
