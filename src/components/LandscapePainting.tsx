import React from "react";

interface Props {
  width?: number;
  height?: number;
  seed?: string;
}

type LayerSpec = { baseYRatio: number; count: number; opacity: number; blurStd: number; scale: number };
interface Config {
  layers: LayerSpec[];
  qingColors: [string, string, string];
  goldStroke: string;
  inkStroke: string;
  cun: { density: number; len: [number, number]; slopeRange: [number, number]; flyWhite: number };
  masses: { concavity: number; hRange: [number, number]; wJitter: number; slopeBias: number; ridge: { count: number; strength: number } };
  foreground: { density: number; types: ("pine" | "willow" | "bush")[] };
  paper: { top: string; bottom: string; opacity: number };
  mist: { topYRatio: number; heightRatio: number; opacity: number; slices?: number };
  water: { enabled: boolean; color: string; shoalColor: string; opacity: number };
  lighting?: { leftBoost: number; rightShade: number };
  sub: { lobeCount: [number, number]; overlap: number; azureOpacity: number };
}
const defaultConfig: Config = {
  layers: [
    { baseYRatio: 0.80, count: 6, opacity: 0.72, blurStd: 0, scale: 1.0 },
    { baseYRatio: 0.68, count: 5, opacity: 0.50, blurStd: 12, scale: 0.92 },
    { baseYRatio: 0.58, count: 4, opacity: 0.30, blurStd: 16, scale: 0.85 }
  ],
  qingColors: ["#0D6153", "#1A8F78", "#8CC769"],
  goldStroke: "#D3A84E",
  inkStroke: "#1f332f",
  cun: { density: 36, len: [4, 10], slopeRange: [0.50, 1.05], flyWhite: 0.10 },
  masses: { concavity: 0.60, hRange: [0.28, 0.42], wJitter: 0.24, slopeBias: -0.12, ridge: { count: 4, strength: 1.0 } },
  foreground: { density: 0.30, types: ["pine", "willow", "bush"] },
  paper: { top: "#B8924A", bottom: "#E2CFA6", opacity: 0.38 },
  mist: { topYRatio: 0.16, heightRatio: 0.60, opacity: 0.32, slices: 6 },
  water: { enabled: true, color: "#78B6C4", shoalColor: "#9FD7C2", opacity: 0.35 },
  lighting: { leftBoost: 0.10, rightShade: 0.12 },
  sub: { lobeCount: [2, 4], overlap: 0.18, azureOpacity: 0.32 }
};

function makeRng(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h >>> 13;
    h ^= h << 17;
    h ^= h >>> 5;
    return (h >>> 0) / 4294967295;
  };
}

/** ----------- 2. 生成中国山水折线山脉（《千里江山图》风格）------------ **/
function generateMountainPath(
  width: number,
  height: number,
  baseY: number,
  strength: number, // 山体高度
  rnd: () => number
) {
  let path = `M 0 ${baseY}`;
  const step = width / 40;

  for (let x = 0; x <= width; x += step) {
    const t = x / width;

    // 千里江山图特征：折带皴（线性增长 + 噪声）
    const base = baseY - strength * Math.pow(t, 0.7);

    // 线条噪声（更具山体棱角）
    const noise = (rnd() - 0.5) * (strength * 0.2);

    path += ` L ${x} ${base + noise}`;
  }

  path += ` L ${width} ${baseY} Z`;
  return path;
}

/** ----------- 3. 披麻皴（顺着山势方向的短线）------------ **/
function generatePimaLines(
  width: number,
  height: number,
  baseY: number,
  strength: number,
  rnd: () => number
) {
  const lines: string[] = [];
  const count = 200;

  for (let i = 0; i < count; i++) {
    const x = rnd() * width;
    const t = x / width;
    const yBase = baseY - strength * Math.pow(t, 0.7);
    const y = yBase + (rnd() - 0.5) * 20;

    const len = 10 + rnd() * 20;
    const dx = len;
    const dy = -len * (0.3 + rnd() * 0.3);

    // 飞白破裂
    if (rnd() < 0.2) continue;

    lines.push(`M ${x} ${y} l ${dx} ${dy}`);
  }

  return lines;
}

