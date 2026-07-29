import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItineraryPoint, MapCoord, MuseumEvent, RouteStep, TravelMode } from "./types";
import { buildRoutePlan, getClosingMinute, minutesToClock } from "./utils";

interface UseMuseumItineraryOptions {
  dataEvents: MuseumEvent[];
  currentCoords: MapCoord | null;
  geocodeLocation: (keyword: string, cityKeyword?: string) => Promise<MapCoord | null>;
  estimateTravelMinutes: (from: MapCoord, to: MapCoord, mode: TravelMode) => Promise<number>;
  resolveEventCity: (event: MuseumEvent) => string;
}

export function useMuseumItinerary({
  dataEvents,
  currentCoords,
  geocodeLocation,
  estimateTravelMinutes,
  resolveEventCity,
}: UseMuseumItineraryOptions) {
  const [planningRoute, setPlanningRoute] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("museum_favorites");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [itineraryPoints, setItineraryPoints] = useState<ItineraryPoint[]>([]);
  const [itinerary, setItinerary] = useState<MuseumEvent[]>([]);

  const favoriteEvents = useMemo(() => {
    const set = new Set(favorites);
    return dataEvents.filter((event) => set.has(event.id));
  }, [dataEvents, favorites]);

  const toggleFavorite = useCallback((eventId: string) => {
    setRouteSteps([]);
    setItineraryPoints([]);
    setItinerary([]);
    setFavorites((current) => {
      const next = current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId];
      try {
        localStorage.setItem("museum_favorites", JSON.stringify(next));
      } catch {
        void 0;
      }
      return next;
    });
  }, []);

  const planItinerary = useCallback(async () => {
    if (!favoriteEvents.length) return;
    setPlanningRoute(true);
    try {
      const enriched = (
        await Promise.all(
          favoriteEvents.map(async (event) => ({
            event,
            coord: await geocodeLocation(event.address || `${event.city}${event.museum}`, event.city),
            closingMinute: getClosingMinute(event.open_hours),
          }))
        )
      ).filter((item): item is { event: MuseumEvent; coord: MapCoord; closingMinute: number } => Boolean(item.coord));
      if (!enriched.length) return;

      const ordered: typeof enriched = [];
      let currentPoint = currentCoords || enriched[0].coord;
      let currentMinute = 9 * 60 + 30;
      const remaining = [...enriched];
      const steps: RouteStep[] = [];
      const plannedPoints: ItineraryPoint[] = [];
      let activeCity = resolveEventCity(remaining[0].event);
      let day = 1;

      steps.push({
        type: "travel",
        id: `day-${day}-${activeCity}`,
        time: `第 ${day} 天`,
        endTime: "",
        title: `${activeCity}行程`,
        subtitle: "跨城展览按城市分日安排",
        address: "",
      });

      while (remaining.length) {
        let cityCandidates = remaining.filter((item) => resolveEventCity(item.event) === activeCity);
        if (!cityCandidates.length) {
          activeCity = resolveEventCity(remaining[0].event);
          day += 1;
          currentMinute = 9 * 60 + 30;
          currentPoint = remaining[0].coord;
          cityCandidates = remaining.filter((item) => resolveEventCity(item.event) === activeCity);
          steps.push({
            type: "travel",
            id: `day-${day}-${activeCity}`,
            time: `第 ${day} 天`,
            endTime: "",
            title: `${activeCity}行程`,
            subtitle: "城际交通时间请根据实际班次安排",
            address: "",
          });
        }

        const firstStopOfDay = !ordered.some((item) => resolveEventCity(item.event) === activeCity);
        const options = await Promise.all(
          cityCandidates.map(async (item) => ({
            ...item,
            driveMinutes:
              firstStopOfDay && (day > 1 || !currentCoords)
                ? 0
                : await estimateTravelMinutes(currentPoint, item.coord, travelMode),
          }))
        );
        const feasible = options
          .filter((item) => currentMinute + item.driveMinutes + 90 <= item.closingMinute + 30)
          .sort(
            (a, b) =>
              a.closingMinute - (currentMinute + a.driveMinutes + 90) - (b.closingMinute - (currentMinute + b.driveMinutes + 90))
          );
        const next = (feasible[0] || options.sort((a, b) => a.closingMinute - b.closingMinute || a.driveMinutes - b.driveMinutes)[0])!;

        if (!firstStopOfDay && next.driveMinutes > 0) {
          steps.push({
            type: "travel",
            id: `travel-${next.event.id}-${steps.length}`,
            time: minutesToClock(currentMinute),
            endTime: minutesToClock(currentMinute + next.driveMinutes),
            title: `路程 ${next.driveMinutes} 分钟`,
            subtitle: travelMode === "walking" ? "步行耗时估算" : travelMode === "transfer" ? "公共交通耗时估算" : "驾车耗时估算",
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
          subtitle: `${activeCity} · ${next.event.museum}`,
          address: next.event.address,
        });

        currentMinute = visitEnd;
        currentPoint = next.coord;
        ordered.push(next);
        plannedPoints.push({
          event: next.event,
          coord: next.coord,
          day,
          order: plannedPoints.length + 1,
        });
        remaining.splice(
          remaining.findIndex((item) => item.event.id === next.event.id),
          1
        );

        const hasMoreInCity = remaining.some((item) => resolveEventCity(item.event) === activeCity);
        if (hasMoreInCity && currentMinute <= 13 * 60) {
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
      setItineraryPoints(plannedPoints);
      setRouteSteps(steps.length ? steps : buildRoutePlan(sorted));
      try {
        localStorage.setItem("museum_itinerary", JSON.stringify(sorted.map((event) => event.id)));
      } catch {
        void 0;
      }
    } finally {
      setPlanningRoute(false);
    }
  }, [currentCoords, estimateTravelMinutes, favoriteEvents, geocodeLocation, resolveEventCity, travelMode]);

  useEffect(() => {
    const saved = localStorage.getItem("museum_itinerary");
    if (!saved || !dataEvents.length) return;
    try {
      const ids = JSON.parse(saved) as string[];
      const items = ids
        .map((id) => dataEvents.find((event) => event.id === id))
        .filter(Boolean) as MuseumEvent[];
      if (items.length) {
        setItinerary(items);
        setRouteSteps([]);
      }
    } catch {
      void 0;
    }
  }, [dataEvents]);

  return {
    planningRoute,
    travelMode,
    setTravelMode,
    routeSteps,
    favorites,
    itineraryPoints,
    itinerary,
    favoriteEvents,
    toggleFavorite,
    planItinerary,
  };
}
