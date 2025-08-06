import React, { useState, useEffect, useContext } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ThemeContext } from '@/context';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';

// API 基础地址
const API_BASE = 'https://60s.viki.moe/v2';

// 数据类型定义
interface NewsItem {
  title: string;
  url?: string;
}

interface News60s {
  date: string;
  news: NewsItem[];
  weiyu: string;
  image: string;
}

interface HotSearchItem {
  title: string;
  url?: string;
  hot?: number;
  desc?: string;
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
  promotions: any;
  keyImages: Array<{ type: string; url: string }>;
}

const NewsCard: React.FC = () => {
  const [news, setNews] = useState<News60s | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageMode, setImageMode] = useState(false);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/60s`);
      const data = await response.json();
      if (data.code === 200) {
        setNews(data.data);
      }
    } catch (error) {
      console.error('获取新闻失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleImageMode = () => {
    setImageMode(!imageMode);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Icon icon="eos-icons:loading" className="w-5 h-5 animate-spin" />
          <span>加载中...</span>
        </div>
        <Progress value={33} className="w-full" />
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
        </div>
        <div className="flex space-x-2">
          <Button
            variant={imageMode ? "default" : "outline"}
            size="sm"
            onClick={toggleImageMode}
          >
            <Icon icon="material-symbols:image" className="w-4 h-4 mr-1" />
            图片模式
          </Button>
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
              src={`${API_BASE}/60s?encoding=image-proxy`}
              alt="60秒新闻图片"
              className="w-full rounded-lg shadow-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
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
                    <p className="text-sm leading-relaxed">{item.title}</p>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>

            {news?.weiyu && (
              <>
                <Separator className="my-4" />
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon icon="material-symbols:format-quote" className="w-5 h-5 text-blue-500" />
                    <span className="font-medium text-blue-600 dark:text-blue-400">微语</span>
                  </div>
                  <p className="text-sm italic text-gray-600 dark:text-gray-300">{news.weiyu}</p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

const HotSearchCard: React.FC<{ platform: string; icon: string; color: string }> = ({
  platform,
  icon,
  color
}) => {
  const [hotList, setHotList] = useState<HotSearchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHotSearch();
  }, [platform]);

  const fetchHotSearch = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/${platform}`);
      const data = await response.json();
      if (data.code === 200) {
        setHotList(data.data.slice(0, 10)); // 只显示前10条
      }
    } catch (error) {
      console.error(`获取${platform}热搜失败:`, error);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformName = (platform: string) => {
    const names: { [key: string]: string } = {
      'weibo': '微博热搜',
      'zhihu': '知乎热榜',
      'bilibili': 'B站热搜',
      'douyin': '抖音热搜',
      'toutiao': '头条热搜'
    };
    return names[platform] || platform;
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon icon={icon} className={`w-5 h-5 ${color}`} />
          <h3 className="font-semibold">{getPlatformName(platform)}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchHotSearch}>
          <Icon icon="material-symbols:refresh" className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {hotList.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => item.url && window.open(item.url, '_blank')}
              >
                <Badge
                  variant={index < 3 ? "default" : "secondary"}
                  className={`min-w-[1.5rem] text-center ${
                    index === 0 ? 'bg-red-500' :
                    index === 1 ? 'bg-orange-500' :
                    index === 2 ? 'bg-yellow-500' : ''
                  }`}
                >
                  {index + 1}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.title}</p>
                  {item.desc && (
                    <p className="text-xs text-gray-500 truncate">{item.desc}</p>
                  )}
                </div>
                {item.hot && (
                  <Badge variant="outline" className="text-xs">
                    {item.hot > 10000 ? `${(item.hot / 10000).toFixed(1)}万` : item.hot}
                  </Badge>
                )}
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
};

