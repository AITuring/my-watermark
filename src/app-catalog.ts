import type { ComponentType } from "react";

export interface AppCatalogItem {
    id: string;
    label: string;
    url: string;
    icon: string;
    description: string;
    component: () => Promise<{ default: ComponentType<Record<string, never>> }>;
}

export const appCatalog: AppCatalogItem[] = [
    {
        id: "watermark",
        label: "水印添加",
        url: "/watermark",
        icon: "ri:image-ai-line",
        description: "批量给图片加文字或图标水印，快速保护版权",
        component: () => import("./Watermark"),
    },
    {
        id: "compress",
        label: "批量压缩",
        url: "/compress",
        icon: "material-symbols:compress",
        description: "批量减小图片体积，兼顾清晰度和上传速度",
        component: () => import("./BatchImageCompressor"),
    },
    {
        id: "photo",
        label: "Google 相册",
        url: "/google-photo",
        icon: "logos:google-photos",
        description: "按相册流式浏览照片，适合沉浸式回看和筛图",
        component: () => import("./GooglePhoto"),
    },
    {
        id: "frame",
        label: "简约相框",
        url: "/frame",
        icon: "ri:image-edit-line",
        description: "为照片加统一边框和留白，适合发朋友圈或打印",
        component: () => import("./PhotoFrame"),
    },
    {
        id: "split",
        label: "图片分割",
        url: "/split",
        icon: "material-symbols:split-vertical",
        description: "把一张图按规则切成多张，适配社媒九宫格等场景",
        component: () => import("./ImageSplitter"),
    },
    {
        id: "crop",
        label: "图片裁切",
        url: "/crop",
        icon: "material-symbols:crop",
        description: "支持固定像素、按比例和自由裁切，导出尺寸更可控",
        component: () => import("./ImageCropper"),
    },
    {
        id: "puzzle",
        label: "大图拼接",
        url: "/puzzle",
        icon: "tabler:layout-board-split",
        description: "多图自由排版并导出长图，适合作品集和图文合集",
        component: () => import("./Puzzle"),
    },
    {
        id: "stitch",
        label: "图片拼接",
        url: "/stitch",
        icon: "material-symbols:photo-library-outline",
        description: "上传有重叠的照片自动全景拼接，输出一张完整大图",
        component: () => import("./ImageStitching"),
    },
    {
        id: "artifact-ai",
        label: "文物百科",
        url: "/artifact-ai",
        icon: "lucide:book-open",
        description: "输入问题快速查文物背景，适合做讲解和科普笔记",
        component: () => import("./ArtifactAI"),
    },
    {
        id: "restaurant",
        label: "餐厅搜索",
        url: "/restaurant",
        icon: "ri:restaurant-2-line",
        description: "按位置和偏好筛餐厅，快速决定去哪吃",
        component: () => import("./RestaurantFinder"),
    },
    {
        id: "change",
        label: "图片颜色调整",
        url: "/change",
        icon: "material-symbols:palette-outline",
        description: "调亮度、对比度和色调，快速修正照片观感",
        component: () => import("./ChangeColor"),
    },
    {
        id: "wenwu",
        label: "195禁出",
        url: "/wenwu",
        icon: "material-symbols:museum-outline",
        description: "按地图查看重点馆藏与分布，快速了解文物脉络",
        component: () => import("./Wenwu"),
    },
    {
        id: "news",
        label: "新闻",
        url: "/news",
        icon: "ri:news-line",
        description: "聚合热点资讯，快速浏览当天重要信息",
        component: () => import("./News"),
    },
    {
        id: "collage",
        label: "图片拼接",
        url: "/collage",
        icon: "material-symbols:photo-library-outline",
        description: "按模板合成多图海报，适合电商图和分享封面",
        component: () => import("./ImageCollage"),
    },
    {
        id: "rename",
        label: "文件重命名",
        url: "/rename",
        icon: "material-symbols:file-rename-outline",
        description: "按规则批量改文件名，整理素材更省时",
        component: () => import("./FileRenamer"),
    },
    {
        id: "mosaic",
        label: "创意马赛克",
        url: "/mosaic",
        icon: "material-symbols:mosaic-outline",
        description: "把多张图组合成图形化马赛克，适合海报创作",
        component: () => import("./CreativeMosaic"),
    },
    {
        id: "gallery",
        label: "年度相册",
        url: "/gallery",
        icon: "material-symbols:photo-library-outline",
        description: "做有边框和排版感的年度照片合集，一键导出",
        component: () => import("./Gallery"),
    },
    {
        id: "christmas",
        label: "圣诞树",
        url: "/christmas",
        icon: "mdi:pine-tree",
        description: "节日互动小工具，适合屏幕展示和氛围装饰",
        component: () => import("./ChristmasTreeHand"),
    },
    {
        id: "calendar",
        label: "日历",
        url: "/calendar",
        icon: "material-symbols:calendar-month-outline",
        description: "大屏日历和时钟展示，适合会议室或工作台",
        component: () => import("./Calendar"),
    },
    {
        id: "raw-editor",
        label: "RAW编辑器",
        url: "/raw-editor",
        icon: "material-symbols:camera-enhance-outline",
        description: "面向摄影后期的 RAW 调整工具，精细控制画质",
        component: () => import("./RawEditor"),
    },
    {
        id: "museum",
        label: "博物万象",
        url: "/museum",
        icon: "material-symbols:museum-outline",
        description: "聚合博物馆内容入口，便于浏览专题与展讯",
        component: () => import("./MuseumExplorer"),
    },
    {
        id: "museum-events",
        label: "临展雷达",
        url: "/museum-events",
        icon: "material-symbols:event-available-outline",
        description: "追踪近期临展和时间节点，避免错过想看的展",
        component: () => import("./MuseumEventRadar"),
    },
];

// 应用目录
// 5.2早上到临沂，北寨汉墓 临沂博物馆 一天
// 晚上 到济宁北
// 5.3第二天 早上 直冲 武梁祠 下午巨野博物馆
// 晚上巨野北 到济南
// 5.4第三天 孝堂山+长清博物馆+灵岩寺
//
