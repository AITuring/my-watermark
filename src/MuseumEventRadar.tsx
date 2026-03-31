import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, CalendarDays, Clock3, ExternalLink, Heart, Info, MapPin, RefreshCw, Sparkles } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

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
  source: string;
  source_url: string;
  updated_at: string;
  raw_excerpt: string;
  rating?: number;
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

interface MapCoord {
  lng: number;
  lat: number;
}

interface RouteStep {
  type: "event" | "break" | "travel";
  id: string;
  time: string;
  endTime: string;
  title: string;
  subtitle: string;
  address: string;
}

type TravelMode = "driving" | "walking" | "transfer";

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

function computeCityCAI(events: MuseumEvent[]) {
  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 24 * 3600 * 1000);
  const cityMap = new Map<
    string,
    { city: string; ongoing: number; endingSoon: number; ratingSum: number; ratedCount: number; eventCount: number }
  >();
  for (const e of events) {
    if (!e.city || e.city === "未知城市") continue;
    const start = new Date(e.start_date);
    const end = new Date(e.end_date);
    const permanent = e.start_date === e.end_date;
    const ongoing = permanent || (start <= today && end >= today);
    const endingSoon = !permanent && end >= today && end <= in7;
    const key = e.city || "未知城市";
    const entry =
      cityMap.get(key) ||
      { city: key, ongoing: 0, endingSoon: 0, ratingSum: 0, ratedCount: 0, eventCount: 0 };
    entry.eventCount += 1;
    if (ongoing) entry.ongoing += 1;
    if (endingSoon) entry.endingSoon += 1;
    if (typeof e.rating === "number") {
      entry.ratingSum += e.rating;
      entry.ratedCount += 1;
    }
    cityMap.set(key, entry);
  }
  const ranking = Array.from(cityMap.values())
    .map((r) => {
      const rAvg = r.ratedCount ? r.ratingSum / r.ratedCount : 0;
      const cai = r.ongoing * 0.6 + r.endingSoon * 1.5 + rAvg * 2.0;
      return { city: r.city, cai, ongoing: r.ongoing, endingSoon: r.endingSoon, rAvg, eventCount: r.eventCount };
    })
    .sort((a, b) => b.cai - a.cai);
  return ranking;
}

function getProgressState(start_date: string, end_date: string) {
  const now = new Date().getTime();
  const start = new Date(start_date).getTime();
  const end = new Date(end_date).getTime();
  const permanent = start_date === end_date;
  if (Number.isNaN(start) || Number.isNaN(end)) return { progress: 0, state: "unknown", ended: false };
  if (permanent) return { progress: 0.5, state: "permanent", ended: false };
  const duration = Math.max(1, end - start);
  const ratio = (now - start) / duration;
  if (ratio < 0) return { progress: 0, state: "pre", ended: false };
  if (ratio >= 1) return { progress: 1, state: "ended", ended: true };
  if (ratio > 0.8) return { progress: Math.min(1, ratio), state: "lastcall", ended: false };
  return { progress: Math.min(1, ratio), state: "hot", ended: false };
}

