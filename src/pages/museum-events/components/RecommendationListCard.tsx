import React from "react";
import { Card } from "@/components/ui/card";
import { Heart, RefreshCw } from "lucide-react";
import type { EventRecommendation } from "../types";
import { formatCompactCount, getEventDateRangeLabel } from "../utils";

interface RecommendationListCardProps {
  loading: boolean;
  recommendedEvents: EventRecommendation[];
  favorites: string[];
  onSelectEvent: (eventId: string) => void;
  onToggleFavorite: (eventId: string) => void;
  onOpenAllEvents: () => void;
}

const RecommendationListCard: React.FC<RecommendationListCardProps> = ({
  loading,
  recommendedEvents,
  favorites,
  onSelectEvent,
  onToggleFavorite,
  onOpenAllEvents,
}) => {
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">最值得去</h2>
          <p className="mt-0.5 text-xs text-slate-500">热度占推荐结果的 70%</p>
        </div>
        <span className="text-xs text-slate-400">Top {Math.min(10, recommendedEvents.length)}</span>
      </div>
      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm text-slate-500">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          正在计算推荐
        </div>
      ) : recommendedEvents.length ? (
        <div className="divide-y divide-slate-100">
          {recommendedEvents.slice(0, 10).map((item, index) => {
            const saved = favorites.includes(item.event.id);
            const rating = item.event.rating_stars ?? item.event.rating ?? 0;
            return (
              <div key={`simple-recommendation-${item.event.id}`} className="flex items-center gap-3 px-4 py-3 md:gap-4 md:px-5">
                <div className={`w-6 shrink-0 text-center text-sm font-semibold ${index === 0 ? "text-orange-600" : "text-slate-400"}`}>
                  {index + 1}
                </div>
                {item.event.cover_url || item.event.poster_url ? (
                  <img
                    src={item.event.cover_url || item.event.poster_url}
                    alt=""
                    className="h-16 w-12 shrink-0 rounded-md object-cover"
                    loading="lazy"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    onSelectEvent(item.event.id);
                    onOpenAllEvents();
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-base font-semibold text-slate-950">{item.event.title}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {item.event.museum} · {getEventDateRangeLabel(item.event)}
                  </div>
                  <div className="mt-1.5 truncate text-xs text-slate-600">{item.reasons.slice(0, 2).join(" · ")}</div>
                </button>
                <div className="hidden w-28 shrink-0 text-right sm:block">
                  <div className="text-sm font-semibold text-slate-900">{rating ? `${rating.toFixed(1)} 分` : "暂无评分"}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{formatCompactCount(item.event.likes_count || 0)} 人关注</div>
                </div>
                <div className="w-16 shrink-0 text-center">
                  <div className="text-lg font-semibold text-orange-600">{item.score}</div>
                  <div className="text-[10px] text-slate-400">推荐分</div>
                </div>
                <button
                  type="button"
                  aria-label={saved ? "从行程移除" : "加入行程"}
                  aria-pressed={saved}
                  onClick={() => onToggleFavorite(item.event.id)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
                    saved ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-10 text-center text-sm text-slate-500">当前日期范围内没有可推荐的展览。</div>
      )}
    </Card>
  );
};

export default RecommendationListCard;
