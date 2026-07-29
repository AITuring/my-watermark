export interface AMapCoord {
  lng: number;
  lat: number;
}

export interface AMapGeocodeResult {
  geocodes?: Array<{ location?: AMapCoord }>;
}

export interface AMapAddressResult {
  regeocode?: {
    addressComponent?: {
      city?: string | string[];
      province?: string | string[];
    };
  };
}

export interface AMapRouteResult {
  routes?: Array<{ time?: number }>;
  plans?: Array<{ time?: number }>;
}

export interface AMapGeocoderInstance {
  getLocation(keyword: string, callback: (status: string, result: AMapGeocodeResult) => void): void;
  getAddress(coords: [number, number], callback: (status: string, result: AMapAddressResult) => void): void;
}

export interface AMapRouteService {
  search(from: [number, number], to: [number, number], callback: (status: string, result: AMapRouteResult) => void): void;
}

export interface AMapPixelInstance {}

export interface AMapMapInstance {
  resize(): void;
  destroy?(): void;
  setFitView(overlays?: unknown[], immediately?: boolean, padding?: [number, number, number, number]): void;
}

export interface AMapMarkerInstance {
  setMap(map: AMapMapInstance): void;
}

export interface AMapPolylineInstance {
  setMap(map: AMapMapInstance): void;
}

export interface AMapNamespace {
  Geocoder: new (options: { city?: string }) => AMapGeocoderInstance;
  Walking?: new (options: Record<string, never>) => AMapRouteService;
  Transfer?: new (options: Record<string, never>) => AMapRouteService;
  Driving?: new (options: Record<string, never>) => AMapRouteService;
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AMapMapInstance;
  Marker: new (options: {
    position: [number, number];
    content?: string;
    offset?: AMapPixelInstance;
  }) => AMapMarkerInstance;
  Polyline: new (options: {
    path: Array<[number, number]>;
    strokeColor: string;
    strokeWeight: number;
    strokeOpacity: number;
    showDir: boolean;
  }) => AMapPolylineInstance;
  Pixel: new (x: number, y: number) => AMapPixelInstance;
}
