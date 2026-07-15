import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Loader2,
  MapPin,
  Calendar,
  Landmark,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Info,
  Globe,
  Palette,
  History,
  SlidersHorizontal,
  ArrowUpRight,
  AlertCircle,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────

interface MuseumArtwork {
  id: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  dimensions: string;
  department: string;
  culture: string;
  imageUrl: string;
  thumbnailUrl: string;
  museum: string;
  museumLabel: string;
  detailUrl: string;
  description: string;
  creditLine: string;
  objectType: string;
}

type TabType = "china" | "world";

interface MuseumConfig {
  id: string;
  name: string;
  nameZh: string;
  color: string;
  bgColor: string;
  borderColor: string;
  country: string;
  tab: TabType;
}

const MUSEUMS: MuseumConfig[] = [
  // 中国博物馆
  {
    id: "palace",
    name: "Palace Museum",
    nameZh: "故宫博物院",
    color: "text-amber-800",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    country: "北京",
    tab: "china",
  },
  {
    id: "national",
    name: "National Museum of China",
    nameZh: "中国国家博物馆",
    color: "text-red-800",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    country: "北京",
    tab: "china",
  },
  {
    id: "shanghai",
    name: "Shanghai Museum",
    nameZh: "上海博物馆",
    color: "text-sky-800",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    country: "上海",
    tab: "china",
  },
  {
    id: "nanjing",
    name: "Nanjing Museum",
    nameZh: "南京博物院",
    color: "text-violet-800",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    country: "南京",
    tab: "china",
  },
  {
    id: "shaanxi",
    name: "Shaanxi History Museum",
    nameZh: "陕西历史博物馆",
    color: "text-orange-800",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    country: "西安",
    tab: "china",
  },
  {
    id: "henan",
    name: "Henan Museum",
    nameZh: "河南博物院",
    color: "text-yellow-800",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    country: "郑州",
    tab: "china",
  },
  {
    id: "hunan",
    name: "Hunan Museum",
    nameZh: "湖南博物院",
    color: "text-teal-800",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    country: "长沙",
    tab: "china",
  },
  {
    id: "taipei",
    name: "National Palace Museum",
    nameZh: "台北故宫博物院",
    color: "text-indigo-800",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    country: "台北",
    tab: "china",
  },
  // 世界博物馆
  {
    id: "met",
    name: "The Metropolitan Museum of Art",
    nameZh: "大都会艺术博物馆",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    country: "美国·纽约",
    tab: "world",
  },
  {
    id: "aic",
    name: "Art Institute of Chicago",
    nameZh: "芝加哥艺术博物馆",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    country: "美国·芝加哥",
    tab: "world",
  },
  {
    id: "cleveland",
    name: "Cleveland Museum of Art",
    nameZh: "克利夫兰艺术博物馆",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    country: "美国·克利夫兰",
    tab: "world",
  },
];

const CHINA_MUSEUMS = MUSEUMS.filter((m) => m.tab === "china");
const WORLD_MUSEUMS = MUSEUMS.filter((m) => m.tab === "world");

const SUGGESTED_SEARCHES_CHINA = [
  { label: "青铜器", query: "青铜器" },
  { label: "瓷器", query: "瓷器" },
  { label: "玉器", query: "玉器" },
  { label: "书画", query: "书画" },
  { label: "金银器", query: "金银器" },
  { label: "佛像", query: "佛像" },
  { label: "陶俑", query: "陶俑" },
  { label: "漆器", query: "漆器" },
  { label: "铜镜", query: "铜镜" },
  { label: "印章", query: "印章" },
];

const SUGGESTED_SEARCHES_WORLD = [
  { label: "中国青铜器", query: "Chinese bronze" },
  { label: "宋代瓷器", query: "Song dynasty porcelain" },
  { label: "日本浮世绘", query: "Japanese ukiyo-e" },
  { label: "埃及文物", query: "Egyptian artifact" },
  { label: "印象派绘画", query: "Impressionist painting" },
  { label: "希腊雕塑", query: "Greek sculpture" },
  { label: "文艺复兴", query: "Renaissance" },
  { label: "梵高", query: "Van Gogh" },
  { label: "佛教造像", query: "Buddhist sculpture" },
  { label: "波斯细密画", query: "Persian miniature" },
];

