export interface MuseumEvent {
  id: string;
  title: string;
  museum: string;
  city: string;
  start_date: string;
  end_date: string;
  highlights: string[];
  address: string;
  hall: string;
  fee: string;
  open_hours: string;
  city_slug: string;
  cover_url: string;
  poster_url: string;
  source: string;
  source_url: string;
  updated_at: string;
  raw_excerpt: string;
  rating?: number;
  rating_stars?: number;
  likes_count?: number;
}

export interface OverviewCity {
  city: string;
  event_count: number;
}

export interface OverviewMuseum {
  city: string;
  city_slug: string;
  museum: string;
  address: string;
  event_count: number;
}

export interface OverviewResponse {
  cities: OverviewCity[];
  museums: OverviewMuseum[];
  events: MuseumEvent[];
  total: number;
  last_refresh: string;
  source?: string;
  events_total?: number;
  events_returned?: number;
}

export interface MapCoord {
  lng: number;
  lat: number;
}

export interface RouteStep {
  type: "event" | "break" | "travel";
  id: string;
  time: string;
  endTime: string;
  title: string;
  subtitle: string;
  address: string;
}

export interface ItineraryPoint {
  event: MuseumEvent;
  coord: MapCoord;
  day: number;
  order: number;
}

export interface EventRecommendation {
  event: MuseumEvent;
  popularity: number;
  score: number;
  reasons: string[];
}

export type TravelMode = "driving" | "walking" | "transfer";
export type ShareMode = "map" | "poster";
export type ListFilter = "all" | "latest" | "hot" | "ending" | "upcoming" | "ended" | "permanent";
