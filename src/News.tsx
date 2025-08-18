import React, { useState, useEffect, useContext } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ThemeContext } from '@/context';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';

// 根据官方文档配置的完整 API 端点列表
const API_CONFIG = {
  // 主要端点 - 按优先级排序
  primary: [
    'https://60s.shspku365.workers.dev',
    'https://60s.viki.moe',           // 主域名 (Deno Deploy)
    'https://60s.b23.run',           // 备用域名 1 (Deno Deploy)
    'https://60s-api-cf.viki.moe',   // 备用域名 2 (CF Workers)
    'https://60s-api.114128.xyz',    // 备用域名 3 (Deno Deploy)
    'https://60s-api-cf.114128.xyz', // 备用域名 4 (CF Workers)
  ],
  // 不同版本的 API
  versions: ['', '/v2'], // 空字符串表示默认版本，v2 表示第二版本
  // 请求配置
  timeout: 8000,
  retries: 2,
  // 缓存配置
  cacheTime: 5 * 60 * 1000, // 5分钟缓存
};

// 根据实际返回数据更新的数据类型定义
interface News60s {
  date: string;
  news: string[]; // 注意：这里是字符串数组，不是对象数组
  audio: {
    music: string;
    news: string;
  };
  image: string;
  tip: string;
  cover: string;
  link: string;
  created: string;
  created_at: number;
  updated: string;
  updated_at: number;
  day_of_week: string;
  lunar_date: string;
  api_updated: string;
  api_updated_at: number;
}

interface HotSearchItem {
  title: string;
  url?: string;
  hot?: number;
  desc?: string;
  index?: number;
}

interface WallpaperData {
  url: string;
  title: string;
  copyright: string;
  date: string;
}

interface EpicGame {
  title: string;
  description: string;
  originalPrice: string;
  discountPrice: string;
  promotions: unknown;
  keyImages: Array<{ type: string; url: string }>;
}

// 缓存管理
class APICache {
  private cache = new Map<string, { data: any; timestamp: number }>();

  set(key: string, data: any, ttl: number = API_CONFIG.cacheTime) {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttl
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.timestamp) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear() {
    this.cache.clear();
  }
}

const apiCache = new APICache();

