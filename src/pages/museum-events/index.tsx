import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import MapNavigationDialog from "./components/MapNavigationDialog";
import ShareDialog from "./components/ShareDialog";
import EventsHeader from "./components/EventsHeader";
import RecommendationListCard from "./components/RecommendationListCard";
import ItineraryCard from "./components/ItineraryCard";
import AllEventsSection from "./components/AllEventsSection";
import type { ListFilter, MapCoord, MuseumEvent, ShareMode } from "./types";
import {
  dateOverlaps,
  isPermanentEvent,
  normalizeCityName,
  parseEventDate,
  rankCityEvents,
  toISODate,
  getProgressState,
} from "./utils";
import { useMuseumAmap } from "./useMuseumAmap";
import { useMuseumEventsData } from "./useMuseumEventsData";
import { useMuseumItinerary } from "./useMuseumItinerary";

const MuseumEventRadar: React.FC = () => {
  const { loadAMap, stabilizeMapRender, geocodeLocation, estimateTravelMinutes, detectCityByLocation } = useMuseumAmap();
  const { loading, error, dataSource, data } = useMuseumEventsData();

  const [city, setCity] = useState("北京");
  const [cityInput, setCityInput] = useState("北京");
  const [startDate, setStartDate] = useState(() => toISODate(new Date()));
  const [startDateInput, setStartDateInput] = useState(() => toISODate(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const dt = new Date();
    dt.setDate(dt.getDate() + 7);
    return toISODate(dt);
  });
  const [endDateInput, setEndDateInput] = useState(() => {
    const dt = new Date();
    dt.setDate(dt.getDate() + 7);
    return toISODate(dt);
  });
  const [selectedEventId, setSelectedEventId] = useState("");
  const [currentCoords, setCurrentCoords] = useState<MapCoord | null>(null);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareMode, setShareMode] = useState<ShareMode>("map");
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detected = await detectCityByLocation();
        if (!cancelled) {
          setCurrentCoords(detected.coord);
          setCity(detected.city);
          setCityInput(detected.city);
        }
      } catch {
        if (!cancelled) {
          setCity("北京");
          setCityInput("北京");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detectCityByLocation]);

  const applyFilters = useCallback(() => {
    setCity((cityInput || "").trim());
    setStartDate(startDateInput);
    setEndDate(endDateInput);
  }, [cityInput, endDateInput, startDateInput]);

  const cityOptions = useMemo(() => {
    return (data?.cities || []).map((item) => item.city).filter((item) => item && item !== "未知城市");
  }, [data]);

  const citySlugAliases = useMemo(() => {
    const aliases = new Map<string, Set<string>>();
    for (const event of data?.events || []) {
      const cityName = normalizeCityName(event.city).toLowerCase();
      if (!cityName || cityName === "未知城市" || !event.city_slug) continue;
      const slugs = aliases.get(cityName) || new Set<string>();
      slugs.add(event.city_slug.toLowerCase());
      aliases.set(cityName, slugs);
    }
    return aliases;
  }, [data]);

  const resolveEventCity = useCallback(
    (event: MuseumEvent) => {
      const directCity = normalizeCityName(event.city);
      if (directCity && directCity !== "未知城市") return directCity;
      const slug = event.city_slug.toLowerCase();
      for (const [cityName, slugs] of citySlugAliases) {
        if (slugs.has(slug)) return cityName;
      }
      return event.city_slug || "未知城市";
    },
    [citySlugAliases]
  );

  const {
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
  } = useMuseumItinerary({
    dataEvents: data?.events || [],
    currentCoords,
    geocodeLocation,
    estimateTravelMinutes,
    resolveEventCity,
  });

  const cityEvents = useMemo(() => {
    const cityKeyword = city.trim().toLowerCase();
    const normalizedKeyword = normalizeCityName(cityKeyword);
    const matchingSlugs = citySlugAliases.get(normalizedKeyword) || new Set<string>();

    return (data?.events || []).filter((item) => {
      const passCity =
        !cityKeyword ||
        normalizeCityName(item.city).toLowerCase().includes(normalizedKeyword) ||
        item.city_slug.toLowerCase().includes(cityKeyword) ||
        matchingSlugs.has(item.city_slug.toLowerCase());
      if (!passCity) return false;
      return dateOverlaps(item.start_date, item.end_date, startDate, endDate, isPermanentEvent(item));
    });
  }, [city, citySlugAliases, data, endDate, startDate]);

  const recommendedEvents = useMemo(() => {
    const ranked = rankCityEvents(cityEvents);
    const museumCount = new Map<string, number>();
    return ranked
      .filter((item) => {
        const count = museumCount.get(item.event.museum) || 0;
        if (count >= 2) return false;
        museumCount.set(item.event.museum, count + 1);
        return true;
      })
      .slice(0, 10);
  }, [cityEvents]);

  const hotCityEvents = useMemo(() => {
    const now = new Date();
    return cityEvents
      .slice()
      .sort((a, b) => {
        const aStart = new Date(a.start_date);
        const aEnd = parseEventDate(a.end_date, true);
        const bStart = new Date(b.start_date);
        const bEnd = parseEventDate(b.end_date, true);
        const aOngoing = isPermanentEvent(a) || (aStart <= now && aEnd >= now) ? 1 : 0;
        const bOngoing = isPermanentEvent(b) || (bStart <= now && bEnd >= now) ? 1 : 0;
        const aScore = (a.rating || 0) * 4 + (a.highlights?.length || 0) + aOngoing * 5;
        const bScore = (b.rating || 0) * 4 + (b.highlights?.length || 0) + bOngoing * 5;
        if (aScore !== bScore) return bScore - aScore;
        return a.end_date > b.end_date ? 1 : -1;
      })
      .slice(0, 14);
  }, [cityEvents]);

  const filteredListEvents = useMemo(() => {
    const temporaryEvents = cityEvents.filter((event) => !isPermanentEvent(event));
    const permanentEvents = cityEvents.filter(isPermanentEvent);
    if (listFilter === "permanent") return permanentEvents;

    const sortedByDate = temporaryEvents.slice().sort((a, b) => (a.end_date > b.end_date ? 1 : -1));
    if (listFilter === "latest") {
      return cityEvents.slice().sort((a, b) => {
        const aTs = Date.parse(a.updated_at || "") || Date.parse(a.end_date || "") || Date.parse(a.start_date || "") || 0;
        const bTs = Date.parse(b.updated_at || "") || Date.parse(b.end_date || "") || Date.parse(b.start_date || "") || 0;
        return bTs - aTs;
      });
    }
    if (listFilter === "hot") return hotCityEvents.filter((event) => !isPermanentEvent(event));
    if (listFilter === "ending") return sortedByDate.filter((event) => getProgressState(event.start_date, event.end_date).state === "lastcall");
    if (listFilter === "upcoming") return sortedByDate.filter((event) => getProgressState(event.start_date, event.end_date).state === "pre");
    if (listFilter === "ended") return sortedByDate.filter((event) => getProgressState(event.start_date, event.end_date).ended);
    return cityEvents.slice().sort((a, b) => {
      const permanentDelta = Number(isPermanentEvent(b)) - Number(isPermanentEvent(a));
      if (permanentDelta) return permanentDelta;
      return a.end_date > b.end_date ? 1 : -1;
    });
  }, [cityEvents, hotCityEvents, listFilter]);

  const selectedEvent = useMemo(() => {
    return cityEvents.find((event) => event.id === selectedEventId) || filteredListEvents.find((event) => event.id === selectedEventId) || null;
  }, [cityEvents, filteredListEvents, selectedEventId]);

  useEffect(() => {
    if (
      selectedEventId &&
      !cityEvents.some((event) => event.id === selectedEventId) &&
      !filteredListEvents.some((event) => event.id === selectedEventId)
    ) {
      setSelectedEventId("");
    }
  }, [cityEvents, filteredListEvents, selectedEventId]);

  const shareEvents = itinerary.length ? itinerary : favoriteEvents;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <MapNavigationDialog open={showMapDialog} selectedEvent={selectedEvent} onOpenChange={setShowMapDialog} />
      <ShareDialog
        open={showShareDialog}
        cityLabel={city}
        shareMode={shareMode}
        shareEvents={shareEvents}
        itineraryPoints={itineraryPoints}
        resolveEventCity={resolveEventCity}
        loadAMap={loadAMap}
        stabilizeMapRender={stabilizeMapRender}
        onOpenChange={setShowShareDialog}
        onShareModeChange={setShareMode}
      />

      <div className="mx-auto max-w-5xl space-y-5">
        <EventsHeader
          city={city}
          cityInput={cityInput}
          cityOptions={cityOptions}
          startDateInput={startDateInput}
          endDateInput={endDateInput}
          dataSource={dataSource}
          lastRefresh={data?.last_refresh}
          eventCount={cityEvents.length}
          onCityInputChange={(value) => {
            setCityInput(value);
            setCity(value);
          }}
          onStartDateChange={setStartDateInput}
          onEndDateChange={setEndDateInput}
          onApplyFilters={applyFilters}
          onResetSelection={() => setSelectedEventId("")}
        />

        {error ? (
          <Card className="border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            {error}
          </Card>
        ) : null}

        <main className="space-y-4">
          <RecommendationListCard
            loading={loading}
            recommendedEvents={recommendedEvents}
            favorites={favorites}
            onSelectEvent={setSelectedEventId}
            onToggleFavorite={toggleFavorite}
            onOpenAllEvents={() => setShowAllEvents(true)}
          />

          <ItineraryCard
            favoriteEvents={favoriteEvents}
            routeSteps={routeSteps}
            itineraryPointsCount={itineraryPoints.length}
            planningRoute={planningRoute}
            travelMode={travelMode}
            resolveEventCity={resolveEventCity}
            onTravelModeChange={setTravelMode}
            onPlanItinerary={() => void planItinerary()}
            onOpenShare={(mode) => {
              setShareMode(mode);
              setShowShareDialog(true);
            }}
          />

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setShowAllEvents((value) => !value)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-950"
            >
              {showAllEvents ? "收起全部展览" : `查看全部 ${cityEvents.length} 场展览`}
            </button>
          </div>

          <AllEventsSection
            visible={showAllEvents}
            listFilter={listFilter}
            filteredListEvents={filteredListEvents}
            selectedEventId={selectedEventId}
            selectedEvent={selectedEvent}
            favorites={favorites}
            onListFilterChange={setListFilter}
            onSelectEvent={setSelectedEventId}
            onOpenMapDialog={() => setShowMapDialog(true)}
            onToggleFavorite={toggleFavorite}
          />
        </main>
      </div>
    </div>
  );
};

export default MuseumEventRadar;
