import React from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock3, MapPin } from "lucide-react";
import type { ListFilter, MuseumEvent } from "../types";
import { getEventDateRangeLabel, getEventQuickNote } from "../utils";

interface AllEventsSectionProps {
  visible: boolean;
  listFilter: ListFilter;
  filteredListEvents: MuseumEvent[];
  selectedEventId: string;
  selectedEvent: MuseumEvent | null;
  favorites: string[];
  onListFilterChange: (value: ListFilter) => void;
  onSelectEvent: (eventId: string) => void;
  onOpenMapDialog: () => void;
  onToggleFavorite: (eventId: string) => void;
}

const tabs: Array<{ key: ListFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "hot", label: "热门" },
  { key: "ending", label: "即将结束" },
  { key: "upcoming", label: "即将开始" },
  { key: "permanent", label: "常设展" },
];

const AllEventsSection: React.FC<AllEventsSectionProps> = ({
  visible,
  listFilter,
  filteredListEvents,
  selectedEventId,
  selectedEvent,
  favorites,
  onListFilterChange,
  onSelectEvent,
  onOpenMapDialog,
  onToggleFavorite,
}) => {
  if (!visible) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] lg:items-start">
      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.key}
                onClick={() => onListFilterChange(tab.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  listFilter === tab.key ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <ScrollArea className="h-[620px]">
          <div className="divide-y divide-slate-100 p-2">
            {filteredListEvents.slice(0, 80).map((event) => {
              const active = selectedEventId === event.id;
              return (
                <button
                  type="button"
                  key={`simple-list-${event.id}`}
                  onClick={() => onSelectEvent(event.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                    active ? "bg-orange-50 ring-1 ring-inset ring-orange-200" : "hover:bg-slate-50"
                  }`}
                >
                  {event.cover_url || event.poster_url ? (
                    <img
                      src={event.cover_url || event.poster_url}
                      alt=""
                      className="h-12 w-9 shrink-0 rounded object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-medium ${active ? "text-orange-900" : "text-slate-900"}`}>{event.title}</div>
                    <div className={`mt-1 truncate text-xs ${active ? "text-orange-700/70" : "text-slate-400"}`}>
                      {event.museum} · {getEventDateRangeLabel(event)}
                    </div>
                  </div>
                  <span className={`text-xs ${active ? "font-medium text-orange-700" : "text-slate-400"}`}>
                    {event.rating_stars ? `${event.rating_stars.toFixed(1)} 分` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </Card>

      <div className="lg:sticky lg:top-4">
        {selectedEvent ? (
          <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {selectedEvent.poster_url || selectedEvent.cover_url ? (
              <img
                src={selectedEvent.poster_url || selectedEvent.cover_url}
                alt={selectedEvent.title}
                className="h-64 w-full object-cover"
              />
            ) : null}
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{selectedEvent.museum}</span>
                <span>·</span>
                <span>{getEventDateRangeLabel(selectedEvent)}</span>
              </div>
              <h2 className="mt-2 text-2xl font-semibold leading-tight text-slate-950">{selectedEvent.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{getEventQuickNote(selectedEvent)}</p>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {selectedEvent.address || "地址待确认"}
                </div>
                <div className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {selectedEvent.open_hours || "开放时间待确认"}
                </div>
                <div>{selectedEvent.fee || "票务待确认"}</div>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={onOpenMapDialog}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  导航
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(selectedEvent.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    favorites.includes(selectedEvent.id) ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {favorites.includes(selectedEvent.id) ? "已加入行程" : "加入行程"}
                </button>
                {selectedEvent.source_url ? (
                  <a
                    href={selectedEvent.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto rounded-lg bg-slate-950 px-4 py-2 text-sm text-white"
                  >
                    展览详情
                  </a>
                ) : null}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-400">
            从左侧选择一个展览查看详情
          </Card>
        )}
      </div>
    </div>
  );
};

export default AllEventsSection;
