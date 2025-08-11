"use client";
import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// 中国传统色彩配色方案，按色系分组
const COLOR_FAMILIES = {
  red: [
    { name: "胭脂", color: "#9d2933", opacity: 0.6 },
    { name: "朱砂", color: "#ff461f", opacity: 0.5 },
    { name: "丹", color: "#ff4e20", opacity: 0.4 },
    { name: "彤", color: "#f35336", opacity: 0.5 },
    { name: "茜", color: "#cb3a56", opacity: 0.4 },
    { name: "嫣红", color: "#ef7a82", opacity: 0.5 },
    { name: "洋红", color: "#ff0097", opacity: 0.3 },
    { name: "品红", color: "#f00056", opacity: 0.4 },
    { name: "桃红", color: "#f47983", opacity: 0.5 },
    { name: "海棠红", color: "#db5a6b", opacity: 0.4 },
    { name: "樱桃色", color: "#c93756", opacity: 0.5 },
    { name: "银红", color: "#f05654", opacity: 0.4 },
    { name: "大红", color: "#ff2121", opacity: 0.6 },
    { name: "绛紫", color: "#8c4356", opacity: 0.4 },
    { name: "绯红", color: "#c83c23", opacity: 0.5 },
    { name: "朱红", color: "#ff4c00", opacity: 0.5 },
    { name: "妃色", color: "#ed5736", opacity: 0.4 },
  ],
   orange: [
    { name: "橘黄", color: "#d4722a", opacity: 0.5 }, // 降低饱和度
    { name: "杏黄", color: "#e6932a", opacity: 0.4 }, // 调暗
    { name: "橙黄", color: "#e6932a", opacity: 0.5 }, // 调暗
    { name: "藤黄", color: "#d4a01e", opacity: 0.4 }, // 降低亮度
    { name: "姜黄", color: "#d4a85a", opacity: 0.4 }, // 提高透明度
    { name: "缃色", color: "#c9a832", opacity: 0.4 }, // 降低饱和度
    { name: "橘红", color: "#d4622a", opacity: 0.5 }, // 调暗
    { name: "琥珀", color: "#b8621f", opacity: 0.5 }, // 提高透明度
  ],
  yellow: [
    { name: "明黄", color: "#d4c41a", opacity: 0.4 }, // 大幅降低亮度
    { name: "鹅黄", color: "#d4c93a", opacity: 0.4 }, // 降低亮度，提高透明度
    { name: "鸭黄", color: "#c9c955", opacity: 0.4 }, // 降低亮度
    { name: "樱草色", color: "#c4c94a", opacity: 0.4 }, // 降低亮度
    { name: "柠檬黄", color: "#a8b81e", opacity: 0.4 }, // 保持相对较暗
    { name: "象牙色", color: "#e6e0d4", opacity: 0.3 }, // 降低亮度
    { name: "雄黄", color: "#c9a01a", opacity: 0.4 }, // 保持
  ],
  green: [
    { name: "嫩绿", color: "#bddd22", opacity: 0.4 },
    { name: "柳绿", color: "#afdd22", opacity: 0.4 },
    { name: "葱绿", color: "#9ed900", opacity: 0.5 },
    { name: "青葱", color: "#0eb83a", opacity: 0.5 },
    { name: "青绿", color: "#00bc12", opacity: 0.5 },
    { name: "翠绿", color: "#00a86b", opacity: 0.5 },
    { name: "碧绿", color: "#2add9c", opacity: 0.4 },
    { name: "玉色", color: "#2edfa3", opacity: 0.4 },
    { name: "缥", color: "#7fecad", opacity: 0.3 },
    { name: "艾绿", color: "#a4e2c6", opacity: 0.3 },
  ],
  cyan: [
    { name: "青色", color: "#00e09e", opacity: 0.4 },
    { name: "青碧", color: "#48c0a3", opacity: 0.4 },
    { name: "铜绿", color: "#549688", opacity: 0.5 },
    { name: "竹青", color: "#789262", opacity: 0.4 },
    { name: "蓝绿", color: "#0eb83a", opacity: 0.5 },
    { name: "青白", color: "#c0ebd7", opacity: 0.3 },
    { name: "水绿", color: "#d3e0dc", opacity: 0.2 },
    { name: "鸭卵青", color: "#e0eee8", opacity: 0.2 },
  ],
  blue: [
    { name: "靛青", color: "#177cb0", opacity: 0.5 },
    { name: "靛蓝", color: "#065279", opacity: 0.6 },
    { name: "碧蓝", color: "#1685a9", opacity: 0.5 },
    { name: "蔚蓝", color: "#70f3ff", opacity: 0.3 },
    { name: "湖蓝", color: "#30dff3", opacity: 0.4 },
    { name: "海蓝", color: "#56b4e9", opacity: 0.4 },
    { name: "天蓝", color: "#87ceeb", opacity: 0.3 },
    { name: "宝蓝", color: "#4b5cc4", opacity: 0.5 },
    { name: "藏蓝", color: "#2e4e7e", opacity: 0.6 },
    { name: "黛", color: "#4a4266", opacity: 0.5 },
  ],
   purple: [
    { name: "紫色", color: "#6b2a8b", opacity: 0.5 }, // 降低饱和度
    { name: "紫罗兰", color: "#6b2a7a", opacity: 0.5 }, // 降低饱和度
    { name: "丁香色", color: "#a085b8", opacity: 0.4 }, // 降低亮度
    { name: "藕色", color: "#c9a8b8", opacity: 0.4 }, // 降低亮度
    { name: "藕荷色", color: "#b89aa8", opacity: 0.4 }, // 降低亮度
    { name: "雪青", color: "#8a7ab8", opacity: 0.4 }, // 降低亮度
    { name: "蓝紫", color: "#4e2f92", opacity: 0.5 }, // 保持
    { name: "绀紫", color: "#2a4a6b", opacity: 0.6 }, // 调整色调
    { name: "暗紫", color: "#4a4a5a", opacity: 0.5 }, // 调整色调
  ],
  brown: [
    { name: "绾", color: "#b8906b", opacity: 0.4 }, // 提亮
    { name: "檀", color: "#c9755a", opacity: 0.4 }, // 提亮
    { name: "棕色", color: "#c9622a", opacity: 0.4 }, // 提亮
    { name: "棕绿", color: "#9a8a2a", opacity: 0.4 }, // 提亮
    { name: "棕黑", color: "#9a622a", opacity: 0.5 }, // 提亮
    { name: "赭", color: "#b8622a", opacity: 0.4 }, // 提亮
    { name: "赭石", color: "#9a6b2a", opacity: 0.4 }, // 提亮
    { name: "土黄", color: "#d4a03a", opacity: 0.4 }, // 保持
    { name: "秋色", color: "#a8753a", opacity: 0.4 }, // 提亮
    { name: "秋香色", color: "#c9a075", opacity: 0.4 }, // 提高透明度
  ],
  gray: [
    { name: "银灰", color: "#8e8e93", opacity: 0.3 },
    { name: "苍色", color: "#75878a", opacity: 0.4 },
    { name: "水色", color: "#88ada6", opacity: 0.3 },
    { name: "老银", color: "#bacac6", opacity: 0.3 },
    { name: "灰色", color: "#808080", opacity: 0.3 },
    { name: "蟹壳青", color: "#bbcdc5", opacity: 0.3 },
    { name: "鸦青", color: "#424c50", opacity: 0.5 },
  ],
};