// ─── Backend Config ─────────────────────────────────────

const DEFAULT_BACKEND_URL = "http://localhost:8000";

function getBackendUrl(): string {
  return localStorage.getItem("museum_backend_url") || DEFAULT_BACKEND_URL;
}

// ─── World Museum APIs (direct, no backend needed) ─────

async function searchMet(
  query: string, page: number, pageSize: number
): Promise<{ artworks: MuseumArtwork[]; total: number }> {
  const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(query)}`;
  const res = await fetch(searchUrl);
  if (!res.ok) return { artworks: [], total: 0 };
  const data = await res.json();
  if (!data.objectIDs?.length) return { artworks: [], total: 0 };

  const total = data.objectIDs.length;
  const ids = data.objectIDs.slice(page * pageSize, (page + 1) * pageSize);

  const artworks = await Promise.all(
    ids.map(async (id: number) => {
      try {
        const r = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
        if (!r.ok) return null;
        const obj = await r.json();
        return {
          id: `met-${obj.objectID}`,
          title: obj.title || "Untitled",
          artist: obj.artistDisplayName || "Unknown",
          date: obj.objectDate || "",
          medium: obj.medium || "",
          dimensions: obj.dimensions || "",
          department: obj.department || "",
          culture: obj.culture || "",
          imageUrl: obj.primaryImage || "",
          thumbnailUrl: obj.primaryImageSmall || obj.primaryImage || "",
          museum: "met",
          museumLabel: "大都会艺术博物馆",
          detailUrl: obj.objectURL || "",
          description: obj.objectName || "",
          creditLine: obj.creditLine || "",
          objectType: obj.objectName || obj.classification || "",
        } satisfies MuseumArtwork;
      } catch { return null; }
    })
  );
  return { artworks: artworks.filter((a): a is MuseumArtwork => !!a?.thumbnailUrl), total };
}

async function searchAIC(
  query: string, page: number, pageSize: number
): Promise<{ artworks: MuseumArtwork[]; total: number }> {
  const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(query)}&page=${page + 1}&limit=${pageSize}&fields=id,title,artist_display,date_display,medium_display,dimensions,department_title,place_of_origin,image_id,thumbnail,credit_line,artwork_type_title,classification_title,description`;
  const res = await fetch(url);
  if (!res.ok) return { artworks: [], total: 0 };
  const data = await res.json();
  const iiifBase = data.config?.iiif_url || "https://www.artic.edu/iiif/2";
  const artworks: MuseumArtwork[] = (data.data || [])
    .filter((item: any) => item.image_id)
    .map((item: any) => ({
      id: `aic-${item.id}`,
      title: item.title || "Untitled",
      artist: item.artist_display || "Unknown",
      date: item.date_display || "",
      medium: item.medium_display || "",
      dimensions: item.dimensions || "",
      department: item.department_title || "",
      culture: item.place_of_origin || "",
      imageUrl: `${iiifBase}/${item.image_id}/full/843,/0/default.jpg`,
      thumbnailUrl: `${iiifBase}/${item.image_id}/full/400,/0/default.jpg`,
      museum: "aic",
      museumLabel: "芝加哥艺术博物馆",
      detailUrl: `https://www.artic.edu/artworks/${item.id}`,
      description: item.description?.replace(/<[^>]*>/g, "") || item.thumbnail?.alt_text || "",
      creditLine: item.credit_line || "",
      objectType: item.artwork_type_title || item.classification_title || "",
    }));
  return { artworks, total: data.pagination?.total || 0 };
}

async function searchCleveland(
  query: string, page: number, pageSize: number
): Promise<{ artworks: MuseumArtwork[]; total: number }> {
  const skip = page * pageSize;
  const url = `https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(query)}&has_image=1&limit=${pageSize}&skip=${skip}`;
  const res = await fetch(url);
  if (!res.ok) return { artworks: [], total: 0 };
  const data = await res.json();
  const artworks: MuseumArtwork[] = (data.data || []).map((item: any) => ({
    id: `cleveland-${item.id}`,
    title: item.title || "Untitled",
    artist: item.creators?.map((c: any) => c.description).join(", ") || "Unknown",
    date: item.creation_date || "",
    medium: item.technique || "",
    dimensions: item.measurements || "",
    department: item.department || "",
    culture: item.culture?.[0] || "",
    imageUrl: item.images?.web?.url || "",
    thumbnailUrl: item.images?.web?.url || "",
    museum: "cleveland",
    museumLabel: "克利夫兰艺术博物馆",
    detailUrl: item.url || `https://www.clevelandart.org/art/${item.accession_number}`,
    description: item.description || item.fun_fact || "",
    creditLine: item.creditline || "",
    objectType: item.type || "",
  }));
  return { artworks, total: data.info?.total || 0 };
}

