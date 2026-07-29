import type { EventRecommendation, MuseumEvent, OverviewCity, OverviewMuseum, OverviewResponse, RouteStep } from "./types";

export const DEFAULT_BACKEND_URL = "http://localhost:8000";

export function getBackendUrl() {
  return localStorage.getItem("museum_backend_url") || DEFAULT_BACKEND_URL;
}

export function toISODate(dt: Date) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function normalizeCityName(value: string) {
  return (value || "").replace(/市$/, "").trim();
}

export function isPermanentEvent(event: MuseumEvent) {
  if (event.start_date === event.end_date) return true;
  const text = `${event.title} ${event.open_hours} ${event.raw_excerpt || ""}`;
  return /常设展|常设陈列|长期展出|长期陈列|永久展/i.test(text);
}

export function parseEventDate(value: string, endOfDay = false) {
  const date = new Date(value);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime())) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

export function dateOverlaps(eventStart: string, eventEnd: string, queryStart: string, queryEnd: string, permanent = false) {
  if (!queryStart && !queryEnd) return true;
  const es = new Date(eventStart).getTime();
  const ee = new Date(eventEnd).getTime();
  if (Number.isNaN(es) || Number.isNaN(ee)) return true;
  const effectiveEnd = permanent || eventStart === eventEnd ? Number.POSITIVE_INFINITY : ee;
  const qs = queryStart ? new Date(queryStart).getTime() : null;
  const qe = queryEnd ? new Date(queryEnd).getTime() : null;
  if (qs !== null && effectiveEnd < qs) return false;
  if (qe !== null && es > qe) return false;
  return true;
}

export function buildOverviewFromEvents(items: MuseumEvent[], source: string): OverviewResponse {
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

export function getProgressState(start_date: string, end_date: string) {
  const now = new Date().getTime();
  const start = parseEventDate(start_date).getTime();
  const end = parseEventDate(end_date, true).getTime();
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

export function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, "0")}`;
}

export function getRelativeDayLabel(value: string) {
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

export function getEndUrgencyLabel(endDate: string) {
  const target = new Date(endDate);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const days = Math.round((startOfTarget - startOfToday) / (24 * 3600 * 1000));
  if (days < 0) return null;
  if (days === 0) return { label: "今天结束", tone: "bg-red-100 text-red-700", level: "urgent" as const };
  if (days === 1) return { label: "明天结束", tone: "bg-red-100 text-red-700", level: "urgent" as const };
  if (days <= 3) return { label: `${days} 天后结束`, tone: "bg-orange-100 text-orange-700", level: "soon" as const };
  if (days <= 7) return { label: "本周内结束", tone: "bg-amber-100 text-amber-700", level: "soon" as const };
  return null;
}

export function truncateText(value: string, maxLength = 48) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

export function getEventDateRangeLabel(event: MuseumEvent) {
  if (isPermanentEvent(event)) return "常设展";
  return `${formatDateLabel(event.start_date)} - ${formatDateLabel(event.end_date)}`;
}

export function getEventQuickNote(event: MuseumEvent) {
  const highlight = (event.highlights || []).find((item) => item && item.trim());
  if (highlight) return truncateText(highlight.trim());
  const excerpt = (event.raw_excerpt || "")
    .replace(/\s+/g, " ")
    .split(/[。；!?？！\n]/)
    .map((item) => item.trim())
    .find(Boolean);
  if (excerpt) return truncateText(excerpt);
  return "暂无结构化要点";
}

export function formatCompactCount(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)} 万`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function getShareImageUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.hostname === "icity-static.icitycdn.com") {
      return `/icity-image${url.pathname}${url.search}`;
    }
  } catch {
    return value;
  }
  return value;
}