// 获取随机色系的颜色
const getRandomColorFamily = () => {
  const familyKeys = Object.keys(COLOR_FAMILIES);
  const randomFamily = familyKeys[Math.floor(Math.random() * familyKeys.length)];
  return COLOR_FAMILIES[randomFamily as keyof typeof COLOR_FAMILIES];
};

interface Wave {
  x: number;
  y: number;
  amplitude: number;
  frequency: number;
  phase: number;
  speed: number;
  color: string;
  opacity: number;
}

interface ChineseWaveBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  animate?: boolean;
  waveCount?: number;
}

function ChineseWaveBackground({
  children,
  className,
  containerClassName,
  animate = true,
  waveCount = 6, // 减少波浪数量，避免过于复杂
}: ChineseWaveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const wavesRef = useRef<Wave[]>([]);
  const timeRef = useRef(0);

  // 初始化波浪
  const initWaves = (width: number, height: number) => {
    wavesRef.current = [];
    // 每次初始化时随机选择一个色系
    const selectedColorFamily = getRandomColorFamily();

    for (let i = 0; i < waveCount; i++) {
      // 在选定的色系中随机选择颜色
      const randomColorIndex = Math.floor(Math.random() * selectedColorFamily.length);
      const colorData = selectedColorFamily[randomColorIndex];

      wavesRef.current.push({
        x: 0,
        // 波浪只占页面下半部分，从50%开始到100%
        y: height * (0.5 + (i / waveCount) * 0.5),
        amplitude: 20 + Math.random() * 30, // 减小振幅，使波浪更温和
        frequency: 0.003 + Math.random() * 0.005, // 降低频率，使波浪更宽缓，减少陡峭
        phase: Math.random() * Math.PI * 2, // 初始相位
        speed: 0.01 + Math.random() * 0.02, // 保持原来的动画速度
        color: colorData.color,
        opacity: colorData.opacity * (1.2 + Math.random() * 0.6), // 提高基础透明度，使颜色更深
      });
    }
  };

  // 绘制波浪
  const drawWaves = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);

    wavesRef.current.forEach((wave) => {
      ctx.beginPath();
      ctx.globalAlpha = wave.opacity;

      // 创建渐变效果
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, wave.color + '20'); // 透明开始
      gradient.addColorStop(0.2, wave.color + '90'); // 半透明
      gradient.addColorStop(0.5, wave.color + 'DD'); // 中等透明度
      gradient.addColorStop(0.8, wave.color + '60'); // 半透明
      gradient.addColorStop(1, wave.color + '10'); // 透明结束

      ctx.fillStyle = gradient;

      // 使用更平滑的波浪算法，减少陡峭的波峰
      const points: { x: number; y: number }[] = [];

      for (let x = 0; x <= width; x += 3) {
        // 主波浪，使用更低的频率
        const mainWave = Math.sin(x * wave.frequency + wave.phase + timeRef.current * wave.speed) * wave.amplitude;

        // 添加次级波浪，增加自然感，但振幅更小
        const secondaryWave = Math.sin(x * wave.frequency * 1.3 + wave.phase * 0.7 + timeRef.current * wave.speed * 0.8) * wave.amplitude * 0.2;

        // 添加微小的细节波浪
        const detailWave = Math.sin(x * wave.frequency * 2.1 + wave.phase * 1.2 + timeRef.current * wave.speed * 1.1) * wave.amplitude * 0.1;

        const y = wave.y + mainWave + secondaryWave + detailWave;
        points.push({ x, y });
      }

      // 使用二次贝塞尔曲线绘制更平滑的波浪，减少陡峭感
      if (points.length > 0) {
        ctx.moveTo(0, points[0].y);

        for (let i = 1; i < points.length - 2; i++) {
          const currentPoint = points[i];
          const nextPoint = points[i + 1];

          // 使用更平滑的控制点计算
          const controlX = (currentPoint.x + nextPoint.x) / 2;
          const controlY = (currentPoint.y + nextPoint.y) / 2;

          ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, controlX, controlY);
        }

        // 完成最后的点
        if (points.length > 2) {
          const lastPoint = points[points.length - 1];
          ctx.lineTo(lastPoint.x, lastPoint.y);
        }

        // 闭合路径创建填充区域
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
      }
    });
  };

  // 动画循环
  const animate_waves = () => {
    if (!animate) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    timeRef.current += 1; // 保持原来的动画速度
    drawWaves(ctx, canvas.width, canvas.height);

    animationRef.current = requestAnimationFrame(animate_waves);
  };

  // 处理窗口大小变化
  const handleResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    initWaves(canvas.width, canvas.height);
  };

  useEffect(() => {
    handleResize();

    if (animate) {
      animate_waves();
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate, waveCount]);

  return (
    <div
      className={cn(
        "relative h-screen w-screen overflow-hidden",
        // 使用中国传统色的渐变背景作为基础
        "bg-gradient-to-br from-slate-50 via-stone-100 to-neutral-200",
        containerClassName
      )}
    >
      {/* 波浪画布 */}
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 w-full h-full",
          className
        )}
        style={{ mixBlendMode: 'multiply' }} // 混合模式增强视觉效果
      />

      {/* 内容层 */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {children}
      </div>

      {/* 可选的诗意装饰元素 */}
      <div className="absolute top-8 right-8 z-5 opacity-20">
        <div className="text-slate-600 text-sm font-light tracking-wider">
          {/* 可以在这里添加诗词装饰 */}
        </div>
      </div>
    </div>
  );
}

export default ChineseWaveBackground;
