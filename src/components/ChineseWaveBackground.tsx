"use client";
import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const COLOR_FAMILIES = {
    red: [
        { r: 157, g: 41, b: 51 }, // 胭脂
        { r: 255, g: 70, b: 31 }, // 朱砂
        { r: 255, g: 78, b: 32 }, // 丹
        { r: 243, g: 83, b: 54 }, // 彤
        { r: 203, g: 58, b: 86 }, // 茜
        { r: 255, g: 0, b: 151 }, // 洋红
        { r: 240, g: 0, b: 86 }, // 品红
        { r: 219, g: 90, b: 107 }, // 海棠红
        { r: 201, g: 55, b: 86 }, // 樱桃色
        { r: 240, g: 86, b: 84 }, // 银红
        { r: 255, g: 33, b: 33 }, // 大红
        { r: 140, g: 67, b: 86 }, // 绛紫
        { r: 200, g: 60, b: 35 }, // 绯红
        { r: 255, g: 76, b: 0 }, // 朱红
        { r: 237, g: 87, b: 54 }, // 妃色
    ],
    orange: [
        { r: 212, g: 114, b: 42 }, // 橘黄
        { r: 230, g: 147, b: 42 }, // 杏黄
        { r: 230, g: 147, b: 42 }, // 橙黄
        { r: 212, g: 160, b: 30 }, // 藤黄
        { r: 212, g: 168, b: 90 }, // 姜黄
        { r: 201, g: 168, b: 50 }, // 缃色
        { r: 212, g: 98, b: 42 }, // 橘红
        { r: 184, g: 98, b: 31 }, // 琥珀
    ],
    // yellow: [
    //     { r: 212, g: 196, b: 26 }, // 明黄
    //     { r: 212, g: 201, b: 58 }, // 鹅黄
    //     { r: 196, g: 201, b: 74 }, // 樱草色
    //     { r: 168, g: 184, b: 30 }, // 柠檬黄
    //     { r: 201, g: 160, b: 26 }, // 雄黄
    // ],
    green: [
        { r: 189, g: 221, b: 34 }, // 嫩绿
        { r: 175, g: 221, b: 34 }, // 柳绿
        { r: 158, g: 217, b: 0 }, // 葱绿
        { r: 14, g: 184, b: 58 }, // 青葱
        { r: 0, g: 188, b: 18 }, // 青绿
        { r: 0, g: 168, b: 107 }, // 翠绿
        { r: 42, g: 221, b: 156 }, // 碧绿
        { r: 46, g: 223, b: 163 }, // 玉色
    ],
    cyan: [
        { r: 0, g: 224, b: 158 }, // 青色
        { r: 72, g: 192, b: 163 }, // 青碧
        { r: 84, g: 150, b: 136 }, // 铜绿
        { r: 120, g: 146, b: 98 }, // 竹青
        { r: 14, g: 184, b: 58 }, // 蓝绿
    ],
    blue: [
        { r: 23, g: 124, b: 176 }, // 靛青
        { r: 6, g: 82, b: 121 }, // 靛蓝
        { r: 22, g: 133, b: 169 }, // 碧蓝
        { r: 48, g: 223, b: 243 }, // 湖蓝
        { r: 86, g: 180, b: 233 }, // 海蓝
        { r: 75, g: 92, b: 196 }, // 宝蓝
        { r: 46, g: 78, b: 126 }, // 藏蓝
        { r: 74, g: 66, b: 102 }, // 黛
    ],
    purple: [
        { r: 107, g: 42, b: 139 }, // 紫色
        { r: 107, g: 42, b: 122 }, // 紫罗兰
        { r: 160, g: 133, b: 184 }, // 丁香色
        { r: 184, g: 154, b: 168 }, // 藕荷色
        { r: 138, g: 122, b: 184 }, // 雪青
        { r: 78, g: 47, b: 146 }, // 蓝紫
        { r: 42, g: 74, b: 107 }, // 绀紫
        { r: 74, g: 74, b: 90 }, // 暗紫
    ],
    brown: [
        { r: 184, g: 144, b: 107 }, // 绾
        { r: 201, g: 117, b: 90 }, // 檀
        { r: 201, g: 98, b: 42 }, // 棕色
        { r: 154, g: 138, b: 42 }, // 棕绿
        { r: 154, g: 98, b: 42 }, // 棕黑
        { r: 184, g: 98, b: 42 }, // 赭
        { r: 154, g: 107, b: 42 }, // 赭石
        { r: 212, g: 160, b: 58 }, // 土黄
        { r: 168, g: 117, b: 58 }, // 秋色
        { r: 201, g: 160, b: 117 }, // 秋香色
    ],
    gray: [
        { r: 117, g: 135, b: 138 }, // 苍色
        { r: 136, g: 173, b: 166 }, // 水色
        { r: 128, g: 128, b: 128 }, // 灰色
        { r: 66, g: 76, b: 80 }, // 鸦青
    ],
};

