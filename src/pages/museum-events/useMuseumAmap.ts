import { useCallback, useRef } from "react";
import type { AMapAddressResult, AMapGeocodeResult, AMapMapInstance, AMapNamespace, AMapRouteResult } from "./amap-types";
import type { MapCoord, TravelMode } from "./types";
import { normalizeCityName } from "./utils";

interface DetectCityResult {
  city: string;
  coord: MapCoord | null;
}

type WindowWithAMap = Window & {
  AMap?: AMapNamespace;
  _AMapSecurityConfig?: {
    securityJsCode: string;
  };
};

export function useMuseumAmap() {
  const cityCoordCacheRef = useRef<Map<string, MapCoord>>(new Map());

  const loadAMap = useCallback(async () => {
    const amapWindow = window as WindowWithAMap;
    if (amapWindow.AMap) return amapWindow.AMap;
    return await new Promise<AMapNamespace>((resolve, reject) => {
      amapWindow._AMapSecurityConfig = {
        securityJsCode: "3ba01835420271d5405dccba5e089b46",
      };
      const script = document.createElement("script");
      script.src =
        "https://webapi.amap.com/maps?v=1.4.15&key=7a9513e700e06c00890363af1bd2d926&plugin=AMap.Geocoder,AMap.Driving,AMap.Walking,AMap.Transfer";
      script.async = true;
      script.onload = () => {
        if (amapWindow.AMap) {
          resolve(amapWindow.AMap);
          return;
        }
        reject(new Error("地图脚本加载失败"));
      };
      script.onerror = () => reject(new Error("地图脚本加载失败"));
      document.head.appendChild(script);
    });
  }, []);

  const stabilizeMapRender = useCallback((mapInstance: AMapMapInstance | null | undefined) => {
    if (!mapInstance) return;
    const run = () => {
      try {
        mapInstance.resize();
      } catch {
        void 0;
      }
    };
    requestAnimationFrame(run);
    window.setTimeout(run, 120);
    window.setTimeout(run, 320);
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
        geocoder.getLocation(keyword, (status: string, result: AMapGeocodeResult) => {
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
          walking.search([from.lng, from.lat], [to.lng, to.lat], (status: string, result: AMapRouteResult) => {
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
          transfer.search([from.lng, from.lat], [to.lng, to.lat], (status: string, result: AMapRouteResult) => {
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
          driving.search([from.lng, from.lat], [to.lng, to.lat], (status: string, result: AMapRouteResult) => {
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

  const detectCityByLocation = useCallback(async (): Promise<DetectCityResult> => {
    if (!navigator.geolocation) return { city: "北京", coord: null };
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
    const coord = { lng: coords.longitude, lat: coords.latitude };
    const AMap = await loadAMap();
    const geocoder = new AMap.Geocoder({});
    const cityName = await new Promise<string>((resolve) => {
      geocoder.getAddress([coords.longitude, coords.latitude], (status: string, result: AMapAddressResult) => {
        if (status !== "complete") {
          resolve("北京");
          return;
        }
        const component = result?.regeocode?.addressComponent || {};
        const city = component.city || component.province || "";
        if (Array.isArray(city)) {
          resolve(normalizeCityName(city[0] || "北京"));
          return;
        }
        resolve(normalizeCityName(String(city || "北京")));
      });
    });
    return { city: cityName || "北京", coord };
  }, [loadAMap]);

  return {
    loadAMap,
    stabilizeMapRender,
    geocodeLocation,
    estimateTravelMinutes,
    detectCityByLocation,
  };
}
