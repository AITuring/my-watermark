import { useCallback, useEffect, useState } from "react";
import type { MuseumEvent, OverviewResponse } from "./types";
import { buildOverviewFromEvents, getBackendUrl } from "./utils";

export function useMuseumEventsData() {
  const backendUrl = getBackendUrl();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dataSource, setDataSource] = useState("json");
  const [data, setData] = useState<OverviewResponse | null>(null);

  const fetchOverview = useCallback(
    async (options?: { forceRefresh?: boolean }) => {
      setLoading(true);
      setError("");
      try {
        const fallbackUrls = [
          new URL("./exhibitions_latest.json", import.meta.url).href,
          "/museum-events/exhibitions_latest.json",
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
            setData(buildOverviewFromEvents(rows, fallbackUrl));
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

        setError(localLoaded ? "当前使用本地 JSON 数据（后端未连接）" : "后端与本地 JSON 均不可用");
      } finally {
        setLoading(false);
      }
    },
    [backendUrl]
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

  return {
    loading,
    error,
    dataSource,
    data,
    fetchOverview,
  };
}
