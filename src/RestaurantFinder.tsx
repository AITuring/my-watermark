/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import {
    MapPin,
    Utensils,
    RefreshCw,
    Navigation,
    Compass,
    LocateFixed,
    X,
} from "lucide-react";
import { motion } from "framer-motion";

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
    const [position, setPosition] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchRadius, setSearchRadius] = useState(500);
    const [locationName, setLocationName] = useState<string>(""); // 添加位置
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapSDK = useRef<any>();
    const mapInstance = useRef<any>();
    const placeSearch = useRef<any>();
    const positionMarker = useRef<any>(null);
    const geocoder = useRef<any>(null); // 添加地理编码器引用

    useEffect(() => {
        (window as any)._AMapSecurityConfig = {
            securityJsCode: "8d5961ba4c131a09904cab742029ca42",
        };
        AMapLoader.load({
            key: "55b6c2fbb0875490d011d74ad99aac31",
            version: "2.0",
            plugins: [
                "AMap.Geolocation",
                "AMap.PlaceSearch",
                "AMap.Walking",
                "AMap.Geocoder",
            ],
        })
            .then((AMap) => {
                mapSDK.current = AMap;
                mapInstance.current = new AMap.Map(mapContainerRef.current, {
                    zoom: 15,
                });
                placeSearch.current = new AMap.PlaceSearch({
                    citylimit: true,
                    pageSize: 20,
                    extensions: "all",
                    type: "餐饮服务",
                });

                // 添加地图点击事件，允许用户手动选择位置
                mapInstance.current.on("click", (e: any) => {
                    updateUserPosition(e.lnglat.getLng(), e.lnglat.getLat());
                });
            })
            .catch((e) => {
                console.error(e);
                setError("地图加载失败，请刷新页面重试");
            });
    }, []);

    const getLocationName = (lng: number, lat: number) => {
        if (!geocoder.current) return;

        geocoder.current.getAddress(
            [lng, lat],
            (status: string, result: any) => {
              console.log(status, result);
                if (status === "complete" && result.regeocode) {
                    const address = result.regeocode.formattedAddress;
                    const addressComponent = result.regeocode.addressComponent;
                    // 提取更简洁的位置名称
                    const simpleName =
                        addressComponent.township ||
                        addressComponent.district ||
                        addressComponent.city ||
                        "未知位置";
                    setLocationName(simpleName);
                } else {
                    setLocationName("未知位置");
                }
            }
        );
    };

    // 更新用户位置的函数
    const updateUserPosition = (lng: number, lat: number) => {
        setPosition({ lat, lng });
        getLocationName(lng, lat);
        mapInstance.current.setCenter([lng, lat]);

        // 更新或创建位置标记
        if (positionMarker.current) {
            positionMarker.current.setPosition(
                new mapSDK.current.LngLat(lng, lat)
            );
        } else {
            positionMarker.current = new mapSDK.current.Marker({
                position: new mapSDK.current.LngLat(lng, lat),
                map: mapInstance.current,
                draggable: true,
                icon: new mapSDK.current.Icon({
                    size: new mapSDK.current.Size(25, 34),
                    image: "https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png",
                    imageSize: new mapSDK.current.Size(25, 34),
                }),
                title: "我的位置（可拖动调整）",
            });

            // 添加拖拽结束事件
            positionMarker.current.on("dragend", () => {
                const newPos = positionMarker.current.getPosition();
                setPosition({ lat: newPos.getLat(), lng: newPos.getLng() });
            });
        }

        // 将地图中心移动到新位置
        mapInstance.current.setCenter(new mapSDK.current.LngLat(lng, lat));
    };

    const getLocation = () => {
        setLoading(true);
        setError(null);
        setSearchRadius(500);

        if (!navigator?.geolocation) {
            setError("您的浏览器不支持地理位置功能");
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                updateUserPosition(longitude, latitude);
                searchRestaurants(latitude, longitude);
            },
            (err) => {
                setLoading(false);
                if (err.code === 1) {
                    // PERMISSION_DENIED = 1
                    setError("需要地理位置权限才能使用此功能");
                } else {
                    setError("获取位置失败: " + err.message);
                }
            }
        );
    };

    const searchRestaurants = (lat: number, lng: number) => {
        if (!mapSDK.current || !placeSearch.current) {
            setError("地图未初始化完成");
            setLoading(false);
            return;
        }

        setLoading(true);
        const center = new mapSDK.current.LngLat(lng, lat);
        mapInstance.current?.setCenter(center);
        placeSearch.current.setType("餐饮服务");

        placeSearch.current.searchNearBy(
            "",
            center,
            searchRadius,
            (status: string, result: { poiList?: { pois: Restaurant[] } }) => {
                console.log("搜索结果", result);
                if (
                    status === "complete" &&
                    result?.poiList?.pois?.length > 0
                ) {
                    pickRandomRestaurant(result.poiList.pois);
                } else if (searchRadius === 500) {
                    setSearchRadius(1000);
                    placeSearch.current.searchNearBy(
                        "",
                        center,
                        1000,
                        (
                            status: string,
                            result: { poiList?: { pois: Restaurant[] } }
                        ) => {
                            setLoading(false);
                            if (
                                status === "complete" &&
                                result?.poiList?.pois?.length > 0
                            ) {
                                pickRandomRestaurant(result.poiList.pois);
                            } else {
                                setError(`附近${searchRadius}米内未找到餐厅`);
                            }
                        }
                    );
                } else {
                    setLoading(false);
                    setError(`附近${searchRadius}米内未找到餐厅`);
                }
            }
        );
    };

    const pickRandomRestaurant = (restaurants: Restaurant[]) => {
        const randomIndex = Math.floor(Math.random() * restaurants.length);
        const selected = restaurants[randomIndex];
        setRestaurant(selected);
        setLoading(false);

        if (mapInstance.current && mapSDK.current) {
            // 保留用户位置标记，只清除其他标记
            const userMarker = positionMarker.current;
            mapInstance.current.clearMap();

            // 重新添加用户位置标记
            if (userMarker) {
                positionMarker.current = userMarker;
                mapInstance.current.add(userMarker);
            }

            // 添加餐厅位置标记
            new mapSDK.current.Marker({
                position: selected.location,
                map: mapInstance.current,
                icon: new mapSDK.current.Icon({
                    size: new mapSDK.current.Size(25, 34),
                    image: "https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png",
                    imageSize: new mapSDK.current.Size(25, 34),
                }),
                title: selected.name,
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
                if (status === "complete") {
                    console.log("步行路线规划成功", result);
                } else {
                    console.log("步行路线规划失败");
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
                            帮你解决&ldquo;今天吃什么&rdquo;的难题，随机推荐附近
                            {searchRadius}米内的餐厅
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
                            {!position ? (
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
                            ) : (
                                <div className="flex-1 bg-blue-50 border border-blue-100 text-blue-800 font-medium py-3 px-4 rounded-lg flex items-center">
                                    <MapPin className="mr-2 text-blue-600" />
                                    <span className="truncate">
                                        当前位置: {locationName || "加载中..."}
                                    </span>
                                </div>
                            )}

                            {position && (
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() =>
                                        position &&
                                        searchRestaurants(
                                            position.lat,
                                            position.lng
                                        )
                                    }
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center"
                                >
                                    <RefreshCw className="mr-2" />
                                    搜索附近餐厅
                                </motion.button>
                            )}
                        </div>

                        {position && (
                            <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <p className="flex items-center">
                                    <MapPin className="h-4 w-4 mr-1 text-blue-500" />
                                    您可以在地图上
                                    <strong className="mx-1">点击</strong>或
                                    <strong className="mx-1">
                                        拖动蓝色标记
                                    </strong>
                                    来调整位置
                                </p>
                            </div>
                        )}

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
                                        {restaurant.type || "特色餐厅"} · 距离约
                                        {restaurant.distance}米
                                    </p>
                                    <p className="mt-3 text-gray-700">
                                        {restaurant.address ||
                                            "暂无详细地址信息"}
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
                                            onClick={() =>
                                                position &&
                                                searchRestaurants(
                                                    position.lat,
                                                    position.lng
                                                )
                                            }
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
                    <div className="p-4 bg-gray-100 border-b flex justify-between items-center">
                        <h2 className="font-medium text-gray-700 flex items-center">
                            <MapPin className="mr-2" />
                            当前位置附近地图
                        </h2>
                        {position && (
                            <button
                                onClick={() =>
                                    position &&
                                    searchRestaurants(
                                        position.lat,
                                        position.lng
                                    )
                                }
                                className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md flex items-center"
                            >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                刷新搜索
                            </button>
                        )}
                    </div>
                    <div
                        ref={mapContainerRef}
                        className="w-full h-64 md:h-96 rounded-b-xl"
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default RestaurantFinder;
