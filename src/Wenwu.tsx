import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, Filter, Grid, List, MapPin, Calendar, Landmark, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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
import artifactsData from './195.json';

const Wenwu: React.FC = () => {
  const [artifacts] = useState<Artifact[]>(artifactsData);
  const [filteredArtifacts, setFilteredArtifacts] = useState<Artifact[]>(artifacts);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // 地图相关状态
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [locationCache, setLocationCache] = useState<Map<string, LocationCoordinate>>(new Map());
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // 提取单个博物馆名称的函数
  const extractMuseumNames = (collectionLocation: string): string[] => {
    const museums = new Set<string>();

    // 预定义的博物馆名称映射，用于标准化
    const museumMapping = {
      '故宫博物院': '故宫博物院',
      '北京故宫博物院': '故宫博物院',
      '台北故宫博物院': '台北故宫博物院',
      '河南博物院': '河南博物院',
      '山西博物院': '山西博物院',
      '山西博物馆': '山西博物馆'
    };

    // 更精确的博物馆名称匹配模式
    const patterns = [
      // 匹配标准的博物馆/博物院名称
      /([\u4e00-\u9fa5]{2,8}博物院)/g,
      /([\u4e00-\u9fa5]{2,8}博物馆)/g,
      /([\u4e00-\u9fa5]{2,8}美术馆)/g,
      /([\u4e00-\u9fa5]{2,8}文物局)/g,
      /([\u4e00-\u9fa5]{2,8}考古[所院])/g,
      /([\u4e00-\u9fa5]{2,8}研究院)/g,
      /([\u4e00-\u9fa5]{2,8}文物考古研究所)/g
    ];

    // 使用正则表达式提取博物馆名称
    for (const pattern of patterns) {
      const matches = collectionLocation.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.trim();
          // 过滤掉过短的匹配
          if (cleaned.length >= 4) {
            // 检查是否有映射，使用标准化名称
            const standardName = museumMapping[cleaned as keyof typeof museumMapping] || cleaned;
            museums.add(standardName);
          }
        });
      }
    }

    // 特殊处理：如果没有匹配到任何博物馆，但包含特定关键词，则直接添加
    if (museums.size === 0) {
      Object.keys(museumMapping).forEach(key => {
        if (collectionLocation.includes(key)) {
          museums.add(museumMapping[key as keyof typeof museumMapping]);
        }
      });
    }

    return Array.from(museums).sort();
  };

  // 获取所有唯一的批次、类型、馆藏
  const batches = useMemo(() => {
    const uniqueBatches = [...new Set(artifacts.map(item => item.batch))];
    return uniqueBatches.sort();
  }, [artifacts]);

  const types = useMemo(() => {
    const uniqueTypes = [...new Set(artifacts.map(item => item.type))];
    return uniqueTypes.sort();
  }, [artifacts]);

  const collections = useMemo(() => {
    const allMuseums = new Set<string>();

    artifacts.forEach(item => {
      const museums = extractMuseumNames(item.collectionLocation);
      museums.forEach(museum => allMuseums.add(museum));
    });

    return Array.from(allMuseums).sort();
  }, [artifacts]);

  // 高德地图初始化
  useEffect(() => {
    if (viewMode === 'map' && !mapInstance) {
      loadAMapScript();
    }
  }, [viewMode]);

  // 加载高德地图脚本
  const loadAMapScript = () => {
    if (window.AMap) {
      initializeMap();
      return;
    }

    setIsLoadingMap(true);

    // 设置安全密钥（需要替换为实际的安全密钥）
    window._AMapSecurityConfig = {
      securityJsCode: '3ba01835420271d5405dccba5e089b46'
    };

    const script = document.createElement('script');
    script.src = 'https://webapi.amap.com/maps?v=1.4.15&key=7a9513e700e06c00890363af1bd2d926&plugin=AMap.Geocoder';
    script.async = true;
    script.onload = () => {
      initializeMap();
      setIsLoadingMap(false);
    };
    script.onerror = () => {
      console.error('高德地图加载失败');
      setIsLoadingMap(false);
    };
    document.head.appendChild(script);
  };

  // 初始化地图
  const initializeMap = () => {
    if (!mapContainerRef.current || !window.AMap) return;

    const map = new window.AMap.Map(mapContainerRef.current, {
      zoom: 5,
      center: [116.397428, 39.90923], // 北京坐标
      mapStyle: 'amap://styles/normal'
    });

    setMapInstance(map);
  };

  // 地理编码函数
  const geocodeLocation = async (address: string): Promise<LocationCoordinate | null> => {
    // 检查缓存
    if (locationCache.has(address)) {
      return locationCache.get(address)!;
    }

    return new Promise((resolve) => {
      if (!window.AMap) {
        resolve(null);
        return;
      }

      const geocoder = new window.AMap.Geocoder({
        city: '全国'
      });

      geocoder.getLocation(address, (status: string, result: any) => {
        if (status === 'complete' && result.geocodes.length > 0) {
          const location = result.geocodes[0].location;
          const coordinate: LocationCoordinate = {
            lng: location.lng,
            lat: location.lat,
            address: address,
            artifacts: []
          };

          // 缓存结果
          setLocationCache(prev => new Map(prev.set(address, coordinate)));
          resolve(coordinate);
        } else {
          resolve(null);
        }
      });
    });
  };

  // 更新地图标记
  const updateMapMarkers = async () => {
    if (!mapInstance || !window.AMap) return;

    // 清除现有标记
    mapInstance.clearMap();

    // 获取唯一的馆藏地点
    const locationGroups = new Map<string, Artifact[]>();
    filteredArtifacts.forEach(artifact => {
      const location = artifact.collectionLocation;
      if (!locationGroups.has(location)) {
        locationGroups.set(location, []);
      }
      locationGroups.get(location)!.push(artifact);
    });

    const markers: any[] = [];
    const coordinates: [number, number][] = [];

    // 为每个位置创建标记
    for (const [location, artifacts] of locationGroups) {
      const coordinate = await geocodeLocation(location);
      if (coordinate) {
        coordinate.artifacts = artifacts;
        coordinates.push([coordinate.lng, coordinate.lat]);

        // 创建自定义标记
        const marker = new window.AMap.Marker({
          position: [coordinate.lng, coordinate.lat],
          content: `
            <div class="custom-marker">
              <div class="marker-content">
                <span class="marker-count">${artifacts.length}</span>
              </div>
            </div>
          `,
          offset: new window.AMap.Pixel(-15, -30)
        });

        // 添加点击事件
        marker.on('click', () => {
          const infoWindow = new window.AMap.InfoWindow({
            content: `
              <div class="info-window">
                <h4>${location}</h4>
                <p>文物数量: ${artifacts.length}件</p>
                <div class="artifact-list">
                  ${artifacts.slice(0, 3).map(artifact =>
                    `<div class="artifact-item">${artifact.name}</div>`
                  ).join('')}
                  ${artifacts.length > 3 ? `<div class="more-items">还有${artifacts.length - 3}件...</div>` : ''}
                </div>
              </div>
            `,
            offset: new window.AMap.Pixel(0, -30)
          });
          infoWindow.open(mapInstance, marker.getPosition());
        });

        markers.push(marker);
        mapInstance.add(marker);
      }
    }

    // 调整地图视野以适应所有标记
    if (coordinates.length > 0) {
      mapInstance.setFitView(markers);
    }
  };

  // 监听筛选变化，更新地图
  useEffect(() => {
    if (viewMode === 'map' && mapInstance) {
      updateMapMarkers();
    }
  }, [filteredArtifacts, mapInstance, viewMode]);

  // 筛选逻辑
  useEffect(() => {
    let filtered = artifacts;

    // 按搜索词筛选
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.era.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.excavationLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.collectionLocation.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 按批次筛选
    if (selectedBatch !== 'all') {
      filtered = filtered.filter(item => item.batch === selectedBatch);
    }

    // 按类型筛选
    if (selectedType !== 'all') {
      filtered = filtered.filter(item => item.type === selectedType);
    }

    // 按馆藏筛选
    if (selectedCollection !== 'all') {
      filtered = filtered.filter(item =>
        item.collectionLocation.includes(selectedCollection)
      );
    }

    setFilteredArtifacts(filtered);
    setCurrentPage(1);
  }, [searchTerm, selectedBatch, selectedType, selectedCollection, artifacts]);

  // 分页逻辑
  const paginatedArtifacts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredArtifacts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredArtifacts, currentPage]);

  const totalPages = Math.ceil(filteredArtifacts.length / itemsPerPage);

  // 重置筛选
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedBatch('all');
    setSelectedType('all');
    setSelectedCollection('all');
  };

  // 获取批次颜色
  const getBatchColor = (batch: string) => {
    switch (batch) {
      case '第一批': return 'bg-red-100 text-red-800 border-red-200';
      case '第二批': return 'bg-blue-100 text-blue-800 border-blue-200';
      case '第三批': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // 获取类型颜色
  const getTypeColor = (type: string) => {
    const colors = {
      '青铜': 'bg-amber-100 text-amber-800',
      '陶瓷': 'bg-orange-100 text-orange-800',
      '绘画': 'bg-purple-100 text-purple-800',
      '书法': 'bg-indigo-100 text-indigo-800',
      '金银': 'bg-yellow-100 text-yellow-800',
      '玉器': 'bg-emerald-100 text-emerald-800',
      '漆器': 'bg-rose-100 text-rose-800',
      '服饰': 'bg-pink-100 text-pink-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
            195件禁止出境文物
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            探索中华文明瑰宝，感受千年历史传承
          </p>
        </div>

        {/* 搜索和筛选区域 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              搜索与筛选
            </CardTitle>
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 筛选器 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择批次" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部批次</SelectItem>
                    {batches.map(batch => (
                      <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择类别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类别</SelectItem>
                    {types.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择馆藏" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部馆藏</SelectItem>
                    {collections.map(collection => (
                      <SelectItem key={collection} value={collection}>{collection}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={resetFilters} variant="outline" className="w-full">
                  重置筛选
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 结果统计和视图切换 */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="text-slate-600">
            共找到 <span className="font-semibold text-slate-800">{filteredArtifacts.length}</span> 件文物
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('map')}
            >
              <MapIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 文物展示区域 */}
        {viewMode === 'map' ? (
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapIcon className="w-5 h-5" />
                  文物地图分布
                </CardTitle>
                <CardDescription>
                  点击地图标记查看该位置的文物详情
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingMap ? (
                  <div className="h-96 flex items-center justify-center bg-slate-50 rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-slate-600">正在加载地图...</p>
                    </div>
                  </div>
                ) : (
                  <div
                    ref={mapContainerRef}
                    className="h-96 w-full rounded-lg border"
                    style={{ minHeight: '400px' }}
                  />
                )}
                <div className="mt-4 text-sm text-slate-600">
                  <p>• 标记数字表示该位置的文物数量</p>
                  <p>• 点击标记可查看详细信息</p>
                  <p>• 地图会根据筛选条件实时更新</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {paginatedArtifacts.map((artifact) => (
              <Dialog key={artifact.id}>
                <DialogTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <Badge className={getBatchColor(artifact.batch)}>
                          {artifact.batch}
                        </Badge>
                        <Badge variant="secondary" className={getTypeColor(artifact.type)}>
                          {artifact.type}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg leading-tight">{artifact.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {artifact.era}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{artifact.excavationLocation}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Landmark className="w-3 h-3" />
                          <span className="truncate">{artifact.collectionLocation}</span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {artifact.desc}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle className="text-xl">{artifact.name}</DialogTitle>
                    <DialogDescription className="text-base">
                      {artifact.era} · {artifact.type}
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="max-h-96">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge className={getBatchColor(artifact.batch)}>
                          {artifact.batch}
                        </Badge>
                        <Badge variant="secondary" className={getTypeColor(artifact.type)}>
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
                          <p className="text-slate-600">{artifact.excavationLocation}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1 flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            出土时间
                          </h4>
                          <p className="text-slate-600">{artifact.excavationTime}</p>
                        </div>
                        <div className="md:col-span-2">
                          <h4 className="font-semibold mb-1 flex items-center gap-1">
                            <Landmark className="w-4 h-4" />
                            馆藏地点
                          </h4>
                          <p className="text-slate-600">{artifact.collectionLocation}</p>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-semibold mb-2">文物描述</h4>
                        <p className="text-slate-700 leading-relaxed">{artifact.desc}</p>
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
                  <Card className="cursor-pointer hover:shadow-md transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge className={getBatchColor(artifact.batch)}>
                              {artifact.batch}
                            </Badge>
                            <Badge variant="secondary" className={getTypeColor(artifact.type)}>
                              {artifact.type}
                            </Badge>
                          </div>
                          <h3 className="text-xl font-semibold mb-2">{artifact.name}</h3>
                          <p className="text-slate-600 mb-3">{artifact.era}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {artifact.excavationLocation}
                            </div>
                            <div className="flex items-center gap-1">
                              <Landmark className="w-4 h-4" />
                              {artifact.collectionLocation}
                            </div>
                          </div>
                        </div>
                        <div className="md:w-1/3">
                          <p className="text-sm text-slate-600 line-clamp-3">
                            {artifact.desc}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle className="text-xl">{artifact.name}</DialogTitle>
                    <DialogDescription className="text-base">
                      {artifact.era} · {artifact.type}
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="max-h-96">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge className={getBatchColor(artifact.batch)}>
                          {artifact.batch}
                        </Badge>
                        <Badge variant="secondary" className={getTypeColor(artifact.type)}>
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
                          <p className="text-slate-600">{artifact.excavationLocation}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1 flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            出土时间
                          </h4>
                          <p className="text-slate-600">{artifact.excavationTime}</p>
                        </div>
                        <div className="md:col-span-2">
                          <h4 className="font-semibold mb-1 flex items-center gap-1">
                            <Landmark className="w-4 h-4" />
                            馆藏地点
                          </h4>
                          <p className="text-slate-600">{artifact.collectionLocation}</p>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-semibold mb-2">文物描述</h4>
                        <p className="text-slate-700 leading-relaxed">{artifact.desc}</p>
                      </div>
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        )}

        {/* 分页 - 地图视图下不显示分页 */}
        {viewMode !== 'map' && totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              上一页
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              下一页
            </Button>
          </div>
        )}

        {/* 统计信息 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>统计信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{artifacts.length}</div>
                <div className="text-sm text-slate-600">总文物数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{batches.length}</div>
                <div className="text-sm text-slate-600">批次数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{types.length}</div>
                <div className="text-sm text-slate-600">类别数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{collections.length}</div>
                <div className="text-sm text-slate-600">馆藏地数</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 地图标记样式 */}
      <style>{`
        .custom-marker {
          position: relative;
        }

        .marker-content {
          background: #1e40af;
          border: 2px solid #ffffff;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .marker-content:hover {
          transform: scale(1.1);
          background: #1d4ed8;
        }

        .marker-count {
          color: white;
          font-size: 12px;
          font-weight: bold;
        }

        .info-window {
          padding: 10px;
          min-width: 200px;
        }

        .info-window h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          font-weight: bold;
        }

        .artifact-list {
          margin-top: 8px;
        }

        .artifact-item {
          padding: 2px 0;
          font-size: 12px;
          border-bottom: 1px solid #eee;
        }

        .more-items {
          padding: 2px 0;
          font-size: 12px;
          color: #666;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default Wenwu;
