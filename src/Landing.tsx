import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DarkToggle from "@/components/DarkToggle";
import ParticleInteraction, { InteractionItem } from "@/components/ParticleInteraction";

// 简化的 SVG 路径集合 (ViewBox 24x24)
const ICONS = {
  image: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`,

  crop: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z"/></svg>`,

  compress: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M8 19h3v3h2v-3h3l-4-4-4 4zm8-15h-3V1h-2v3H8l4 4 4-4zM4 9v2h16V9H4zM4 12h16v2H4z"/></svg>`,

  layers: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"/></svg>`,
  palette: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,

  search: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,

  map: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,

  grid: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z"/></svg>`,
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
      <div aria-hidden className="absolute inset-0 z-[1] pointer-events-none bg-gradient-to-b from-[#020617] via-[#0b1220] to-black" />
      <div aria-hidden className="absolute -top-40 -left-40 w-[55vw] h-[55vw] rounded-full bg-cyan-500/20 blur-3xl z-[2] pointer-events-none" />
      <div aria-hidden className="absolute -bottom-32 -right-24 w-[40vw] h-[40vw] rounded-full bg-fuchsia-500/20 blur-3xl z-[2] pointer-events-none" />
      <div aria-hidden className="absolute inset-0 z-[3] pointer-events-none bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.06),_transparent_60%)]" />

      <div className="fixed top-0 left-0 w-full px-6 py-5 z-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 font-extrabold text-xl tracking-tight">MyTools</div>
          <div className="text-xs text-slate-400/70">轻量工具集</div>
        </div>
        <div className="pointer-events-auto">
          <DarkToggle />
        </div>
      </div>

      <div className="fixed top-20 left-0 w-full z-40 flex justify-center pointer-events-none">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 backdrop-blur-sm">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span className="text-xs text-slate-300">悬停卡片，粒子会变成图标</span>
        </motion.div>
      </div>

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
