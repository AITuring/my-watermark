import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Images, Map as MapIcon, RefreshCw, Share2 } from "lucide-react";
import type { AMapMapInstance, AMapNamespace } from "../amap-types";
import type { ItineraryPoint, MuseumEvent, ShareMode } from "../types";
import { getEventDateRangeLabel, getShareImageUrl } from "../utils";

interface ShareDialogProps {
  open: boolean;
  cityLabel: string;
  shareMode: ShareMode;
  shareEvents: MuseumEvent[];
  itineraryPoints: ItineraryPoint[];
  resolveEventCity: (event: MuseumEvent) => string;
  loadAMap: () => Promise<AMapNamespace>;
  stabilizeMapRender: (mapInstance: AMapMapInstance | null | undefined) => void;
  onOpenChange: (open: boolean) => void;
  onShareModeChange: (mode: ShareMode) => void;
}

const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  cityLabel,
  shareMode,
  shareEvents,
  itineraryPoints,
  resolveEventCity,
  loadAMap,
  stabilizeMapRender,
  onOpenChange,
  onShareModeChange,
}) => {
  const [exportingShare, setExportingShare] = useState(false);
  const sharePreviewRef = useRef<HTMLDivElement | null>(null);
  const shareMapContainerRef = useRef<HTMLDivElement | null>(null);
  const shareMapRef = useRef<AMapMapInstance | null>(null);

  useEffect(() => {
    if (!open || shareMode !== "map" || !shareMapContainerRef.current || !itineraryPoints.length) return;
    let cancelled = false;
    void loadAMap().then((AMap) => {
      if (cancelled || !shareMapContainerRef.current) return;
      shareMapRef.current?.destroy?.();
      const map = new AMap.Map(shareMapContainerRef.current, {
        zoom: 11,
        mapStyle: "amap://styles/whitesmoke",
      });
      shareMapRef.current = map;
      const overlays: unknown[] = [];
      const pointsByDay = new Map<number, ItineraryPoint[]>();

      for (const point of itineraryPoints) {
        const group = pointsByDay.get(point.day) || [];
        group.push(point);
        pointsByDay.set(point.day, group);

        const marker = new AMap.Marker({
          position: [point.coord.lng, point.coord.lat],
          content:
            `<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#0f172a;color:white;border:3px solid white;box-shadow:0 4px 12px rgba(15,23,42,.28);font:600 12px sans-serif">${point.order}</div>`,
          offset: new AMap.Pixel(-14, -14),
        });
        marker.setMap(map);
        overlays.push(marker);
      }

      const colors = ["#ea580c", "#2563eb", "#059669", "#9333ea"];
      Array.from(pointsByDay.entries()).forEach(([day, points]) => {
        if (points.length < 2) return;
        const polyline = new AMap.Polyline({
          path: points.map((point) => [point.coord.lng, point.coord.lat]),
          strokeColor: colors[(day - 1) % colors.length],
          strokeWeight: 6,
          strokeOpacity: 0.85,
          showDir: true,
        });
        polyline.setMap(map);
        overlays.push(polyline);
      });

      map.setFitView(overlays, false, [56, 56, 56, 56]);
      stabilizeMapRender(map);
    });

    return () => {
      cancelled = true;
      shareMapRef.current?.destroy?.();
      shareMapRef.current = null;
    };
  }, [itineraryPoints, loadAMap, open, shareMode, stabilizeMapRender]);

  const exportShareImage = useCallback(
    async (useSystemShare: boolean) => {
      if (!sharePreviewRef.current || !shareEvents.length) return;
      setExportingShare(true);
      try {
        await document.fonts?.ready;
        const images = Array.from(sharePreviewRef.current.querySelectorAll("img"));
        await Promise.all(
          images.map(
            (image) =>
              new Promise<void>((resolve) => {
                if (image.complete) {
                  resolve();
                  return;
                }
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), { once: true });
              })
          )
        );
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(sharePreviewRef.current, {
          backgroundColor: "#f8fafc",
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.96));
        if (!blob) return;
        const fileName = `看展行程-${new Date().toISOString().slice(0, 10)}.png`;
        const file = new File([blob], fileName, { type: "image/png" });
        if (useSystemShare && navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: "我的看展行程", files: [file] });
          return;
        }
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      } finally {
        setExportingShare(false);
      }
    },
    [shareEvents]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <DialogHeader>
            <DialogTitle>导出与分享行程</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onShareModeChange("map")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${
                shareMode === "map" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              <MapIcon className="h-4 w-4" />
              地图轨迹
            </button>
            <button
              type="button"
              onClick={() => onShareModeChange("poster")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${
                shareMode === "poster" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              <Images className="h-4 w-4" />
              海报清单
            </button>
          </div>
        </div>

        <div className="max-h-[72vh] overflow-auto bg-slate-100 p-4 md:p-6">
          <div ref={sharePreviewRef} className="mx-auto w-full max-w-[900px] overflow-hidden rounded-2xl bg-slate-50 shadow-sm">
            <div className="bg-slate-950 px-6 py-6 text-white md:px-8">
              <div className="text-xs font-medium uppercase tracking-[0.24em] text-orange-300">Exhibition Journey</div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">我的看展行程</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    {shareEvents.length} 场展览 · {new Set(shareEvents.map(resolveEventCity)).size} 个城市
                  </p>
                </div>
                <div className="text-sm text-slate-400">{new Date().toLocaleDateString("zh-CN")}</div>
              </div>
            </div>

            {shareMode === "map" ? (
              itineraryPoints.length ? (
                <>
                  <div ref={shareMapContainerRef} className="h-[460px] w-full bg-slate-200" />
                  <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
                    {Array.from(new Set(itineraryPoints.map((point) => point.day))).map((day) => {
                      const dayPoints = itineraryPoints.filter((point) => point.day === day);
                      return (
                        <div key={`share-day-${day}`} className="bg-white px-5 py-4">
                          <div className="text-xs font-semibold text-orange-600">第 {day} 天 · {resolveEventCity(dayPoints[0].event)}</div>
                          <div className="mt-2 text-sm leading-6 text-slate-700">
                            {dayPoints.map((point) => `${point.order}. ${point.event.title}`).join(" → ")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex h-[460px] items-center justify-center px-8 text-center text-sm leading-6 text-slate-500">
                  请先生成行程，系统才能绘制地图轨迹。
                </div>
              )
            ) : (
              <div className="grid gap-4 p-5 sm:grid-cols-2 md:p-7">
                {shareEvents.map((event, index) => {
                  const point = itineraryPoints.find((item) => item.event.id === event.id);
                  return (
                    <div key={`share-poster-${event.id}`} className="flex min-h-[160px] overflow-hidden rounded-xl border border-slate-200 bg-white">
                      {event.poster_url || event.cover_url ? (
                        <img
                          src={getShareImageUrl(event.poster_url || event.cover_url)}
                          alt=""
                          className="w-28 shrink-0 object-cover"
                          onError={(error) => {
                            const fallback = getShareImageUrl(event.cover_url);
                            if (fallback && error.currentTarget.src !== new URL(fallback, window.location.href).href) {
                              error.currentTarget.src = fallback;
                            }
                          }}
                        />
                      ) : (
                        <div className="w-28 shrink-0 bg-slate-200" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col p-4">
                        <div className="text-[11px] font-medium text-orange-600">
                          {point ? `第 ${point.day} 天 · ` : ""}
                          {resolveEventCity(event)}
                        </div>
                        <div className="mt-2 line-clamp-3 text-base font-semibold leading-snug text-slate-950">{event.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{event.museum}</div>
                        <div className="mt-auto pt-3 text-xs text-slate-400">
                          #{index + 1} · {getEventDateRangeLabel(event)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 text-[11px] text-slate-400">
              <span>评分与开放信息请以展馆官方发布为准</span>
              <span>{cityLabel || "看展计划"}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            disabled={exportingShare || !shareEvents.length || (shareMode === "map" && !itineraryPoints.length)}
            onClick={() => void exportShareImage(false)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            导出 PNG
          </button>
          <button
            type="button"
            disabled={exportingShare || !shareEvents.length || (shareMode === "map" && !itineraryPoints.length)}
            onClick={() => void exportShareImage(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40"
          >
            {exportingShare ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            分享图片
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