export function rankCityEvents(events: MuseumEvent[]): EventRecommendation[] {
  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const maxLikes = Math.max(1, ...events.map((event) => event.likes_count || 0));

  return events
    .filter((event) => isPermanentEvent(event) || !getProgressState(event.start_date, event.end_date).ended)
    .map((event) => {
      const rating = event.rating_stars ?? event.rating ?? 0;
      const likes = Math.max(0, event.likes_count || 0);
      const permanent = isPermanentEvent(event);
      const phase = permanent
        ? { progress: 0.5, state: "permanent", ended: false }
        : getProgressState(event.start_date, event.end_date);
      const end = parseEventDate(event.end_date, true);
      const start = parseEventDate(event.start_date);
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const daysToEnd = Number.isNaN(end.getTime())
        ? null
        : Math.round((new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() - todayStart) / dayMs);
      const daysToStart = Number.isNaN(start.getTime())
        ? null
        : Math.round((new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() - todayStart) / dayMs);
      const likesRatio = likes > 0 ? Math.log1p(likes) / Math.log1p(maxLikes) : 0;
      const ratingConfidence = Math.min(1, Math.log1p(likes) / Math.log1p(1000));
      const ratingQuality = rating > 0 ? (rating / 5) * (0.75 + ratingConfidence * 0.25) : 0;
      const popularity = Math.round(Math.min(1, ratingQuality * 0.65 + likesRatio * 0.35) * 100);
      const contentPoints =
        Math.min(10, (event.highlights?.filter(Boolean).length || 0) * 1.7) +
        (event.poster_url || event.cover_url ? 3 : 0);
      const practicalPoints = (event.address ? 2 : 0) + (event.open_hours ? 2 : 0) + (event.fee ? 1 : 0);

      let timingPoints = 0;
      if (phase.state === "lastcall") timingPoints = 18;
      else if (phase.state === "hot") timingPoints = 12;
      else if (phase.state === "pre" && daysToStart !== null && daysToStart <= 14) timingPoints = 8;
      else if (phase.state === "permanent") timingPoints = 6;

      if (!permanent && daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= 7) {
        timingPoints += Math.max(3, 9 - daysToEnd);
      }

      const reasons: string[] = [];
      if (rating > 0) {
        reasons.push(`${rating.toFixed(1)} 分${likes ? ` · ${formatCompactCount(likes)} 人关注` : ""}`);
      } else if (likes > 0) {
        reasons.push(`${formatCompactCount(likes)} 人关注`);
      }

      if (!permanent && daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= 14) {
        reasons.push(daysToEnd <= 1 ? "即将闭幕" : `${daysToEnd} 天后闭幕`);
      } else if (phase.state === "hot") {
        reasons.push("正在展出");
      } else if (phase.state === "pre" && daysToStart !== null) {
        reasons.push(`${Math.max(0, daysToStart)} 天后开展`);
      }

      if ((event.highlights?.filter(Boolean).length || 0) >= 3) {
        reasons.push(`${event.highlights.filter(Boolean).length} 条展览看点`);
      }
      if (/free|免费|免票/i.test(event.fee || "")) reasons.push("免费或免票");
      if (!reasons.length) reasons.push("信息完整，可直接规划");

      return {
        event,
        popularity,
        score: Math.min(
          99,
          Math.round(popularity * 0.7 + Math.min(20, timingPoints) + Math.min(6, contentPoints * 0.45) + Math.min(4, practicalPoints))
        ),
        reasons: reasons.slice(0, 3),
      };
    })
    .sort((a, b) => b.score - a.score || b.popularity - a.popularity || (b.event.likes_count || 0) - (a.event.likes_count || 0));
}

export function buildRoutePlan(events: MuseumEvent[]): RouteStep[] {
  let cursor = 9 * 60 + 30;
  return events.flatMap((event, index) => {
    const closingMinute = getClosingMinute(event.open_hours);
    const startMinute = Math.min(cursor, Math.max(9 * 60 + 30, closingMinute - 120));
    const endMinute = Math.min(closingMinute, startMinute + 90);
    const visitItem: RouteStep = {
      type: "event",
      id: event.id,
      time: minutesToClock(startMinute),
      endTime: minutesToClock(endMinute),
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
        time: minutesToClock(lunchStart),
        endTime: minutesToClock(cursor),
        title: "简餐补给",
        subtitle: "附近高分咖啡馆 / 餐厅",
        address: event.address,
      },
    ];
  });
}

export function minutesToClock(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function getClosingMinute(open_hours: string) {
  const text = open_hours || "";
  const match = /(\d{1,2})(?::|：)?(\d{2})?\s*(?:$|[^0-9]*$)/.exec(text);
  if (match) {
    return Number(match[1]) * 60 + Number(match[2] || "0");
  }
  return 17 * 60;
}