const WallpaperCard: React.FC = () => {
  const [wallpaper, setWallpaper] = useState<WallpaperData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWallpaper();
  }, []);

  const fetchWallpaper = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/bing`);
      const data = await response.json();
      if (data.code === 200) {
        setWallpaper(data.data);
      }
    } catch (error) {
      console.error('获取壁纸失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon icon="material-symbols:wallpaper" className="w-5 h-5 text-green-500" />
          <h3 className="font-semibold">必应每日壁纸</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchWallpaper}>
          <Icon icon="material-symbols:refresh" className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      ) : wallpaper ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-3"
        >
          <div className="relative aspect-video rounded-lg overflow-hidden">
            <img
              src={wallpaper.url}
              alt={wallpaper.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h4 className="font-semibold text-lg mb-1">{wallpaper.title}</h4>
              <p className="text-sm opacity-90">{wallpaper.copyright}</p>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <Badge variant="secondary">{wallpaper.date}</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(wallpaper.url, '_blank')}
            >
              <Icon icon="material-symbols:download" className="w-4 h-4 mr-1" />
              下载
            </Button>
          </div>
        </motion.div>
      ) : null}
    </Card>
  );
};

const EpicGamesCard: React.FC = () => {
  const [games, setGames] = useState<EpicGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEpicGames();
  }, []);

  const fetchEpicGames = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/epic`);
      const data = await response.json();
      if (data.code === 200) {
        setGames(data.data.slice(0, 3)); // 只显示前3个游戏
      }
    } catch (error) {
      console.error('获取Epic游戏失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon icon="simple-icons:epicgames" className="w-5 h-5 text-purple-500" />
          <h3 className="font-semibold">Epic 免费游戏</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchEpicGames}>
          <Icon icon="material-symbols:refresh" className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {games.map((game, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex space-x-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {game.keyImages?.[0] && (
                <img
                  src={game.keyImages[0].url}
                  alt={game.title}
                  className="w-16 h-16 rounded object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{game.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {game.description}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  {game.originalPrice && (
                    <span className="text-sm line-through text-gray-500">
                      {game.originalPrice}
                    </span>
                  )}
                  <Badge variant="default" className="bg-green-500">
                    免费
                  </Badge>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  );
};

const FunCard: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [currentType, setCurrentType] = useState<'kfc' | 'yiyan' | 'fortune'>('yiyan');

  const fetchFunContent = async (type: 'kfc' | 'yiyan' | 'fortune') => {
    try {
      setLoading(true);
      setCurrentType(type);
      const response = await fetch(`${API_BASE}/${type}`);
      const data = await response.json();
      if (data.code === 200) {
        setContent(data.data.text || data.data.content || data.data);
      }
    } catch (error) {
      console.error(`获取${type}内容失败:`, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunContent('yiyan');
  }, []);

  const getTypeInfo = (type: string) => {
    const info = {
      'kfc': { name: 'KFC 文学', icon: 'noto:poultry-leg', color: 'text-red-500' },
      'yiyan': { name: '随机一言', icon: 'material-symbols:format-quote', color: 'text-blue-500' },
      'fortune': { name: '今日运势', icon: 'noto:crystal-ball', color: 'text-purple-500' }
    };
    return info[type as keyof typeof info];
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon
            icon={getTypeInfo(currentType).icon}
            className={`w-5 h-5 ${getTypeInfo(currentType).color}`}
          />
          <h3 className="font-semibold">{getTypeInfo(currentType).name}</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchFunContent(currentType)}
          disabled={loading}
        >
          <Icon
            icon={loading ? "eos-icons:loading" : "material-symbols:refresh"}
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex space-x-2">
          {(['yiyan', 'kfc', 'fortune'] as const).map((type) => (
            <Button
              key={type}
              variant={currentType === type ? "default" : "outline"}
              size="sm"
              onClick={() => fetchFunContent(type)}
              disabled={loading}
            >
              {getTypeInfo(type).name}
            </Button>
          ))}
        </div>

        <div className="min-h-[100px] p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Icon icon="eos-icons:loading" className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <motion.p
              key={content}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm leading-relaxed text-center"
            >
              {content}
            </motion.p>
          )}
        </div>
      </div>
    </Card>
  );
};

const NewsApp: React.FC = () => {
  const { isDark } = useContext(ThemeContext);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            60秒资讯中心
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            每天60秒，了解世界大事 · 热门榜单 · 精彩内容
          </p>
        </motion.div>

        {/* 主要内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧 - 主要新闻 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <NewsCard />
          </motion.div>

          {/* 右侧 - 侧边栏 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <WallpaperCard />
            <FunCard />
          </motion.div>
        </div>

        {/* 热搜榜单区域 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <h2 className="text-2xl font-bold mb-6 text-center">热门榜单</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <HotSearchCard
              platform="weibo"
              icon="simple-icons:sinaweibo"
              color="text-red-500"
            />
            <HotSearchCard
              platform="zhihu"
              icon="simple-icons:zhihu"
              color="text-blue-600"
            />
            <HotSearchCard
              platform="bilibili"
              icon="simple-icons:bilibili"
              color="text-pink-500"
            />
            <HotSearchCard
              platform="douyin"
              icon="simple-icons:tiktok"
              color="text-black dark:text-white"
            />
            <HotSearchCard
              platform="toutiao"
              icon="material-symbols:newspaper"
              color="text-orange-500"
            />
          </div>
        </motion.div>

        {/* Epic 游戏区域 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <EpicGamesCard />
        </motion.div>

        {/* 页脚 */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center text-gray-500 dark:text-gray-400"
        >
          <Separator className="mb-4" />
          <p className="text-sm">
            数据来源于 60s API · 每日更新 ·
            <a
              href="https://github.com/vikiboss/60s"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline ml-1"
            >
              项目地址
            </a>
          </p>
        </motion.footer>
      </div>
    </div>
  );
};

export default NewsApp;
