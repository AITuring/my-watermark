import React, { useState, useMemo, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import "./wenwu-map.css";
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
import {
    Search,
    Filter,
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
    image?: string;
    detail?: string;
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
// 导入图片资源
import historyIcon from "@/assets/history/split_002.jpg";
const historyImages = Object.values(
    import.meta.glob("@/assets/history/split_*.jpg", { eager: true, as: "url" })
);

const wenwuTypeIcons = Object.fromEntries(
    Object.entries(
        import.meta.glob("@/assets/wenwu-type/*.jpg", { eager: true, as: "url" })
    ).map(([p, url]) => [
        (p.split("/").pop() || "").replace(".jpg", ""),
        url as string,
    ])
) as Record<string, string>;

const artifactImages = Object.fromEntries(
    Object.entries(
        import.meta.glob("@/assets/195/*", { eager: true, as: "url" })
    ).map(([p, url]) => [
        (p.split("/").pop() || ""),
        url as string,
    ])
) as Record<string, string>;

// Helper component for highlighting text safely
const HighlightText: React.FC<{
    text: string;
    highlight: string;
    contextLength?: number;
}> = ({ text, highlight, contextLength }) => {
    if (!text) return null;
    if (!highlight || !highlight.trim()) {
        // If contextLength is set but no highlight, just truncate start if needed (or full text if contextLength not set)
        // For standard behavior without highlight, we might just return the full text and let CSS truncate
        if (contextLength && text.length > contextLength * 2) {
            return <span>{text.slice(0, contextLength * 2)}...</span>;
        }
        return <>{text}</>;
    }
    try {
        const escapedHighlight = highlight.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
        const regex = new RegExp(`(${escapedHighlight})`, "gi");
        let displayText = text;
        let matchIndex = -1;

        if (contextLength) {
            // Find first match
            const match = regex.exec(text);
            if (match) {
                matchIndex = match.index;
                const start = Math.max(0, matchIndex - contextLength);
                const end = Math.min(
                    text.length,
                    matchIndex + match[0].length + contextLength
                );
                displayText =
                    (start > 0 ? "..." : "") +
                    text.slice(start, end) +
                    (end < text.length ? "..." : "");
            } else {
                // No match found (weird if filtered), fallback to start
                if (text.length > contextLength * 2) {
                    displayText = text.slice(0, contextLength * 2) + "...";
                }
            }
        }

        const parts = displayText.split(regex);
        return (
            <span>
                {parts.map((part, i) =>
                    regex.test(part) ? (
                        <span
                            key={i}
                            className="bg-yellow-200 text-slate-900 rounded-[2px] px-0.5 box-decoration-clone"
                        >
                            {part}
                        </span>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                )}
            </span>
        );
    } catch (error) {
        console.error("Highlighting error:", error);
        return <>{text}</>;
    }
};

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
    const viewMode = "grid";


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
        北京: ["故宫博物院", "中国国家博物馆", "首都博物馆", "中国国家图书馆"],
        上海: ["上海博物馆", "上海市历史博物馆"],
        天津: ["天津博物馆"],
        重庆: ["重庆中国三峡博物馆", "重庆博物馆"],

        河南: ["河南博物院", "二里头夏都博物馆", "郑州博物馆"],
        湖北: ["湖北省博物馆"],
        陕西: [
            "陕西历史博物馆",
            "秦始皇帝陵博物院",
            "西安博物院",
            "西安碑林博物馆",
        ],
        浙江: ["浙江省博物馆", "杭州市博物馆", "临安博物馆"],
        江苏: ["南京博物院", "南京市博物馆", "苏州博物馆", "扬州博物馆"],
        山东: ["山东博物馆", "淄博博物馆"],
        湖南: ["湖南省博物馆", "岳麓书院"],
        河北: ["河北博物院", "定州市博物馆"],
        甘肃: ["甘肃省博物馆", "敦煌研究院"],
        四川: ["成都金沙遗址博物馆", "广汉三星堆博物馆"],
        辽宁: ["辽宁省博物馆"],
        新疆: ["新疆维吾尔自治区博物馆"],
        宁夏: ["宁夏文物考古研究所"],
        青海: ["青海省文物考古研究所"],
        山西: ["山西博物院", "山西古建筑博物馆", "北齐壁画博物馆"],
        广东: ["西汉南越王博物馆"],
        江西: ["江西省博物馆"],
        安徽: ["安徽博物院", "安徽省文物考古研究所", "马鞍山市博物馆"],
    };

    const normalizeProvince = (name: string) =>
        (name || "").replace(/(省|市|自治区|特别行政区)$/, "");

    const belongsToProvince = (
        item: { collectionLocation: string; excavationLocation: string },
        provinceRaw: string
    ) => {
        if (!provinceRaw) return true;
        const province = normalizeProvince(provinceRaw);
        const candidates = [province, `${province}市`, `${province}省`];

        const hitsText = (text?: string) =>
            !!text && candidates.some((k) => text.includes(k));

        // 1) collection/excavation 直接命中“北京/北京市/北京省”等
        if (
            hitsText(item.collectionLocation) ||
            hitsText(item.excavationLocation)
        ) {
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
            if (
                p === "原物为一对，一件藏于北京故宫博物院，另一件藏于河南博物院"
            ) {
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
                        const provinces =
                            result?.districtList?.[0]?.districtList || [];
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
                                    poly.on("mouseover", () =>
                                        poly.setOptions({
                                            fillOpacity: 0.08,
                                            strokeColor: "#60a5fa",
                                        })
                                    );
                                    poly.on("mouseout", () =>
                                        poly.setOptions({
                                            fillOpacity: 0,
                                            strokeColor: "#cbd5e1",
                                        })
                                    );
                                    polygons.push(poly);
                                });
                                provincePolygonsRef.current[prov.adcode] =
                                    polygons;
                                polygons.forEach((pg) => pg.setMap(mapIns));
                            });
                        });
                    });
                });
            };

            // 新增：自动定位到当前省，并过滤仅当前省数据 + 视野适配到省范围
            const autoLocateAndFilterProvince = (mapIns: any) => {
                if (!window.AMap || hasAutoLocatedRef.current) return;
                window.AMap.plugin(
                    [
                        "AMap.Geolocation",
                        "AMap.Geocoder",
                        "AMap.DistrictSearch",
                    ],
                    () => {
                        const geolocation = new window.AMap.Geolocation({
                            enableHighAccuracy: true,
                            timeout: 5000,
                        });
                        geolocation.getCurrentPosition(
                            (status: string, result: any) => {
                                if (status !== "complete") return;
                                const pos = result.position;
                                const geocoder = new window.AMap.Geocoder({});
                                geocoder.getAddress(
                                    pos,
                                    (s: string, res: any) => {
                                        if (s !== "complete") return;
                                        const addr =
                                            res?.regeocode?.addressComponent;
                                        const provinceName =
                                            addr?.province ||
                                            addr?.city ||
                                            addr?.district ||
                                            "";
                                        if (!provinceName) return;

                                        hasAutoLocatedRef.current = true;
                                        setCurrentProvince(provinceName);

                                        const ds =
                                            new window.AMap.DistrictSearch({
                                                level: "province",
                                                extensions: "all",
                                            });
                                        ds.search(
                                            provinceName,
                                            (st2: string, res2: any) => {
                                                if (st2 !== "complete") return;
                                                const d2 =
                                                    res2?.districtList?.[0];
                                                const boundaries =
                                                    d2?.boundaries || [];
                                                if (boundaries.length) {
                                                    const tempPoly =
                                                        new window.AMap.Polygon(
                                                            {
                                                                path: boundaries[0],
                                                            }
                                                        );
                                                    mapIns.setFitView([
                                                        tempPoly,
                                                    ]);
                                                    tempPoly.setMap(
                                                        null as any
                                                    );
                                                }
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
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
        "北京",
        "上海",
        "天津",
        "重庆",
        "河南",
        "郑州",
        "山西",
        "太原",
        "陕西",
        "西安",
        "山东",
        "济南",
        "青岛",
        "江苏",
        "南京",
        "苏州",
        "无锡",
        "浙江",
        "杭州",
        "宁波",
        "绍兴",
        "温州",
        "广东",
        "广州",
        "深圳",
        "佛山",
        "东莞",
        "湖北",
        "武汉",
        "湖南",
        "长沙",
        "四川",
        "成都",
        "江西",
        "南昌",
        "福建",
        "福州",
        "厦门",
        "安徽",
        "合肥",
        "河北",
        "石家庄",
        "辽宁",
        "沈阳",
        "大连",
        "吉林",
        "长春",
        "黑龙江",
        "哈尔滨",
        "云南",
        "昆明",
        "贵州",
        "贵阳",
        "甘肃",
        "兰州",
        "青海",
        "西宁",
        "宁夏",
        "银川",
        "新疆",
        "乌鲁木齐",
        "海南",
        "海口",
        "广西",
        "南宁",
        "内蒙古",
        "呼和浩特",
        "西藏",
        "拉萨",
        "香港",
        "澳门",
        "台湾",
    ];

    const deduceCityFromName = (name: string): string | null => {
        const s = (name || "").trim();
        for (const region of COMMON_REGIONS) {
            if (s.includes(region)) return region;
        }
        return null;
    };

    const normalizeForCompare = (s: string) =>
        (s || "")
            .replace(/\\s+/g, "")
            .replace(/博物院/g, "博物馆")
            .toLowerCase();

    const EXCLUDED_KEYWORDS = [
        "地铁",
        "站",
        "停车场",
        "酒店",
        "商场",
        "商店",
        "餐厅",
        "写字楼",
    ];

    // 预置常见博物馆坐标，减少 API 调用，大幅提升加载性能
    const PRESET_LOCATIONS: Record<string, [number, number]> = {
        故宫博物院: [116.397026, 39.918058],
        中国国家博物馆: [116.403406, 39.905075],
        上海博物馆: [121.474699, 31.228778],
        南京博物院: [118.821526, 32.042354],
        陕西历史博物馆: [108.959727, 34.222281],
        河南博物院: [113.663221, 34.784457],
        浙江省博物馆: [120.146502, 30.254199], // 孤山馆区
        湖北省博物馆: [114.362402, 30.563198],
        湖南省博物馆: [112.991463, 28.215475],
        天津博物馆: [117.214397, 39.082675],
        首都博物馆: [116.339958, 39.906774],
        山西博物院: [112.531931, 37.869944],
        四川博物院: [104.030938, 30.659864],
        重庆中国三峡博物馆: [106.551875, 29.564386],
        安徽博物院: [117.232649, 31.815952],
        甘肃省博物馆: [103.768076, 36.068656],
        辽宁省博物馆: [123.461219, 41.693729],
        秦始皇帝陵博物院: [109.278551, 34.384759],
        三星堆博物馆: [104.207856, 30.993968],
        金沙遗址博物馆: [104.011848, 30.682394],
        广东省博物馆: [113.325455, 23.118278],
        江西省博物馆: [115.883312, 28.679387],
        云南省博物馆: [102.718338, 24.946835],
        福建博物院: [119.282125, 26.092699],
        贵州省博物馆: [106.645835, 26.647133],
        海南省博物馆: [110.368224, 20.019504],
        内蒙古博物院: [111.718608, 40.843268],
        广西民族博物馆: [108.390754, 22.779707],
        西藏博物馆: [91.106262, 29.652897],
        宁夏博物馆: [106.235461, 38.494632],
        新疆维吾尔自治区博物馆: [87.587737, 43.807708],
        青海省博物馆: [101.765253, 36.632229],
        黑龙江省博物馆: [126.642556, 45.756956],
        吉林省博物院: [125.406878, 43.794565],
        苏州博物馆: [120.625196, 31.323743],
        扬州博物馆: [119.396884, 32.393614],
    };

    const scorePoi = (poi: any, query: string, cityHint?: string) => {
        const name = poi?.name || "";
        const type = poi?.type || "";
        const cityname = poi?.cityname || "";
        const adname = poi?.adname || "";

        // 负向过滤（明显不是馆）
        for (const k of EXCLUDED_KEYWORDS) {
            if (name.includes(k)) return -Infinity;
        }

        const qn = normalizeForCompare(query);
        const pn = normalizeForCompare(name);

        let score = 0;
        if (pn === qn) score += 100;
        else if (pn.includes(qn) || qn.includes(pn)) score += 60;

        if (type.includes("博物馆") || type.includes("博物院")) score += 40;

        if (
            cityHint &&
            (cityname.includes(cityHint) || adname.includes(cityHint))
        ) {
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
        const cityHint =
            deduceCityFromName(query) || deduceCityFromName(name) || null;

        return new Promise((resolve) => {
            const placeSearch = new window.AMap.PlaceSearch({
                city: cityHint || "全国",
                citylimit: !!cityHint, // 有城市线索时收紧范围
                pageSize: 5, // 拿更多候选以便挑选最优
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

    // 地理编码函数（先 预设 -> 缓存 -> POI 检索 -> Geocoder）
    const geocodeLocation = async (
        address: string
    ): Promise<LocationCoordinate | null> => {
        const cityHint = deduceCityFromName(address) || null;
        const normalized = normalizeMuseumQuery(address);
        const cacheKey = `${normalized}__${cityHint || "全国"}`;

        // 0) 优先检查预设坐标（秒开）
        if (PRESET_LOCATIONS[normalized]) {
            const [lng, lat] = PRESET_LOCATIONS[normalized];
            const coordinate: LocationCoordinate = {
                lng,
                lat,
                address: normalized,
                artifacts: [],
            };
            // 同时也写入缓存，保持逻辑一致
            if (!locationCache.has(cacheKey)) {
                setLocationCache((prev) => {
                    const next = new Map(prev);
                    next.set(cacheKey, coordinate);
                    return next;
                });
            }
            return coordinate;
        }

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
        try {
            infoWindowRef.current?.close();
        } catch {}

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
                        if (hoverTimerRef.current)
                            clearTimeout(hoverTimerRef.current);
                        hoverTimerRef.current = window.setTimeout(() => {
                            try {
                                infoWindowRef.current?.close();
                            } catch {}
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
                            <span class="chip chip-primary">当前显示 ${
                                museumArtifacts.length
                            }</span>
                            <span class="chip">馆藏总数 ${
                                allMuseumArtifacts.length
                            }</span>
                          </div>
                          <div class="artifact-list">
                            ${museumArtifacts
                                .map(
                                    (artifact) =>
                                        `<div class="artifact-item">${artifact.name}</div>`
                                )
                                .join("")}
                          </div>
                        </div>
                      `;
                        if (!infoWindowRef.current) {
                            infoWindowRef.current = new window.AMap.InfoWindow({
                                isCustom: true,
                                offset: new window.AMap.Pixel(0, -12),
                                autoMove: true, // 自动调整地图视野以显示 InfoWindow
                                closeWhenClickMap: true, // 点击地图关闭
                            });
                        }
                        infoWindowRef.current.setContent(html);
                        infoWindowRef.current.open(
                            mapInstance,
                            marker.getPosition()
                        );

                        // 重新绑定 Hover 保持逻辑（针对 InfoWindow 自身）
                        setTimeout(() => {
                            const panel = document.querySelector(
                                ".info-window"
                            ) as HTMLElement | null;
                            if (panel) {
                                panel.onmouseenter = () => {
                                    if (hoverTimerRef.current) {
                                        clearTimeout(hoverTimerRef.current);
                                        hoverTimerRef.current = null;
                                    }
                                };
                                panel.onmouseleave = () => {
                                    // 只有在非点击锁定模式下才自动关闭（此处简化处理：桌面端 Hover 离开仍关闭，但允许点击锁定）
                                    // 为了更好的体验，我们统一策略：
                                    // 1. Hover Marker -> 打开
                                    // 2. Hover InfoWindow -> 保持
                                    // 3. MouseOut both -> 延时关闭
                                    // 4. Click Marker -> 打开并清除延时（“锁定”效果需配合状态，这里简单处理为重新打开）
                                    scheduleClose();
                                };
                            }
                        }, 0);
                    };

                    // 桌面端 Hover 交互
                    marker.on("mouseover", openInfo);
                    marker.on("mouseout", scheduleClose);

                    // 移动端/桌面端 点击交互（更稳健）
                    marker.on("click", (e: any) => {
                        // 点击时清除关闭定时器，确保窗口常驻
                        if (hoverTimerRef.current) {
                            clearTimeout(hoverTimerRef.current);
                            hoverTimerRef.current = null;
                        }
                        openInfo();
                    });

                    markers.push(marker);
                }
            }
        }

        // 若期间已触发新一轮渲染，丢弃本轮结果
        if (runId !== geocodeRunIdRef.current) return;

        // 使用 MarkerClusterer 管理标记（严格覆盖为“当前筛选”的集合）
        if (!clustererRef.current) {
            clustererRef.current = new window.AMap.MarkerClusterer(
                mapInstance,
                markers,
                {
                    gridSize: 80,
                    maxZoom: 15, // 放大到 15 级以上时不聚合
                    averageCenter: true,
                    renderClusterMarker: (context: any) => {
                        const count = context.count;
                        const div = document.createElement("div");
                        div.className = "cluster-marker";
                        div.innerHTML = `<span class="cluster-count">${count}</span>`;
                        context.marker.setOffset(
                            new window.AMap.Pixel(-20, -20)
                        );
                        context.marker.setContent(div);
                    },
                }
            );
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
            // 让地图计算一个可见范围的合理缩放级别，增加 padding 避免贴边
            mapInstance.setFitView(null, false, [60, 60, 60, 60]);
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
        try {
            infoWindowRef.current?.close();
        } catch {}
    }, [filteredArtifacts]);

    // 地图与窗口/容器尺寸的清理（卸载时触发）
    useEffect(() => {
        return () => {
            if (mapInstance && (mapInstance as any).__wm_cleanup__) {
                try {
                    (mapInstance as any).__wm_cleanup__();
                } catch {}
            }
            try {
                infoWindowRef.current?.close();
            } catch {}
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
            filtered = filtered.filter((item) =>
                belongsToProvince(item, currentProvince)
            );
        }

        // 排序：批次顺序（第一批 -> 第二批 -> 第三批） -> ID
        const batchOrder: Record<string, number> = {
            第一批: 1,
            第二批: 2,
            第三批: 3,
        };

        filtered.sort((a, b) => {
            const orderA = batchOrder[a.batch] || 99;
            const orderB = batchOrder[b.batch] || 99;
            if (orderA !== orderB) return orderA - orderB;
            return a.id - b.id;
        });

        setFilteredArtifacts(filtered);
    }, [
        searchTerm,
        selectedBatch,
        selectedType,
        selectedCollection,
        artifacts,
        selectedEra,
        currentProvince,
    ]);


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

    console.log(types,eras);

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-600 font-sans selection:bg-violet-200 selection:text-violet-900">
            {/* 顶部导航栏 */}
            <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-white/70 border-b border-slate-200/50 supports-[backdrop-filter]:bg-white/60">
                <div className="max-w-[1800px] mx-auto px-4 h-auto lg:h-20 py-3 lg:py-0 flex flex-col lg:flex-row items-center justify-between gap-4">
                    <div className="flex items-center justify-between w-full lg:w-auto">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-8 h-8 overflow-hidden shadow-lg shadow-blue-500/20">
                                <img
                                    src={historyIcon}
                                    alt="Icon"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 font-serif tracking-tight whitespace-nowrap">
                                禁止出境展览文物
                            </h1>
                        </div>

                    </div>

                    {/* 居中搜索框 + 筛选 (Desktop: Row, Mobile: Search only) */}
                    <div className="flex-1 w-full lg:w-auto flex flex-col lg:flex-row items-center justify-center gap-3">
                        <div className="w-full lg:w-64 relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-2 border-none rounded-full leading-5 bg-slate-100/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:bg-white transition-all duration-300 shadow-inner hover:bg-slate-100"
                                placeholder="搜索文物、年代、地点..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Desktop Filters */}
                        <div className="hidden lg:flex items-center gap-2">
                            <div className="relative">
                                <Select
                                    value={selectedBatch}
                                    onValueChange={setSelectedBatch}
                                >
                                    <SelectTrigger className="w-[150px] h-9 rounded-full border-slate-200/60 bg-slate-50/50 shadow-sm hover:bg-white text-xs pr-16">
                                        <SelectValue placeholder="批次" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            全部批次
                                        </SelectItem>
                                        {batches.map((b) => (
                                            <SelectItem key={b} value={b}>
                                                {b}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedBatch !== "all" && (
                                    <div
                                        className="absolute right-10 top-1/2 -translate-y-1/2 cursor-pointer p-1 hover:bg-slate-200 rounded-full z-10"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedBatch("all");
                                        }}
                                    >
                                        <X className="w-3 h-3 text-slate-400" />
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <Select
                                    value={selectedType}
                                    onValueChange={setSelectedType}
                                >
                                    <SelectTrigger className="w-[150px] h-9 rounded-full border-slate-200/60 bg-slate-50/50 shadow-sm hover:bg-white text-xs pr-16">
                                        <SelectValue placeholder="类别" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            全部类别
                                        </SelectItem>
                                        {types.map((t) => (
                                            <SelectItem key={t} value={t}>
                                                <div className="flex items-center gap-2">
                                                    {wenwuTypeIcons[t] && (
                                                        <img src={wenwuTypeIcons[t]} alt={t} className="w-5 h-5 rounded-sm" />
                                                    )}
                                                    <span>{t}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedType !== "all" && (
                                    <div
                                        className="absolute right-10 top-1/2 -translate-y-1/2 cursor-pointer p-1 hover:bg-slate-200 rounded-full z-10"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedType("all");
                                        }}
                                    >
                                        <X className="w-3 h-3 text-slate-400" />
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <Select
                                    value={selectedEra}
                                    onValueChange={setSelectedEra}
                                >
                                    <SelectTrigger className="w-[150px] h-9 rounded-full border-slate-200/60 bg-slate-50/50 shadow-sm hover:bg-white text-xs pr-16">
                                        <SelectValue placeholder="时代" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            全部时代
                                        </SelectItem>
                                        {eras.map((e) => (
                                            <SelectItem key={e} value={e}>
                                                {e}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedEra !== "all" && (
                                    <div
                                        className="absolute right-10 top-1/2 -translate-y-1/2 cursor-pointer p-1 hover:bg-slate-200 rounded-full z-10"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedEra("all");
                                        }}
                                    >
                                        <X className="w-3 h-3 text-slate-400" />
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <Select
                                    value={selectedCollection}
                                    onValueChange={setSelectedCollection}
                                >
                                    <SelectTrigger className="w-[150px] h-9 rounded-full border-slate-200/60 bg-slate-50/50 shadow-sm hover:bg-white text-xs pr-16">
                                        <SelectValue placeholder="馆藏" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            全部馆藏
                                        </SelectItem>
                                        {collections.map((c) => (
                                            <SelectItem key={c} value={c}>
                                                {c}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedCollection !== "all" && (
                                    <div
                                        className="absolute right-10 top-1/2 -translate-y-1/2 cursor-pointer p-1 hover:bg-slate-200 rounded-full z-10"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCollection("all");
                                        }}
                                    >
                                        <X className="w-3 h-3 text-slate-400" />
                                    </div>
                                )}
                            </div>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={resetFilters}
                                className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                title="重置"
                            >
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1800px] mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 中间栏 -> 左栏：内容 (7 Columns) */}
                <div className="lg:col-span-7 space-y-4">
                    {/* 移动端筛选折叠器 (Visible on mobile only) */}
                    <div className="lg:hidden mb-4">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full rounded-xl border-slate-200 shadow-sm"
                                >
                                    <Filter className="w-4 h-4 mr-2" /> 筛选条件
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>筛选文物</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500 ml-1">
                                            批次
                                        </label>
                                        <Select
                                            value={selectedBatch}
                                            onValueChange={setSelectedBatch}
                                        >
                                            <SelectTrigger className="w-full rounded-xl border-slate-200 shadow-sm">
                                                <SelectValue placeholder="全部批次" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    全部批次
                                                </SelectItem>
                                                {batches.map((b) => (
                                                    <SelectItem
                                                        key={b}
                                                        value={b}
                                                    >
                                                        {b}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500 ml-1">
                                            类别
                                        </label>
                                        <Select
                                            value={selectedType}
                                            onValueChange={setSelectedType}
                                        >
                                            <SelectTrigger className="w-full rounded-xl border-slate-200 shadow-sm">
                                                <SelectValue placeholder="全部类别" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    全部类别
                                                </SelectItem>
                                                {types.map((t) => (
                                                    <SelectItem
                                                        key={t}
                                                        value={t}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {wenwuTypeIcons[t] && (
                                                                <img src={wenwuTypeIcons[t]} alt={t} className="w-5 h-5 rounded-sm" />
                                                            )}
                                                            <span>{t}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500 ml-1">
                                            时代
                                        </label>
                                        <Select
                                            value={selectedEra}
                                            onValueChange={setSelectedEra}
                                        >
                                            <SelectTrigger className="w-full rounded-xl border-slate-200 shadow-sm">
                                                <SelectValue placeholder="全部时代" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    全部时代
                                                </SelectItem>
                                                {eras.map((e) => (
                                                    <SelectItem
                                                        key={e}
                                                        value={e}
                                                    >
                                                        {e}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500 ml-1">
                                            馆藏
                                        </label>
                                        <Select
                                            value={selectedCollection}
                                            onValueChange={
                                                setSelectedCollection
                                            }
                                        >
                                            <SelectTrigger className="w-full rounded-xl border-slate-200 shadow-sm">
                                                <SelectValue placeholder="全部馆藏" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    全部馆藏
                                                </SelectItem>
                                                {collections.map((c) => (
                                                    <SelectItem
                                                        key={c}
                                                        value={c}
                                                    >
                                                        {c}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            resetFilters();
                                            // Optional: close dialog if we had a ref, but simple reset is fine
                                        }}
                                        className="w-full rounded-xl border-dashed border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 mt-4"
                                    >
                                        重置筛选
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* 视图切换与状态 */}
                    <div className="flex items-center px-1">
                        <div className="text-sm text-slate-500">
                            共 {filteredArtifacts.length} 个结果
                        </div>
                    </div>

                    {/* 文物列表 */}
                    <div
                        className={
                            viewMode === "grid"
                                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                                : "space-y-4"
                        }
                    >
                        {filteredArtifacts.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center space-y-4">
                                <div className="w-32 h-32 rounded-full bg-slate-100 overflow-hidden shadow-inner">
                                    <img
                                        src={
                                            historyImages[
                                                Math.floor(
                                                    Math.random() *
                                                        historyImages.length
                                                )
                                            ]
                                        }
                                        alt="No results"
                                        className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-medium text-slate-900">
                                        暂无相关文物
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        换个搜索词试试看吧
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={resetFilters}
                                    className="mt-4"
                                >
                                    重置筛选
                                </Button>
                            </div>
                        ) : (
                            filteredArtifacts.map((artifact) => (
                                <Dialog key={artifact.id}>
                                    <DialogTrigger asChild>
                                        <div
                                            className={`
                                            group cursor-pointer bg-white rounded-2xl transition-all duration-300
                                            border border-slate-100 hover:border-violet-100
                                            ${
                                                viewMode === "grid"
                                                    ? "hover:-translate-y-1 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]"
                                                    : "flex gap-4 p-4 hover:bg-slate-50 shadow-sm hover:shadow-md"
                                            }
                                        `}
                                        >
                                            <div
                                                className="p-5"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex gap-2">
                                                        <span
                                                            className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white text-slate-700 border border-slate-200"
                                                        >
                                                            {artifact.batch}
                                                        </span>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 font-medium flex items-center gap-1">
                                                            {wenwuTypeIcons[artifact.type] && (
                                                                <img src={wenwuTypeIcons[artifact.type]} alt={artifact.type} className="w-5 h-5 rounded-sm" />
                                                            )}
                                                            {artifact.type}
                                                        </span>
                                                    </div>
                                                </div>

                                                <h3 className="text-lg font-bold text-slate-800 mb-2 font-serif group-hover:text-violet-700 transition-colors line-clamp-1">
                                                    <HighlightText
                                                        text={artifact.name}
                                                        highlight={searchTerm}
                                                    />
                                                </h3>

                                                <div className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">
                                                    {searchTerm ? (
                                                        <HighlightText
                                                            text={artifact.desc}
                                                            highlight={
                                                                searchTerm
                                                            }
                                                            contextLength={40}
                                                        />
                                                    ) : (
                                                        <MarkdownContent
                                                            content={
                                                                artifact.desc
                                                            }
                                                            className="[&>p]:mb-0 text-slate-500"
                                                        />
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-50">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {artifact.era}
                                                    </div>
                                                    <div className="flex items-center gap-1 max-w-[50%]">
                                                        <Landmark className="w-3 h-3 shrink-0" />
                                                        <span className="truncate">
                                                            {
                                                                artifact.collectionLocation
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[85vh] rounded-3xl border-none shadow-2xl">
                                        <DialogHeader className="px-2">
                                            <DialogTitle className="text-2xl font-serif text-slate-800">
                                                {artifact.name}
                                            </DialogTitle>
                                            <div className="flex gap-2 mt-2">
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-full px-3 font-normal bg-white border border-slate-200 text-slate-700"
                                                >
                                                    {artifact.era}
                                                </Badge>
                                                <Badge
                                                    variant="secondary"
                                                    className="rounded-full px-3 bg-white border border-slate-200 text-slate-700 font-normal"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        {wenwuTypeIcons[artifact.type] && (
                                                            <img src={wenwuTypeIcons[artifact.type]} alt={artifact.type} className="w-5 h-5 rounded-sm" />
                                                        )}
                                                        <span>{artifact.type}</span>
                                                    </span>
                                                </Badge>
                                            </div>
                                        </DialogHeader>
                                        <ScrollArea className="max-h-[70vh] px-2 md:px-0">
                                            <div className="space-y-6 py-4">
                                                {artifact.image && artifactImages[artifact.image.split("/").pop() || ""] && (
                                                    <div className="rounded-2xl border border-slate-100 bg-white p-3">
                                                        <div className="w-full h-[280px] md:h-[380px] overflow-hidden rounded-xl bg-slate-50">
                                                            <img
                                                                src={artifactImages[artifact.image.split("/").pop() || ""]}
                                                                alt={artifact.name}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="bg-slate-50 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-1">
                                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                                            <MapPin className="w-3 h-3" />{" "}
                                                            出土
                                                        </span>
                                                        <p className="font-medium text-slate-700">
                                                            {
                                                                artifact.excavationLocation
                                                            }
                                                        </p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />{" "}
                                                            时间
                                                        </span>
                                                        <p className="font-medium text-slate-700">
                                                            {
                                                                artifact.excavationTime
                                                            }
                                                        </p>
                                                    </div>
                                                    <div className="md:col-span-2 space-y-1">
                                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                                            <Landmark className="w-3 h-3" />{" "}
                                                            馆藏
                                                        </span>
                                                        <p className="font-medium text-slate-700">
                                                            {
                                                                artifact.collectionLocation
                                                            }
                                                        </p>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                        <span className="w-1 h-4 bg-violet-500 rounded-full"></span>
                                                        文物描述
                                                    </h4>
                                                    <div className="prose prose-sm prose-slate max-w-none bg-white p-1">
                                                        <MarkdownContent
                                                            content={
                                                                artifact.detail && artifact.detail.trim()
                                                                    ? artifact.detail
                                                                    : artifact.desc
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </DialogContent>
                                </Dialog>
                            ))
                        )}
                    </div>

                </div>

                {/* 右侧栏：地图 (5 Columns) */}
                <div className="lg:col-span-5 mt-6 lg:mt-0">
                    <div className="lg:sticky lg:top-24">
                        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden h-[500px] lg:h-[calc(100vh-8rem)] lg:min-h-[500px] relative group">
                            {/* 地图标题浮层 */}
                            <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm border border-slate-100/50">
                                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-violet-500" />
                                    博物馆分布
                                </h3>
                            </div>

                            {isLoadingMap ? (
                                <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
                                        <span className="text-xs text-slate-400">
                                            加载地图资源...
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    ref={mapContainerRef}
                                    className="w-full h-full bg-slate-50 transition-opacity duration-500"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </main>



        </div>
    );
};

export default Wenwu;