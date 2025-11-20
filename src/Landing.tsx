import React from "react";
import { useNavigate } from "react-router-dom";
import ParticleInteraction, { InteractionItem } from "@/components/ParticleInteraction";

// 简化的 SVG 路径集合 (ViewBox 24x24)
const ICONS = {
  image: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-icon lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
  
  crop: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gallery-horizontal-icon lucide-gallery-horizontal"><path d="M2 3v18"/><rect width="12" height="18" x="6" y="3" rx="2"/><path d="M22 3v18"/></svg>`,

  compress: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package-icon lucide-package"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/></svg>`,

  layers: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-puzzle-icon lucide-puzzle"><path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/></svg>`,
  palette: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-palette-icon lucide-palette"><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,

  search: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-utensils-icon lucide-utensils"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,

  map: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-landmark-icon lucide-landmark"><path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/></svg>`,

  grid: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-grid-icon lucide-layout-grid"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
};

export default function Landing() {
  const navigate = useNavigate();

  // 提示：title 中的 \n 可以让文字强制换行，符合截图效果
  const items: InteractionItem[] = [
    { id: "google-photo",  title: "Google\n相册", description: "抓取相册图片",  iconPath: ICONS.image, href: "/google-photo" },
    { id: "puzzle",  title: "大图\n拼接", description: "多图快速拼接",  iconPath: ICONS.layers, href: "/puzzle" },
    { id: "stitch",  title: "图片\n拼接", description: "多张图片任意拼合",  iconPath: ICONS.crop, href: "/stitch" },
    { id: "restaurant",  title: "餐厅\n搜索", description: "周边美食一览",  iconPath: ICONS.search, href: "/restaurant" },
    { id: "change",  title: "颜色\n调整", description: "色彩与滤镜微调",  iconPath: ICONS.palette, href: "/change" },
    { id: "watermark",  title: "水印\n添加", description: "快速为图片添加水印",  iconPath: ICONS.layers, href: "/watermark" },
    { id: "compress",  title: "批量\n压缩", description: "高效压缩多张图片",  iconPath: ICONS.compress, href: "/compress" },
    { id: "wenwu",  title: "195\n禁出", description: "馆藏文物地图",  iconPath: ICONS.map, href: "/wenwu" },
    { id: "news",  title: "每日\n新闻", description: "热点速览",  iconPath: ICONS.search, href: "/news" },
    { id: "collage",  title: "拼图\n模式", description: "多图拼贴样式",  iconPath: ICONS.grid, href: "/collage" },
    { id: "split",  title: "长图\n拆分", description: "按比例切片",  iconPath: ICONS.crop, href: "/split" },
  ];

  return (
    <div className="relative min-h-screen w-screen bg-black overflow-hidden">
      {/* Header 可以稍微加点东西，或者留空保持极简 */}
      <div className="fixed top-0 left-0 w-full p-6 z-50 pointer-events-none flex justify-between items-center">
          <div className="text-white font-bold text-xl opacity-50">MyTools</div>
      </div>

      {/* 核心交互区 */}
      <div className="flex items-center justify-center h-screen w-full">
        <ParticleInteraction
            items={items}
            onItemClick={(item) => item.href && navigate(item.href)}
            className="h-full"
        />
      </div>
    </div>
  );
}
