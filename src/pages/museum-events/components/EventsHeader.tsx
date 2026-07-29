import React from "react";
import { Input } from "@/components/ui/input";

interface EventsHeaderProps {
  city: string;
  cityInput: string;
  cityOptions: string[];
  startDateInput: string;
  endDateInput: string;
  dataSource: string;
  lastRefresh?: string;
  eventCount: number;
  onCityInputChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onApplyFilters: () => void;
  onResetSelection: () => void;
}

const EventsHeader: React.FC<EventsHeaderProps> = ({
  city,
  cityInput,
  cityOptions,
  startDateInput,
  endDateInput,
  dataSource,
  lastRefresh,
  eventCount,
  onCityInputChange,
  onStartDateChange,
  onEndDateChange,
  onApplyFilters,
  onResetSelection,
}) => {
  return (
    <header className="rounded-2xl bg-white px-5 py-5 shadow-sm md:px-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm font-medium text-orange-600">附近展览推荐</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{city || "北京"}看什么展</h1>
          <p className="mt-1 text-sm text-slate-500">按评分与关注度优先推荐，选好后直接生成行程。</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[180px_150px_150px_auto]">
          <select
            aria-label="选择城市"
            className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
            value={cityInput}
            onChange={(event) => {
              onCityInputChange(event.target.value);
              onResetSelection();
            }}
          >
            {cityOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Input
            className="border-slate-200 bg-slate-50"
            type="date"
            value={startDateInput}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => onStartDateChange(event.target.value)}
          />
          <Input
            className="border-slate-200 bg-slate-50"
            type="date"
            value={endDateInput}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => onEndDateChange(event.target.value)}
          />
          <button
            type="button"
            onClick={onApplyFilters}
            className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            查看推荐
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-400">
        <span>{eventCount} 场符合条件</span>
        <span>数据源：{dataSource}</span>
        <span>更新：{lastRefresh || "暂无"}</span>
      </div>
    </header>
  );
};

export default EventsHeader;
