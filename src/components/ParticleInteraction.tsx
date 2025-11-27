import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

// --- 类型定义 ---
export interface InteractionItem {
  id: string;
  title: string;
  description: string;
  iconPath: string; // 传入完整 <svg>...</svg> 字符串
  href?: string;
}

interface ParticleInteractionProps {
  items: InteractionItem[];
  className?: string;
  onItemClick?: (item: InteractionItem) => void;
}

// --- 粒子系统逻辑 ---
class ParticleSystem {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number = 0;
  height: number = 0;
  particles: any[] = [];
  targetPoints: { x: number; y: number }[] = [];
  particleCount: number = 2000;
  state: 'idle' | 'active' = 'idle';
  animationFrameId: number = 0;
  activeSvgString: string = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    // 1. 先强制设置一次尺寸，防止初始为 0
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.resize();
    this.initParticles();
    this.animate();
    window.addEventListener('resize', this.handleResize);
  }

  handleResize = () => {
    this.resize();
    this.initParticles();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    // 确保粒子够多
    this.particleCount = Math.max(1500, Math.min(4000, Math.floor((this.width * this.height) / 5000)));
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        // 给予每个粒子独立的运动速度，确保背景永动
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        size: Math.random() * 1.8 + 0.8, // 稍微调大一点点，更容易看清
        alpha: Math.random() * 0.6 + 0.4, // 提高基础透明度
        // 记录归属状态
        targetX: null,
        targetY: null
      });
    }
  }

  // --- 核心修复：稳健的 SVG 处理器 ---
  processSvgToPoints(svgString: string, centerX: number, centerY: number) {
    const tempCanvas = document.createElement('canvas');
    const tCtx = tempCanvas.getContext('2d')!;
    const w = 300;
    const h = 300;
    tempCanvas.width = w;
    tempCanvas.height = h;

    // 1. 强制注入白色样式和加粗描边
    // 我们移除原有的 class 依赖，强制 stroke 为白色，并加粗 stroke-width 以便采样
    let processedSvg = svgString
        .replace(/<svg/, '<svg style="fill: white; stroke: white; stroke-width: 2px; stroke-linejoin: round; stroke-linecap: round;"')
        .replace(/currentColor/g, 'white') // 替换 currentColor
        .replace(/stroke-width=".*?"/g, '') // 移除原有的宽度定义，使用上面的 style 覆盖
        .replace(/class=".*?"/g, ''); // 移除 class 防止样式干扰

    // 2. 转为 Base64 (最稳健的加载方式)
    const base64Svg = window.btoa(unescape(encodeURIComponent(processedSvg)));
    const imgSrc = `data:image/svg+xml;base64,${base64Svg}`;

    const img = new Image();
    img.onload = () => {
      tCtx.clearRect(0, 0, w, h);
      tCtx.save();
      tCtx.translate(w / 2, h / 2);

      // 放大绘制，确保像素清晰
      const scale = 10;
      tCtx.scale(scale, scale);
      tCtx.translate(-12, -12); // 假设 viewBox 24x24

      tCtx.drawImage(img, 0, 0, 24, 24);
      tCtx.restore();

      // 采样
      const imageData = tCtx.getImageData(0, 0, w, h).data;
      const points: { x: number; y: number }[] = [];
      const gap = 4; // 采样间隔

      for (let y = 0; y < h; y += gap) {
        for (let x = 0; x < w; x += gap) {
          const index = (y * w + x) * 4;
          // 只要 alpha > 50 就认为是有效点
          if (imageData[index + 3] > 50) {
            const jx = (Math.random() - 0.5) * gap * 0.6;
            const jy = (Math.random() - 0.5) * gap * 0.6;
            points.push({ x: centerX + (x - w / 2) + jx, y: centerY + (y - h / 2) + jy });
          }
        }
      }

      // 随机打乱并分配
      points.sort(() => Math.random() - 0.5);
      this.targetPoints = points;
      this.updateParticleTargets();
    };

    img.src = imgSrc;
  }

  updateParticleTargets() {
    const targetLen = this.targetPoints.length;

    this.particles.forEach((p, i) => {
        if (i < targetLen) {
            p.targetX = this.targetPoints[i].x;
            p.targetY = this.targetPoints[i].y;
        } else {
            p.targetX = null;
            p.targetY = null;
        }
    });
  }

  setTarget(svgString: string | null, centerX: number = 0, centerY: number = 0) {
    if (!svgString) {
      this.state = 'idle';
      this.activeSvgString = '';
      this.targetPoints = [];
      this.updateParticleTargets();
      return;
    }

    this.state = 'active';

    // 如果 SVG 变了，或者这是第一次加载
    if (this.activeSvgString !== svgString) {
        this.activeSvgString = svgString;
        this.processSvgToPoints(svgString, centerX, centerY);
    } else {
        // 如果 SVG 没变（只是鼠标微动），我们只需要更新坐标偏移
        // 重新计算一下 offset 即可，不需要重新 drawImage
        // 这里为了代码简单，直接重新 process 也是可以的，或者只平移 targetPoints
        // 为了最准确的跟随，重新 process 也不慢
        this.processSvgToPoints(svgString, centerX, centerY);
    }
  }

  animate = () => {
    this.ctx.clearRect(0, 0, this.width, this.height);

    const len = this.particles.length;

    // 混合模式：让重叠粒子发光
    this.ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < len; i++) {
      let p = this.particles[i];

      // 检查该粒子是否有分配目标
      const hasTarget = p.targetX !== null && this.state === 'active';

      if (hasTarget) {
        // --- 模式 A：吸附成图标 ---
        // 强力吸附
        p.x += (p.targetX - p.x) * 0.2;
        p.y += (p.targetY - p.y) * 0.2;

        // 图标粒子颜色：高亮青蓝
        this.ctx.fillStyle = `rgba(120, 220, 255, ${p.alpha})`;
      }
      else {
        // --- 模式 B：背景自由运动 ---
        // 无论是否在 Active 状态，剩下的粒子必须动！

        p.x += p.vx;
        p.y += p.vy;

        // 边界循环
        if (p.x < 0) p.x = this.width;
        if (p.x > this.width) p.x = 0;
        if (p.y < 0) p.y = this.height;
        if (p.y > this.height) p.y = 0;

        // 颜色：
        // 如果是 Active 状态，背景粒子稍微变暗 (0.5)，突出 Icon
        // 如果是 Idle 状态，背景粒子正常亮度 (1.0)
        const dimFactor = this.state === 'active' ? 0.4 : 0.8;
        // 使用更优雅的冷白/淡蓝灰色，而非纯白
        this.ctx.fillStyle = `rgba(200, 210, 230, ${p.alpha * 0.8 * dimFactor})`;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.globalCompositeOperation = 'source-over';
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    cancelAnimationFrame(this.animationFrameId);
  }
}