/** ----------- 4. 云雾层（渐变 + blur）------------ **/
function renderCloudLayer(width: number, height: number, opacity: number, id: string) {
  return (
    <g filter="url(#blurCloud)">
      <rect
        x={0}
        y={height * 0.2}
        width={width}
        height={height * 0.4}
        fill={`url(#cloudGrad-${id})`}
        opacity={opacity}
      />
    </g>
  );
}

/** ----------- 5. 小型符号（松树 / 屋舍等）------------ **/

// 松树（极简）
function PineTree(x: number, y: number) {
  return (
    <path
      d={`M ${x} ${y}
          l -10 20
          l 20 0
          Z
          M ${x} ${y + 10}
          l -8 18
          l 16 0
          Z`}
      fill="rgba(40,80,40,0.8)"
    />
  );
}

// 小屋
function SmallHouse(x: number, y: number) {
  return (
    <g fill="rgba(80,60,40,0.8)">
      <path d={`M ${x} ${y} l 20 0 l 0 12 l -20 0 Z`} />
      <path d={`M ${x - 2} ${y} l 12 -8 l 12 8 Z`} />
    </g>
  );
}

/** ============ 主组件 ================ **/

const LandscapePainting: React.FC<Props> = ({ width = 800, height = 600, seed = "default" }) => {
  const W = width, H = height, sx = W / 600, sy = H / 360;
  const rnd = makeRng(seed);
  const defaultConfig: Config = {
    layers: [
      { baseYRatio: 0.80, count: 6, opacity: 0.72, blurStd: 0, scale: 1.0 },
      { baseYRatio: 0.68, count: 5, opacity: 0.50, blurStd: 12, scale: 0.92 },
      { baseYRatio: 0.58, count: 4, opacity: 0.30, blurStd: 16, scale: 0.85 }
    ],
    qingColors: ["#0D6153", "#1A8F78", "#8CC769"],
    goldStroke: "#D3A84E",
    inkStroke: "#1f332f",
    cun: { density: 34, len: [5, 12], slopeRange: [0.45, 1.0], flyWhite: 0.12 },
    masses: { concavity: 0.55, hRange: [0.26, 0.38], wJitter: 0.22, slopeBias: -0.12, ridge: { count: 3, strength: 1.0 } },
    foreground: { density: 0.25, types: ["pine"] },
    paper: { top: "#B8924A", bottom: "#E2CFA6", opacity: 0.35 },
    mist: { topYRatio: 0.18, heightRatio: 0.55, opacity: 0.35 },
    water: { enabled: true, color: "#78B6C4", shoalColor: "#9FD7C2", opacity: 0.35 },
    sub: { lobeCount: [2, 4], overlap: 0.18, azureOpacity: 0.32 }
  };
  const cfg: Config = defaultConfig;

  function genRanges(baseY: number, spec: LayerSpec) {
    const groups = Math.max(2, Math.floor(spec.count / 3));
    const arr: { path: string; boundary: string; ridges: string[]; ribs: string[]; shade: string; light: string; cap: string; cun: string[]; platform: { x: number; y: number }; grad: { x: number; yTop: number; yBase: number }; lobes: { path: string; opacity: number }[]; contours: string[] }[] = [];
    let cur = W * 0.06, tot = W * 0.88, gw = tot / groups;
    for (let g = 0; g < groups; g++) {
      const w = gw * (0.9 + rnd() * 0.2) * spec.scale;
      const h = H * (cfg.masses.hRange[0] + rnd() * (cfg.masses.hRange[1] - cfg.masses.hRange[0])) * spec.scale;
      const xL = cur + gw * 0.08 + rnd() * gw * 0.06;
      const xR = xL + w;
      const cx = (xL + xR) / 2 + (rnd() - 0.5) * w * 0.1;
      const y0 = baseY - H * (0.02 + rnd() * 0.03);
      cur += gw;
      const s = -cfg.masses.concavity + rnd() * 2 * cfg.masses.concavity + cfg.masses.slopeBias;
      const p1 = `${xL} ${y0}`;
      const c1 = `${xL + w * 0.20} ${y0 - h * 0.40}`;
      const c2 = `${cx - w * 0.28} ${y0 - h * (0.80 + s * 0.10)}`;
      const p2 = `${cx} ${y0 - h}`;
      const c3 = `${cx + w * 0.30} ${y0 - h * (0.78 + s * 0.08)}`;
      const c4 = `${xR - w * 0.22} ${y0 - h * 0.42}`;
      const p3 = `${xR} ${y0}`;
      const c5 = `${xR - w * 0.35} ${y0 + h * 0.06}`;
      const c6 = `${xL + w * 0.28} ${y0 + h * 0.04}`;
      const p4 = `${xL} ${y0}`;
      const path = `M ${p1} C ${c1}, ${c2}, ${p2} C ${c3}, ${c4}, ${p3} C ${c5}, ${c6}, ${p4} Z`;
      const boundary = `M ${p1} C ${c1}, ${c2}, ${p2} C ${c3}, ${c4}, ${p3}`;
      const ridges: string[] = [];
      const ribs: string[] = [];
      for (let r = 0; r < cfg.masses.ridge.count; r++) {
        const rx = xL + w * (0.28 + r * 0.12);
        const ry = y0 - h * (0.85 - r * 0.12);
        const r2x = cx + w * (0.06 + r * 0.08);
        const r2y = y0 - h * (0.62 - r * 0.08);
        const r3x = xR - w * (0.20 - r * 0.06);
        const r3y = y0 - h * (0.36 - r * 0.06);
        ridges.push(`M ${rx} ${ry} Q ${r2x} ${r2y} ${r3x} ${r3y}`);
        ribs.push(`M ${rx + 6 * sx} ${ry + 4 * sy} Q ${r2x + 8 * sx} ${r2y + 4 * sy} ${r3x + 10 * sx} ${r3y + 6 * sy}`);
        ribs.push(`M ${rx - 6 * sx} ${ry + 6 * sy} Q ${r2x - 6 * sx} ${r2y + 6 * sy} ${r3x - 8 * sx} ${r3y + 8 * sy}`);
      }
      const shade = `M ${cx + w * 0.06} ${y0 - h * 0.18} L ${xR - w * 0.20} ${y0 - h * 0.44} L ${xR - w * 0.08} ${y0 - h * 0.28} L ${cx} ${y0 - h * 0.08} Z`;
      const light = `M ${p1} C ${c1}, ${c2}, ${p2} L ${xL + w * 0.28} ${y0 + h * 0.04} L ${p1} Z`;
      const cap = `M ${cx - w * 0.20} ${y0 - h * 0.88} L ${cx + w * 0.24} ${y0 - h * 0.70} L ${cx + w * 0.10} ${y0 - h * 0.60} L ${cx - w * 0.28} ${y0 - h * 0.74} Z`;
      const n = Math.floor((cfg.cun.density * 1.2 + rnd() * cfg.cun.density) * spec.scale);
      const cun: string[] = [];
      for (let k = 0; k < n; k++) {
        const t = rnd();
        const x = xL + w * (0.12 + t * 0.76);
        const y = y0 - h * (0.22 + t * 0.72) + (rnd() - 0.5) * 6 * sy;
        const sdir = cfg.cun.slopeRange[0] + t * (cfg.cun.slopeRange[1] - cfg.cun.slopeRange[0]) + s * 0.16;
        const len = (cfg.cun.len[0] + rnd() * (cfg.cun.len[1] - cfg.cun.len[0])) * sx;
        const dx = len, dy = -len * sdir;
        if (rnd() < cfg.cun.flyWhite) continue;
        cun.push(`M ${x} ${y} L ${x + dx} ${y + dy}`);
      }
      const platform = { x: cx - w * 0.08, y: y0 - h * 0.28 };
      const lobeCount = Math.max(cfg.sub.lobeCount[0], Math.floor(cfg.sub.lobeCount[0] + rnd() * (cfg.sub.lobeCount[1] - cfg.sub.lobeCount[0])));
      const lobes: { path: string; opacity: number }[] = [];
      const contours: string[] = [];
      for (let m = 0; m < lobeCount; m++) {
        const t = 0.22 + m / lobeCount * 0.6 + (rnd() - 0.5) * 0.08;
        const lx = xL + w * t;
        const ly = y0 - h * (0.58 + (rnd() - 0.5) * 0.12);
        const lw = w * (0.18 + rnd() * 0.12);
        const lh = h * (0.24 + rnd() * 0.12);
        const lp1 = `${lx - lw * 0.50} ${ly + lh * 0.10}`;
        const lc1 = `${lx - lw * 0.20} ${ly - lh * 0.20}`;
        const lc2 = `${lx + lw * 0.20} ${ly - lh * 0.35}`;
        const lp2 = `${lx + lw * 0.50} ${ly}`;
        const lc3 = `${lx + lw * 0.36} ${ly + lh * 0.22}`;
        const lc4 = `${lx - lw * 0.28} ${ly + lh * 0.30}`;
        const lp3 = `${lx - lw * 0.50} ${ly + lh * 0.10}`;
        lobes.push({ path: `M ${lp1} C ${lc1}, ${lc2}, ${lp2} C ${lc3}, ${lc4}, ${lp3} Z`, opacity: cfg.sub.azureOpacity });
        const cx1 = lx - lw * 0.30, cy1 = ly + lh * 0.05;
        const cx2 = lx + lw * 0.30, cy2 = ly - lh * 0.18;
        contours.push(`M ${cx1} ${cy1} L ${cx2} ${cy2}`);
      }
      arr.push({ path, boundary, ridges, ribs, shade, light, cap, cun, platform, grad: { x: cx, yTop: y0 - h, yBase: y0 }, lobes, contours });
    }
    return arr;
  }

  function Pine(x: number, y: number, s: number) {
    const t = 10 * sx * s, h = 24 * sy * s;
    return (
      <g stroke="#13493F" strokeWidth={0.9 * sx} fill="none">
        <path d={`M ${x} ${y} L ${x} ${y + h}`} />
        <path d={`M ${x - t * 1.2} ${y + h * 0.3} L ${x} ${y + h * 0.15} L ${x + t * 1.2} ${y + h * 0.3}`} />
        <path d={`M ${x - t * 1.4} ${y + h * 0.55} L ${x} ${y + h * 0.40} L ${x + t * 1.4} ${y + h * 0.55}`} />
        <path d={`M ${x - t * 1.0} ${y + h * 0.80} L ${x} ${y + h * 0.65} L ${x + t * 1.0} ${y + h * 0.80}`} />
      </g>
    );
  }

  function House(x: number, y: number, s: number) {
    const w = 28 * sx * s, h = 12 * sy * s;
    return (
      <g>
        <path d={`M ${x} ${y} l ${w} 0 l 0 ${h} l ${-w} 0 Z`} fill="rgba(80,60,40,0.85)" />
        <path d={`M ${x - 2 * sx} ${y} l ${w * 0.5} ${-h * 0.9} l ${w * 0.5} ${h * 0.9} Z`} fill="#D3A84E" />
      </g>
    );
  }

  function Pavilion(x: number, y: number, s: number) {
    const w = 22 * sx * s, h = 10 * sy * s;
    return (
      <g>
        <path d={`M ${x} ${y} l ${w} 0 l 0 ${h} l ${-w} 0 Z`} fill="rgba(90,70,50,0.85)" />
        <path d={`M ${x - 2 * sx} ${y} l ${w * 0.5} ${-h} l ${w * 0.5} ${h} Z`} fill={cfg.goldStroke} />
      </g>
    );
  }

  function renderWater() {
    if (!cfg.water.enabled) return null;
    const y = H * 0.84;
    return (
      <g opacity={cfg.water.opacity}>
        <path d={`M 0 ${y} C ${W * 0.18} ${y - 8}, ${W * 0.42} ${y - 16}, ${W * 0.56} ${y - 10} C ${W * 0.72} ${y + 8}, ${W * 0.88} ${y + 6}, ${W} ${y - 8} L ${W} ${H} L 0 ${H} Z`} fill={cfg.water.color} />
        <path d={`M ${W * 0.12} ${y - 5} L ${W * 0.18} ${y - 3} L ${W * 0.22} ${y - 8} L ${W * 0.16} ${y - 10} Z`} fill={cfg.water.shoalColor} />
        <path d={`M ${W * 0.60} ${y - 4} L ${W * 0.66} ${y - 2} L ${W * 0.70} ${y - 7} L ${W * 0.64} ${y - 9} Z`} fill={cfg.water.shoalColor} />
        <g opacity={0.6}>
          <circle cx={W * 0.28} cy={y - 6} r={3 * sx} fill="#cfe7df" />
          <circle cx={W * 0.32} cy={y - 6} r={3 * sx} fill="#cfe7df" />
          <circle cx={W * 0.66} cy={y - 7} r={3 * sx} fill="#cfe7df" />
        </g>
      </g>
    );
  }

  function renderMistSlices() {
    const slices = cfg.mist.slices || 5;
    const elements = [] as JSX.Element[];
    for (let i = 0; i < slices; i++) {
      const w = W * (0.25 + rnd() * 0.25);
      const x = W * (rnd() * 0.7);
      const y = H * (cfg.mist.topYRatio + rnd() * (cfg.mist.heightRatio * 0.8));
      elements.push(
        <g key={i} opacity={cfg.mist.opacity * (0.9 - i * 0.08)} filter={`url(#${specs[Math.min(2, 1 + i % specs.length)].id})`}>
          <rect x={x} y={y} width={w} height={H * 0.12} fill="url(#mistGrad)" />
        </g>
      );
    }
    return elements;
  }

  const specs = cfg.layers.map((ls, i) => ({ ...ls, baseY: H * ls.baseYRatio, id: `blur-${i}` }));
  const L = specs.map(sp => ({ ...sp, blocks: genRanges(sp.baseY, sp) }));

  const nearBlocks = L[0]?.blocks || [];
  const fgCount = Math.max(1, Math.floor(nearBlocks.length * cfg.foreground.density));

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="qinglu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cfg.qingColors[0]} />
          <stop offset="70%" stopColor={cfg.qingColors[1]} />
          <stop offset="100%" stopColor={cfg.qingColors[2]} />
        </linearGradient>
        <linearGradient id="azureTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A8F78" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <linearGradient id="paperWarm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cfg.paper.top} />
          <stop offset="100%" stopColor={cfg.paper.bottom} />
        </linearGradient>
        <linearGradient id="mistGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="ink"><feTurbulence baseFrequency="0.8" numOctaves="5" /><feDisplacementMap in="SourceGraphic" scale="3" /></filter>
        <filter id="grainInk"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" /><feColorMatrix type="saturate" values="0.4" /></filter>
        {specs.map(sp => (
          <filter id={sp.id} key={sp.id}><feGaussianBlur stdDeviation={sp.blurStd} /></filter>
        ))}
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="url(#paperWarm)" opacity={cfg.paper.opacity} />
      {renderMistSlices()}
      {L.map((l, i) => (
        <g key={i} opacity={l.opacity} filter={l.blurStd > 0 ? `url(#${l.id})` : undefined}>
          {l.blocks.map((b, bi) => {
            const gid = `g-${i}-${bi}`;
            return (
              <g key={bi}>
                <defs>
                  <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={b.grad.x} y1={b.grad.yTop} x2={b.grad.x} y2={b.grad.yBase}>
                    <stop offset="0%" stopColor={cfg.qingColors[0]} />
                    <stop offset="60%" stopColor={cfg.qingColors[1]} />
                    <stop offset="100%" stopColor={cfg.qingColors[2]} />
                  </linearGradient>
                </defs>
                <path d={b.path} fill={`url(#${gid})`} stroke={cfg.goldStroke} strokeWidth={1.6 * sx} />
                <path d={b.boundary} fill="none" stroke={cfg.inkStroke} strokeWidth={1.0 * sx} filter="url(#ink)" />
                {b.ridges.map((rd, ri) => (
                  <path key={ri} d={rd} fill="none" stroke="#1a4f45" strokeWidth={0.8 * sx} />
                ))}
                {b.lobes.map((lo, lj) => (
                  <path key={`lo-${lj}`} d={lo.path} fill="url(#azureTop)" opacity={lo.opacity} />
                ))}
                {b.contours.map((ct, cj) => (
                  <path key={`ct-${cj}`} d={ct} fill="none" stroke="#29433c" strokeWidth={0.7 * sx} opacity={0.5} />
                ))}
                <path d={b.cap} fill="url(#azureTop)" opacity={0.25} />
                <path d={b.light} fill="#ffffff" opacity={cfg.lighting?.leftBoost || 0.08} />
                <path d={b.shade} fill="#14322E" opacity={cfg.lighting?.rightShade || 0.12} filter="url(#grainInk)" />
                {b.ribs.map((rb, ri) => (
                  <path key={`rb-${ri}`} d={rb} fill="none" stroke="#1c3f39" strokeWidth={0.6 * sx} opacity={0.5} />
                ))}
                {b.cun.map((d, ci) => (
                  <path key={ci} d={d} stroke="#13493F" strokeWidth={0.8 * sx} fill="none" />
                ))}
              </g>
            );
          })}
        </g>
      ))}
      {renderWater()}
      {nearBlocks.slice(0, Math.max(1, Math.floor(fgCount))).map((b, i) => {
        const s = 0.9 + rnd() * 0.5, x = b.platform.x, y = b.platform.y;
        const Willow = (wx: number, wy: number, k: number) => (
          <g stroke="#1c3f39" strokeWidth={0.6 * sx}>
            <path d={`M ${wx} ${wy} L ${wx} ${wy + 22 * sy * k}`} />
            <path d={`M ${wx} ${wy + 6 * sy * k} Q ${wx - 10 * sx * k} ${wy + 12 * sy * k} ${wx - 6 * sx * k} ${wy + 20 * sy * k}`} />
            <path d={`M ${wx} ${wy + 8 * sy * k} Q ${wx + 10 * sx * k} ${wy + 14 * sy * k} ${wx + 6 * sx * k} ${wy + 22 * sy * k}`} />
          </g>
        );
        const Bush = (bx: number, by: number, k: number) => (
          <g fill="#1a3b34" opacity={0.7}>
            <circle cx={bx} cy={by} r={3 * sx * k} />
            <circle cx={bx + 5 * sx * k} cy={by + 2 * sy * k} r={2.6 * sx * k} />
            <circle cx={bx - 4 * sx * k} cy={by + 3 * sy * k} r={2.4 * sx * k} />
          </g>
        );
        return [
          Pine(x - 12 * sx, y, s * 0.9),
          Willow(x + 10 * sx, y + 4 * sy, 0.9),
          Bush(x + 24 * sx, y - 2 * sy, 0.8)
        ];
      })}
    </svg>
  );
};

export default LandscapePainting;
