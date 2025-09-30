import React, { useState, useMemo, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Search,
    Filter,
    Grid,
    List,
    MapPin,
    Calendar,
    Landmark,
    X,
} from "lucide-react";

// 文物数据类型定义
interface Artifact {
    id: number;
    batch: string;
    type: string;
    name: string;
    era: string;
    excavationLocation: string;
    excavationTime: string;
    collectionLocation: string;
    desc: string;
}

// 位置坐标接口
interface LocationCoordinate {
    lng: number;
    lat: number;
    address: string;
    artifacts: Artifact[];
}

// 高德地图全局变量声明
declare global {
    interface Window {
        AMap: any;
        _AMapSecurityConfig: any;
    }
}

// 导入JSON数据
import artifactsData from "./195.json";

// 在文件末尾添加 Markdown 样式组件
const MarkdownContent: React.FC<{ content: string; className?: string }> = ({
    content,
    className = "",
}) => {
    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="text-xl font-bold mb-3 text-slate-800">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-lg font-semibold mb-2 text-slate-800">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-base font-semibold mb-2 text-slate-700">
                            {children}
                        </h3>
                    ),
                    p: ({ children }) => (
                        <p className="mb-3 leading-relaxed text-slate-700">
                            {children}
                        </p>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-3 space-y-1">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-3 space-y-1">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-slate-700">{children}</li>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold text-slate-800">
                            {children}
                        </strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-slate-700">{children}</em>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-200 pl-4 py-2 mb-3 bg-blue-50 text-slate-700">
                            {children}
                        </blockquote>
                    ),
                    code: ({ children, className }) => {
                        const isInline = !className;
                        return isInline ? (
                            <code className="bg-slate-100 px-1 py-0.5 rounded text-sm font-mono text-slate-800">
                                {children}
                            </code>
                        ) : (
                            <code className={className}>{children}</code>
                        );
                    },
                    pre: ({ children }) => (
                        <pre className="bg-slate-100 p-3 rounded-lg overflow-x-auto mb-3">
                            {children}
                        </pre>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

const Wenwu: React.FC = () => {
    const [artifacts] = useState<Artifact[]>(artifactsData);
    const [filteredArtifacts, setFilteredArtifacts] =
        useState<Artifact[]>(artifacts);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedBatch, setSelectedBatch] = useState<string>("all");
    const [selectedType, setSelectedType] = useState<string>("all");
    const [selectedCollection, setSelectedCollection] = useState<string>("all");
    const [selectedEra, setSelectedEra] = useState<string>("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    // 地图相关状态
    const [mapInstance, setMapInstance] = useState<any>(null);
    const [locationCache, setLocationCache] = useState<
        Map<string, LocationCoordinate>
    >(new Map());
    const [isLoadingMap, setIsLoadingMap] = useState(false);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const clustererRef = useRef<any>(null); // 新增：聚类实例
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    // InfoWindow 实例与悬停关闭的延时器
    const infoWindowRef = useRef<any | null>(null);
    const hoverTimerRef = useRef<number | null>(null);

    // 地图标注渲染批次ID，确保只有最新一次筛选结果会生效
    const geocodeRunIdRef = useRef(0);

    // 省份相关：当前省、是否已自动定位、省界多边形缓存
    const [currentProvince, setCurrentProvince] = useState<string | null>(null);

    // 是否在页面加载时自动定位到当前省并过滤/缩放（默认关闭以展示全国）
    const AUTO_LOCATE_ON_LOAD = false;
    // 是否启用省界悬停高亮（默认关闭以提升性能）
    const ENABLE_PROVINCE_HOVER = false;

    const hasAutoLocatedRef = useRef(false);
    const provincePolygonsRef = useRef<Record<string, any[]>>({});

    // 工具常量与函数：省份归属判断支持
    const PROVINCE_MUSEUM_KEYWORDS: Record<string, string[]> = {
      北京: ['故宫博物院', '中国国家博物馆', '首都博物馆', '中国国家图书馆'],
      上海: ['上海博物馆', '上海市历史博物馆'],
      天津: ['天津博物馆'],
      重庆: ['重庆中国三峡博物馆', '重庆博物馆'],

      河南: ['河南博物院', '二里头夏都博物馆', '郑州博物馆'],
      湖北: ['湖北省博物馆'],
      陕西: ['陕西历史博物馆', '秦始皇帝陵博物院', '西安博物院', '西安碑林博物馆'],
      浙江: ['浙江省博物馆', '杭州市博物馆', '临安博物馆'],
      江苏: ['南京博物院', '南京市博物馆', '苏州博物馆', '扬州博物馆'],
      山东: ['山东博物馆', '淄博博物馆'],
      湖南: ['湖南省博物馆', '岳麓书院'],
      河北: ['河北博物院', '定州市博物馆'],
      甘肃: ['甘肃省博物馆', '敦煌研究院'],
      四川: ['成都金沙遗址博物馆', '广汉三星堆博物馆'],
      辽宁: ['辽宁省博物馆'],
      新疆: ['新疆维吾尔自治区博物馆'],
      宁夏: ['宁夏文物考古研究所'],
      青海: ['青海省文物考古研究所'],
      山西: ['山西博物院', '山西古建筑博物馆', '北齐壁画博物馆'],
      广东: ['西汉南越王博物馆'],
      江西: ['江西省博物馆'],
      安徽: ['安徽博物院', '安徽省文物考古研究所', '马鞍山市博物馆'],
    };

    const normalizeProvince = (name: string) => (name || '').replace(/(省|市|自治区|特别行政区)$/,'');

    const belongsToProvince = (
      item: { collectionLocation: string; excavationLocation: string },
      provinceRaw: string
    ) => {
      if (!provinceRaw) return true;
      const province = normalizeProvince(provinceRaw);
      const candidates = [province, `${province}市`, `${province}省`];

      const hitsText = (text?: string) => !!text && candidates.some((k) => text.includes(k));

      // 1) collection/excavation 直接命中“北京/北京市/北京省”等
      if (hitsText(item.collectionLocation) || hitsText(item.excavationLocation)) {
        return true;
      }

      // 2) 命中该省常见藏馆关键字
      const museums = PROVINCE_MUSEUM_KEYWORDS[province] || [];
      return museums.some((m) => item.collectionLocation?.includes(m));
    };

    // 提取单个博物馆名称的函数（升级版：拆分/清洗/去括号/去冗余）
    const extractMuseumNames = (collectionLocation: string): string[] => {
        const museums = new Set<string>();
        if (!collectionLocation) return [];

        const raw = collectionLocation
            .replace(/（[^）]*）/g, "") // 去中文括号内容
            .replace(/\([^)]*\)/g, "") // 去英文括号内容
            .replace(/各(馆|博物馆)?(收藏|收藏一半|分藏|各藏).*/g, "") // 去“各收藏…”后缀
            .replace(/(等)?(单位|博物馆)?(共同)?(收藏|保管).*/g, ""); // 去“共同收藏…”后缀

        const parts = raw
            .split(/[、，,；;\/\|]|和|与|及/g) // 常见分隔符
            .map((s) => s.trim())
            .filter(Boolean);

        for (const p of parts) {
            // 处理少数特殊描述
            if (p === "原物为一对，一件藏于北京故宫博物院，另一件藏于河南博物院") {
                museums.add("故宫博物院");
                museums.add("河南博物院");
                continue;
            }
            if (p === "上海博物馆、山西博物馆各收藏一半") {
                museums.add("上海博物馆");
                museums.add("山西博物馆");
                continue;
            }
            museums.add(p);
        }

        return Array.from(museums).sort();
    };

    // 获取所有唯一的批次、类型、馆藏
    const batches = useMemo(() => {
        const uniqueBatches = [...new Set(artifacts.map((item) => item.batch))];
        return uniqueBatches.sort();
    }, [artifacts]);

    const types = useMemo(() => {
        const uniqueTypes = [...new Set(artifacts.map((item) => item.type))];
        return uniqueTypes.sort();
    }, [artifacts]);

    const collections = useMemo(() => {
        const allMuseums = new Set<string>();

        artifacts.forEach((item) => {
            const museums = extractMuseumNames(item.collectionLocation);
            museums.forEach((museum) => allMuseums.add(museum));
        });

        return Array.from(allMuseums).sort();
    }, [artifacts]);

    const eras = useMemo(() => {
        const uniqueEras = [...new Set(artifacts.map((item) => item.era))];
        return uniqueEras.sort();
    }, [artifacts]);

    // 摘要统计（当前筛选结果）
    const filteredMuseumsCount = useMemo(() => {
        const m = new Set<string>();
        filteredArtifacts.forEach((a) => {
            extractMuseumNames(a.collectionLocation).forEach((n) => m.add(n));
        });
        return m.size;
    }, [filteredArtifacts]);

    // 激活的筛选项（用于显示筛选chips）
    const activeFilters = useMemo(() => {
        const chips: Array<{ label: string; value: string }> = [];
        if (searchTerm) chips.push({ label: "搜索", value: searchTerm });
        if (selectedBatch !== "all")
            chips.push({ label: "批次", value: selectedBatch });
        if (selectedType !== "all")
            chips.push({ label: "类别", value: selectedType });
        if (selectedEra !== "all")
            chips.push({ label: "时代", value: selectedEra });
        if (selectedCollection !== "all")
            chips.push({ label: "馆藏", value: selectedCollection });
        return chips;
    }, [
        searchTerm,
        selectedBatch,
        selectedType,
        selectedEra,
        selectedCollection,
    ]);

    const handleRemoveFilter = (label: string) => {
        if (label === "搜索") setSearchTerm("");
        if (label === "批次") setSelectedBatch("all");
        if (label === "类别") setSelectedType("all");
        if (label === "时代") setSelectedEra("all");
        if (label === "馆藏") setSelectedCollection("all");
    };

    // 高德地图初始化
    useEffect(() => {
        // 添加延迟确保DOM完全渲染
        const timer = setTimeout(() => {
            loadAMapScript();
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    // 加载高德地图脚本
    const loadAMapScript = () => {
        if (window.AMap) {
            initializeMap();
            return;
        }

        setIsLoadingMap(true);

        // 设置安全密钥（需要替换为实际的安全密钥）
        window._AMapSecurityConfig = {
            securityJsCode: "3ba01835420271d5405dccba5e089b46",
        };

        const script = document.createElement("script");
        // 同时加载 Geocoder 和 PlaceSearch 插件，确保可以进行 POI 检索
        script.src =
            "https://webapi.amap.com/maps?v=1.4.15&key=7a9513e700e06c00890363af1bd2d926&plugin=AMap.Geocoder,AMap.PlaceSearch,AMap.MarkerClusterer";
        script.async = true;
        script.onload = () => {
            initializeMap();
            setIsLoadingMap(false);
        };
        script.onerror = () => {
            console.error("高德地图加载失败");
            setIsLoadingMap(false);
        };
        document.head.appendChild(script);
    };

    // 初始化地图
    const initializeMap = () => {
        if (!mapContainerRef.current) {
            setTimeout(() => {
                if (mapContainerRef.current && window.AMap && !mapInstance) {
                    initializeMap();
                }
            }, 200);
            return;
        }

        if (!window.AMap) {
            console.error("高德地图API未加载");
            return;
        }

        try {
            const map = new window.AMap.Map(mapContainerRef.current, {
                zoom: 5,
                center: [116.397428, 39.90923],
                mapStyle: "amap://styles/whitesmoke", // 改为更清爽的底图风格
            });

            // 兼容 v1.4/v2 的安全重绘
            const safeResize = () => {
                try {
                    const anyMap = map as any;
                    if (typeof anyMap.resize === "function") {
                        anyMap.resize();
                    } else {
                        // v1.4 没有 resize，通过“无副作用”的方式触发一次重绘
                        const c = map.getCenter();
                        const z = map.getZoom();
                        map.setZoom(z);
                        map.setCenter(c);
                    }
                } catch {}
            };

            // 地图完成初始化后，触发一次重绘和首轮标记渲染
            const onMapComplete = () => {
                safeResize();
                setTimeout(() => {
                    safeResize();
                    updateMapMarkers();
                }, 0);
            };
            map.on("complete", onMapComplete);

            // 监听窗口尺寸变化
            const onWinResize = () => {
                safeResize();
            };
            window.addEventListener("resize", onWinResize);

            // 监听容器尺寸变化
            if ("ResizeObserver" in window && mapContainerRef.current) {
                const ro = new ResizeObserver(() => {
                    safeResize();
                });
                ro.observe(mapContainerRef.current);
                resizeObserverRef.current = ro;
            }

            setMapInstance(map);

            // 新增：构建省界并绑定 hover 高亮
            const setupProvinceHover = (mapIns: any) => {
                if (!window.AMap) return;
                window.AMap.plugin("AMap.DistrictSearch", () => {
                    const ds = new window.AMap.DistrictSearch({
                        level: "country",
                        subdistrict: 1,
                        extensions: "all",
                    });
                    ds.search("中国", (status: string, result: any) => {
                        if (status !== "complete") return;
                        const provinces = result?.districtList?.[0]?.districtList || [];
                        provinces.forEach((prov: any) => {
                            const sub = new window.AMap.DistrictSearch({
                                level: "province",
                                extensions: "all",
                            });
                            sub.search(prov.adcode, (st: string, res: any) => {
                                if (st !== "complete") return;
                                const d = res?.districtList?.[0];
                                const boundaries = d?.boundaries || [];
                                const polygons: any[] = [];
                                boundaries.forEach((path: any) => {
                                    const poly = new window.AMap.Polygon({
                                        path,
                                        zIndex: 10,
                                        strokeWeight: 1,
                                        strokeColor: "#cbd5e1", // slate-300
                                        fillOpacity: 0,
                                        fillColor: "#bfdbfe", // hover 填充色
                                        bubble: true,
                                        cursor: "pointer",
                                    });
                                    poly.on("mouseover", () => poly.setOptions({ fillOpacity: 0.08, strokeColor: "#60a5fa" }));
                                    poly.on("mouseout", () => poly.setOptions({ fillOpacity: 0, strokeColor: "#cbd5e1" }));
                                    polygons.push(poly);
                                });
                                provincePolygonsRef.current[prov.adcode] = polygons;
                                polygons.forEach((pg) => pg.setMap(mapIns));
                            });
                        });
                    });
                });
            };

            // 新增：自动定位到当前省，并过滤仅当前省数据 + 视野适配到省范围
            const autoLocateAndFilterProvince = (mapIns: any) => {
                if (!window.AMap || hasAutoLocatedRef.current) return;
                window.AMap.plugin(["AMap.Geolocation", "AMap.Geocoder", "AMap.DistrictSearch"], () => {
                    const geolocation = new window.AMap.Geolocation({
                        enableHighAccuracy: true,
                        timeout: 5000,
                    });
                    geolocation.getCurrentPosition((status: string, result: any) => {
                        if (status !== "complete") return;
                        const pos = result.position;
                        const geocoder = new window.AMap.Geocoder({});
                        geocoder.getAddress(pos, (s: string, res: any) => {
                            if (s !== "complete") return;
                            const addr = res?.regeocode?.addressComponent;
                            const provinceName = addr?.province || addr?.city || addr?.district || "";
                            if (!provinceName) return;

                            hasAutoLocatedRef.current = true;
                            setCurrentProvince(provinceName);

                            const ds = new window.AMap.DistrictSearch({
                                level: "province",
                                extensions: "all",
                            });
                            ds.search(provinceName, (st2: string, res2: any) => {
                                if (st2 !== "complete") return;
                                const d2 = res2?.districtList?.[0];
                                const boundaries = d2?.boundaries || [];
                                if (boundaries.length) {
                                    const tempPoly = new window.AMap.Polygon({ path: boundaries[0] });
                                    mapIns.setFitView([tempPoly]);
                                    tempPoly.setMap(null as any);
                                }
                            });
                        });
                    });
                });
            };

            // 调用增强功能（受开关控制）
            if (ENABLE_PROVINCE_HOVER) {
                setupProvinceHover(map);
            }
            if (AUTO_LOCATE_ON_LOAD) {
                autoLocateAndFilterProvince(map);
            }

            // 组件卸载清理
            const cleanup = () => {
                window.removeEventListener("resize", onWinResize);
                if (typeof (map as any).off === "function") {
                    (map as any).off("complete", onMapComplete);
                }
                if (resizeObserverRef.current) {
                    resizeObserverRef.current.disconnect();
                    resizeObserverRef.current = null;
                }
            };
            (map as any).__wm_cleanup__ = cleanup;
        } catch (error) {
            console.error("地图初始化失败:", error);
        }
    };

    // 将简称或模糊名称规范为更易命中的检索词
    const normalizeMuseumQuery = (name: string) => {
        let q = (name || "").trim();

        const aliases: Record<string, string> = {
            故宫: "故宫博物院",
            紫禁城: "故宫博物院",
            国博: "中国国家博物馆",
            国家博物馆: "中国国家博物馆",
            中国国博: "中国国家博物馆",
            上博: "上海博物馆",
            上历博: "上海历史博物馆",
            陕历博: "陕西历史博物馆",
            山西博物馆: "山西博物院",
            河南省博物馆: "河南博物院",
            浙博: "浙江省博物馆",
            天博: "天津博物馆",
        };
        if (aliases[q]) return aliases[q];

        // 若不包含“博物”/“博物院”，补“博物馆”
        if (!q.includes("博物") && !q.includes("博物院")) {
            q = `${q} 博物馆`;
        }
        return q;
    };

    // 常见省份/直辖市/城市关键词（覆盖常见馆）
    const COMMON_REGIONS = [
        '北京','上海','天津','重庆',
        '河南','郑州','山西','太原','陕西','西安','山东','济南','青岛',
        '江苏','南京','苏州','无锡','浙江','杭州','宁波','绍兴','温州',
        '广东','广州','深圳','佛山','东莞',
        '湖北','武汉','湖南','长沙',
        '四川','成都','江西','南昌','福建','福州','厦门',
        '安徽','合肥','河北','石家庄','辽宁','沈阳','大连','吉林','长春','黑龙江','哈尔滨',
        '云南','昆明','贵州','贵阳','甘肃','兰州','青海','西宁','宁夏','银川','新疆','乌鲁木齐',
        '海南','海口','广西','南宁','内蒙古','呼和浩特','西藏','拉萨',
        '香港','澳门','台湾'
    ];

    const deduceCityFromName = (name: string): string | null => {
        const s = (name || '').trim();
        for (const region of COMMON_REGIONS) {
            if (s.includes(region)) return region;
        }
        return null;
    };

    const normalizeForCompare = (s: string) =>
        (s || '').replace(/\\s+/g, '').replace(/博物院/g, '博物馆').toLowerCase();

    const EXCLUDED_KEYWORDS = ['地铁', '站', '停车场', '酒店', '商场', '商店', '餐厅', '写字楼'];

    const scorePoi = (poi: any, query: string, cityHint?: string) => {
        const name = poi?.name || '';
        const type = poi?.type || '';
        const cityname = poi?.cityname || '';
        const adname = poi?.adname || '';

        // 负向过滤（明显不是馆）
        for (const k of EXCLUDED_KEYWORDS) {
            if (name.includes(k)) return -Infinity;
        }

        const qn = normalizeForCompare(query);
        const pn = normalizeForCompare(name);

        let score = 0;
        if (pn === qn) score += 100;
        else if (pn.includes(qn) || qn.includes(pn)) score += 60;

        if (type.includes('博物馆') || type.includes('博物院')) score += 40;

        if (cityHint && (cityname.includes(cityHint) || adname.includes(cityHint))) {
            score += 25;
        }

        // 小加成：POI 的 name 中包含城市关键词
        if (cityHint && name.includes(cityHint)) score += 10;

        return score;
    };

    // 使用 PlaceSearch 通过名称检索 POI
    const placeSearchByName = async (
        name: string
    ): Promise<LocationCoordinate | null> => {
        if (!window.AMap || !window.AMap.PlaceSearch) return null;

        const query = normalizeMuseumQuery(name);
        const cityHint = deduceCityFromName(query) || deduceCityFromName(name) || null;

        return new Promise((resolve) => {
            const placeSearch = new window.AMap.PlaceSearch({
                city: cityHint || "全国",
                citylimit: !!cityHint,      // 有城市线索时收紧范围
                pageSize: 5,               // 拿更多候选以便挑选最优
                pageIndex: 1,
                extensions: "all",
            });

            placeSearch.search(query, (status: string, result: any) => {
                const pois = result?.poiList?.pois || [];
                if (status === "complete" && pois.length > 0) {
                    // 按自定义打分选出最佳候选
                    let best = null as any;
                    let bestScore = -Infinity;
                    for (const poi of pois) {
                        const s = scorePoi(poi, query, cityHint || undefined);
                        if (s > bestScore) {
                            bestScore = s;
                            best = poi;
                        }
                    }
                    const loc = best?.location || (best as any)?._location;
                    if (loc) {
                        const coordinate: LocationCoordinate = {
                            lng: loc.lng,
                            lat: loc.lat,
                            address: best.name,
                            artifacts: [],
                        };
                        resolve(coordinate);
                        return;
                    }
                }
                resolve(null);
            });
        });
    };

    // 地理编码函数（先 POI 检索，后回退 Geocoder）
    const geocodeLocation = async (
        address: string
    ): Promise<LocationCoordinate | null> => {
        const cityHint = deduceCityFromName(address) || null;
        const normalized = normalizeMuseumQuery(address);
        const cacheKey = `${normalized}__${cityHint || "全国"}`;

        // 检查缓存（加入城市维度，避免同名异地混淆）
        if (locationCache.has(cacheKey)) {
            return locationCache.get(cacheKey)!;
        }

        // 1) 先用 POI 搜索获取更精确的博物馆坐标
        const poiResult = await placeSearchByName(address);
        if (poiResult) {
            setLocationCache((prev) => {
                const next = new Map(prev);
                next.set(cacheKey, poiResult);
                return next;
            });
            return poiResult;
        }

        // 2) 回退到 Geocoder（带 cityHint 收敛范围）
        return new Promise((resolve) => {
            if (!window.AMap) {
                resolve(null);
                return;
            }
            const geocoder = new window.AMap.Geocoder({
                city: cityHint || "全国",
            });

            geocoder.getLocation(normalized, (status: string, result: any) => {
                if (status === "complete" && result?.geocodes?.length > 0) {
                    const location = result.geocodes[0].location;
                    const coordinate: LocationCoordinate = {
                        lng: location.lng,
                        lat: location.lat,
                        address: address,
                        artifacts: [],
                    };

                    setLocationCache((prev) => {
                        const next = new Map(prev);
                        next.set(cacheKey, coordinate);
                        return next;
                    });
                    resolve(coordinate);
                } else {
                    resolve(null);
                }
            });
        });
    };

    // 更新地图标记 - 只显示当前筛选结果中的博物馆地点
    const updateMapMarkers = async () => {
        if (!mapInstance || !window.AMap) return;

        // 开始新一轮渲染：记录本轮批次，并关闭当前 InfoWindow
        geocodeRunIdRef.current += 1;
        const runId = geocodeRunIdRef.current;
        try { infoWindowRef.current?.close(); } catch {}

        const markers: any[] = [];
        const coordinates: [number, number][] = [];

        // 从筛选后的文物中提取博物馆列表
        const filteredMuseums = new Set<string>();
        filteredArtifacts.forEach((artifact) => {
            const museums = extractMuseumNames(artifact.collectionLocation);
            museums.forEach((museum) => filteredMuseums.add(museum));
        });

        for (const museum of Array.from(filteredMuseums)) {
            // 如果在耗时 geocode 期间来了新一轮筛选，停止旧轮渲染
            if (runId !== geocodeRunIdRef.current) return;

            const museumArtifacts = filteredArtifacts.filter((artifact) =>
                artifact.collectionLocation.includes(museum)
            );

            if (museumArtifacts.length > 0) {
                const allMuseumArtifacts = artifacts.filter((artifact) =>
                    artifact.collectionLocation.includes(museum)
                );

                const coordinate = await geocodeLocation(museum);
                if (runId !== geocodeRunIdRef.current) return; // 再次校验批次有效性
                if (coordinate) {
                    coordinate.artifacts = museumArtifacts;
                    coordinates.push([coordinate.lng, coordinate.lat]);

                    const marker = new window.AMap.Marker({
                        position: [coordinate.lng, coordinate.lat],
                        // anchor 对自定义 DOM content 一般不生效，使用 offset 做“底部居中”对齐
                        content: `
                          <div class="museum-marker" title="${museum}">
                            <svg class="museum-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="28" height="28" style="color:#2563eb;filter: drop-shadow(0 2px 6px rgba(37, 99, 235, 0.35));">
                              <path d="M12 3 3 8v2h18V8L12 3zm-7 9h2v7H5v-7zm4 0h2v7H9v-7zm4 0h2v7h-2v-7zm4 0h2v7h-2v-7z"/>
                            </svg>
                          </div>
                        `,
                        offset: new window.AMap.Pixel(-14, -28), // 28x28 图标 => 底部居中对齐
                        clickable: true,
                        bubble: true,
                        cursor: "pointer",
                        zIndex: 120,
                    });

                    const scheduleClose = () => {
                      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                      hoverTimerRef.current = window.setTimeout(() => {
                        try { infoWindowRef.current?.close(); } catch {}
                      }, 120);
                    };

                    const openInfo = () => {
                      if (hoverTimerRef.current) {
                        clearTimeout(hoverTimerRef.current);
                        hoverTimerRef.current = null;
                      }
                      const html = `
                        <div class="info-window">
                          <div class="info-header">
                            <span class="info-icon">🏛️</span>
                            <h4 class="info-title">${museum}</h4>
                          </div>
                          <div class="info-stats">
                            <span class="chip chip-primary">当前显示 ${museumArtifacts.length}</span>
                            <span class="chip">馆藏总数 ${allMuseumArtifacts.length}</span>
                          </div>
                          <div class="artifact-list">
                            ${museumArtifacts
                              .slice(0, 5)
                              .map((artifact) => `<div class="artifact-item">${artifact.name}</div>`)
                              .join("")}
                            ${museumArtifacts.length > 5 ? `<div class="more-items">还有 ${museumArtifacts.length - 5} 件...</div>` : ""}
                          </div>
                        </div>
                      `;
                      if (!infoWindowRef.current) {
                        infoWindowRef.current = new window.AMap.InfoWindow({
                          isCustom: true,
                          offset: new window.AMap.Pixel(0, -12),
                        });
                      }
                      infoWindowRef.current.setContent(html);
                      infoWindowRef.current.open(mapInstance, marker.getPosition());

                      setTimeout(() => {
                        const panel = document.querySelector(".info-window") as HTMLElement | null;
                        if (panel) {
                          panel.onmouseenter = () => {
                            if (hoverTimerRef.current) {
                              clearTimeout(hoverTimerRef.current);
                              hoverTimerRef.current = null;
                            }
                          };
                          panel.onmouseleave = () => {
                            scheduleClose();
                          };
                        }
                      }, 0);
                    };

                    marker.on("mouseover", openInfo);
                    marker.on("mouseout", scheduleClose);

                    markers.push(marker);
                }
            }
        }

        // 若期间已触发新一轮渲染，丢弃本轮结果
        if (runId !== geocodeRunIdRef.current) return;

        // 使用 MarkerClusterer 管理标记（严格覆盖为“当前筛选”的集合）
        if (!clustererRef.current) {
            clustererRef.current = new window.AMap.MarkerClusterer(mapInstance, markers, {
                gridSize: 80,
                averageCenter: true,
                renderClusterMarker: (context: any) => {
                    const count = context.count;
                    const div = document.createElement("div");
                    div.className = "cluster-marker";
                    div.innerHTML = `<span class="cluster-count">${count}</span>`;
                    context.marker.setOffset(new window.AMap.Pixel(-20, -20));
                    context.marker.setContent(div);
                },
            });
        } else {
            clustererRef.current.clearMarkers();
            clustererRef.current.addMarkers(markers);
        }

        // 基于筛选结果的智能定位：
        // - 1 个点：直接定位并放大
        // - 多个点：先用 fitView 计算合适缩放，再将中心移动到所有点的几何中心
        if (coordinates.length === 1) {
            const [lng, lat] = coordinates[0];
            mapInstance.setZoomAndCenter(14, [lng, lat]); // 14 级约为城区级别，可按需调整
        } else if (coordinates.length > 1) {
            // 让地图计算一个可见范围的合理缩放级别
            mapInstance.setFitView();
            // 再将中心设置为所有点的几何中心（中间点）
            const sum = coordinates.reduce(
                (acc, [lng, lat]) => {
                    acc[0] += lng;
                    acc[1] += lat;
                    return acc;
                },
                [0, 0] as [number, number]
            );
            const center: [number, number] = [sum[0] / coordinates.length, sum[1] / coordinates.length];
            mapInstance.setCenter(center);
        } else {
            mapInstance.setZoomAndCenter(5, [116.397428, 39.90923]);
        }
    };

    // 监听筛选变化，更新地图
    useEffect(() => {
        if (mapInstance) {
            updateMapMarkers();
        }
    }, [filteredArtifacts, mapInstance]);

    // 筛选变化时，主动关闭 InfoWindow，避免残留与误导
    useEffect(() => {
        try { infoWindowRef.current?.close(); } catch {}
    }, [filteredArtifacts]);

    // 地图与窗口/容器尺寸的清理（卸载时触发）
    useEffect(() => {
        return () => {
            if (mapInstance && (mapInstance as any).__wm_cleanup__) {
                try {
                    (mapInstance as any).__wm_cleanup__();
                } catch {}
            }
            try { infoWindowRef.current?.close(); } catch {}
            infoWindowRef.current = null;
        };
    }, [mapInstance]);

    // 筛选逻辑
    useEffect(() => {
        let filtered = artifacts;

        // 按搜索词筛选
        if (searchTerm) {
            filtered = filtered.filter(
                (item) =>
                    item.name
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                    item.desc
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                    item.era.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.excavationLocation
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                    item.collectionLocation
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase())
            );
        }

        // 按批次筛选
        if (selectedBatch !== "all") {
            filtered = filtered.filter((item) => item.batch === selectedBatch);
        }

        // 按类型筛选
        if (selectedType !== "all") {
            filtered = filtered.filter((item) => item.type === selectedType);
        }

        // 按馆藏筛选
        if (selectedCollection !== "all") {
            filtered = filtered.filter((item) =>
                item.collectionLocation.includes(selectedCollection)
            );
        }
        // 按时代筛选
        if (selectedEra !== "all") {
            filtered = filtered.filter((item) => item.era === selectedEra);
        }

        // 仅显示当前省（若已自动定位）
        if (currentProvince) {
            filtered = filtered.filter((item) => belongsToProvince(item, currentProvince));
        }

        setFilteredArtifacts(filtered);
        setCurrentPage(1);
    }, [
        searchTerm,
        selectedBatch,
        selectedType,
        selectedCollection,
        artifacts,
        selectedEra,
        currentProvince,
    ]);

    // 分页逻辑
    const paginatedArtifacts = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredArtifacts.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredArtifacts, currentPage]);

    const totalPages = Math.ceil(filteredArtifacts.length / itemsPerPage);

    // 重置筛选
    const resetFilters = () => {
        setSearchTerm("");
        setSelectedBatch("all");
        setSelectedType("all");
        setSelectedCollection("all");
        setSelectedEra("all");
    };

    // 获取批次颜色
    const getBatchColor = (batch: string) => {
        switch (batch) {
            case "第一批":
                return "bg-red-100 text-red-800 border-red-200";
            case "第二批":
                return "bg-blue-100 text-blue-800 border-blue-200";
            case "第三批":
                return "bg-green-100 text-green-800 border-green-200";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    // 获取类型颜色
    const getTypeColor = (type: string) => {
        const colors = {
            青铜: "bg-amber-100 text-amber-800",
            陶瓷: "bg-orange-100 text-orange-800",
            绘画: "bg-purple-100 text-purple-800",
            书法: "bg-indigo-100 text-indigo-800",
            金银: "bg-yellow-100 text-yellow-800",
            玉器: "bg-emerald-100 text-emerald-800",
            漆器: "bg-rose-100 text-rose-800",
            服饰: "bg-pink-100 text-pink-800",
        };
        return (
            colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800"
        );
    };

    // 获取时代颜色
    const getEraColor = (era: string) => {
        const colors = {
            新石器时代: "bg-red-100 text-red-800",
            商: "bg-red-100 text-red-800",
            西周: "bg-orange-100 text-orange-800",
            春秋: "bg-yellow-100 text-yellow-800",
            战国: "bg-green-100 text-green-800",
            秦: "bg-teal-100 text-teal-800",
            西汉: "bg-blue-100 text-blue-800",
            东汉: "bg-indigo-100 text-indigo-800",
            三国: "bg-purple-100 text-purple-800",
            西晋: "bg-pink-100 text-pink-800",
            东晋: "bg-rose-100 text-rose-800",
            南北朝: "bg-cyan-100 text-cyan-800",
            隋: "bg-lime-100 text-lime-800",
            唐: "bg-emerald-100 text-emerald-800",
            五代: "bg-sky-100 text-sky-800",
            北宋: "bg-violet-100 text-violet-800",
            南宋: "bg-fuchsia-100 text-fuchsia-800",
            元: "bg-amber-100 text-amber-800",
            明: "bg-red-100 text-red-800",
            清: "bg-blue-100 text-blue-800",
        };
        return (
            colors[era as keyof typeof colors] || "bg-slate-100 text-slate-800"
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-stone-100 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* 页面标题 */}
                <div className="text-center mb-8">
                    <h2 className="text-4xl md:text-5xl font-bold text-slate-800 mb-3 font-serif tracking-wide">
                        195件禁止出境文物
                    </h2>

                </div>

                {/* 搜索和筛选区域 */}
                <Card className="mb-6 border-slate-200/70 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-slate-800">
                            <Filter className="w-5 h-5" />
                            搜索与筛选
                        </CardTitle>
                        <CardDescription className="text-slate-500">
                            支持名称、描述、年代、出土/馆藏地点关键字检索
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* 搜索框 */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="搜索文物名称、描述、年代、出土地点、馆藏地点..."
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                />
                            </div>

                            {/* 筛选器 */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                <Select
                                    value={selectedBatch}
                                    onValueChange={setSelectedBatch}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择批次" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            全部批次
                                        </SelectItem>
                                        {batches.map((batch) => (
                                            <SelectItem
                                                key={batch}
                                                value={batch}
                                            >
                                                {batch}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={selectedType}
                                    onValueChange={setSelectedType}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择类别" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            全部类别
                                        </SelectItem>
                                        {types.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={selectedEra}
                                    onValueChange={setSelectedEra}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择时代" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            全部时代
                                        </SelectItem>
                                        {eras.map((era) => (
                                            <SelectItem key={era} value={era}>
                                                {era}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={selectedCollection}
                                    onValueChange={setSelectedCollection}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="选择馆藏" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            全部馆藏
                                        </SelectItem>
                                        {collections.map((collection) => (
                                            <SelectItem
                                                key={collection}
                                                value={collection}
                                            >
                                                {collection}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Button
                                    onClick={resetFilters}
                                    variant="outline"
                                    className="w-full"
                                >
                                    重置筛选
                                </Button>
                            </div>

                            {/* 激活筛选 chips */}
                            {activeFilters.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <span className="text-sm text-slate-500">
                                        已选：
                                    </span>
                                    {activeFilters.map((chip, idx) => (
                                        <span
                                            key={`${chip.label}-${chip.value}-${idx}`}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border border-slate-300 bg-white text-slate-700"
                                        >
                                            <span className="text-slate-500">
                                                {chip.label}：
                                            </span>
                                            <span className="font-medium">
                                                {chip.value}
                                            </span>
                                            <button
                                                aria-label="移除筛选"
                                                className="ml-1 text-slate-400 hover:text-slate-600"
                                                onClick={() =>
                                                    handleRemoveFilter(
                                                        chip.label
                                                    )
                                                }
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={resetFilters}
                                        className="text-slate-600"
                                    >
                                        清除全部
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 结果统计和视图切换 */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div className="text-slate-600">
                        共找到{" "}
                        <span className="font-semibold text-slate-800">
                            {filteredArtifacts.length}
                        </span>{" "}
                        件文物
                        <span className="mx-2 text-slate-400">•</span>
                        馆藏地{" "}
                        <span className="font-semibold text-slate-800">
                            {filteredMuseumsCount}
                        </span>{" "}
                        个
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={
                                viewMode === "grid" ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setViewMode("grid")}
                            className="shadow-sm"
                        >
                            <Grid className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={
                                viewMode === "list" ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setViewMode("list")}
                            className="shadow-sm"
                        >
                            <List className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-4">
                    {/* 左侧：列表/网格 */}
                    <div className="lg:col-span-3">
                        {viewMode === "grid" ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                                {paginatedArtifacts.map((artifact) => (
                                    <Dialog key={artifact.id}>
                                        <DialogTrigger asChild>
                                            <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.015] border-slate-200/70">
                                                <CardHeader className="pb-3">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <Badge
                                                            className={getBatchColor(
                                                                artifact.batch
                                                            )}
                                                        >
                                                            {artifact.batch}
                                                        </Badge>
                                                        <Badge
                                                            variant="secondary"
                                                            className={getTypeColor(
                                                                artifact.type
                                                            )}
                                                        >
                                                            {artifact.type}
                                                        </Badge>
                                                    </div>
                                                    <CardTitle className="text-lg leading-tight">
                                                        {artifact.name}
                                                    </CardTitle>
                                                    <CardDescription className="text-sm">
                                                        <Badge
                                                            variant="outline"
                                                            className={getEraColor(
                                                                artifact.era
                                                            )}
                                                        >
                                                            {artifact.era}
                                                        </Badge>
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="space-y-2 text-sm text-slate-600">
                                                        <div className="flex items-center gap-1">
                                                            <MapPin className="w-3 h-3" />
                                                            <span className="truncate">
                                                                {
                                                                    artifact.excavationLocation
                                                                }
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Landmark className="w-3 h-3" />
                                                            <span className="truncate">
                                                                {
                                                                    artifact.collectionLocation
                                                                }
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 line-clamp-2">
                                                            <MarkdownContent
                                                                content={
                                                                    artifact.desc
                                                                }
                                                                className="text-xs [&>p]:mb-0 [&>p]:leading-tight"
                                                            />
                                                        </p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl max-h-[80vh]">
                                            <DialogHeader>
                                                <DialogTitle className="text-xl font-serif">
                                                    {artifact.name}
                                                </DialogTitle>
                                            </DialogHeader>
                                            <ScrollArea className="max-h-96">
                                                <div className="space-y-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge
                                                            variant="outline"
                                                            className={getEraColor(
                                                                artifact.era
                                                            )}
                                                        >
                                                            {artifact.era}
                                                        </Badge>

                                                        <Badge
                                                            variant="secondary"
                                                            className={getTypeColor(
                                                                artifact.type
                                                            )}
                                                        >
                                                            {artifact.type}
                                                        </Badge>
                                                        <Badge
                                                            className={getBatchColor(
                                                                artifact.batch
                                                            )}
                                                        >
                                                            {artifact.batch}
                                                        </Badge>
                                                    </div>

                                                    <Separator />

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <h4 className="font-semibold mb-1 flex items-center gap-1">
                                                                <MapPin className="w-4 h-4" />
                                                                出土地点
                                                            </h4>
                                                            <p className="text-slate-600">
                                                                {
                                                                    artifact.excavationLocation
                                                                }
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold mb-1 flex items-center gap-1">
                                                                <Calendar className="w-4 h-4" />
                                                                出土时间
                                                            </h4>
                                                            <p className="text-slate-600">
                                                                {
                                                                    artifact.excavationTime
                                                                }
                                                            </p>
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <h4 className="font-semibold mb-1 flex items-center gap-1">
                                                                <Landmark className="w-4 h-4" />
                                                                馆藏地点
                                                            </h4>
                                                            <p className="text-slate-600">
                                                                {
                                                                    artifact.collectionLocation
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <Separator />

                                                    <div>
                                                        <h4 className="font-semibold mb-2">
                                                            文物描述
                                                        </h4>
                                                        <MarkdownContent
                                                            content={
                                                                artifact.desc
                                                            }
                                                            className="text-slate-700"
                                                        />
                                                    </div>
                                                </div>
                                            </ScrollArea>
                                        </DialogContent>
                                    </Dialog>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4 mb-8">
                                {paginatedArtifacts.map((artifact) => (
                                    <Dialog key={artifact.id}>
                                        <DialogTrigger asChild>
                                            <Card className="cursor-pointer hover:shadow-md transition-all duration-300 border-slate-200/70">
                                                <CardContent className="p-6">
                                                    <div className="flex flex-col md:flex-row gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex flex-wrap gap-2 mb-3">
                                                                <Badge
                                                                    className={getBatchColor(
                                                                        artifact.batch
                                                                    )}
                                                                >
                                                                    {
                                                                        artifact.batch
                                                                    }
                                                                </Badge>
                                                                <Badge
                                                                    variant="secondary"
                                                                    className={getTypeColor(
                                                                        artifact.type
                                                                    )}
                                                                >
                                                                    {
                                                                        artifact.type
                                                                    }
                                                                </Badge>
                                                            </div>
                                                            <h3 className="text-xl font-semibold mb-2 font-serif">
                                                                {artifact.name}
                                                            </h3>
                                                            <p className="text-slate-600 mb-3">
                                                                <Badge
                                                                    variant="outline"
                                                                    className={getEraColor(
                                                                        artifact.era
                                                                    )}
                                                                >
                                                                    {
                                                                        artifact.era
                                                                    }
                                                                </Badge>
                                                            </p>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600">
                                                                <div className="flex items-center gap-1">
                                                                    <MapPin className="w-4 h-4" />
                                                                    {
                                                                        artifact.excavationLocation
                                                                    }
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Landmark className="w-4 h-4" />
                                                                    {
                                                                        artifact.collectionLocation
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="md:w-1/3">
                                                            <div className="text-sm text-slate-600 line-clamp-3">
                                                                <MarkdownContent
                                                                    content={
                                                                        artifact.desc
                                                                    }
                                                                    className="text-sm [&>p]:mb-0 [&>p]:leading-tight [&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-sm"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl max-h-[80vh]">
                                            <DialogHeader>
                                                <DialogTitle className="text-xl font-serif">
                                                    {artifact.name}
                                                </DialogTitle>
                                                <DialogDescription className="text-base">
                                                    {artifact.era} ·{" "}
                                                    {artifact.type}
                                                </DialogDescription>
                                            </DialogHeader>
                                            <ScrollArea className="max-h-96">
                                                <div className="space-y-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge
                                                            className={getBatchColor(
                                                                artifact.batch
                                                            )}
                                                        >
                                                            {artifact.batch}
                                                        </Badge>
                                                        <Badge
                                                            variant="secondary"
                                                            className={getTypeColor(
                                                                artifact.type
                                                            )}
                                                        >
                                                            {artifact.type}
                                                        </Badge>
                                                    </div>

                                                    <Separator />

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <h4 className="font-semibold mb-1 flex items-center gap-1">
                                                                <MapPin className="w-4 h-4" />
                                                                出土地点
                                                            </h4>
                                                            <p className="text-slate-600">
                                                                {
                                                                    artifact.excavationLocation
                                                                }
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold mb-1 flex items-center gap-1">
                                                                <Calendar className="w-4 h-4" />
                                                                出土时间
                                                            </h4>
                                                            <p className="text-slate-600">
                                                                {
                                                                    artifact.excavationTime
                                                                }
                                                            </p>
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <h4 className="font-semibold mb-1 flex items-center gap-1">
                                                                <Landmark className="w-4 h-4" />
                                                                馆藏地点
                                                            </h4>
                                                            <p className="text-slate-600">
                                                                {
                                                                    artifact.collectionLocation
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <Separator />

                                                    <div>
                                                        <h4 className="font-semibold mb-2">
                                                            文物描述
                                                        </h4>
                                                        <MarkdownContent
                                                            content={
                                                                artifact.desc
                                                            }
                                                            className="text-slate-700"
                                                        />
                                                    </div>
                                                </div>
                                            </ScrollArea>
                                        </DialogContent>
                                    </Dialog>
                                ))}
                            </div>
                        )}

                        {/* 分页：只要有多页就显示 */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setCurrentPage((prev) =>
                                            Math.max(prev - 1, 1)
                                        )
                                    }
                                    disabled={currentPage === 1}
                                >
                                    上一页
                                </Button>

                                <div className="flex items-center gap-1">
                                    {Array.from(
                                        { length: Math.min(5, totalPages) },
                                        (_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (
                                                currentPage >=
                                                totalPages - 2
                                            ) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }

                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={
                                                        currentPage === pageNum
                                                            ? "default"
                                                            : "outline"
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                        setCurrentPage(pageNum)
                                                    }
                                                >
                                                    {pageNum}
                                                </Button>
                                            );
                                        }
                                    )}
                                </div>

                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setCurrentPage((prev) =>
                                            Math.min(prev + 1, totalPages)
                                        )
                                    }
                                    disabled={currentPage === totalPages}
                                >
                                    下一页
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* 右侧：地图始终展示 */}
                    <div className="lg:col-span-2">
                        <Card className="sticky top-4 border-slate-200/70 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-slate-800 font-serif">
                                    博物馆分布
                                </CardTitle>
                                <CardDescription className="text-slate-500">
                                    数字表示当前筛选结果中该馆的文物数
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoadingMap ? (
                                    <div className="h-[65vh] min-h-[420px] flex items-center justify-center bg-slate-50 rounded-lg">
                                        <div className="text-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                            <p className="text-slate-600">
                                                正在加载地图...
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        ref={mapContainerRef}
                                        className="w-full h-[65vh] min-h-[420px] rounded-lg border"
                                        style={{ transform: "none" }}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* 统计信息（总览） */}
                <Card className="mt-8 border-slate-200/70 shadow-sm">
                    <CardHeader>
                        <CardTitle className="font-serif">统计信息</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-blue-600">
                                    {artifacts.length}
                                </div>
                                <div className="text-sm text-slate-600">
                                    总文物数
                                </div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-green-600">
                                    {batches.length}
                                </div>
                                <div className="text-sm text-slate-600">
                                    批次数
                                </div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-purple-600">
                                    {types.length}
                                </div>
                                <div className="text-sm text-slate-600">
                                    类别数
                                </div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-orange-600">
                                    {collections.length}
                                </div>
                                <div className="text-sm text-slate-600">
                                    馆藏地数
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 地图标记样式 */}
            <style>
                {`
        /* Marker 外观：渐变圆 + 脉冲光晕 + 微动效 */
        .custom-marker {
          position: relative;
          width: 36px;
          height: 36px;
        }

        .marker-content {
          position: relative;
          z-index: 2;
          background: linear-gradient(135deg, #2563eb, #14b8a6);
          border: 2px solid #ffffff;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .marker-content:hover {
          transform: translateY(-1px) scale(1.03);
          box-shadow: 0 10px 24px rgba(20, 184, 166, 0.35);
        }

        /* 外圈脉冲光晕 */
        .marker-pulse {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(rgba(37, 99, 235, 0.25), transparent 60%);
          animation: marker-pulse 2s ease-out infinite;
          z-index: 1;
        }

        @keyframes marker-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }

        .marker-count {
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        /* 建筑图标标记的容器，保证热点与视觉完全重叠 */
        .museum-marker {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          transform: translateZ(0); /* 减少高分屏亚像素漂移 */
        }

        /* 聚类气泡：简洁圆片 + 数字 */
        .cluster-marker {
          width: 40px;
          height: 40px;
          border-radius: 9999px;
          background: linear-gradient(135deg, rgba(37,99,235,0.95), rgba(20,184,166,0.95));
          border: 2px solid #fff;
          box-shadow: 0 8px 20px rgba(2, 6, 23, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cluster-count {
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        /* 自定义 InfoWindow：玻璃拟态卡片 + 小箭头 */
        .info-window {
          position: relative;
          min-width: 260px;
          max-width: 320px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(2, 6, 23, 0.06);
          box-shadow: 0 10px 30px rgba(2, 6, 23, 0.15);
          border-radius: 12px;
          padding: 12px 14px;
          color: #0f172a; /* slate-900 */
        }

        .info-window::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -8px;
          transform: translateX(-50%) rotate(45deg);
          width: 14px;
          height: 14px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: inherit;
          border-right: 1px solid rgba(2, 6, 23, 0.06);
          border-bottom: 1px solid rgba(2, 6, 23, 0.06);
          box-shadow: 3px 3px 10px rgba(2, 6, 23, 0.12);
        }

        .info-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .info-icon {
          font-size: 16px;
        }

        .info-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .info-stats {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin: 6px 0 8px;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 12px;
          border: 1px solid rgba(2, 6, 23, 0.08);
          background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,250,252,0.9));
          color: #334155; /* slate-600 */
        }

        .chip-primary {
          background: linear-gradient(180deg, rgba(219,234,254,0.95), rgba(191,219,254,0.95));
          border-color: rgba(37, 99, 235, 0.25);
          color: #1d4ed8; /* blue-700 */
          font-weight: 600;
        }

        .artifact-list {
          margin-top: 4px;
          max-height: 150px;
          overflow: auto;
          padding-right: 2px;
        }

        .artifact-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 0;
          font-size: 13px;
          border-bottom: 1px dashed rgba(2, 6, 23, 0.08);
          color: #334155;
        }

        .artifact-item::before {
          content: "•";
          color: #64748b; /* slate-500 */
        }

        .more-items {
          padding: 6px 0 2px;
          font-size: 12px;
          color: #64748b;
          font-style: italic;
        }
                `}
            </style>
        </div>
    );
};

export default Wenwu;