// 智能请求函数 - 支持多种策略
const smartFetch = async (
  endpoint: string,
  path: string,
  options: {
    timeout?: number;
    retries?: number;
    useCache?: boolean;
    headers?: Record<string, string>;
  } = {}
): Promise<any> => {
  const {
    timeout = API_CONFIG.timeout,
    retries = API_CONFIG.retries,
    useCache = true,
    headers = {}
  } = options;

  const cacheKey = `${endpoint}${path}`;

  // 检查缓存
  if (useCache) {
    const cached = apiCache.get(cacheKey);
    if (cached) {
      console.log(`缓存命中: ${cacheKey}`);
      return cached;
    }
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const url = `${endpoint}${path}`;
      console.log(`尝试请求 (${attempt + 1}/${retries}): ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (compatible; 60sNewsApp/1.0)',
          'Referer': window.location.origin,
          'Cache-Control': 'no-cache',
          ...headers
        },
        mode: 'cors',
        credentials: 'omit',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // 缓存成功的响应
      if (useCache && (data.code === 200 || data.success)) {
        apiCache.set(cacheKey, data);
      }

      console.log(`请求成功: ${url}`);
      return data;

    } catch (error) {
      console.warn(`请求失败 (${attempt + 1}/${retries}) ${endpoint}${path}:`, error);

      if (attempt === retries - 1) {
        throw error;
      }

      // 指数退避重试
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// 多端点并发请求策略
const fetchFromMultipleEndpoints = async (
  path: string,
  strategy: 'sequential' | 'parallel' | 'race' = 'sequential'
): Promise<any> => {
  const endpoints = API_CONFIG.primary;
  const versions = API_CONFIG.versions;

  // 生成所有可能的 URL 组合
  const urlCombinations: string[] = [];
  for (const endpoint of endpoints) {
    for (const version of versions) {
      urlCombinations.push(`${endpoint}${version}`);
    }
  }

  let lastError: Error | null = null;

  switch (strategy) {
    case 'parallel':
      // 并行请求所有端点，返回第一个成功的
      try {
        const promises = urlCombinations.map(endpoint =>
          smartFetch(endpoint, path, { retries: 1 })
        );
        return await Promise.any(promises);
      } catch (error) {
        throw new Error('所有并行请求都失败了');
      }

    case 'race':
      // 竞速模式，最快响应的获胜
      try {
        const promises = urlCombinations.slice(0, 3).map(endpoint =>
          smartFetch(endpoint, path, { timeout: 5000, retries: 1 })
        );
        return await Promise.race(promises);
      } catch (error) {
        // 如果竞速失败，回退到顺序模式
        console.warn('竞速模式失败，回退到顺序模式');
        return await fetchFromMultipleEndpoints(path, 'sequential');
      }

    case 'sequential':
    default:
      // 顺序请求，逐个尝试
      for (const endpoint of urlCombinations) {
        try {
          const data = await smartFetch(endpoint, path);
          return data;
        } catch (error) {
          console.warn(`端点 ${endpoint} 请求失败:`, error);
          lastError = error as Error;
          continue;
        }
      }
      throw lastError || new Error('所有 API 端点都无法访问');
  }
};

// 自适应请求策略
const adaptiveFetch = async (path: string): Promise<any> => {
  // 首先尝试快速竞速模式
  try {
    console.log('尝试竞速模式...');
    return await fetchFromMultipleEndpoints(path, 'race');
  } catch (error) {
    console.warn('竞速模式失败，尝试顺序模式...');

    try {
      return await fetchFromMultipleEndpoints(path, 'sequential');
    } catch (sequentialError) {
      console.warn('顺序模式失败，尝试并行模式...');

      try {
        return await fetchFromMultipleEndpoints(path, 'parallel');
      } catch (parallelError) {
        console.error('所有请求策略都失败了');
        throw new Error('网络连接失败，请检查网络设置或稍后重试');
      }
    }
  }
};

const NewsCard: React.FC = () => {
  const [news, setNews] = useState<News60s | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [imageMode, setImageMode] = useState(false);
  const [requestStrategy, setRequestStrategy] = useState<'sequential' | 'parallel' | 'race' | 'adaptive'>('adaptive');

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      setError('');

      let data;

      if (requestStrategy === 'adaptive') {
        data = await adaptiveFetch('/60s');
      } else {
        data = await fetchFromMultipleEndpoints('/60s', requestStrategy);
      }

      if (data.code === 200) {
        setNews(data.data);
      } else {
        throw new Error(data.message || '数据格式错误');
      }
    } catch (error) {
      console.error('获取新闻失败:', error);
      setError(error instanceof Error ? error.message : '获取新闻失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleImageMode = () => {
    setImageMode(!imageMode);
  };

  const clearCache = () => {
    apiCache.clear();
    console.log('缓存已清除');
  };

  const openOriginalLink = () => {
    if (news?.link) {
      window.open(news.link.trim(), '_blank');
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Icon icon="eos-icons:loading" className="w-5 h-5 animate-spin" />
          <span>正在加载新闻...</span>
        </div>
        <Progress value={33} className="w-full" />
        <div className="text-sm text-gray-500 mt-2 space-y-1">
          <p>使用 {requestStrategy} 策略请求数据...</p>
          <p>首次加载可能需要较长时间，请耐心等待</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <Icon icon="material-symbols:error" className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">加载失败</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>

          <div className="space-y-3">
            <div className="flex justify-center space-x-2">
              <Button onClick={fetchNews} variant="outline">
                <Icon icon="material-symbols:refresh" className="w-4 h-4 mr-2" />
                重试
              </Button>
              <Button onClick={clearCache} variant="outline" size="sm">
                <Icon icon="material-symbols:clear-all" className="w-4 h-4 mr-2" />
                清除缓存
              </Button>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>当前策略: {requestStrategy}</p>
              <div className="flex justify-center space-x-1">
                {(['sequential', 'parallel', 'race', 'adaptive'] as const).map(strategy => (
                  <Button
                    key={strategy}
                    variant={requestStrategy === strategy ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRequestStrategy(strategy)}
                    className="text-xs px-2 py-1"
                  >
                    {strategy}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon icon="material-symbols:newspaper" className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-bold">每天 60 秒读懂世界</h2>
          <Badge variant="secondary">{news?.date}</Badge>
          <Badge variant="outline">{news?.day_of_week}</Badge>
        </div>
        <div className="flex space-x-2">
          {news?.image && (
            <Button
              variant={imageMode ? "default" : "outline"}
              size="sm"
              onClick={toggleImageMode}
            >
              <Icon icon="material-symbols:image" className="w-4 h-4 mr-1" />
              图片模式
            </Button>
          )}
          {news?.link && (
            <Button variant="outline" size="sm" onClick={openOriginalLink}>
              <Icon icon="material-symbols:open-in-new" className="w-4 h-4 mr-1" />
              原文
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchNews}>
            <Icon icon="material-symbols:refresh" className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {imageMode && news?.image ? (
          <motion.div
            key="image"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4"
          >
            <img
              src={news.image.trim()}
              alt="60秒新闻图片"
              className="w-full rounded-lg shadow-lg cursor-pointer"
              onClick={() => window.open(news.image.trim(), '_blank')}
              onError={(e) => {
                console.warn('图片加载失败');
                e.currentTarget.style.display = 'none';
              }}
            />
            {news.cover && (
              <div className="mt-2">
                <img
                  src={news.cover.trim()}
                  alt="封面图片"
                  className="w-full rounded-lg shadow-lg cursor-pointer"
                  onClick={() => window.open(news.cover.trim(), '_blank')}
                  onError={(e) => {
                    console.warn('封面图片加载失败');
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="text"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ScrollArea className="h-96 mb-4">
              <div className="space-y-3">
                {news?.news.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Badge variant="outline" className="mt-1 min-w-[2rem] text-center">
                      {index + 1}
                    </Badge>
                    <p className="text-sm leading-relaxed">{item}</p>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>

            {news?.tip && (
              <>
                <Separator className="my-4" />
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon icon="material-symbols:format-quote" className="w-5 h-5 text-blue-500" />
                    <span className="font-medium text-blue-600 dark:text-blue-400">每日一言</span>
                  </div>
                  <p className="text-sm italic text-gray-600 dark:text-gray-300">{news.tip}</p>
                </div>
              </>
            )}

            {news?.lunar_date && (
              <div className="mt-4 text-center">
                <Badge variant="secondary" className="text-xs">
                  农历：{news.lunar_date}
                </Badge>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 调试信息和音频播放 */}
      <div className="mt-4 space-y-2">
        {news?.audio?.news && (
          <div className="flex items-center space-x-2">
            <Icon icon="material-symbols:volume-up" className="w-4 h-4 text-green-500" />
            <audio controls className="flex-1 h-8">
              <source src={news.audio.news} type="audio/mpeg" />
              您的浏览器不支持音频播放
            </audio>
          </div>
        )}

        <div className="text-xs text-gray-400 text-center space-y-1">
          <p>策略: {requestStrategy} | 缓存: {apiCache.get('/60s') ? '已缓存' : '无缓存'}</p>
          <p>更新时间: {news?.api_updated}</p>
        </div>
      </div>
    </Card>
  );
};

// 热搜组件 - 使用相同的优化策略
const HotSearchCard: React.FC = () => {
  const [hotSearch, setHotSearch] = useState<{ [key: string]: HotSearchItem[] }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState('weibo');

  const platforms = [
    { key: 'weibo', name: '微博热搜', icon: 'ri:weibo-fill', color: 'text-red-500', path: '/hotlist/weibo' },
    { key: 'zhihu', name: '知乎热榜', icon: 'ri:zhihu-fill', color: 'text-blue-500', path: '/hotlist/zhihu' },
    { key: 'douyin', name: '抖音热点', icon: 'simple-icons:tiktok', color: 'text-black dark:text-white', path: '/hotlist/douyin' },
    { key: 'bilibili', name: 'B站热门', icon: 'ri:bilibili-fill', color: 'text-pink-500', path: '/hotlist/bilibili' },
  ];

  useEffect(() => {
    fetchHotSearch();
  }, []);

  const fetchHotSearch = async () => {
    try {
      setLoading(true);
      setError('');

      const results: { [key: string]: HotSearchItem[] } = {};

      // 并行获取所有平台的热搜数据
      const promises = platforms.map(async (platform) => {
        try {
          const data = await adaptiveFetch(platform.path);
          if (data.code === 200) {
            results[platform.key] = data.data || [];
          }
        } catch (error) {
          console.warn(`获取 ${platform.name} 热搜失败:`, error);
          results[platform.key] = [];
        }
      });

      await Promise.allSettled(promises);
      setHotSearch(results);

    } catch (error) {
      console.error('获取热搜失败:', error);
      setError(error instanceof Error ? error.message : '获取热搜失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <Icon icon="eos-icons:loading" className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>正在加载热搜...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <Icon icon="material-symbols:error" className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={fetchHotSearch} variant="outline" size="sm">
            重试
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon icon="material-symbols:trending-up" className="w-6 h-6 text-orange-500" />
          <h2 className="text-xl font-bold">实时热搜</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHotSearch}>
          <Icon icon="material-symbols:refresh" className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {platforms.map((platform) => (
            <Button
              key={platform.key}
              variant={activeTab === platform.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(platform.key)}
              className="flex items-center space-x-1"
            >
              <Icon icon={platform.icon} className={`w-4 h-4 ${platform.color}`} />
              <span>{platform.name}</span>
              <Badge variant="secondary" className="ml-1">
                {hotSearch[platform.key]?.length || 0}
              </Badge>
            </Button>
          ))}
        </div>

        <ScrollArea className="h-80">
          <div className="space-y-2">
            {(hotSearch[activeTab] || []).slice(0, 20).map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => item.url && window.open(item.url, '_blank')}
              >
                <Badge
                  variant={index < 3 ? "default" : "outline"}
                  className={`min-w-[2rem] text-center ${
                    index === 0 ? 'bg-red-500' :
                    index === 1 ? 'bg-orange-500' :
                    index === 2 ? 'bg-yellow-500' : ''
                  }`}
                >
                  {index + 1}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                  {item.hot && (
                    <p className="text-xs text-gray-500">热度: {item.hot.toLocaleString()}</p>
                  )}
                  {item.desc && (
                    <p className="text-xs text-gray-400 line-clamp-1">{item.desc}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
};

// 主应用组件
const NewsApp: React.FC = () => {
  const { isDark } = useContext(ThemeContext);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark ? 'dark bg-gray-900' : 'bg-gray-50'
    }`}>
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            60秒资讯中心
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            每天60秒，了解世界大事 · 实时热搜 · 精彩内容
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <NewsCard />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <HotSearchCard />
          </motion.div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>数据来源：60s API - 高质量、开源、可靠、全球 CDN 加速</p>
          <p>支持多种请求策略，自动缓存，智能重试</p>
        </div>
      </div>
    </div>
  );
};

export default NewsApp;