// ─── Chinese Museum API (via backend proxy) ────────────

async function searchChineseMuseums(
  query: string,
  museumIds: string[],
  page: number,
  pageSize: number,
  backendUrl: string
): Promise<{ artworks: MuseumArtwork[]; totals: Record<string, number>; errors: Record<string, string> }> {
  const url = `${backendUrl}/api/museum/search?keyword=${encodeURIComponent(query)}&museums=${museumIds.join(",")}&page=${page + 1}&size=${pageSize}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`后端服务不可用 (${res.status})`);
  }

  const data = await res.json();
  const artworks: MuseumArtwork[] = [];
  const totals: Record<string, number> = {};
  const errors: Record<string, string> = {};

  for (const [museumId, museumData] of Object.entries(data) as [string, any][]) {
    totals[museumId] = museumData.total || 0;
    if (museumData.error) {
      errors[museumId] = museumData.error;
    }

    const museum = MUSEUMS.find((m) => m.id === museumId);
    for (const item of museumData.items || []) {
      let thumbnailUrl = item.thumbnail_url || item.image_url || "";
      let imageUrl = item.image_url || "";

      if (thumbnailUrl && !thumbnailUrl.includes("localhost")) {
        const proxyBase = `${backendUrl}/api/museum/image-proxy?url=`;
        thumbnailUrl = proxyBase + encodeURIComponent(thumbnailUrl);
        imageUrl = imageUrl ? proxyBase + encodeURIComponent(imageUrl) : thumbnailUrl;
      }

      artworks.push({
        id: item.id,
        title: item.title,
        artist: item.artist || "",
        date: item.dynasty || "",
        medium: item.material || "",
        dimensions: item.dimensions || "",
        department: item.category || "",
        culture: "",
        imageUrl,
        thumbnailUrl,
        museum: museumId,
        museumLabel: museum?.nameZh || museumData.museum_name || museumId,
        detailUrl: item.detail_url || "",
        description: item.description || "",
        creditLine: "",
        objectType: item.category || "",
      });
    }
  }

  return { artworks, totals, errors };
}

// ─── Components ─────────────────────────────────────────

function ArtworkCard({ artwork, onClick }: { artwork: MuseumArtwork; onClick: () => void }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const museum = MUSEUMS.find((m) => m.id === artwork.museum);
  const mc = museum || { bgColor: "bg-stone-50", color: "text-stone-700", borderColor: "border-stone-200", nameZh: artwork.museumLabel };

  return (
    <div onClick={onClick} className="group cursor-pointer rounded-xl overflow-hidden bg-white border border-stone-200/80 shadow-sm hover:shadow-xl hover:border-stone-300 transition-all duration-500 hover:-translate-y-1">
      <div className="relative aspect-[4/5] bg-stone-100 overflow-hidden">
        {!imgError && artwork.thumbnailUrl ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
                <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              </div>
            )}
            <img
              src={artwork.thumbnailUrl}
              alt={artwork.title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-400 gap-2 bg-stone-50">
            <Landmark className="w-8 h-8 text-stone-300" />
            <span className="text-xs text-stone-400 text-center px-4 line-clamp-2">{artwork.title}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-500">
          <p className="text-white/90 text-xs line-clamp-2 leading-relaxed">{artwork.artist || artwork.description}</p>
        </div>
        <Badge className={`absolute top-2 right-2 ${mc.bgColor} ${mc.color} border ${mc.borderColor} text-[10px] px-1.5 py-0 font-medium shadow-sm backdrop-blur-sm`}>
          {mc.nameZh}
        </Badge>
      </div>
      <div className="p-3 space-y-1.5">
        <h3 className="font-medium text-stone-800 text-sm line-clamp-2 leading-snug group-hover:text-stone-900 transition-colors">{artwork.title}</h3>
        {artwork.date && (
          <span className="text-[11px] text-stone-500 flex items-center gap-0.5">
            <Calendar className="w-3 h-3" />
            {artwork.date.length > 30 ? artwork.date.slice(0, 30) + "..." : artwork.date}
          </span>
        )}
        {artwork.culture && <span className="text-[11px] text-stone-400 block truncate">{artwork.culture}</span>}
      </div>
    </div>
  );
}

function ArtworkDetail({ artwork }: { artwork: MuseumArtwork }) {
  const museum = MUSEUMS.find((m) => m.id === artwork.museum);
  const mc = museum || { bgColor: "bg-stone-50", color: "text-stone-700", borderColor: "border-stone-200", nameZh: artwork.museumLabel, name: artwork.museum, country: "" };

  const fields = [
    { icon: <Palette className="w-4 h-4" />, label: "材质/媒介", value: artwork.medium },
    { icon: <History className="w-4 h-4" />, label: "年代", value: artwork.date },
    { icon: <Globe className="w-4 h-4" />, label: "文化/来源", value: artwork.culture },
    { icon: <Landmark className="w-4 h-4" />, label: "部门/类别", value: artwork.department },
    { icon: <SlidersHorizontal className="w-4 h-4" />, label: "尺寸", value: artwork.dimensions },
    { icon: <Info className="w-4 h-4" />, label: "类别", value: artwork.objectType },
  ].filter((f) => f.value);

  return (
    <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] p-0 gap-0 bg-white overflow-hidden border-stone-200">
      <DialogHeader className="sr-only"><DialogTitle>{artwork.title}</DialogTitle></DialogHeader>
      <div className="flex flex-col md:flex-row h-full max-h-[92vh]">
        <div className="relative md:w-[55%] bg-stone-950 flex items-center justify-center min-h-[300px] md:min-h-0">
          {artwork.imageUrl ? (
            <img src={artwork.imageUrl} alt={artwork.title} className="w-full h-full object-contain max-h-[50vh] md:max-h-[92vh]" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-stone-500">
              <ImageOff className="w-16 h-16" />
              <span>暂无高清图片</span>
            </div>
          )}
        </div>
        <ScrollArea className="md:w-[45%] max-h-[42vh] md:max-h-[92vh]">
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <Badge className={`${mc.bgColor} ${mc.color} border ${mc.borderColor} text-xs mb-3 font-medium`}>
                <MapPin className="w-3 h-3 mr-1" />
                {mc.nameZh}{mc.country ? ` · ${mc.country}` : ""}
              </Badge>
              <h2 className="text-2xl font-serif font-bold text-stone-900 leading-tight">{artwork.title}</h2>
              {artwork.artist && artwork.artist !== "Unknown" && (
                <p className="text-stone-600 mt-2 text-base">{artwork.artist}</p>
              )}
            </div>
            {fields.length > 0 && (
              <div className="grid grid-cols-1 gap-3">
                {fields.map((field, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-stone-50 border border-stone-100">
                    <span className="text-stone-400 mt-0.5 shrink-0">{field.icon}</span>
                    <div className="min-w-0">
                      <span className="text-[11px] text-stone-400 uppercase tracking-wider font-medium block">{field.label}</span>
                      <span className="text-sm text-stone-700 leading-relaxed break-words">{field.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {artwork.description && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">简介</h4>
                <p className="text-sm text-stone-600 leading-relaxed">{artwork.description}</p>
              </div>
            )}
            {artwork.creditLine && (
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">藏品来源</h4>
                <p className="text-xs text-stone-500 leading-relaxed">{artwork.creditLine}</p>
              </div>
            )}
            {artwork.detailUrl && (
              <a href={artwork.detailUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-stone-900 text-white text-sm hover:bg-stone-800 transition-colors group">
                <ExternalLink className="w-4 h-4" />
                在{mc.name ? ` ${mc.nameZh} ` : ""}官网查看
                <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
          </div>
        </ScrollArea>
      </div>
    </DialogContent>
  );
}

// ─── Main Component ─────────────────────────────────────

const MuseumExplorer: React.FC = () => {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("china");
  const [selectedMuseums, setSelectedMuseums] = useState<string[]>(
    CHINA_MUSEUMS.map((m) => m.id)
  );
  const [artworks, setArtworks] = useState<MuseumArtwork[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedArtwork, setSelectedArtwork] = useState<MuseumArtwork | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [backendUrl, setBackendUrl] = useState(getBackendUrl());
  const [showSettings, setShowSettings] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const pageSize = 20;
  const abortRef = useRef<AbortController | null>(null);

  const currentMuseums = activeTab === "china" ? CHINA_MUSEUMS : WORLD_MUSEUMS;
  const totalResults = Object.entries(totals)
    .filter(([k]) => selectedMuseums.includes(k))
    .reduce((s, [, v]) => s + v, 0);

  // Check backend health on mount and tab switch
  useEffect(() => {
    if (activeTab === "china") {
      fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(3000) })
        .then((r) => r.ok && setBackendOnline(true))
        .catch(() => setBackendOnline(false));
    }
  }, [backendUrl, activeTab]);

  const doSearch = useCallback(
    async (q: string, p: number, museums: string[], tab: TabType) => {
      if (!q.trim()) return;
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setHasSearched(true);
      setErrors({});

      try {
        if (tab === "china") {
          // Chinese museums via backend
          const { artworks: items, totals: t, errors: e } = await searchChineseMuseums(
            q, museums, p, pageSize, backendUrl
          );
          if (controller.signal.aborted) return;
          setArtworks(items);
          setTotals(t);
          setErrors(e);
        } else {
          // World museums via direct APIs
          const perMuseumSize = Math.max(4, Math.floor(pageSize / museums.length));
          const promises: Promise<{ source: string; result: { artworks: MuseumArtwork[]; total: number } }>[] = [];

          if (museums.includes("met"))
            promises.push(searchMet(q, p, perMuseumSize).then((r) => ({ source: "met", result: r })));
          if (museums.includes("aic"))
            promises.push(searchAIC(q, p, perMuseumSize).then((r) => ({ source: "aic", result: r })));
          if (museums.includes("cleveland"))
            promises.push(searchCleveland(q, p, perMuseumSize).then((r) => ({ source: "cleveland", result: r })));

          const results = await Promise.allSettled(promises);
          if (controller.signal.aborted) return;

          const newTotals: Record<string, number> = {};
          let allArtworks: MuseumArtwork[] = [];
          for (const r of results) {
            if (r.status === "fulfilled") {
              newTotals[r.value.source] = r.value.result.total;
              allArtworks = allArtworks.concat(r.value.result.artworks);
            }
          }
          setTotals(newTotals);
          setArtworks(allArtworks);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          if (tab === "china") {
            toast.error("后端服务不可用，请确认已启动后端服务");
            setBackendOnline(false);
          } else {
            toast.error("搜索失败，请稍后重试");
          }
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [backendUrl]
  );

  const handleSearch = () => {
    if (!query.trim()) { toast.error("请输入搜索关键词"); return; }
    setSearchTerm(query);
    setPage(0);
    doSearch(query, 0, selectedMuseums, activeTab);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    doSearch(searchTerm, newPage, selectedMuseums, activeTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedMuseums(tab === "china" ? CHINA_MUSEUMS.map((m) => m.id) : WORLD_MUSEUMS.map((m) => m.id));
    setHasSearched(false);
    setArtworks([]);
    setTotals({});
    setErrors({});
    setPage(0);
    setSearchTerm("");
    setQuery("");
  };

  const toggleMuseum = (id: string) => {
    setSelectedMuseums((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((m) => m !== id);
      }
      return [...prev, id];
    });
  };

  useEffect(() => {
    if (searchTerm) {
      setPage(0);
      doSearch(searchTerm, 0, selectedMuseums, activeTab);
    }
  }, [selectedMuseums]);

  const handleSaveBackendUrl = () => {
    localStorage.setItem("museum_backend_url", backendUrl);
    setShowSettings(false);
    setBackendOnline(null);
    fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(3000) })
      .then((r) => r.ok && setBackendOnline(true))
      .catch(() => setBackendOnline(false));
    toast.success("后端地址已保存");
  };

  const suggestedSearches = activeTab === "china" ? SUGGESTED_SEARCHES_CHINA : SUGGESTED_SEARCHES_WORLD;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#FAFAF9] z-40">
      {/* Header */}
      <header className="flex-none border-b border-stone-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Logo + Tabs */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center shadow-sm">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:flex items-center gap-1 bg-stone-100 rounded-lg p-0.5">
              <button
                onClick={() => handleTabSwitch("china")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "china"
                    ? "bg-white shadow-sm text-stone-900"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                中国博物馆
              </button>
              <button
                onClick={() => handleTabSwitch("world")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "world"
                    ? "bg-white shadow-sm text-stone-900"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                世界博物馆
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={activeTab === "china" ? "搜索中国博物馆藏品..." : "Search world museum collections..."}
                className="pl-10 pr-20 h-10 bg-stone-50 border-stone-200 rounded-xl focus-visible:ring-stone-400 text-sm"
              />
              <Button onClick={handleSearch} disabled={loading || !query.trim()} size="sm"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 text-white text-xs">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "搜索"}
              </Button>
            </div>
          </div>

          {/* Museum filters + settings */}
          <div className="hidden lg:flex items-center gap-1.5 flex-wrap">
            {currentMuseums.map((m) => (
              <button
                key={m.id}
                onClick={() => toggleMuseum(m.id)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all duration-200 ${
                  selectedMuseums.includes(m.id)
                    ? `${m.bgColor} ${m.color} ${m.borderColor} shadow-sm`
                    : "bg-stone-50 text-stone-400 border-stone-200 hover:border-stone-300"
                }`}
              >
                {m.nameZh}
              </button>
            ))}
          </div>

          {activeTab === "china" && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors relative"
              title="后端设置"
            >
              <Settings className="w-4 h-4" />
              {backendOnline !== null && (
                <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${backendOnline ? "bg-green-500" : "bg-red-500"}`} />
              )}
            </button>
          )}
        </div>

        {/* Mobile tabs */}
        <div className="sm:hidden flex items-center gap-1 px-4 pb-2">
          <button
            onClick={() => handleTabSwitch("china")}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "china" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"
            }`}
          >
            中国博物馆
          </button>
          <button
            onClick={() => handleTabSwitch("world")}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "world" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"
            }`}
          >
            世界博物馆
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
            <span className="text-xs text-amber-800 font-medium shrink-0">后端地址：</span>
            <Input
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="h-8 text-xs max-w-xs bg-white border-amber-200"
              placeholder="http://localhost:8000"
            />
            <Button size="sm" onClick={handleSaveBackendUrl} className="h-8 text-xs bg-amber-700 hover:bg-amber-800">
              保存
            </Button>
            <span className={`text-xs ${backendOnline ? "text-green-600" : "text-red-600"}`}>
              {backendOnline === null ? "检测中..." : backendOnline ? "已连接" : "未连接"}
            </span>
          </div>
        </div>
      )}

      {/* Backend offline warning */}
      {activeTab === "china" && backendOnline === false && !showSettings && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>后端服务未启动。请运行 <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">cd backend && pip install -r requirements.txt && python app.py</code> 启动服务</span>
            <button onClick={() => setShowSettings(true)} className="ml-auto text-amber-700 underline shrink-0">设置</button>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {!hasSearched ? (
          <HeroSection
            query={query}
            setQuery={setQuery}
            onSearch={handleSearch}
            loading={loading}
            activeTab={activeTab}
            suggestedSearches={suggestedSearches}
            museums={currentMuseums}
          />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-serif font-bold text-stone-800">"{searchTerm}"</h2>
                {!loading && (
                  <span className="text-sm text-stone-400">
                    共找到 {totalResults.toLocaleString()} 件藏品
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-400 flex-wrap">
                {currentMuseums
                  .filter((m) => selectedMuseums.includes(m.id))
                  .map((m) => (
                    <span key={m.id} className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${m.bgColor} border ${m.borderColor}`} />
                      {(totals[m.id] || 0).toLocaleString()}
                    </span>
                  ))}
              </div>
            </div>

            {/* Error notices */}
            {Object.keys(errors).length > 0 && (
              <div className="mb-4 space-y-2">
                {Object.entries(errors).map(([mid, err]) => {
                  const m = MUSEUMS.find((x) => x.id === mid);
                  return (
                    <div key={mid} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-500">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span><strong>{m?.nameZh || mid}</strong>: {err}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Results Grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-xl overflow-hidden bg-white border border-stone-200/80 animate-pulse">
                    <div className="aspect-[4/5] bg-stone-200" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-stone-200 rounded w-3/4" />
                      <div className="h-3 bg-stone-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : artworks.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {artworks.map((a) => (
                    <ArtworkCard key={a.id} artwork={a} onClick={() => setSelectedArtwork(a)} />
                  ))}
                </div>
                <div className="flex items-center justify-center gap-3 mt-8 pb-4">
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page === 0} className="border-stone-200 text-stone-600">
                    <ChevronLeft className="w-4 h-4 mr-1" />上一页
                  </Button>
                  <span className="text-sm text-stone-500 tabular-nums">第 {page + 1} 页</span>
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={artworks.length < 4} className="border-stone-200 text-stone-600">
                    下一页<ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-stone-400 gap-4">
                <Search className="w-12 h-12 text-stone-300" />
                <p className="text-lg font-serif">未找到相关藏品</p>
                <p className="text-sm">
                  {activeTab === "china" ? "尝试更换关键词或确认后端服务已启动" : "尝试使用英文关键词或更换搜索条件"}
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!selectedArtwork} onOpenChange={(open) => !open && setSelectedArtwork(null)}>
        {selectedArtwork && <ArtworkDetail artwork={selectedArtwork} />}
      </Dialog>
    </div>
  );
};

