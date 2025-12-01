import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DarkToggle from "@/components/DarkToggle";
import LandscapePainting from "./components/LandscapePainting";
import {
    Image,
    Layers,
    Stamp,
    Shrink,
    Map,
    Newspaper,
    LayoutGrid,
    Split,
    Utensils,
    Clock,
} from "lucide-react";
import h001 from "@/assets/history/split_001.jpg";
import h002 from "@/assets/history/split_002.jpg";
import h003 from "@/assets/history/split_003.jpg";
import h004 from "@/assets/history/split_004.jpg";
import h005 from "@/assets/history/split_005.jpg";
import h006 from "@/assets/history/split_006.jpg";
import h007 from "@/assets/history/split_007.jpg";
import h008 from "@/assets/history/split_008.jpg";
import h009 from "@/assets/history/split_009.jpg";
import h010 from "@/assets/history/split_010.jpg";
import h011 from "@/assets/history/split_011.jpg";
import h012 from "@/assets/history/split_012.jpg";
import h013 from "@/assets/history/split_013.jpg";
import h014 from "@/assets/history/split_014.jpg";
import h015 from "@/assets/history/split_015.jpg";
import h016 from "@/assets/history/split_016.jpg";
import h017 from "@/assets/history/split_017.jpg";
import h018 from "@/assets/history/split_018.jpg";

const HISTORY_ICONS = [
    h001,
    h002,
    h003,
    h004,
    h005,
    h006,
    h007,
    h008,
    h009,
    h010,
    h011,
    h012,
    h013,
    h014,
    h015,
    h016,
    h017,
    h018,
];

interface ToolItem {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    href: string;
    colorTheme: {
        bg: string;
        text: string;
        border: string;
        hoverGradient: string;
    };
}

