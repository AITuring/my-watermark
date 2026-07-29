import React from "react";
import { Card } from "@/components/ui/card";
import { Route, Share2 } from "lucide-react";
import type { MuseumEvent, RouteStep, ShareMode, TravelMode } from "../types";

interface ItineraryCardProps {
  favoriteEvents: MuseumEvent[];
  routeSteps: RouteStep[];
  itineraryPointsCount: number;
  planningRoute: boolean;
  travelMode: TravelMode;
  resolveEventCity: (event: MuseumEvent) => string;
  onTravelModeChange: (mode: TravelMode) => void;
  onPlanItinerary: () => void;
  onOpenShare: (mode: ShareMode) => void;
}

const travelModes: Array<{ key: TravelMode; label: string }> = [
  { key: "driving", label: "驾车" },
  { key: "transfer", label: "公交" },
  { key: "walking", label: "步行" },
];

const ItineraryCard: React.FC<ItineraryCardProps> = ({
  favoriteEvents,
  routeSteps,
  itineraryPointsCount,
  planningRoute,
  travelMode,
  resolveEventCity,
  onTravelModeChange,
  onPlanItinerary,
  onOpenShare,
}) => {
  if (!favoriteEvents.length) return null;

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Route className="h-5 w-5 shrink-0 text-orange-600" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-950">
              跨城行程 · 已选 {favoriteEvents.length} 场 / {new Set(favoriteEvents.map(resolveEventCity)).size} 个城市
            </div>
            <div className="truncate text-xs text-slate-500">
              {favoriteEvents.map((event) => `${resolveEventCity(event)} · ${event.title}`).join("、")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {travelModes.map((mode) => (
            <button
              type="button"
              key={mode.key}
              onClick={() => onTravelModeChange(mode.key)}
              className={`rounded-md px-2.5 py-1.5 text-xs ${
                travelMode === mode.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {mode.label}
            </button>
          ))}
          <button
            type="button"
            disabled={planningRoute}
            onClick={onPlanItinerary}
            className="ml-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {planningRoute ? "计算中…" : "生成行程"}
          </button>
          <button
            type="button"
            onClick={() => onOpenShare(itineraryPointsCount ? "map" : "poster")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Share2 className="h-4 w-4" />
            导出分享
          </button>
        </div>
      </div>
      {routeSteps.length ? (
        <div className="mt-4 flex gap-2 overflow-x-auto border-t border-slate-100 pt-4">
          {routeSteps.map((step) => (
            <div key={`simple-${step.id}`} className="min-w-[180px] rounded-lg bg-slate-50 px-3 py-2">
              <div className="text-[11px] text-orange-600">{step.endTime ? `${step.time}–${step.endTime}` : step.time}</div>
              <div className="mt-1 truncate text-sm font-medium text-slate-900">{step.title}</div>
              <div className="truncate text-xs text-slate-400">{step.subtitle}</div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
};

export default ItineraryCard;