function computeOpenStatus(open_hours: string) {
  const text = (open_hours || "").replace(/\s+/g, "");
  const now = new Date();
  const weekday = now.getDay();
  if (/周一(闭馆|休馆)/.test(text) && weekday === 1) return { label: "○ 闭馆中", color: "text-slate-600" };
  const times: Array<{ h: number; m: number }> = [];
  const re = /(?:(\d{1,2})(?::|：)?(\d{2})?)(?:\s*(?:-|至|到)\s*(\d{1,2})(?::|：)?(\d{2})?)?/g;
  let m;
  while ((m = re.exec(open_hours))) {
    const h1 = Number(m[1]);
    const n1 = Number(m[2] || "0");
    const h2 = m[3] ? Number(m[3]) : NaN;
    const n2 = m[4] ? Number(m[4]) : NaN;
    if (Number.isFinite(h1)) times.push({ h: h1, m: n1 });
    if (Number.isFinite(h2)) times.push({ h: h2, m: n2 || 0 });
  }
  let startMin = 9 * 60;
  let endMin = 17 * 60;
  if (times.length >= 2) {
    startMin = times[0].h * 60 + times[0].m;
    endMin = times[times.length - 1].h * 60 + times[times.length - 1].m;
  } else if (times.length === 1) {
    endMin = times[0].h * 60 + times[0].m;
  } else if (/延长至?(\d{1,2})(?::|：)?(\d{2})?/.test(open_hours)) {
    const mm = /延长至?(\d{1,2})(?::|：)?(\d{2})?/.exec(open_hours)!;
    endMin = Number(mm[1]) * 60 + Number(mm[2] || "0");
  }
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < startMin || nowMin >= endMin) return { label: "○ 闭馆中", color: "text-slate-600" };
  if (endMin - nowMin <= 60) return { label: "⏰ 即将闭馆", color: "text-orange-600" };
  return { label: "● 开放中", color: "text-emerald-600" };
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, "0")}`;
}

function getRelativeDayLabel(value: string) {
  const target = new Date(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const delta = Math.round((startOfTarget - startOfToday) / (24 * 3600 * 1000));
  if (delta === 0) return "今天";
  if (delta === 1) return "明天";
  if (delta > 1 && delta <= 7) return `${delta} 天后`;
  if (delta === -1) return "昨天";
  if (delta < -1) return `${Math.abs(delta)} 天前`;
  return formatDateLabel(value);
}

function buildCityBrief(cityName: string, events: MuseumEvent[], caiScore?: number) {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const cityEvents = events.filter((event) => normalizeCityName(event.city) === normalizeCityName(cityName));
  const openingSoon = cityEvents.filter((event) => {
    const start = new Date(event.start_date);
    return start >= now && start <= in7;
  }).length;
  const endingSoon = cityEvents.filter((event) => {
    if (event.start_date === event.end_date) return false;
    const end = new Date(event.end_date);
    return end >= now && end <= in7;
  }).length;
  const active = cityEvents.filter((event) => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    return event.start_date === event.end_date || (start <= now && end >= now);
  }).length;
  const featured = cityEvents
    .slice()
    .sort((a, b) => (b.highlights?.length || 0) - (a.highlights?.length || 0))[0];
  const sentence = `${cityName}：本周 ${openingSoon} 个新展，${endingSoon} 个闭幕，当前 ${active} 场进行中${typeof caiScore === "number" ? `，CAI ${caiScore.toFixed(1)}` : ""}。`;
  return { openingSoon, endingSoon, active, featured, sentence };
}

function buildRoutePlan(events: MuseumEvent[]) {
  let cursor = 9 * 60 + 30;
  return events.flatMap((event, index) => {
    const closingMinuteMatch = /(\d{1,2})(?::|：)?(\d{2})?\s*(?:$|[^0-9]*$)/.exec(event.open_hours || "");
    const closingMinute = closingMinuteMatch
      ? Number(closingMinuteMatch[1]) * 60 + Number(closingMinuteMatch[2] || "0")
      : 17 * 60;
    const startMinute = Math.min(cursor, Math.max(9 * 60 + 30, closingMinute - 120));
    const endMinute = Math.min(closingMinute, startMinute + 90);
    const visitItem = {
      type: "event" as const,
      id: event.id,
      time: `${String(Math.floor(startMinute / 60)).padStart(2, "0")}:${String(startMinute % 60).padStart(2, "0")}`,
      endTime: `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`,
      title: event.title,
      subtitle: event.museum,
      address: event.address,
    };
    cursor = endMinute + 35;
    const lunchNeeded = index < events.length - 1 && cursor <= 13 * 60;
    if (!lunchNeeded) return [visitItem];
    const lunchStart = cursor;
    cursor += 75;
    return [
      visitItem,
      {
        type: "break" as const,
        id: `break-${event.id}`,
        time: `${String(Math.floor(lunchStart / 60)).padStart(2, "0")}:${String(lunchStart % 60).padStart(2, "0")}`,
        endTime: `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`,
        title: "简餐补给",
        subtitle: "附近高分咖啡馆 / 餐厅",
        address: event.address,
      },
    ];
  });
}

function minutesToClock(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function getFallbackAccent(event: MuseumEvent | null) {
  if (!event) return "rgb(41, 72, 128)";
  const progress = getProgressState(event.start_date, event.end_date);
  if (progress.state === "lastcall") return "rgb(185, 28, 28)";
  if (progress.state === "hot") return "rgb(29, 78, 216)";
  if (progress.state === "pre") return "rgb(71, 85, 105)";
  return "rgb(41, 72, 128)";
}

const MuseumEventRadar: React.FC = () => {
  const backendUrl = getBackendUrl();
  const [city, setCity] = useState("北京");
  const [startDate, setStartDate] = useState(() => toISODate(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const dt = new Date();
    dt.setDate(dt.getDate() + 7);
    return toISODate(dt);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dataSource, setDataSource] = useState("json");
  const [data, setData] = useState<OverviewResponse | null>(null);
  const cityMapContainerRef = useRef<HTMLDivElement | null>(null);
  const cityMapRef = useRef<any>(null);
  const cityMarkerRef = useRef<any[]>([]);
  const cityCoordCacheRef = useRef<Map<string, MapCoord>>(new Map());
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [detailAccent, setDetailAccent] = useState("rgb(41, 72, 128)");
  const [currentCoords, setCurrentCoords] = useState<MapCoord | null>(null);
  const [planningRoute, setPlanningRoute] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [highlightPage, setHighlightPage] = useState(0);
  const [showSourceSummary, setShowSourceSummary] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("museum_favorites");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [itinerary, setItinerary] = useState<MuseumEvent[]>(() => {
    try {
      const raw = localStorage.getItem("museum_itinerary");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      return [];
    } catch {
      return [];
    }
  });

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
      script.src = "https://webapi.amap.com/maps?v=1.4.15&key=7a9513e700e06c00890363af1bd2d926&plugin=AMap.Geocoder,AMap.Driving,AMap.Walking,AMap.Transfer";
      script.async = true;
      script.onload = () => resolve((window as any).AMap);
      script.onerror = () => reject(new Error("地图脚本加载失败"));
      document.head.appendChild(script);
    });
  }, []);

  const geocodeLocation = useCallback(
    async (keyword: string, cityKeyword?: string) => {
      if (!keyword) return null;
      const cacheKey = `${cityKeyword || ""}|${keyword}`;
      const cached = cityCoordCacheRef.current.get(cacheKey);
      if (cached) return cached;
      const AMap = await loadAMap();
      const geocoder = new AMap.Geocoder({ city: cityKeyword || undefined });
      const location = await new Promise<MapCoord | null>((resolve) => {
        geocoder.getLocation(keyword, (status: string, result: any) => {
          if (status === "complete" && result?.geocodes?.[0]?.location) {
            resolve({
              lng: result.geocodes[0].location.lng,
              lat: result.geocodes[0].location.lat,
            });
            return;
          }
          resolve(null);
        });
      });
      if (location) {
        cityCoordCacheRef.current.set(cacheKey, location);
      }
      return location;
    },
    [loadAMap]
  );

  const estimateTravelMinutes = useCallback(
    async (from: MapCoord, to: MapCoord, mode: TravelMode) => {
      const AMap = await loadAMap();
      const straightDistance = Math.hypot(from.lng - to.lng, from.lat - to.lat) * 111;
      const fallbackMinutes =
        mode === "walking"
          ? Math.max(15, Math.round((straightDistance / 5) * 60))
          : mode === "transfer"
          ? Math.max(18, Math.round((straightDistance / 20) * 60))
          : Math.max(10, Math.round((straightDistance / 28) * 60));
      if (mode === "walking" && AMap?.Walking) {
        const walking = new AMap.Walking({});
        return await new Promise<number>((resolve) => {
          walking.search([from.lng, from.lat], [to.lng, to.lat], (status: string, result: any) => {
            if (status === "complete" && result?.routes?.[0]?.time) {
              resolve(Math.max(8, Math.round(result.routes[0].time / 60)));
              return;
            }
            resolve(fallbackMinutes);
          });
        });
      }
      if (mode === "transfer" && AMap?.Transfer) {
        const transfer = new AMap.Transfer({});
        return await new Promise<number>((resolve) => {
          transfer.search([from.lng, from.lat], [to.lng, to.lat], (status: string, result: any) => {
            if (status === "complete" && result?.plans?.[0]?.time) {
              resolve(Math.max(10, Math.round(result.plans[0].time / 60)));
              return;
            }
            resolve(fallbackMinutes);
          });
        });
      }
      if (AMap?.Driving) {
        const driving = new AMap.Driving({});
        return await new Promise<number>((resolve) => {
          driving.search([from.lng, from.lat], [to.lng, to.lat], (status: string, result: any) => {
            if (status === "complete" && result?.routes?.[0]?.time) {
              resolve(Math.max(8, Math.round(result.routes[0].time / 60)));
              return;
            }
            resolve(fallbackMinutes);
          });
        });
      }
      return fallbackMinutes;
    },
    [loadAMap]
  );

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
    setCurrentCoords({ lng: coords.longitude, lat: coords.latitude });
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
    return (data?.events || []).filter((item) => {
      const passCity = !cityKeyword || `${item.city} ${item.city_slug}`.toLowerCase().includes(cityKeyword);
      if (!passCity) return false;
      const passDate = dateOverlaps(item.start_date, item.end_date, startDate, endDate);
      if (!passDate) return false;
      return true;
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
      .sort((a, b) => {
        const aPermanent = a.start_date === a.end_date;
        const bPermanent = b.start_date === b.end_date;
        if (aPermanent !== bPermanent) {
          return aPermanent ? 1 : -1;
        }
        if (a.start_date === b.start_date) {
          return a.museum.localeCompare(b.museum, "zh-CN");
        }
        return a.start_date > b.start_date ? 1 : -1;
      })
      .slice(0, 120)
      .map((event, index) => {
        const start = new Date(event.start_date).getTime();
        const end = new Date(event.end_date).getTime();
        const left = Math.max(0, ((start - timelineRange.min.getTime()) / totalMs) * 100);
        const permanent = event.start_date === event.end_date;
        const phase = getProgressState(event.start_date, event.end_date);
        const width = permanent
          ? Math.max(100 - left, 10)
          : Math.max(2.4, ((Math.max(end, start) - start) / totalMs) * 100);
        return {
          event,
          left,
          width,
          permanent,
          colorClass:
            phase.state === "pre"
              ? "bg-[repeating-linear-gradient(90deg,#c7cddc_0_8px,transparent_8px_16px)]"
              : phase.state === "lastcall"
              ? "bg-red-600"
              : phase.state === "hot"
              ? "bg-blue-700"
              : "bg-slate-400",
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
        events: group.events.sort((a, b) => (a.start_date > b.start_date ? 1 : -1)),
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

      const points: any[] = [];
      for (const museum of cityMuseums.slice(0, 80)) {
        const location = await geocodeLocation(museum.address || `${museum.city}${museum.museum}`, city);
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
  }, [city, cityMuseums, geocodeLocation, loadAMap]);

  useEffect(() => {
    updateMap();
  }, [updateMap]);

  const cityRanking = useMemo(() => {
    const all = data?.events || [];
    return computeCityCAI(all).filter((c) => c.city && c.city !== "未知城市").slice(0, 15);
  }, [data]);

  useEffect(() => {
    const paintCityPulseMap = async () => {
      if (!cityMapContainerRef.current || !cityRanking.length) return;
      try {
        const AMap = await loadAMap();
        if (!cityMapRef.current) {
          cityMapRef.current = new AMap.Map(cityMapContainerRef.current, {
            zoom: 4.5,
            center: [104.195397, 35.86166],
            dragEnable: true,
            zoomEnable: true,
            mapStyle: "amap://styles/whitesmoke",
            viewMode: "2D",
          });
        }
        cityMarkerRef.current.forEach((marker) => marker.setMap(null));
        cityMarkerRef.current = [];
        for (const item of cityRanking.slice(0, 12)) {
          const location = await geocodeLocation(item.city, item.city);
          if (!location) continue;
          const active = normalizeCityName(item.city) === normalizeCityName(city);
          const pulseSize = Math.round(44 + item.cai * 7);
          const marker = new AMap.Marker({
            position: [location.lng, location.lat],
            offset: new AMap.Pixel(-pulseSize / 2, -pulseSize / 2),
            content: `
              <button style="width:${pulseSize}px;height:${pulseSize}px;border:none;background:transparent;cursor:pointer;position:relative;">
                <span style="position:absolute;inset:0;border-radius:999px;background:${active ? "rgba(15,23,42,0.92)" : "rgba(29,78,216,0.18)"};animation:pulse-city 2.4s ease-out infinite;"></span>
                <span style="position:absolute;inset:${active ? "9px" : "12px"};border-radius:999px;background:${active ? "#f8fafc" : "rgba(29,78,216,0.88)"};display:flex;align-items:center;justify-content:center;color:${active ? "#0f172a" : "white"};font-size:11px;font-weight:700;">${item.city.slice(0, 2)}</span>
              </button>
            `,
            extData: { city: item.city },
          });
          marker.on("click", () => setCity(item.city));
          marker.setMap(cityMapRef.current);
          cityMarkerRef.current.push(marker);
        }
      } catch {
        void 0;
      }
    };
    paintCityPulseMap();
  }, [city, cityRanking, geocodeLocation, loadAMap]);

  const activeCityInsight = useMemo(() => {
    const rank = cityRanking.find((item) => normalizeCityName(item.city) === normalizeCityName(city));
    return buildCityBrief(city || "北京", data?.events || [], rank?.cai);
  }, [city, cityRanking, data]);

  const selectedEvent = useMemo(() => {
    return cityEvents.find((event) => event.id === selectedEventId) || cityEvents[0] || null;
  }, [cityEvents, selectedEventId]);

  const favoriteEvents = useMemo(() => {
    const set = new Set(favorites);
    return (data?.events || []).filter((e) => set.has(e.id));
  }, [data, favorites]);

  const getClosingMinute = useCallback((open_hours: string) => {
    const text = open_hours || "";
    const m = /(\d{1,2})(?::|：)?(\d{2})?\s*(?:$|[^0-9]*$)/.exec(text);
    if (m) {
      return Number(m[1]) * 60 + Number(m[2] || "0");
    }
    return 17 * 60;
  }, []);

  const favoriteTimelineGroups = useMemo(() => {
    const scoped = favoriteEvents.filter((event) => normalizeCityName(event.city) === normalizeCityName(city));
    return {
      rescue: scoped.filter((event) => getProgressState(event.start_date, event.end_date).state === "lastcall"),
      active: scoped.filter((event) => getProgressState(event.start_date, event.end_date).state === "hot"),
      upcoming: scoped.filter((event) => getProgressState(event.start_date, event.end_date).state === "pre"),
    };
  }, [city, favoriteEvents]);

  const planItinerary = useCallback(async () => {
    const selected = favoriteEvents.filter((e) => normalizeCityName(e.city) === normalizeCityName(city));
    if (selected.length < 3) return;
    setPlanningRoute(true);
    try {
      const enriched = (
        await Promise.all(
          selected.map(async (event) => ({
            event,
            coord: await geocodeLocation(event.address || `${event.city}${event.museum}`, event.city),
            closingMinute: getClosingMinute(event.open_hours),
          }))
        )
      ).filter((item) => item.coord);
      if (!enriched.length) return;
      const ordered: typeof enriched = [];
      let currentPoint = currentCoords || enriched[0].coord!;
      let currentMinute = 9 * 60 + 30;
      const remaining = [...enriched];
      const steps: RouteStep[] = [];
      while (remaining.length) {
        const options = await Promise.all(
          remaining.map(async (item) => ({
            ...item,
            driveMinutes: await estimateTravelMinutes(currentPoint, item.coord!, travelMode),
          }))
        );
        const feasible = options
          .filter((item) => currentMinute + item.driveMinutes + 90 <= item.closingMinute + 30)
          .sort((a, b) => a.closingMinute - (currentMinute + a.driveMinutes + 90) - (b.closingMinute - (currentMinute + b.driveMinutes + 90)));
        const next = (feasible[0] || options.sort((a, b) => a.closingMinute - b.closingMinute || a.driveMinutes - b.driveMinutes)[0])!;
        if (steps.length) {
          steps.push({
            type: "travel",
            id: `travel-${next.event.id}-${steps.length}`,
            time: minutesToClock(currentMinute),
            endTime: minutesToClock(currentMinute + next.driveMinutes),
            title: `路程 ${next.driveMinutes} 分钟`,
            subtitle: "高德驾车耗时估算",
            address: next.event.address,
          });
        }
        const arrivalMinute = currentMinute + next.driveMinutes;
        const visitStart = Math.max(arrivalMinute, 9 * 60 + 30);
        const visitEnd = Math.min(next.closingMinute, visitStart + 90);
        steps.push({
          type: "event",
          id: next.event.id,
          time: minutesToClock(visitStart),
          endTime: minutesToClock(visitEnd),
          title: next.event.title,
          subtitle: next.event.museum,
          address: next.event.address,
        });
        currentMinute = visitEnd;
        currentPoint = next.coord!;
        ordered.push(next);
        const removeIndex = remaining.findIndex((item) => item.event.id === next.event.id);
        remaining.splice(removeIndex, 1);
        if (remaining.length && currentMinute <= 13 * 60) {
          const breakStart = currentMinute + 10;
          const breakEnd = breakStart + 60;
          steps.push({
            type: "break",
            id: `break-${next.event.id}`,
            time: minutesToClock(breakStart),
            endTime: minutesToClock(breakEnd),
            title: "简餐补给",
            subtitle: "附近高分咖啡馆 / 餐厅",
            address: next.event.address,
          });
          currentMinute = breakEnd;
        }
      }
      const sorted = ordered.map((item) => item.event);
      setItinerary(sorted);
      setRouteSteps(steps.length ? steps : buildRoutePlan(sorted));
      try {
        localStorage.setItem("museum_itinerary", JSON.stringify(sorted.map((e) => e.id)));
      } catch {}
    } finally {
      setPlanningRoute(false);
    }
  }, [city, currentCoords, estimateTravelMinutes, favoriteEvents, geocodeLocation, getClosingMinute, travelMode]);

  useEffect(() => {
    if (!cityEvents.length) {
      setSelectedEventId("");
      return;
    }
    if (!cityEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(cityEvents[0].id);
    }
  }, [cityEvents, selectedEventId]);

  useEffect(() => {
    const saved = localStorage.getItem("museum_itinerary");
    if (!saved || !data?.events?.length) return;
    try {
      const ids = JSON.parse(saved) as string[];
      const items = ids
        .map((id) => data.events.find((event) => event.id === id))
        .filter(Boolean) as MuseumEvent[];
      if (items.length) {
        setItinerary(items);
        setRouteSteps(buildRoutePlan(items));
      }
    } catch {
      void 0;
    }
  }, [data]);

  useEffect(() => {
    if (!itinerary.length) {
      setRouteSteps([]);
      return;
    }
    setRouteSteps(buildRoutePlan(itinerary));
  }, [itinerary, travelMode]);

  useEffect(() => {
    setHighlightPage(0);
    setShowSourceSummary(false);
  }, [selectedEventId]);

  useEffect(() => {
    setDetailAccent(getFallbackAccent(selectedEvent));
    if (!selectedEvent?.poster_url && !selectedEvent?.cover_url) return;
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx || cancelled) return;
      const width = 24;
      const height = Math.max(24, Math.round((image.height / Math.max(1, image.width)) * 24));
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(image, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 16) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count += 1;
      }
      if (!cancelled && count) {
        setDetailAccent(`rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`);
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setDetailAccent(getFallbackAccent(selectedEvent));
      }
    };
    image.src = selectedEvent.poster_url || selectedEvent.cover_url;
    return () => {
      cancelled = true;
    };
  }, [selectedEvent]);

  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(37,99,235,0.12), transparent 26%), radial-gradient(circle at 85% 10%, rgba(180,83,9,0.12), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #f7f4ee 100%)",
      }}
    >
      <style>{`@keyframes pulse-city {0%{transform:scale(.92);opacity:.2}60%{transform:scale(1.18);opacity:.42}100%{transform:scale(1.26);opacity:0}}`}</style>
      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
        <DialogContent className="max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle>选择地图导航</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedEvent ? (
              <>
                <a
                  href={`https://uri.amap.com/search?query=${encodeURIComponent(selectedEvent.address || `${selectedEvent.city}${selectedEvent.museum}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  打开高德地图
                </a>
                <a
                  href={`https://api.map.baidu.com/place/search?query=${encodeURIComponent(selectedEvent.address || selectedEvent.museum)}&region=${encodeURIComponent(selectedEvent.city)}&output=html`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  打开百度地图
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.address || `${selectedEvent.city}${selectedEvent.museum}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  打开 Google Maps
                </a>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <div className="mx-auto max-w-7xl space-y-5">
        <Card className="overflow-hidden border border-slate-200/70 bg-white/90 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="border-b border-slate-200/80 p-5 lg:border-b-0 lg:border-r lg:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">ArtPulse / City Art Index</div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">{city || "北京"}</h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                      {activeCityInsight.sentence}
                    </p>
                  </div>
                </div>
                <div className="min-w-[180px] rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-white">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Active CAI</div>
                  <div className="mt-2 text-4xl font-semibold">
                    {cityRanking.find((item) => normalizeCityName(item.city) === normalizeCityName(city))?.cai.toFixed(1) || "0.0"}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                    <span>{activeCityInsight.active} 场进行中</span>
                    <span>·</span>
                    <span>{activeCityInsight.endingSoon} 场待抢救</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-12">
                <Input
                  className="border-slate-300 bg-white md:col-span-4"
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
                  className="border-slate-300 bg-white md:col-span-4"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  className="border-slate-300 bg-white md:col-span-4"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">进行中</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{activeCityInsight.active}</div>
                </div>
                <div className="rounded-2xl border border-red-100 bg-red-50/70 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-red-500">7日闭幕</div>
                  <div className="mt-2 text-2xl font-semibold text-red-700">{activeCityInsight.endingSoon}</div>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-500">本周新开</div>
                  <div className="mt-2 text-2xl font-semibold text-indigo-700">{activeCityInsight.openingSoon}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">数据源</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{dataSource}</div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500">
                <span>当前城市：{city || "北京"}</span>
                <span>最近同步：{data?.last_refresh || "暂无"}</span>
                {activeCityInsight.featured ? <span>推荐关注：{activeCityInsight.featured.title}</span> : null}
              </div>
            </div>
            <div className="p-5 lg:p-7">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
                <span>城市节点脉冲地图</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 cursor-help text-slate-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="max-w-[280px] leading-relaxed">
                        CAI = 0.6×进行中 + 1.5×7日内闭馆 + 2.0×平均评分。闭馆权重最高，优先提醒“再不去就错过”的城市。
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#fafaf9,#f1f5f9)]">
                <div ref={cityMapContainerRef} className="h-[360px] w-full" />
                <div className="border-t border-slate-200 bg-white/80 p-3">
                  <div className="flex gap-2 overflow-x-auto">
                    {cityRanking.map((c, idx) => {
                      const active = normalizeCityName(c.city) === normalizeCityName(city);
                      return (
                        <button
                          key={c.city}
                          onClick={() => setCity(c.city)}
                          className={`min-w-[170px] rounded-2xl border px-3 py-2 text-left transition ${
                            active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className={`text-xs ${active ? "text-slate-300" : "text-slate-400"}`}>#{idx + 1}</span>
                            <span className="text-lg font-semibold">{c.cai.toFixed(1)}</span>
                          </div>
                          <div className="mt-1 text-sm font-semibold">{c.city}</div>
                          <div className={`mt-1 text-[11px] ${active ? "text-slate-300" : "text-slate-500"}`}>
                            进行中 {c.ongoing} · 闭幕 {c.endingSoon}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
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
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-4">
                  <Card className="border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Smart Itinerary</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">一键排程</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Tabs value={travelMode} onValueChange={(value) => setTravelMode(value as TravelMode)}>
                          <TabsList className="h-10 rounded-full bg-slate-100 p-1">
                            <TabsTrigger value="driving" className="rounded-full px-3">驾车</TabsTrigger>
                            <TabsTrigger value="walking" className="rounded-full px-3">步行</TabsTrigger>
                            <TabsTrigger value="transfer" className="rounded-full px-3">公交</TabsTrigger>
                          </TabsList>
                        </Tabs>
                        <button
                          onClick={() => void planItinerary()}
                          disabled={favorites.length < 3}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            favorites.length >= 3
                              ? "bg-slate-950 text-white hover:bg-slate-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {planningRoute ? "正在计算真实路线…" : `选中 ${favorites.length} 场后排程`}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4">
                      {routeSteps.length ? (
                          <div className="space-y-3">
                          {routeSteps.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-[72px_16px_1fr] gap-3">
                              <div className="pt-0.5 text-right text-xs leading-5 text-slate-500">
                                <div className="font-medium text-slate-700">{item.time}</div>
                                <div>{item.endTime}</div>
                              </div>
                              <div className="relative flex justify-center">
                                <span className={`mt-1 h-3 w-3 rounded-full ${item.type === "event" ? "bg-slate-950" : item.type === "travel" ? "bg-blue-600" : "bg-amber-500"}`} />
                                {index < routeSteps.length - 1 ? <span className="absolute top-4 h-full w-px bg-slate-300" /> : null}
                              </div>
                              <div className={`rounded-2xl border px-4 py-3 ${item.type === "event" ? "border-slate-200 bg-white" : item.type === "travel" ? "border-blue-100 bg-blue-50" : "border-amber-100 bg-amber-50"}`}>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                                  <ArrowRight className="h-4 w-4 text-slate-400" />
                                </div>
                                <div className="mt-1 text-xs text-slate-600">{item.subtitle || (travelMode === "walking" ? "高德步行耗时估算" : travelMode === "transfer" ? "高德公交耗时估算" : "高德驾车耗时估算")}</div>
                                <div className="mt-2 text-[11px] text-slate-500">{item.address}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm text-slate-600">
                          <div>先收藏至少 3 场展览，再点击“一键排程”。</div>
                          <div className="text-xs text-slate-500">当前会调用真实地图 {travelMode === "walking" ? "步行" : travelMode === "transfer" ? "公交" : "驾车"} 耗时估算，综合闭馆时间与路程生成路线图。</div>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card className="border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Saved Timeline</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">收藏后的时间轴分组</div>
                      </div>
                      <div className="text-xs text-slate-500">{favoriteEvents.filter((event) => normalizeCityName(event.city) === normalizeCityName(city)).length} 场</div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Last Call", tone: "border-red-100 bg-red-50", items: favoriteTimelineGroups.rescue },
                        { label: "进行中", tone: "border-blue-100 bg-blue-50", items: favoriteTimelineGroups.active },
                        { label: "期待中", tone: "border-slate-200 bg-slate-50", items: favoriteTimelineGroups.upcoming },
                      ].map((group) => (
                        <div key={group.label} className={`rounded-2xl border p-3 ${group.tone}`}>
                          <div className="flex items-center justify-between text-sm font-medium text-slate-900">
                            <span>{group.label}</span>
                            <span className="text-xs text-slate-500">{group.items.length}</span>
                          </div>
                          <div className="mt-2 space-y-2">
                            {group.items.length ? (
                              group.items.map((event) => (
                                <button key={`saved-${event.id}`} onClick={() => setSelectedEventId(event.id)} className="block w-full rounded-xl bg-white/80 px-3 py-2 text-left text-sm text-slate-700">
                                  <div className="font-medium text-slate-900">{event.title}</div>
                                  <div className="mt-1 text-[11px] text-slate-500">{formatDateLabel(event.start_date)} — {formatDateLabel(event.end_date)}</div>
                                </button>
                              ))
                            ) : (
                              <div className="text-xs text-slate-500">这一组还没有收藏内容。</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Lifespan Timeline</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">展期全景</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-[repeating-linear-gradient(90deg,#c7cddc_0_8px,transparent_8px_16px)]" /> 期待中</span>
                        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-blue-700" /> 热展期</span>
                        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-red-600" /> Last Call</span>
                      </div>
                    </div>
                    {timelineRange ? (
                      <div className="space-y-3">
                        <div className="mb-2 flex justify-between text-[11px] text-slate-500">
                          {Array.from({ length: 7 }).map((_, i) => {
                            const t =
                              timelineRange.min.getTime() +
                              ((timelineRange.max.getTime() - timelineRange.min.getTime()) * i) / 6;
                            return <span key={`tick-${i}`}>{formatDateLabel(new Date(t).toISOString())}</span>;
                          })}
                        </div>
                        <div className="space-y-3">
                          {ganttItems.map(({ event, left, width, permanent, colorClass, label }) => (
                            <button
                              key={`g-${event.id}`}
                              onClick={() => setSelectedEventId(event.id)}
                              className={`block w-full rounded-2xl border p-3 text-left transition ${
                                selectedEvent?.id === event.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                              title={`${label}｜${event.start_date} → ${event.end_date}`}
                            >
                              <div className={`truncate text-xs ${selectedEvent?.id === event.id ? "text-slate-300" : "text-slate-500"}`}>{label}</div>
                              <div
                                className={`relative mt-2 h-7 rounded-full border ${selectedEvent?.id === event.id ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"}`}
                                style={{
                                  backgroundImage:
                                    "repeating-linear-gradient(to right, rgba(148,163,184,0.35) 0 1px, transparent 1px 10%)",
                                }}
                              >
                                <div className={`h-7 rounded-full ${colorClass}`} style={{ marginLeft: `${left}%`, width: `${width}%` }} />
                              </div>
                              <div className={`mt-2 flex items-center justify-between text-[11px] ${selectedEvent?.id === event.id ? "text-slate-300" : "text-slate-500"}`}>
                                <span>{formatDateLabel(event.start_date)} · {getRelativeDayLabel(event.start_date)}</span>
                                <span>{permanent ? "常设展" : `${formatDateLabel(event.end_date)} 截止`}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">暂无可绘制的时间范围</div>
                    )}
                  </Card>

                  <Card className="border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">City Map</div>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-lg font-semibold text-slate-900">馆点分布</div>
                      <div className="text-xs text-slate-500">{cityMuseums.length} 个馆点</div>
                    </div>
                    <div ref={mapContainerRef} className="h-[320px] w-full rounded-2xl bg-slate-100" />
                  </Card>
                </div>

                <div className="space-y-4">
                  {selectedEvent ? (
                    <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-sm">
                      <div
                        className="relative min-h-[320px] p-5 text-white"
                        style={{
                          backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.82)), linear-gradient(135deg, ${detailAccent}, rgba(15,23,42,0.96)), url(${selectedEvent.poster_url || selectedEvent.cover_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        <div className="flex h-full min-h-[280px] flex-col justify-between">
                          <div className="flex items-start justify-between gap-3">
                            <div className="max-w-xl">
                              <div className="text-[11px] uppercase tracking-[0.32em] text-white/60">AI-Driven Details</div>
                              <h2 className="mt-3 text-2xl font-semibold leading-tight md:text-3xl">{selectedEvent.title}</h2>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
                                <span>{selectedEvent.museum}</span>
                                <span>·</span>
                                <span>{selectedEvent.city}</span>
                                <span>·</span>
                                <span>{computeOpenStatus(selectedEvent.open_hours).label}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const exists = favorites.includes(selectedEvent.id);
                                const next = exists ? favorites.filter((id) => id !== selectedEvent.id) : [...favorites, selectedEvent.id];
                                setFavorites(next);
                                try {
                                  localStorage.setItem("museum_favorites", JSON.stringify(next));
                                } catch {}
                              }}
                              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs text-white backdrop-blur"
                            >
                              <Heart className={`h-4 w-4 ${favorites.includes(selectedEvent.id) ? "fill-current" : ""}`} />
                              {favorites.includes(selectedEvent.id) ? "已加入待办时间轴" : "加入待办时间轴"}
                            </button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                            <div className="rounded-2xl border border-white/15 bg-black/20 p-4 backdrop-blur">
                              <div className="flex items-center justify-between">
                                <div className="text-[11px] uppercase tracking-[0.24em] text-white/50">Highlights</div>
                                {(selectedEvent.highlights || []).length > 1 ? (
                                  <div className="flex items-center gap-2 text-[11px] text-white/60">
                                    <button
                                      onClick={() => setHighlightPage((prev) => Math.max(0, prev - 1))}
                                      className="rounded-full border border-white/15 px-2 py-1"
                                    >
                                      上一张
                                    </button>
                                    <span>{highlightPage + 1}/{Math.max(1, (selectedEvent.highlights || []).length)}</span>
                                    <button
                                      onClick={() => setHighlightPage((prev) => Math.min((selectedEvent.highlights || []).length - 1, prev + 1))}
                                      className="rounded-full border border-white/15 px-2 py-1"
                                    >
                                      下一张
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                              <div className="mt-3 min-h-[120px]">
                                {(selectedEvent.highlights || []).length ? (
                                  <div className="rounded-[24px] border border-white/15 bg-white/10 p-5">
                                    <div className="text-sm leading-7 text-white/95">{selectedEvent.highlights[Math.min(highlightPage, selectedEvent.highlights.length - 1)]}</div>
                                  </div>
                                ) : (
                                  <span className="text-sm text-white/70">暂无结构化亮点，建议补充策展关键词。</span>
                                )}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-black/20 p-4 backdrop-blur">
                              <div className="space-y-3 text-sm text-white/90">
                                <div className="flex items-start gap-2">
                                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
                                  <span>{selectedEvent.start_date} 至 {selectedEvent.end_date}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
                                  <span>{selectedEvent.open_hours || "开放时间待补充"}</span>
                                </div>
                                <button
                                  onClick={() => setShowMapDialog(true)}
                                  className="flex items-start gap-2 text-left text-white/90 hover:text-white"
                                >
                                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
                                  <span>{selectedEvent.address || "地址待补充"}</span>
                                </button>
                                {selectedEvent.source_url ? (
                                  <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
                                    <button
                                      onClick={() => setShowSourceSummary((prev) => !prev)}
                                      className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white"
                                    >
                                      {showSourceSummary ? "收起来源摘要" : "展开来源摘要"} <ExternalLink className="h-3.5 w-3.5" />
                                    </button>
                                    {showSourceSummary ? (
                                      <div className="mt-3 space-y-2">
                                        <div className="text-xs leading-6 text-white/75">
                                          {(selectedEvent.raw_excerpt || "暂无来源摘要").slice(0, 180)}
                                          {(selectedEvent.raw_excerpt || "").length > 180 ? "…" : ""}
                                        </div>
                                        <a
                                          href={selectedEvent.source_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 text-xs text-white hover:text-white"
                                        >
                                          打开原始来源 <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {selectedEvent.raw_excerpt ? (
                        <div className="border-t border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-600">
                          {selectedEvent.raw_excerpt}
                        </div>
                      ) : null}
                    </Card>
                  ) : null}

                  <div className="space-y-4">
                    {museumGroups.map((group) => (
                      <Card key={`${group.museum}-${group.address}`} className="border border-slate-200/80 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <div className="text-lg font-semibold text-slate-900">{group.museum}</div>
                            {group.address ? <div className="mt-1 text-xs text-slate-500">{group.address}</div> : null}
                          </div>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                            {group.events.length} 场
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          {group.events.map((event) => {
                            const status = getEventStatus(event.start_date, event.end_date);
                            const prog = getProgressState(event.start_date, event.end_date);
                            const openState = computeOpenStatus(event.open_hours);
                            const active = selectedEvent?.id === event.id;
                            const endedCls = prog.ended ? "opacity-45" : "";
                            const barColor =
                              prog.state === "pre"
                                ? "bg-[repeating-linear-gradient(90deg,#c7cddc_0_8px,transparent_8px_16px)]"
                                : prog.state === "hot"
                                ? "bg-blue-700"
                                : prog.state === "lastcall"
                                ? "bg-red-600 animate-pulse"
                                : "bg-slate-400";
                            return (
                              <div
                                key={event.id}
                                onClick={() => setSelectedEventId(event.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSelectedEventId(event.id);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                                className={`w-full rounded-2xl border p-3 text-left transition ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-100 bg-slate-50 hover:border-slate-300"} ${endedCls}`}
                              >
                                <div className="flex gap-3">
                                  {(event.cover_url || event.poster_url) && (
                                    <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
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
                                      <h3 className={`line-clamp-2 text-base font-semibold ${active ? "text-white" : "text-slate-900"}`}>{event.title}</h3>
                                      <Badge className={status.color}>{status.label}</Badge>
                                    </div>
                                    <div className={`mb-2 flex flex-wrap items-center gap-3 text-xs ${active ? "text-slate-300" : "text-slate-600"}`}>
                                      <span className="inline-flex items-center gap-1">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        {formatDateLabel(event.start_date)} — {formatDateLabel(event.end_date)}
                                      </span>
                                      <span className={active ? "text-white/80" : openState.color}>{openState.label}</span>
                                    </div>
                                    <div className={`mb-2 h-2 w-full rounded-full ${active ? "bg-white/10" : "bg-slate-200"}`}>
                                      <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.floor(prog.progress * 100)}%` }} />
                                    </div>
                                    <div className={`mb-3 flex items-center justify-between text-[11px] ${active ? "text-slate-300" : "text-slate-500"}`}>
                                      <span>{prog.state === "pre" ? "期待中" : prog.state === "hot" ? "热展期" : prog.state === "lastcall" ? "Last Call" : prog.state === "permanent" ? "常设展" : "已结束"}</span>
                                      <span>{prog.state === "lastcall" ? `距结束 ${getRelativeDayLabel(event.end_date)}` : getRelativeDayLabel(event.end_date)}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {(event.highlights || []).slice(0, 4).map((h) => (
                                        <span key={`${event.id}-${h}`} className={`rounded-full px-2.5 py-1 text-[11px] ${active ? "bg-white/10 text-white/85" : "bg-white text-slate-700"}`}>
                                          {h}
                                        </span>
                                      ))}
                                    </div>
                                    <div className={`mt-3 flex items-center gap-4 text-xs ${active ? "text-slate-300" : "text-slate-600"}`}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const exists = favorites.includes(event.id);
                                          const next = exists ? favorites.filter((id) => id !== event.id) : [...favorites, event.id];
                                          setFavorites(next);
                                          try {
                                            localStorage.setItem("museum_favorites", JSON.stringify(next));
                                          } catch {}
                                        }}
                                        className="inline-flex items-center gap-1"
                                      >
                                        <Heart className={`h-3.5 w-3.5 ${favorites.includes(event.id) ? "fill-current" : ""}`} />
                                        {favorites.includes(event.id) ? "已收藏" : "收藏"}
                                      </button>
                                      {event.address ? (
                                        <a
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center gap-1 hover:underline"
                                          href={`https://uri.amap.com/search?query=${encodeURIComponent(event.address)}`}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          <MapPin className="h-3.5 w-3.5" />
                                          地图
                                        </a>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
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