const ToolCard = ({
    item,
    index,
    onClick,
}: {
    item: ToolItem;
    index: number;
    onClick: () => void;
}) => {
    const Icon = item.icon;

    const hashRandom = (seed: number) => {
        let x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    };

    // 精选12款中国水墨意境图案 (保证不重复)
    const getDecorationPath = (idx: number) => {
        // 坐标规则：x=0→64（宽度），y=64（底部）→y≈42-58（主峰最低y≈42，次峰≈48-55）
        // 真实感逻辑：主峰→次峰高度渐增（坡度变缓），曲线向主峰内侧偏移（不对称）
        const naturalMountainPaths = [
            // 1 — 主峰居中+双侧缓降（最经典的山脉形态）
            "M0 64 Q12 56 22 50 Q32 42 42 50 Q52 56 64 64 Z",
            // 解析：主峰在x=32（y=42），向左（x=22,y=50）和向右（x=42,y=50）坡度渐缓，自然对称中带微差

            // 2 — 主峰偏左+右侧长缓坡（左陡右缓，真实山脉常见形态）
            "M0 64 Q8 50 18 46 Q28 52 38 56 Q48 58 58 56 Q64 54 64 64 Z",
            // 解析：主峰在x=18（y=46），左侧陡峭（x=0到x=18，y从64→46），右侧缓坡延伸（x=18到x=64，y从46→64）

            // 3 — 主峰偏右+左侧长缓坡（右陡左缓，与路径2呼应）
            "M0 64 Q10 58 20 56 Q30 54 40 50 Q50 44 60 50 Q64 56 64 64 Z",
            // 解析：主峰在x=50（y=44），右侧陡峭（x=50到x=64，y从44→64），左侧缓坡延伸

            // 4 — 双主脉+中间谷（峰谷相间，层次分明）
            "M0 64 Q12 54 22 50 Q32 56 42 52 Q52 46 62 54 Q64 58 64 64 Z",
            // 解析：左主脉x=22（y=50），右主脉x=52（y=46），中间谷x=32（y=56），形成“峰-谷-峰”节奏

            // 5 — 低缓主脉+多小支峰（如丘陵地带，起伏柔和）
            "M0 64 Q8 57 16 55 Q24 57 32 53 Q40 57 48 55 Q56 57 64 64 Z",
            // 解析：主峰x=32（y=53），周围小支峰y≈55-57，高度差仅2-4，模拟丘陵的平缓起伏

            // 6 — 主峰高+右侧小支峰（主脉突出，支脉依附）
            "M0 64 Q14 56 24 48 Q32 54 40 52 Q50 48 60 54 Q64 58 64 64 Z",
            // 解析：主峰x=24（y=48），右侧x=50处有小支峰（y=48），依附主脉走势

            // 7 — 长缓坡起+主峰+陡收（有“山脉延伸而来”的流动感）
            "M0 64 Q16 59 32 55 Q40 46 48 52 Q56 56 64 60 Q64 64 64 64 Z",
            // 解析：左侧长缓坡（x=0到x=32，y从64→55），主峰x=40（y=46），右侧稍陡收束

            // 8 — 对称双主峰+中间微凸（如山脉鞍部，自然衔接）
            "M0 64 Q16 52 26 56 Q32 58 38 56 Q48 52 64 64 Z",
            // 解析：左右双主峰x=16和x=48（y=52），中间鞍部x=32（y=58），过渡自然

            // 9 — 主峰低+支峰错落（如远山层叠，朦胧中见层次）
            "M0 64 Q10 56 20 54 Q30 58 40 55 Q50 52 60 54 Q64 56 64 64 Z",
            // 解析：主峰不突出（y≈52-54），支峰高度微差（3-5单位），模拟远山的朦胧层叠

            // 10 — 左起微降+主峰+右缓收（有“自然生长”的流向）
            "M0 64 Q10 62 20 60 Q30 54 40 48 Q50 54 60 58 Q64 60 64 64 Z",
            // 解析：左侧先微降（x=0→20，y64→60），再升向主峰（x=40,y48），右侧自然收平

            // 11 — 主峰陡峭+底部宽缓（如孤峰，根部扎实）
            "M0 64 Q12 58 20 50 Q28 44 36 50 Q44 56 52 54 Q60 56 64 64 Z",
            // 解析：主峰x=28（y=44）陡峭，底部向两侧展开（y≈56-64），有“根基稳固”的真实感

            // 12 — 多小峰依附主脉（主脉x=32，小峰沿主脉分布）
            "M0 64 Q6 56 12 52 Q18 56 24 50 Q30 54 36 48 Q42 52 48 56 Q54 52 60 56 Q64 60 64 64 Z",
            // 解析：主脉沿x轴中间分布，小峰y值围绕52-56波动，高度差≤4，像主脉上的小凸起

            // 13 — 右半段主脉+左延伸（主脉在右，左脉自然延伸）
            "M0 64 Q16 60 32 59 Q44 56 56 50 Q64 56 64 64 Z",
            // 解析：主脉在x=56（y=50），左侧延伸部分坡度极缓（y从59→60），模拟山脉余脉

            // 14 — 左高右低+坡度渐变（左侧稍陡，向右均匀变缓）
            "M0 64 Q8 54 18 52 Q28 54 38 56 Q48 57 58 58 Q64 59 64 64 Z",
            // 解析：左侧y值低（52），向右y值逐渐升高（52→59），坡度均匀变缓，无突变

            // 15 — 中间微凸+双侧对称缓降（低调自然，适合小卡片）
            "M0 64 Q20 56 32 53 Q44 56 64 64 Z",
            // 解析：主峰x=32（y=53），双侧坡度对称且缓（y从53→64，x跨度20-22），适合简约场景

            // 16 — 峰谷交错+自然收束（小起伏贯穿，末端平缓收尾）
            "M0 64 Q10 57 18 55 Q26 57 34 54 Q42 56 50 53 Q58 55 64 57 Q64 64 64 64 Z",
            // 解析：全程小起伏（y53-57），末端x=64处y=57→64，平缓收尾，有“山脉消失在地平线”的感觉
        ];

        return naturalMountainPaths[
            Math.abs(idx) % naturalMountainPaths.length
        ];
    };

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.005 }}
            whileTap={{ scale: 0.98 }}
            className={`group relative overflow-hidden rounded-lg border border-stone-200/60 bg-[#eff0f0] shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] ${item.colorTheme.border} transition-all duration-300 cursor-pointer p-4 flex flex-col items-start justify-between gap-3 h-64 md:h-72`}
            onClick={onClick}
        >
            {/* 背景装饰：微弱的色块 - 进一步减淡以突出水墨 */}
            <div
                className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full ${item.colorTheme.bg} opacity-5 blur-2xl group-hover:opacity-20 transition-opacity duration-500`}
            />

            {/* 背景装饰：水墨山水图案 - 右下角轻微点缀 */}
            <div className="absolute right-0 bottom-0 w-32 h-32 opacity-[0.55] group-hover:opacity-[0.95] transition-opacity duration-500 pointer-events-none">
                <img
                    src={HISTORY_ICONS[index % HISTORY_ICONS.length]}
                    alt=""
                    className="w-full h-full object-contain object-right-bottom"
                />
            </div>

            {/* 装饰性背景渐变 - Desktop hover 时显现 */}
            <div
                className={`hidden md:block absolute inset-0 bg-gradient-to-r ${item.colorTheme.hoverGradient} opacity-0 group-hover:opacity-10 transition-all duration-500`}
            />

            <div className="flex items-center gap-4 relative z-10">
                {/* 图标容器 */}
                <div
                    className={`shrink-0 p-2.5 rounded-lg bg-white/80 border border-stone-100 shadow-sm ${item.colorTheme.text} transition-transform duration-300 group-hover:scale-105 backdrop-blur-sm`}
                >
                    <Icon size={20} strokeWidth={1.5} />
                </div>

                {/* 文字内容 */}
                <div className="flex flex-col z-10">
                    <h3 className="text-sm md:text-base font-bold text-stone-700 group-hover:text-black tracking-tight font-mono">
                        {item.title.replace("\n", "")}
                    </h3>
                    <p className="text-xs text-stone-500 group-hover:text-stone-600 leading-relaxed line-clamp-2 mt-0.5 font-mono opacity-80">
                        {item.description}
                    </p>
                </div>
            </div>

            {/* 箭头图标 (仅桌面端显示) - 更简约 */}
            <div className="hidden md:block opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-stone-400 relative z-10">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                </svg>
            </div>

            {/* 移动端箭头 */}
            <div className="md:hidden text-stone-300 relative z-10">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="m9 18 6-6-6-6" />
                </svg>
            </div>
        </motion.div>
    );
};

export default function Landing() {
    const navigate = useNavigate();

    const items: ToolItem[] = [
        {
            id: "watermark",
            title: "水印添加",
            description: "批量添加文字或图片水印，保护版权",
            icon: Stamp,
            href: "/watermark",
            colorTheme: {
                bg: "bg-cyan-50",
                text: "text-cyan-700",
                border: "hover:border-cyan-200",
                hoverGradient: "from-cyan-100 to-transparent",
            },
        },
        {
            id: "puzzle",
            title: "大图拼接",
            description: "智能拼接多张图片，支持自定义布局",
            icon: Layers,
            href: "/puzzle",
            colorTheme: {
                bg: "bg-violet-50",
                text: "text-violet-700",
                border: "hover:border-violet-200",
                hoverGradient: "from-violet-100 to-transparent",
            },
        },
        {
            id: "google-photo",
            title: "Google 相册",
            description: "笑谈间气吐霓虹的相册",
            icon: Image,
            href: "/google-photo",
            colorTheme: {
                bg: "bg-indigo-50",
                text: "text-indigo-700",
                border: "hover:border-indigo-200",
                hoverGradient: "from-indigo-100 to-transparent",
            },
        },
        // 还不成熟
        // {
        //     id: "stitch",
        //     title: "图片拼接",
        //     description: "自由拼接多张图片，无缝合成",
        //     icon: Scissors,
        //     href: "/stitch",
        //     colorTheme: {
        //         bg: "bg-emerald-50",
        //         text: "text-emerald-700",
        //         border: "hover:border-emerald-200",
        //         hoverGradient: "from-emerald-100 to-transparent",
        //     },
        // },
        {
            id: "restaurant",
            title: "餐厅搜索",
            description: "快速发现周边热门美食",
            icon: Utensils,
            href: "/restaurant",
            colorTheme: {
                bg: "bg-orange-50",
                text: "text-orange-700",
                border: "hover:border-orange-200",
                hoverGradient: "from-orange-100 to-transparent",
            },
        },
        // {
        //     id: "change",
        //     title: "颜色调整",
        //     description: "专业的色彩与滤镜微调工具",
        //     icon: Palette,
        //     href: "/change",
        //     colorTheme: {
        //         bg: "bg-rose-50",
        //         text: "text-rose-700",
        //         border: "hover:border-rose-200",
        //         hoverGradient: "from-rose-100 to-transparent",
        //     },
        // },

        {
            id: "compress",
            title: "批量压缩",
            description: "高效压缩图片体积，保持画质",
            icon: Shrink,
            href: "/compress",
            colorTheme: {
                bg: "bg-slate-100",
                text: "text-slate-700",
                border: "hover:border-slate-300",
                hoverGradient: "from-slate-200 to-transparent",
            },
        },
        {
            id: "wenwu",
            title: "195 禁出",
            description: "探索国家级馆藏文物地图",
            icon: Map,
            href: "/wenwu",
            colorTheme: {
                bg: "bg-amber-50",
                text: "text-amber-700",
                border: "hover:border-amber-200",
                hoverGradient: "from-amber-100 to-transparent",
            },
        },
        {
            id: "news",
            title: "每日新闻",
            description: "实时聚合热点新闻资讯",
            icon: Newspaper,
            href: "/news",
            colorTheme: {
                bg: "bg-red-50",
                text: "text-red-700",
                border: "hover:border-red-200",
                hoverGradient: "from-red-100 to-transparent",
            },
        },
        {
            id: "collage",
            title: "拼图模式",
            description: "丰富的拼图模板与样式选择",
            icon: LayoutGrid,
            href: "/collage",
            colorTheme: {
                bg: "bg-fuchsia-50",
                text: "text-fuchsia-700",
                border: "hover:border-fuchsia-200",
                hoverGradient: "from-fuchsia-100 to-transparent",
            },
        },
        {
            id: "split",
            title: "长图拆分",
            description: "精确按比例拆分长图",
            icon: Split,
            href: "/split",
            colorTheme: {
                bg: "bg-lime-50",
                text: "text-lime-700",
                border: "hover:border-lime-200",
                hoverGradient: "from-lime-100 to-transparent",
            },
        },
        {
            id: "calendar",
            title: "屏幕时钟",
            description: "好玩有趣的屏幕时钟",
            icon: Clock,
            href: "/calendar",
            colorTheme: {
                bg: "bg-yellow-50",
                text: "text-yellow-700",
                border: "hover:border-yellow-200",
                hoverGradient: "from-yellow-100 to-transparent",
            },
        },
    ];

    return (
        <div className="min-h-screen w-full bg-[#FDFBF7] text-stone-800 font-mono selection:bg-stone-200 selection:text-stone-800 overflow-x-hidden relative">
            {/* 背景装饰：静态水墨波浪意象 - 极简处理 */}
            <div className="fixed bottom-0 left-0 w-full h-[40vh] z-0 pointer-events-none opacity-[0.03] text-stone-900">
                <svg
                    className="w-full h-full"
                    viewBox="0 0 1440 320"
                    preserveAspectRatio="none"
                >
                    <path
                        fill="currentColor"
                        fillOpacity="1"
                        d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,197.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
                    ></path>
                </svg>
            </div>
            <div className="fixed bottom-0 left-0 w-full h-[45vh] z-0 pointer-events-none opacity-[0.02] text-stone-800">
                <svg
                    className="w-full h-full"
                    viewBox="0 0 1440 320"
                    preserveAspectRatio="none"
                >
                    <path
                        fill="currentColor"
                        fillOpacity="1"
                        d="M0,96L48,112C96,128,192,160,288,186.7C384,213,480,235,576,213.3C672,192,768,128,864,128C960,128,1056,192,1152,208C1248,224,1344,192,1392,176L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
                    ></path>
                </svg>
            </div>

            {/* 顶部 Header */}
            <header className="fixed top-0 left-0 w-full px-6 py-4 z-50 flex justify-between items-center bg-[#FDFBF7]/80 backdrop-blur-sm border-b border-stone-200/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-stone-800 flex items-center justify-center text-[#FDFBF7] font-bold text-lg shadow-sm">
                        <span className="font-mono text-4xl">☺</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-stone-800 leading-tight font-mono tracking-wide">
                            笑谈间气吐霓虹
                        </span>
                        <span className="text-[10px] text-stone-500 font-medium uppercase tracking-widest opacity-80 font-mono">
                            工具合集
                        </span>
                    </div>
                </div>
                {/* <div>
                    <DarkToggle />
                </div> */}
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 pt-32 pb-24 max-w-[1600px] relative z-10">
                {/* Hero Section */}
                <div className="mb-16 text-center max-w-2xl mx-auto">
                    <motion.h1
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-3xl md:text-4xl font-bold text-stone-800 tracking-wide mb-6 font-mono"
                    >
                        创意与效率的
                        <span className="text-stone-500 relative inline-block mx-2">
                            工具箱
                            <svg
                                className="absolute -bottom-1 left-0 w-full h-2 text-stone-300 -z-10"
                                viewBox="0 0 100 10"
                                preserveAspectRatio="none"
                            >
                                <path
                                    d="M0 5 Q 50 10 100 5"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="none"
                                />
                            </svg>
                        </span>
                    </motion.h1>

                    {/* <motion.p
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="text-sm md:text-base text-stone-500 leading-relaxed font-mono tracking-wide max-w-lg mx-auto"
                    >
                        一站式图片处理与实用工具集合
                        <br className="hidden md:block" />
                        <span className="opacity-80 mt-2 block">
                            简化工作流程，让创作回归纯粹与愉悦
                        </span>
                    </motion.p> */}
                </div>

                {/* Tools Grid - Adjusted for more compact layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6 xl:gap-8">
                    {items.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.05 }}
                        >
                            <ToolCard
                                item={item}
                                index={index}
                                onClick={() => item.href && navigate(item.href)}
                            />
                        </motion.div>
                    ))}
                </div>
            </main>

            {/* Footer */}
            <footer className="py-12 text-center text-stone-400 text-xs font-mono tracking-widest relative z-10">
                <div className="w-12 h-px bg-stone-300 mx-auto mb-4"></div>
                <p>
                    &copy; {new Date().getFullYear()} MyTools.{" "}
                    <span className="mx-2 opacity-50">|</span>{" "}
                    这里的山水，皆为心画
                </p>
            </footer>
        </div>
    );
}