// 获取随机色系的颜色
const getRandomColorFamily = () => {
  const familyKeys = Object.keys(COLOR_FAMILIES);
  const randomFamily = familyKeys[Math.floor(Math.random() * familyKeys.length)];
  const colorArray = COLOR_FAMILIES[randomFamily as keyof typeof COLOR_FAMILIES];

  // 从选中的色系中随机选择一个颜色
  return colorArray[Math.floor(Math.random() * colorArray.length)];
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
    contentClassName?: string;
}

function ChineseWaveBackground({
    children,
    className,
    containerClassName,
    animate = true,
    waveCount = 6, // 减少波浪数量，避免过于复杂
    contentClassName,
}: ChineseWaveBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const wavesRef = useRef<Wave[]>([]);
    const timeRef = useRef(0);

    // 初始化波浪
    const initWaves = (width: number, height: number) => {
        wavesRef.current = [];
        // 每次初始化时随机选择一个色系的RGB值
        const selectedColor = getRandomColorFamily();

        for (let i = 0; i < waveCount; i++) {
            // 为每个波浪分配不同的透明度，创建层次感
            const alphaValue = 0.45 + (i / waveCount) * 0.4; // 从0.15到0.55的渐变透明度

            wavesRef.current.push({
                x: 0,
                // 波浪只占页面下半部分，从50%开始到100%
                y: height * (0.5 + (i / waveCount) * 0.5),
                amplitude: 20 + Math.random() * 30, // 减小振幅，使波浪更温和
                frequency: 0.003 + Math.random() * 0.005, // 降低频率，使波浪更宽缓，减少陡峭
                phase: Math.random() * Math.PI * 2, // 初始相位
                speed: 0.01 + Math.random() * 0.02, // 保持原来的动画速度
                color: `rgba(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b}`, // 使用RGB格式，不包含alpha
                opacity: alphaValue, // 使用计算出的透明度
            });
        }
    };

    // 绘制波浪
    const drawWaves = (
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number
    ) => {
        ctx.clearRect(0, 0, width, height);

        wavesRef.current.forEach((wave) => {
            ctx.beginPath();
            ctx.globalAlpha = wave.opacity;

            // 创建径向渐变，从波浪中心向外扩散
            const centerX = width / 2;
            const centerY = wave.y;
            const radius = Math.max(width, height) * 0.7;

            const radialGradient = ctx.createRadialGradient(
                centerX,
                centerY,
                0, // 内圆：中心点，半径0
                centerX,
                centerY,
                radius // 外圆：中心点，大半径
            );

            // 径向渐变配置 - 从中心向外逐渐变浅
            radialGradient.addColorStop(0, `${wave.color}, ${wave.opacity})`); // 中心完整透明度
            radialGradient.addColorStop(
                0.3,
                `${wave.color}, ${wave.opacity * 0.8})`
            ); // 30%处稍浅
            radialGradient.addColorStop(
                0.4,
                `${wave.color}, ${wave.opacity * 0.7})`
            ); // 40%处稍浅
            radialGradient.addColorStop(
                0.6,
                `${wave.color}, ${wave.opacity * 0.5})`
            ); // 60%处更浅
            radialGradient.addColorStop(
                0.7,
                `${wave.color}, ${wave.opacity * 0.4})`
            ); // 70%处更浅
            radialGradient.addColorStop(
                0.8,
                `${wave.color}, ${wave.opacity * 0.3})`
            ); // 80%处很浅
            radialGradient.addColorStop(
                1,
                `${wave.color}, ${wave.opacity * 0.1})`
            ); // 边缘几乎透明

            ctx.fillStyle = radialGradient;

            // 使用更平滑的波浪算法，减少陡峭的波峰
            const points: { x: number; y: number }[] = [];

            for (let x = 0; x <= width; x += 3) {
                // 主波浪，使用更低的频率
                const mainWave =
                    Math.sin(
                        x * wave.frequency +
                            wave.phase +
                            timeRef.current * wave.speed
                    ) * wave.amplitude;

                // 添加次级波浪，增加自然感，但振幅更小
                const secondaryWave =
                    Math.sin(
                        x * wave.frequency * 1.3 +
                            wave.phase * 0.7 +
                            timeRef.current * wave.speed * 0.8
                    ) *
                    wave.amplitude *
                    0.2;

                // 添加微小的细节波浪
                const detailWave =
                    Math.sin(
                        x * wave.frequency * 2.1 +
                            wave.phase * 1.2 +
                            timeRef.current * wave.speed * 1.1
                    ) *
                    wave.amplitude *
                    0.1;

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

                    ctx.quadraticCurveTo(
                        currentPoint.x,
                        currentPoint.y,
                        controlX,
                        controlY
                    );
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

        const ctx = canvas.getContext("2d");
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

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
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
                className={cn("absolute inset-0 w-full h-full", className)}
                style={{ mixBlendMode: "multiply" }} // 混合模式增强视觉效果
            />

            {/* 内容层 */}
            <div className={cn("relative z-10 w-full h-full flex items-center justify-center", contentClassName)}>
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
