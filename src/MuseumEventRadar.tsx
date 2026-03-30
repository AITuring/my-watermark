import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, Clock3, ExternalLink, MapPin, RefreshCw, Sparkles } from "lucide-react";

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

function getEventStatus(startDate: string, endDate: string) {
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
  const qs = queryStart ? new Date(queryStart).getTime() : null;
  const qe = queryEnd ? new Date(queryEnd).getTime() : null;
  if (qs !== null && ee < qs) return false;
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
  const [backendUrl, setBackendUrl] = useState(getBackendUrl());
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
          if (keyword.trim()) url.searchParams.set("keyword", keyword.trim());
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
    [backendUrl, city, endDate, keyword, startDate]
  );

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    localStorage.setItem("museum_backend_url", backendUrl);
  }, [backendUrl]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchOverview();
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchOverview]);

  const cityOptions = useMemo(() => {
    return (data?.cities || []).map((item) => item.city).filter((item) => item && item !== "未知城市");
  }, [data]);

  const cityEvents = useMemo(() => {
    const cityKeyword = city.trim().toLowerCase();
    const keywordKeyword = keyword.trim().toLowerCase();
    return (data?.events || []).filter((item) => {
      const passCity = !cityKeyword || `${item.city} ${item.city_slug}`.toLowerCase().includes(cityKeyword);
      if (!passCity) return false;
      const passDate = dateOverlaps(item.start_date, item.end_date, startDate, endDate);
      if (!passDate) return false;
      if (!keywordKeyword) return true;
      const haystack = `${item.title} ${item.museum} ${item.city} ${item.address} ${(item.highlights || []).join(" ")} ${item.raw_excerpt}`.toLowerCase();
      return haystack.includes(keywordKeyword);
    });
  }, [city, data, endDate, keyword, startDate]);

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
    const dates = cityEvents.flatMap((item) => [new Date(item.start_date), new Date(item.end_date)]).filter((d) => !Number.isNaN(d.getTime()));
    if (!dates.length) return null;
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    return { min, max };
  }, [cityEvents]);

  const ganttItems = useMemo(() => {
    if (!timelineRange) return [];
    const totalMs = Math.max(24 * 3600 * 1000, timelineRange.max.getTime() - timelineRange.min.getTime());
    return cityEvents
      .slice()
      .sort((a, b) => (a.start_date > b.start_date ? 1 : -1))
      .slice(0, 120)
      .map((event) => {
        const start = new Date(event.start_date).getTime();
        const end = new Date(event.end_date).getTime();
        const left = Math.max(0, ((start - timelineRange.min.getTime()) / totalMs) * 100);
        const width = Math.max(1.6, ((Math.max(end, start) - start) / totalMs) * 100);
        return { event, left, width };
      });
  }, [cityEvents, timelineRange]);

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

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchOverview({ forceRefresh: true });
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <Card className="border-0 bg-white/85 p-5 shadow-sm backdrop-blur md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">全国临展雷达</h1>
              <p className="text-sm text-slate-600">聚合博物馆临时展览时间与重点，按城市和时间快速筛选。</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleManualRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                强制刷新
              </Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
            <Input
              className="md:col-span-3"
              placeholder="关键词（展名/重点）"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Input
              className="md:col-span-2"
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
              className="md:col-span-2"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              className="md:col-span-2"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <Button className="md:col-span-1" onClick={() => fetchOverview()} disabled={loading}>
              查询
            </Button>
            <Button
              className="md:col-span-2"
              variant="secondary"
              onClick={() => {
                setKeyword("");
                setCity("");
                setStartDate("");
                setEndDate("");
                fetchOverview();
              }}
            >
              重置
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-500 md:grid-cols-3">
            <div>后端地址：{backendUrl}</div>
            <div>最近同步：{data?.last_refresh || "暂无"}</div>
            <div>范围：已聚合 {data?.cities?.length ?? 0} 城市，{data?.museums?.length ?? 0} 个展馆（来源：{dataSource}）</div>
          </div>
          <div className="mt-3">
            <Input
              placeholder="自定义后端地址，例如 http://localhost:8000"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value.trim())}
            />
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
                  <div className="mb-2 text-sm font-medium text-slate-800">城市博物馆分布图</div>
                  <div ref={mapContainerRef} className="h-[280px] w-full rounded-md bg-slate-100" />
                </Card>
                <Card className="border border-slate-200 p-3">
                  <div className="mb-2 text-sm font-medium text-slate-800">临展时间甘特图</div>
                  {timelineRange ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{timelineRange.min.toISOString().slice(0, 10)}</span>
                        <span>{timelineRange.max.toISOString().slice(0, 10)}</span>
                      </div>
                      <div className="space-y-2">
                        {ganttItems.map(({ event, left, width }) => (
                          <div key={`g-${event.id}`} className="grid grid-cols-12 items-center gap-2">
                            <div className="col-span-4 truncate text-xs text-slate-600">{event.title}</div>
                            <div className="col-span-8 h-5 rounded bg-slate-100">
                              <div
                                className="h-5 rounded bg-indigo-500/80"
                                style={{ marginLeft: `${left}%`, width: `${width}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">暂无可绘制的时间范围</div>
                  )}
                </Card>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {cityEvents.map((event) => {
                  const status = getEventStatus(event.start_date, event.end_date);
                  return (
                    <Card key={event.id} className="rounded-xl border border-slate-200 p-4 transition hover:shadow-md">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{event.title}</h3>
                        <Badge className={status.color}>{status.label}</Badge>
                      </div>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{event.city} · {event.museum}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          <span>{event.start_date} 至 {event.end_date}</span>
                        </div>
                        {event.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{event.address}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4" />
                          <span>来源：{event.source || "未知"}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(event.highlights || []).slice(0, 4).map((h) => (
                          <Badge key={`${event.id}-${h}`} variant="secondary" className="bg-slate-100 text-slate-700">
                            <Sparkles className="mr-1 h-3 w-3" />
                            {h}
                          </Badge>
                        ))}
                      </div>
                      {event.raw_excerpt && (
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">{event.raw_excerpt}</p>
                      )}
                      {event.source_url && (
                        <a
                          href={event.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                        >
                          查看来源 <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </Card>
                  );
                })}
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-slate-500">
              暂无展览数据，可先点击“强制刷新”，或在后端配置公众号数据源后重试。
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default MuseumEventRadar;
