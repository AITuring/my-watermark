import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DarkToggle from "@/components/DarkToggle";
import { Icon } from "@iconify/react";
import { appCatalog } from "./app-catalog";
import h001 from "@/assets/history/split_001.png";
import h002 from "@/assets/history/split_002.png";
import h003 from "@/assets/history/split_003.png";
import h004 from "@/assets/history/split_004.png";
import h005 from "@/assets/history/split_005.png";
import h006 from "@/assets/history/split_006.png";
import h007 from "@/assets/history/split_007.png";
import h008 from "@/assets/history/split_008.png";
import h009 from "@/assets/history/split_009.png";
import h010 from "@/assets/history/split_010.png";
import h011 from "@/assets/history/split_011.png";
import h012 from "@/assets/history/split_012.png";
import h013 from "@/assets/history/split_013.png";
import h014 from "@/assets/history/split_014.png";
import h015 from "@/assets/history/split_015.png";
import h016 from "@/assets/history/split_016.png";
import h017 from "@/assets/history/split_017.png";
import h018 from "@/assets/history/split_018.png";

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
    icon: string;
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
    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.005 }}
            whileTap={{ scale: 0.98 }}
            className={`group relative overflow-hidden rounded-lg border border-stone-200/60 dark:border-stone-700/60 bg-[#eff0f0] dark:bg-[#262626] shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] dark:shadow-none ${item.colorTheme.border} transition-all duration-300 cursor-pointer p-4 flex flex-col items-start justify-between gap-3 h-64 md:h-72`}
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
                    className={`shrink-0 p-2.5 rounded-lg bg-white/80 dark:bg-stone-700/80 border border-stone-100 dark:border-stone-600 shadow-sm ${item.colorTheme.text} transition-transform duration-300 group-hover:scale-105 backdrop-blur-sm`}
                >
                    <Icon icon={item.icon} width={20} height={20} />
                </div>

                {/* 文字内容 */}
                <div className="flex flex-col z-10">
                    <h3 className="text-sm md:text-base font-bold text-stone-700 dark:text-stone-200 group-hover:text-black dark:group-hover:text-white tracking-tight font-mono">
                        {item.title.replace("\n", "")}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300 leading-relaxed line-clamp-2 mt-0.5 font-mono opacity-80">
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
    const colorThemes = [
        {
            bg: "bg-cyan-50 dark:bg-cyan-900/20",
            text: "text-cyan-700 dark:text-cyan-300",
            border: "hover:border-cyan-200 dark:hover:border-cyan-700",
            hoverGradient: "from-cyan-100 to-transparent dark:from-cyan-900/40",
        },
        {
            bg: "bg-violet-50 dark:bg-violet-900/20",
            text: "text-violet-700 dark:text-violet-300",
            border: "hover:border-violet-200 dark:hover:border-violet-700",
            hoverGradient: "from-violet-100 to-transparent dark:from-violet-900/40",
        },
        {
            bg: "bg-indigo-50 dark:bg-indigo-900/20",
            text: "text-indigo-700 dark:text-indigo-300",
            border: "hover:border-indigo-200 dark:hover:border-indigo-700",
            hoverGradient: "from-indigo-100 to-transparent dark:from-indigo-900/40",
        },
        {
            bg: "bg-rose-50 dark:bg-rose-900/20",
            text: "text-rose-700 dark:text-rose-300",
            border: "hover:border-rose-200 dark:hover:border-rose-700",
            hoverGradient: "from-rose-100 to-transparent dark:from-rose-900/40",
        },
        {
            bg: "bg-amber-50 dark:bg-amber-900/20",
            text: "text-amber-700 dark:text-amber-300",
            border: "hover:border-amber-200 dark:hover:border-amber-700",
            hoverGradient: "from-amber-100 to-transparent dark:from-amber-900/40",
        },
        {
            bg: "bg-lime-50 dark:bg-lime-900/20",
            text: "text-lime-700 dark:text-lime-300",
            border: "hover:border-lime-200 dark:hover:border-lime-700",
            hoverGradient: "from-lime-100 to-transparent dark:from-lime-900/40",
        },
    ];

    const items: ToolItem[] = appCatalog.map((app, index) => ({
        id: app.id,
        title: app.label,
        description: app.description,
        icon: app.icon,
        href: app.url,
        colorTheme: colorThemes[index % colorThemes.length],
    }));

    return (
        <div className="min-h-screen w-full bg-[#FDFBF7] dark:bg-[#1a1a1a] text-stone-800 dark:text-stone-200 font-mono selection:bg-stone-200 dark:selection:bg-stone-700 selection:text-stone-800 dark:selection:text-stone-100 overflow-x-hidden relative">
            {/* 背景装饰：静态水墨波浪意象 - 极简处理 */}
            <div className="fixed bottom-0 left-0 w-full h-[40vh] z-0 pointer-events-none opacity-[0.03] text-stone-900 dark:text-stone-100 dark:opacity-[0.05]">
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
            <div className="fixed bottom-0 left-0 w-full h-[45vh] z-0 pointer-events-none opacity-[0.02] text-stone-800 dark:text-stone-100 dark:opacity-[0.03]">
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
            <header className="fixed top-0 left-0 w-full px-6 pt-4 pb-2 z-50 flex justify-between items-center bg-[#FDFBF7]/80 dark:bg-[#1a1a1a]/80 backdrop-blur-sm border-b border-stone-200/50 dark:border-stone-700/50">
                <div className="flex items-center gap-3 cursor-pointer">
                    <motion.div
                        className="relative w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-[#FDFBF7] font-bold text-lg shadow-sm"
                        initial="rest"
                        animate="rest"
                        whileHover="hover"
                    >
                        <motion.span
                            className="font-mono text-4xl"
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                        >
                            ☺
                        </motion.span>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none">
                            <motion.span
                                className="absolute -ml-4 select-none"
                                variants={{
                                    rest: { opacity: 0 },
                                    hover: {
                                        y: [0, -16, -32],
                                        opacity: [0, 1, 0],
                                        scale: [0.7, 1, 0.9],
                                        transition: { duration: 1.4, repeat: Infinity, repeatDelay: 0.4, ease: "easeOut" },
                                    },
                                }}
                                aria-hidden="true"
                            >
                                😊
                            </motion.span>
                            <motion.span
                                className="absolute select-none"
                                variants={{
                                    rest: { opacity: 0 },
                                    hover: {
                                        y: [0, -16, -32],
                                        opacity: [0, 1, 0],
                                        scale: [0.7, 1, 0.9],
                                        transition: { duration: 1.4, repeat: Infinity, repeatDelay: 0.4, ease: "easeOut", delay: 0.2 },
                                    },
                                }}
                                aria-hidden="true"
                            >
                                😊
                            </motion.span>
                            <motion.span
                                className="absolute ml-4 select-none"
                                variants={{
                                    rest: { opacity: 0 },
                                    hover: {
                                        y: [0, -16, -32],
                                        opacity: [0, 1, 0],
                                        scale: [0.7, 1, 0.9],
                                        transition: { duration: 1.4, repeat: Infinity, repeatDelay: 0.4, ease: "easeOut", delay: 0.4 },
                                    },
                                }}
                                aria-hidden="true"
                            >
                                😊
                            </motion.span>
                        </div>
                    </motion.div>
                    <div className="flex flex-col">
                        <span className="font-bold text-stone-800 dark:text-stone-100 leading-tight font-mono tracking-wide text-xl">
                            笑谈间气吐霓虹
                        </span>
                        {/* <span className="text-[10px] text-stone-500 font-medium uppercase tracking-widest opacity-80 font-mono">
                            工具合集
                        </span> */}
                    </div>
                </div>
                <div>
                    <DarkToggle />
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 pt-32 pb-24 max-w-[1600px] relative z-10">
                {/* Hero Section */}
                <div className="mb-16 text-center max-w-2xl mx-auto">
                    <motion.h1
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-3xl md:text-4xl font-bold text-stone-800 dark:text-stone-100 tracking-wide mb-6 font-mono"
                    >
                        创意与效率的
                        <motion.span
                            className="text-stone-500 dark:text-stone-400 relative inline-block mx-2"
                            initial="rest"
                            animate="rest"
                            whileHover="hover"
                        >
                            工具箱
                            <motion.span
                                className="absolute -top-6 right-2 select-none"
                                variants={{
                                    rest: { opacity: 0, scale: 0.6, y: 6, rotate: -12 },
                                    hover: { opacity: 1, scale: 1, y: 0, rotate: 0 },
                                }}
                                transition={{ type: "spring", stiffness: 360, damping: 20 }}
                                aria-hidden="true"
                            >
                                😊
                            </motion.span>
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
                        </motion.span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="text-sm md:text-base text-stone-500 dark:text-stone-400 leading-relaxed font-mono tracking-wide"
                    >
                        共 {items.length} 个应用，按卡片简介快速选择最合适的工具。
                    </motion.p>

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
            <footer className="py-12 text-center text-stone-400 dark:text-stone-600 text-xs font-mono tracking-widest relative z-10">
                <div className="w-12 h-px bg-stone-300 dark:bg-stone-700 mx-auto mb-4"></div>
                <p>
                    &copy; {new Date().getFullYear()} 笑谈间气吐霓虹{" "}
                    {/* <span className="mx-2 opacity-50">|</span>{" "}
                    这里的山水，皆为心画 */}
                </p>
            </footer>
        </div>
    );
}
