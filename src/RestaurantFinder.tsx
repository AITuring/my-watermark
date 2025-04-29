/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";
import { MapPin, Utensils, RefreshCw, Navigation, Compass } from "lucide-react";
import flagIcon from "@/assets/flag.svg";
import BeerIcon from "@/assets/Beer.svg";
import BreadIcon from "@/assets/Bread.svg";
import ChickenIcon from "@/assets/Chicken.svg";
import CurryRiceIcon from "@/assets/CurryRice.svg";
import FrenchFriesIcon from "@/assets/FrenchFries.svg";
import GreenSaladIcon from "@/assets/GreenSalad.svg";
import PanOfFoodIcon from "@/assets/PanOfFood.svg";
import RiceIcon from "@/assets/Rice.svg";
import ShallowPanOfFoodIcon from "@/assets/ShallowPanOfFood.svg";
import WineIcon from "@/assets/Wine.svg";
import DumplingIcon from "@/assets/Dumpling.svg";
import SteamingBowlIcon from "@/assets/SteamingBowl.svg";
import TeacupIcon from "@/assets/Teacup.svg";
import WaterMelonIcon from "@/assets/Watermelon.svg";
import IceCreamIcon from "@/assets/IceCream.svg";
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

    const randomIcons = [
        BeerIcon,
        BreadIcon,
        ChickenIcon,
        CurryRiceIcon,
        FrenchFriesIcon,
        GreenSaladIcon,
        PanOfFoodIcon,
        RiceIcon,
        ShallowPanOfFoodIcon,
        TeacupIcon,
        WineIcon,
        DumplingIcon,
        SteamingBowlIcon,
        TeacupIcon,
        WaterMelonIcon,
        IceCreamIcon,
    ];

    const getRestaurantIcon = (
        restaurantName: string,
        restaurantType: string
    ) => {
        const name = restaurantName.toLowerCase();
        const type = restaurantType?.toLowerCase() || "";

        // 根据餐厅名称或类型中的关键词选择图标
        if (
            name.includes("茶") ||
            name.includes("奶茶") ||
            type.includes("茶")
        ) {
            return TeacupIcon;
        } else if (
            name.includes("酒") ||
            name.includes("bar") ||
            type.includes("酒吧")
        ) {
            return WineIcon;
        } else if (name.includes("啤酒") || name.includes("beer")) {
            return BeerIcon;
        } else if (
            name.includes("面包") ||
            name.includes("蛋糕") ||
            name.includes("bakery")
        ) {
            return BreadIcon;
        } else if (
            name.includes("鸡") ||
            name.includes("炸鸡") ||
            type.includes("快餐")
        ) {
            return ChickenIcon;
        } else if (name.includes("咖喱") || name.includes("curry")) {
            return CurryRiceIcon;
        } else if (name.includes("薯条") || name.includes("炸薯")) {
            return FrenchFriesIcon;
        } else if (
            name.includes("沙拉") ||
            name.includes("salad") ||
            name.includes("轻食")
        ) {
            return GreenSaladIcon;
        } else if (
            name.includes("米饭") ||
            name.includes("rice") ||
            name.includes("饭店")
        ) {
            return RiceIcon;
        } else if (
            name.includes("火锅") ||
            name.includes("hot pot") ||
            name.includes("中餐") ||
            name.includes("川") ||
            name.includes("湘") ||
            name.includes("粤")
        ) {
            return PanOfFoodIcon;
        } else if (
            name.includes("包子") ||
            name.includes("dumpling") ||
            name.includes("饺") ||
            name.includes("馄饨") ||
            name.includes("抄手")
        ) {
            return DumplingIcon;
        } else if (name.includes("水果") || name.includes("瓜果")) {
            return WaterMelonIcon;
        } else if (name.includes("小吃") || name.includes("snack")) {
            return ShallowPanOfFoodIcon;
        } else if (name.includes("冰") || name.includes("雪")) {
            return IceCreamIcon;
        }

        // 如果没有匹配到关键词，则随机选择一个图标
        return randomIcons[Math.floor(Math.random() * randomIcons.length)];
    };

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

                geocoder.current = new AMap.Geocoder({
                    radius: 1000,
                    extensions: "all",
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
        console.log("getLocationName", lng, lat, geocoder.current);
        if (!geocoder.current) return;

        geocoder.current.getAddress(
            [lng, lat],
            (status: string, result: any) => {
                console.log(status, result);
                const address = result.regeocode.formattedAddress;
                const addressComponent = result.regeocode.addressComponent;

                // 从完整地址中提取更精确的位置名称
                let simpleName = "未知位置";

                // if (address) {
                //     // 尝试去除前面的区、路、街道等信息
                //     const parts = address.split(/[市区县]/).filter(Boolean);
                //     console.log("parts", parts);
                //     if (parts.length > 1) {
                //         // 取最后一部分，通常是最具体的位置
                //         const lastPart = parts[parts.length - 1];
                //         // 进一步处理，去除可能的"路街道"等前缀
                //         simpleName = lastPart.replace(
                //             /^.*?(街道|路|大道|胡同|巷|乡|镇)/,
                //             ""
                //         );
                //         // 如果处理后为空，则使用原始地址
                //         if (!simpleName.trim()) {
                //             simpleName = lastPart;
                //         }
                //     } else {
                //         simpleName = address;
                //     }
                // }
                setLocationName(address);
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
                    size: new mapSDK.current.Size(35, 44),
                    image: flagIcon,
                    imageSize: new mapSDK.current.Size(35, 44),
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
                    size: new mapSDK.current.Size(35, 44),
                    image: getRestaurantIcon(selected.name, selected.type),
                    imageSize: new mapSDK.current.Size(35, 44),
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

        // 构建调起手机高德地图的URL
        const startPoint = `${position.lng},${position.lat}`;
        const endPoint = `${restaurant.location.lng},${restaurant.location.lat}`;
        const endName = encodeURIComponent(restaurant.name);

        // 高德地图URL Scheme
        const amapUrl = `androidamap://route?sourceApplication=appname&slat=${position.lat}&slon=${position.lng}&dlat=${restaurant.location.lat}&dlon=${restaurant.location.lng}&dname=${endName}&dev=0&t=2`;

        // iOS和Android通用的URI API
        const webUrl = `https://uri.amap.com/navigation?from=${startPoint},我的位置&to=${endPoint},${endName}&mode=walk&callnative=1`;

        // 检测设备类型并打开相应链接
        if (/android/i.test(navigator.userAgent)) {
            window.location.href = amapUrl;
            // 如果无法打开应用，延迟后跳转到网页版
            setTimeout(() => {
                window.location.href = webUrl;
            }, 2000);
        } else {
            window.location.href = webUrl;
        }
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

                        {/* {position && (
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
                        )} */}

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
                        {/* {position && (
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
                        )} */}
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