// ─── Hero Section ───────────────────────────────────────

function HeroSection({
  query, setQuery, onSearch, loading, activeTab, suggestedSearches, museums,
}: {
  query: string;
  setQuery: (q: string) => void;
  onSearch: () => void;
  loading: boolean;
  activeTab: TabType;
  suggestedSearches: { label: string; query: string }[];
  museums: MuseumConfig[];
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] px-6 py-16">
      <div className="text-center space-y-8 max-w-2xl mx-auto">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 bg-stone-100 rounded-full blur-xl opacity-60 animate-pulse" />
          <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center border border-stone-200 shadow-lg">
            <Landmark className="w-9 h-9 text-stone-700" />
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-stone-900 tracking-wide">博物万象</h1>
          <div className="flex items-center justify-center gap-2 text-stone-400 text-sm">
            <span className="w-8 h-[1px] bg-stone-300" />
            <span className="tracking-[0.15em] text-xs uppercase">
              {activeTab === "china" ? "Explore Chinese Museum Collections" : "Explore Museum Collections Worldwide"}
            </span>
            <span className="w-8 h-[1px] bg-stone-300" />
          </div>
          <p className="text-stone-500 text-sm leading-relaxed max-w-md mx-auto">
            {activeTab === "china"
              ? "聚合故宫博物院、国家博物馆等中国各大博物馆藏品数据，一键检索数十万件珍贵文物"
              : "聚合全球顶级博物馆的开放藏品数据，超过 65 万件珍贵文物与艺术品"}
          </p>
        </div>

        {/* Museum badges */}
        <div className="flex items-center gap-2 justify-center flex-wrap text-xs text-stone-400">
          {museums.map((m) => (
            <div key={m.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${m.borderColor} ${m.bgColor}`}>
              <span className={`${m.color} font-medium`}>{m.nameZh}</span>
              <span className="text-stone-400">·</span>
              <span>{m.country}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder={activeTab === "china" ? "输入关键词搜索中国博物馆藏品..." : "输入关键词搜索全球博物馆藏品..."}
            className="pl-12 pr-28 h-14 bg-white border-stone-200 rounded-2xl shadow-lg focus-visible:ring-stone-400 text-base"
          />
          <Button onClick={onSearch} disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            搜索
          </Button>
        </div>

        {/* Suggested */}
        <div className="space-y-3">
          <p className="text-xs text-stone-400 tracking-wider uppercase">热门搜索</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {suggestedSearches.map((s) => (
              <button
                key={s.query}
                onClick={() => { setQuery(s.query); setTimeout(onSearch, 50); }}
                className="px-3 py-1.5 rounded-full bg-white border border-stone-200 text-xs text-stone-600 hover:border-stone-400 hover:text-stone-800 hover:shadow-sm transition-all duration-200"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MuseumExplorer;