// --- React 组件 ---

const ParticleInteraction: React.FC<ParticleInteractionProps> = ({ items, className, onItemClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const systemRef = useRef<ParticleSystem | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      systemRef.current = new ParticleSystem(canvasRef.current);
    }
    return () => systemRef.current?.destroy();
  }, []);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, iconPath: string) => {
    if (!systemRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    systemRef.current.setTarget(iconPath, centerX, centerY);

    gsap.to(e.currentTarget.querySelector('.text-content'), { scale: 1.15, opacity: 1, duration: 0.3, ease: "power2.out" });
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    systemRef.current?.setTarget(null);
    gsap.to(e.currentTarget.querySelector('.text-content'), { scale: 1, opacity: 0.7, duration: 0.3, ease: "power2.out" });
  };

  // 辅助函数：调整 SVG 尺寸以适应容器
  const getResponsiveSvg = (svgString: string) => {
    return svgString
        .replace(/width="\d+"/, 'width="100%"')
        .replace(/height="\d+"/, 'height="100%"');
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* 粒子画布：固定背景 */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-[5] pointer-events-none bg-transparent"
      />

      {/* Grid 布局容器 */}
      <div className="relative z-10 w-full h-full min-h-[80vh] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-10 md:gap-y-8 p-6 md:p-10 content-start md:content-center justify-items-center">
        {items.map((item) => (
          <div
            key={item.id}
            className="group relative w-full max-w-[140px] md:max-w-[200px] aspect-[4/5] md:aspect-square flex flex-col items-center justify-start md:justify-center cursor-pointer select-none transition-transform active:scale-95"
            onMouseEnter={(e) => handleMouseEnter(e, item.iconPath)}
            onMouseLeave={handleMouseLeave}
            onClick={() => onItemClick?.(item)}
          >
            {/* 透明触摸区 */}
            <div className="absolute -inset-4 z-0 bg-transparent md:hidden" />

            {/* 移动端显示的静态图标 - 极简圆圈容器 */}
            <div className="mb-4 flex items-center justify-center w-14 h-14 rounded-full bg-white/5 backdrop-blur-sm border border-white/5 md:hidden shadow-lg">
                <div
                    className="w-6 h-6 text-indigo-300 opacity-90"
                    dangerouslySetInnerHTML={{ __html: getResponsiveSvg(item.iconPath) }}
                />
            </div>

            {/* 内容区域 */}
            <div className="text-content flex flex-col items-center gap-2 md:gap-4 transition-all duration-500 opacity-100 md:opacity-70 will-change-transform">

                {/* 标题 */}
                <h3 className="text-sm md:text-2xl lg:text-3xl font-medium md:font-bold text-slate-200 leading-tight whitespace-pre-line text-center tracking-widest uppercase md:normal-case">
                    {item.title.replace(' ', '\n')}
                </h3>

                {/* 描述 - 仅桌面端显示，更精致的字体 */}
                <p className="text-[10px] md:text-xs text-slate-500 text-center max-w-[100px] md:max-w-[120px] leading-relaxed hidden md:block tracking-wide font-light">
                    {item.description}
                </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParticleInteraction;
