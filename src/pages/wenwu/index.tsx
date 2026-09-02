import React, { useState, useMemo, useEffect } from "react";
import "highlight.js/styles/github.css";
import "./map.css";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import {
    historyIcon,
    historyImages,
    wenwuTypeIcons,
} from "./assets";
import { ArtifactCard } from "./ArtifactCard";
import { ArtifactPanel } from "./ArtifactPanel";
import { FilterBar } from "./FilterBar";
import { BATCH_ORDER } from "./constants";
import { useWenwuMap } from "./useWenwuMap";
import {
    belongsToProvince,
    extractMuseumNames,
    getEraColor,
    getEraIcon,
    getEraRank,
    getTypeColor,
} from "./utils";
import type { Artifact } from "./types";

const Wenwu: React.FC = () => {
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [filteredArtifacts, setFilteredArtifacts] = useState<Artifact[]>([]);
    const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(true);
    const [artifactsError, setArtifactsError] = useState("");
    const [artifactsReloadKey, setArtifactsReloadKey] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedBatch, setSelectedBatch] = useState<string>("all");
    const [selectedType, setSelectedType] = useState<string>("all");
    const [selectedCollection, setSelectedCollection] = useState<string>("all");
    const [selectedEra, setSelectedEra] = useState<string>("all");
    const viewMode = "grid";

    const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
    const [isArtifactPanelOpen, setIsArtifactPanelOpen] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        const dataUrl = `${import.meta.env.BASE_URL}data/195.json`;

        const loadArtifacts = async () => {
            setIsLoadingArtifacts(true);
            setArtifactsError("");

            try {
                const response = await fetch(dataUrl, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Failed to load artifacts: ${response.status}`);
                }

                const payload = (await response.json()) as Artifact[];
                setArtifacts(payload);
            } catch (error) {
                if (controller.signal.aborted) return;
                setArtifacts([]);
                setArtifactsError("文物数据加载失败，请重试");
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoadingArtifacts(false);
                }
            }
        };

        void loadArtifacts();

        return () => controller.abort();
    }, [artifactsReloadKey]);

    const openArtifactPanel = (artifact: Artifact) => {
        setActiveArtifact(artifact);
        if (isArtifactPanelOpen) return;
        setIsArtifactPanelOpen(false);
        if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
            window.requestAnimationFrame(() => setIsArtifactPanelOpen(true));
        } else {
            setIsArtifactPanelOpen(true);
        }
    };

    // 暴露给全局，供地图 InfoWindow 点击调用
    useEffect(() => {
        (window as any).openArtifact = (id: number) => {
            const artifact = artifacts.find((a) => a.id === id);
            if (artifact) {
                openArtifactPanel(artifact);
            }
        };
        return () => {
            delete (window as any).openArtifact;
        };
    }, [artifacts]);

    const closeArtifactPanel = () => {
        setIsArtifactPanelOpen(false);
        if (typeof window !== "undefined" && "setTimeout" in window) {
            window.setTimeout(() => setActiveArtifact(null), 260);
        } else {
            setActiveArtifact(null);
        }
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
        const uniqueEras = Array.from(
            new Set(
                artifacts
                    .map((item) => item.era)
                    .filter((e) => e && e.trim().length > 0)
            )
        );

        // 按时代远近排序：从最早到最近
        uniqueEras.sort((a, b) => {
            const ra = getEraRank(a);
            const rb = getEraRank(b);
            if (ra !== rb) return ra - rb;
            // 同一权重下再按字面排序，保证稳定
            return a.localeCompare(b, "zh");
        });

        return uniqueEras;
    }, [artifacts]);

    const {
        currentProvince,
        focusMuseumForArtifact,
        isLoadingMap,
        mapContainerRef,
    } = useWenwuMap({
        artifacts,
        filteredArtifacts,
        activeArtifact,
        isArtifactPanelOpen,
    });

    // 筛选逻辑
    useEffect(() => {
        let filtered = [...artifacts];

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
        filtered.sort((a, b) => {
            const orderA = BATCH_ORDER[a.batch] || 99;
            const orderB = BATCH_ORDER[b.batch] || 99;
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

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-600 dark:text-slate-400 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/30">
            {/* Background Texture - Subtle Grain */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03] mix-blend-multiply dark:mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}
            />

            {/* 顶部导航栏 - 更加极简 */}
            <header className="fixed top-0 z-40 w-full">
                <div className="w-full backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/50 dark:border-slate-800/50">
                    <div className="max-w-[1800px] mx-auto px-4 h-16 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm">
                            <img
                                src={historyIcon}
                                alt="Icon"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 font-serif tracking-tight">
                            禁止出境展览文物
                        </h1>
                    </div>

                    {/* 居中搜索框 + 筛选 */}
                    <div className="flex-1 max-w-4xl flex items-center justify-end lg:justify-center gap-3">
                        <div className="w-full max-w-[260px] relative group hidden md:block">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-slate-600 dark:group-focus-within:text-slate-300 transition-colors" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-9 pr-3 py-1.5 text-sm border-none rounded-full bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/50 transition-all shadow-sm"
                                placeholder="搜索..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <FilterBar
                            mode="desktop"
                            resultCount={filteredArtifacts.length}
                            selectedBatch={selectedBatch}
                            selectedType={selectedType}
                            selectedEra={selectedEra}
                            selectedCollection={selectedCollection}
                            batches={batches}
                            types={types}
                            eras={eras}
                            collections={collections}
                            setSelectedBatch={setSelectedBatch}
                            setSelectedType={setSelectedType}
                            setSelectedEra={setSelectedEra}
                            setSelectedCollection={setSelectedCollection}
                            resetFilters={resetFilters}
                            wenwuTypeIcons={wenwuTypeIcons}
                            getEraIcon={getEraIcon}
                        />
                    </div>
                </div>
            </div>
            </header>

            <main className="max-w-[1800px] mx-auto p-4 pt-32 lg:px-6 lg:pb-6 lg:pt-24 grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* 中间栏 -> 左栏：内容 (7 Columns) */}
                <div className="lg:col-span-7">
                    <ArtifactPanel
                        artifact={activeArtifact}
                        isOpen={isArtifactPanelOpen}
                        onClose={closeArtifactPanel}
                        onFocusMuseum={focusMuseumForArtifact}
                        wenwuTypeIcons={wenwuTypeIcons}
                        getEraIcon={getEraIcon}
                        getEraColor={getEraColor}
                        getTypeColor={getTypeColor}
                    />
                    <FilterBar
                        mode="mobile"
                        resultCount={filteredArtifacts.length}
                        selectedBatch={selectedBatch}
                        selectedType={selectedType}
                        selectedEra={selectedEra}
                        selectedCollection={selectedCollection}
                        batches={batches}
                        types={types}
                        eras={eras}
                        collections={collections}
                        setSelectedBatch={setSelectedBatch}
                        setSelectedType={setSelectedType}
                        setSelectedEra={setSelectedEra}
                        setSelectedCollection={setSelectedCollection}
                        resetFilters={resetFilters}
                        wenwuTypeIcons={wenwuTypeIcons}
                        getEraIcon={getEraIcon}
                    />

                    {/* 视图切换与状态 - 已移至 Header */}
                    <div className="hidden"></div>

                    {/* 文物列表 */}
                    <div
                        className={
                            viewMode === "grid"
                                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                                : "space-y-4"
                        }
                    >
                        {isLoadingArtifacts ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center space-y-4">
                                <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
                                <div className="space-y-1">
                                    <h3 className="text-lg font-medium text-slate-900">
                                        正在加载文物数据
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        首次加载会稍等一会
                                    </p>
                                </div>
                            </div>
                        ) : artifactsError ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center space-y-4">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-medium text-slate-900">
                                        数据暂时没加载出来
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        {artifactsError}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setArtifactsReloadKey((key) => key + 1)
                                    }
                                >
                                    重新加载
                                </Button>
                            </div>
                        ) : filteredArtifacts.length === 0 ? (
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
                                <ArtifactCard
                                    key={artifact.id}
                                    artifact={artifact}
                                    searchTerm={searchTerm}
                                    onClick={openArtifactPanel}
                                    wenwuTypeIcons={wenwuTypeIcons}
                                    getEraIcon={getEraIcon}
                                    getEraColor={getEraColor}
                                    getTypeColor={getTypeColor}
                                />
                            ))
                        )}
                    </div>

                </div>

                {/* 右侧栏：地图 (5 Columns) */}
                <div className="lg:col-span-5 mt-6 lg:mt-0">
                    <div className="lg:sticky lg:top-24">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 overflow-hidden h-[500px] lg:h-[calc(100vh-8rem)] lg:min-h-[500px] relative group">

                            {isLoadingMap ? (
                                <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
                                        <span className="text-xs text-slate-400 dark:text-slate-500">
                                            加载地图资源...
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    ref={mapContainerRef}
                                    className="w-full h-full bg-slate-50 dark:bg-slate-900 transition-opacity duration-500"
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
