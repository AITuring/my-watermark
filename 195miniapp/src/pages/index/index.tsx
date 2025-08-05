import React, { useState, useMemo, useEffect } from "react";
import { View, Text, ScrollView, Picker } from "@tarojs/components";
import { AtButton, AtCard, AtTag, AtSearchBar } from "taro-ui";
import Taro from "@tarojs/taro";
import MyIcon from "@/components/MyIcon";

import './index.less'

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

// 导入JSON数据
import artifactsData from "@/195.json";

const Index: React.FC = () => {
    const [artifacts] = useState<Artifact[]>(artifactsData);
    const [filteredArtifacts, setFilteredArtifacts] = useState<Artifact[]>(artifacts);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedBatch, setSelectedBatch] = useState<string>("all");
    const [selectedType, setSelectedType] = useState<string>("all");
    const [selectedCollection, setSelectedCollection] = useState<string>("all");
    const [selectedEra, setSelectedEra] = useState<string>("all");

    // 详情弹窗
    const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
    const [showModal, setShowModal] = useState(false);

    // 提取单个博物馆名称的函数
    const extractMuseumNames = (collectionLocation: string): string[] => {
        const museums = new Set<string>();

        if (collectionLocation && collectionLocation.trim()) {
            if (collectionLocation === "原物为一对，一件藏于北京故宫博物院，另一件藏于河南博物院") {
                museums.add("故宫博物院");
                museums.add("河南博物院");
            } else if (collectionLocation === "上海博物馆、山西博物馆各收藏一半") {
                museums.add("上海博物馆");
                museums.add("山西博物馆");
            } else {
                museums.add(collectionLocation.trim());
            }
        }

        return Array.from(museums).sort();
    };

    // 获取所有唯一的批次、类型、馆藏、时代
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

    // 筛选逻辑
    useEffect(() => {
        let filtered = artifacts;

        // 按搜索词筛选
        if (searchTerm) {
            filtered = filtered.filter(
                (item) =>
                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.era.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.excavationLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.collectionLocation.toLowerCase().includes(searchTerm.toLowerCase())
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

        setFilteredArtifacts(filtered);
    }, [searchTerm, selectedBatch, selectedType, selectedCollection, selectedEra, artifacts]);

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
                return "red";
            case "第二批":
                return "blue";
            case "第三批":
                return "green";
            default:
                return "grey";
        }
    };

    // 获取类型颜色
    const getTypeColor = (type: string) => {
        const colors = {
            青铜: "orange",
            陶瓷: "yellow",
            绘画: "purple",
            书法: "blue",
            金银: "yellow",
            玉器: "green",
            漆器: "red",
            服饰: "pink",
        };
        return colors[type as keyof typeof colors] || "grey";
    };

    // 获取时代颜色
    const getEraColor = (era: string) => {
        const colors = {
            新石器时代: "red",
            商: "red",
            西周: "orange",
            春秋: "yellow",
            战国: "green",
            秦: "blue",
            西汉: "blue",
            东汉: "blue",
            三国: "purple",
            西晋: "pink",
            东晋: "pink",
            南北朝: "grey",
            隋: "green",
            唐: "green",
            五代: "blue",
            北宋: "purple",
            南宋: "purple",
            元: "orange",
            明: "red",
            清: "blue",
        };
        return colors[era as keyof typeof colors] || "grey";
    };

    // 显示详情
    const showArtifactDetail = (artifact: Artifact) => {
        setSelectedArtifact(artifact);
        setShowModal(true);
    };

    // 关闭详情
    const closeModal = () => {
        setShowModal(false);
        setSelectedArtifact(null);
    };

    // 简化的Markdown渲染
    const renderDescription = (desc: string, maxLength: number = 100) => {
        const cleanDesc = desc.replace(/[#*`]/g, '').replace(/\n+/g, ' ');
        return cleanDesc.length > maxLength
            ? `${cleanDesc.substring(0, maxLength)}...`
            : cleanDesc;
    };

    // 处理选择器变化
    const handleBatchChange = (e: any) => {
        const index = e.detail.value;
        const value = index === 0 ? "all" : batches[index - 1];
        setSelectedBatch(value);
    };

    const handleTypeChange = (e: any) => {
        const index = e.detail.value;
        const value = index === 0 ? "all" : types[index - 1];
        setSelectedType(value);
    };

    const handleEraChange = (e: any) => {
        const index = e.detail.value;
        const value = index === 0 ? "all" : eras[index - 1];
        setSelectedEra(value);
    };

    const handleCollectionChange = (e: any) => {
        const index = e.detail.value;
        const value = index === 0 ? "all" : collections[index - 1];
        setSelectedCollection(value);
    };

    // 获取当前选择的显示文本
    const getBatchDisplayText = () => {
        return selectedBatch === "all" ? "全部批次" : selectedBatch;
    };

    const getTypeDisplayText = () => {
        return selectedType === "all" ? "全部类型" : selectedType;
    };

    const getEraDisplayText = () => {
        return selectedEra === "all" ? "全部时代" : selectedEra;
    };

    const getCollectionDisplayText = () => {
        if (selectedCollection === "all") return "全部馆藏";
        return selectedCollection.length > 8 ? `${selectedCollection.substring(0, 8)}...` : selectedCollection;
    };

    // 筛选器组件
    const FilterSection = () => (
        <View className="filter-section">
            <AtSearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="搜索文物名称、描述、时代等..."
                className="search-bar"
            />

            <View className="filter-grid">
                <View className="filter-item">
                    <Text className="filter-label">批次</Text>
                    <Picker
                        mode="selector"
                        range={["全部批次", ...batches]}
                        value={selectedBatch === "all" ? 0 : batches.indexOf(selectedBatch) + 1}
                        onChange={handleBatchChange}
                        className="filter-picker"
                    >
                        <View className="picker-display">
                            <Text className="picker-text">{getBatchDisplayText()}</Text>
                            <MyIcon name="chevron-down" size={16} className="picker-icon" />
                        </View>
                    </Picker>
                </View>

                <View className="filter-item">
                    <Text className="filter-label">类型</Text>
                    <Picker
                        mode="selector"
                        range={["全部类型", ...types]}
                        value={selectedType === "all" ? 0 : types.indexOf(selectedType) + 1}
                        onChange={handleTypeChange}
                        className="filter-picker"
                    >
                        <View className="picker-display">
                            <Text className="picker-text">{getTypeDisplayText()}</Text>
                            <MyIcon name="chevron-down" size={16} className="picker-icon" />
                        </View>
                    </Picker>
                </View>

                <View className="filter-item">
                    <Text className="filter-label">时代</Text>
                    <Picker
                        mode="selector"
                        range={["全部时代", ...eras]}
                        value={selectedEra === "all" ? 0 : eras.indexOf(selectedEra) + 1}
                        onChange={handleEraChange}
                        className="filter-picker"
                    >
                        <View className="picker-display">
                            <Text className="picker-text">{getEraDisplayText()}</Text>
                            <MyIcon name="chevron-down" size={16} className="picker-icon" />
                        </View>
                    </Picker>
                </View>

                <View className="filter-item">
                    <Text className="filter-label">馆藏</Text>
                    <Picker
                        mode="selector"
                        range={["全部馆藏", ...collections]}
                        value={selectedCollection === "all" ? 0 : collections.indexOf(selectedCollection) + 1}
                        onChange={handleCollectionChange}
                        className="filter-picker"
                    >
                        <View className="picker-display">
                            <Text className="picker-text">{getCollectionDisplayText()}</Text>
                            <MyIcon name="chevron-down" size={16} className="picker-icon" />
                        </View>
                    </Picker>
                </View>
            </View>

            <View className="filter-actions">
                <View className="action-buttons">
                    <AtButton size="small" onClick={resetFilters} className="reset-btn">
                        <MyIcon name="refresh" size={14} />
                        重置筛选
                    </AtButton>
                </View>
                <Text className="result-count">
                    共找到 {filteredArtifacts.length} 件文物
                </Text>
            </View>
        </View>
    );

    // 网格视图组件 - 显示所有筛选结果
    const GridView = () => (
        <ScrollView className="grid-container" scrollY>
            {filteredArtifacts.map((artifact) => (
                <View
                    key={artifact.id}
                    className="grid-item"
                    onClick={() => showArtifactDetail(artifact)}
                >
                    <View className="grid-card">
                        <View className="card-header">
                            <View className="badge-group">
                                <View className={`batch-badge batch-${getBatchColor(artifact.batch)}`}>
                                    {artifact.batch}
                                </View>
                                <View className={`type-badge type-${getTypeColor(artifact.type)}`}>
                                    {artifact.type}
                                </View>
                            </View>
                            <Text className="artifact-title">{artifact.name}</Text>
                            <View className={`era-badge era-${getEraColor(artifact.era)}`}>
                                {artifact.era}
                            </View>
                        </View>
                        <View className="card-content">
                            <View className="meta-info">
                                <View className="meta-item">
                                    <MyIcon name="map-pin" size={12} />
                                    <Text className="meta-text">{artifact.excavationLocation}</Text>
                                </View>
                                <View className="meta-item">
                                    <MyIcon name="home" size={12} />
                                    <Text className="meta-text">
                                        {artifact.collectionLocation.length > 12
                                            ? `${artifact.collectionLocation.substring(0, 12)}...`
                                            : artifact.collectionLocation
                                        }
                                    </Text>
                                </View>
                            </View>
                            <Text className="description">
                                {renderDescription(artifact.desc, 60)}
                            </Text>
                        </View>
                    </View>
                </View>
            ))}
        </ScrollView>
    );

    return (
        <View className="wenwu-container">
            {/* <View className="header">
                <Text className="title">中华文物宝库</Text>
                <Text className="subtitle">探索中华文明瑰宝 · 传承千年文化</Text>
            </View> */}
            <FilterSection />
            <GridView />

            {/* 自定义详情弹窗 */}
            {showModal && (
                <View className="custom-modal-overlay" onClick={closeModal}>
                    <View className="custom-modal-container" onClick={(e) => e.stopPropagation()}>
                        <View className="custom-modal-header">
                            <Text className="modal-title">{selectedArtifact?.name}</Text>
                            <View className="modal-close" onClick={closeModal}>
                                <MyIcon name="close" size={20} />
                            </View>
                        </View>

                        <ScrollView className="custom-modal-content" scrollY>
                            {selectedArtifact && (
                                <View className="modal-content">
                                    <View className="modal-badges">
                                        <View className={`batch-badge batch-${getBatchColor(selectedArtifact.batch)}`}>
                                            {selectedArtifact.batch}
                                        </View>
                                        <View className={`type-badge type-${getTypeColor(selectedArtifact.type)}`}>
                                            {selectedArtifact.type}
                                        </View>
                                        <View className={`era-badge era-${getEraColor(selectedArtifact.era)}`}>
                                            {selectedArtifact.era}
                                        </View>
                                    </View>

                                    <View className="modal-info">
                                        <View className="info-section">
                                            <View className="info-item">
                                                <View className="info-label">
                                                    <MyIcon name="map-pin" size={16} />
                                                    <Text className="label-text">出土地点</Text>
                                                </View>
                                                <Text className="info-value">{selectedArtifact.excavationLocation}</Text>
                                            </View>
                                            <View className="info-item">
                                                <View className="info-label">
                                                    <MyIcon name="calendar" size={16} />
                                                    <Text className="label-text">出土时间</Text>
                                                </View>
                                                <Text className="info-value">{selectedArtifact.excavationTime}</Text>
                                            </View>
                                            <View className="info-item">
                                                <View className="info-label">
                                                    <MyIcon name="home" size={16} />
                                                    <Text className="label-text">收藏地点</Text>
                                                </View>
                                                <Text className="info-value">{selectedArtifact.collectionLocation}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View className="modal-description">
                                        <View className="description-header">
                                            <MyIcon name="file-text" size={16} />
                                            <Text className="description-title">文物描述</Text>
                                        </View>
                                        <Text className="description-content">
                                            {selectedArtifact.desc.replace(/[#*`]/g, '')}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </ScrollView>

                        <View className="custom-modal-footer">
                            <AtButton onClick={closeModal} className="modal-close-btn">关闭</AtButton>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

export default Index;
