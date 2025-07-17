import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, Filter, Grid, List, MapPin, Calendar, Landmark } from 'lucide-react';
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

// 导入JSON数据
import artifactsData from './195.json';

const Wenwu: React.FC = () => {
  const [artifacts] = useState<Artifact[]>(artifactsData);
  const [filteredArtifacts, setFilteredArtifacts] = useState<Artifact[]>(artifacts);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // 提取单个博物馆名称的函数
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

  // 筛选逻辑
  useEffect(() => {
    let filtered = artifacts;

    // 按搜索词筛选
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.era.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.excavationLocation.toLowerCase().includes(searchTerm.toLowerCase())
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
                  placeholder="搜索文物名称、描述、年代、出土地点..."
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
          </div>
        </div>

        {/* 文物展示区域 */}
        {viewMode === 'grid' ? (
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

        {/* 分页 */}
        {totalPages > 1 && (
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
    </div>
  );
};

export default Wenwu;
