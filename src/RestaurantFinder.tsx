import React, { useState, useEffect, useRef } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { MapPin, Utensils, RefreshCw, Navigation, Compass, LocateFixed, X } from 'lucide-react';
import { motion } from 'framer-motion';

// 定义餐厅类型接口
interface Restaurant {
  id: string;
  name: string;
  type: string;
  address: string;
  distance: number;
  location: {
    lng: number;
    lat: number;
  };
}

const RestaurantFinder = () => {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState(500);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapSDK = useRef<any>();
  const mapInstance = useRef<any>();
  const placeSearch = useRef<any>();

  useEffect(() => {
    AMapLoader.load({
      key: 'd17c17f8f712c81a7e4241aff4faa7b0',
      version: '2.0',
      plugins: ['AMap.Geolocation', 'AMap.PlaceSearch', 'AMap.Walking'],
    })
      .then((AMap) => {
        mapSDK.current = AMap;
        mapInstance.current = new AMap.Map(mapContainerRef.current, {
          zoom: 15,
        });
        placeSearch.current = new AMap.PlaceSearch({
          citylimit: true,
          pageSize: 20,
          extensions: 'all',
          type: '餐饮服务',
        });
      })
      .catch((e) => {
        console.error(e);
        setError('地图加载失败，请刷新页面重试');
      });
  }, []);

  const getLocation = () => {
    setLoading(true);
    setError(null);
    setSearchRadius(500);

    if (!navigator?.geolocation) {
      setError('您的浏览器不支持地理位置功能');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition({ lat: latitude, lng: longitude });
        searchRestaurants(latitude, longitude);
      },
      (err) => {
        setLoading(false);
        if (err.code === 1) { // PERMISSION_DENIED = 1
          setError('需要地理位置权限才能使用此功能');
        } else {
          setError('获取位置失败: ' + err.message);
        }
      }
    );
  };

  const searchRestaurants = (lat: number, lng: number) => {
    if (!mapSDK.current || !placeSearch.current) {
      setError('地图未初始化完成');
      setLoading(false);
      return;
    }

    const center = new mapSDK.current.LngLat(lng, lat);
    mapInstance.current?.setCenter(center);
    placeSearch.current.setType('餐饮服务');

    placeSearch.current.searchNearBy('', center, searchRadius, (status: string, result: { poiList?: { pois: Restaurant[] } }) => {
      if (status === 'complete' && result?.poiList?.pois?.length > 0) {
        pickRandomRestaurant(result.poiList.pois);
      } else if (searchRadius === 500) {
        setSearchRadius(1000);
        placeSearch.current.searchNearBy('', center, 1000, (status: string, result: { poiList?: { pois: Restaurant[] } }) => {
          setLoading(false);
          if (status === 'complete' && result?.poiList?.pois?.length > 0) {
            pickRandomRestaurant(result.poiList.pois);
          } else {
            setError(`附近${searchRadius}米内未找到餐厅`);
          }
        });
      } else {
        setLoading(false);
        setError(`附近${searchRadius}米内未找到餐厅`);
      }
    });
  };

  const pickRandomRestaurant = (restaurants: Restaurant[]) => {
    const randomIndex = Math.floor(Math.random() * restaurants.length);
    const selected = restaurants[randomIndex];
    setRestaurant(selected);
    setLoading(false);

    if (mapInstance.current && mapSDK.current) {
      mapInstance.current.clearMap();
      new mapSDK.current.Marker({
        position: selected.location,
        map: mapInstance.current,
      });
    }
  };

  const showWalkingRoute = () => {
    if (!restaurant?.location || !position || !mapSDK.current) return;

    const walking = new mapSDK.current.Walking({
      map: mapInstance.current,
    });
    walking.search(
      [position.lng, position.lat],
      [restaurant.location.lng, restaurant.location.lat],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (status: string, result: any) => {
        if (status === 'complete') {
          console.log('步行路线规划成功', result);
        } else {
          console.log('步行路线规划失败');
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6"
        >
          <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center">
              <Utensils className="mr-2" />
              附近餐厅随机选择器
            </h1>
            <p className="mt-2 opacity-90">
              帮你解决&ldquo;今天吃什么&rdquo;的难题，随机推荐附近{searchRadius}米内的餐厅
            </p>
          </div>

          <div className="p-6">
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded"
              >
                {error}
              </motion.div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={getLocation}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin mr-2" />
                    获取位置中...
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2" />
                    获取我的位置
                  </>
                )}
              </motion.button>

              {position && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={getLocation}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center"
                >
                  <LocateFixed className="mr-2" />
                  重新定位
                </motion.button>
              )}
            </div>

            {restaurant && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6"
              >
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    <Compass className="mr-2 text-blue-600" />
                    {restaurant.name}
                  </h2>
                  <p className="mt-2 text-gray-600">
                    {restaurant.type || '特色餐厅'} · 距离约{restaurant.distance}米
                  </p>
                  <p className="mt-3 text-gray-700">
                    {restaurant.address || '暂无详细地址信息'}
                  </p>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={showWalkingRoute}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center"
                    >
                      <Navigation className="mr-2" />
                      步行导航
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => position && searchRestaurants(position.lat, position.lng)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center"
                    >
                      <RefreshCw className="mr-2" />
                      换一家
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 bg-gray-100 border-b">
            <h2 className="font-medium text-gray-700 flex items-center">
              <MapPin className="mr-2" />
              当前位置附近地图
            </h2>
          </div>
          <div
            ref={mapContainerRef}
            className="w-full h-64 md:h-96 rounded-b-xl"
          ></div>
        </div>

        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>
            created by{' '}
            <a
              href="https://space.coze.cn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              coze space
            </a>
          </p>
          <p>页面内容均由 AI 生成，仅供参考</p>
        </footer>
      </div>
    </div>
  );
};

export default RestaurantFinder;