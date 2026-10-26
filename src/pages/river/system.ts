import { G, type RiverSettings } from './physics';
export type WaterKind = 'creek' | 'river' | 'lake' | 'great-river' | 'ocean' | 'storm';
export interface SimulationSettings extends RiverSettings {
    kind: WaterKind;
    variability: number;
    realization: number;
    waveHeight: number;
    period: number;
    direction: number;
    choppiness: number;
    timeScale: number;
    clarity: number;
    vectors: boolean;
    wireframe: boolean;
}
export interface WaterEnvironment {
    id: WaterKind; name: string; english: string; description: string; width: number; length: number;
    depthRange: [number, number]; flowRange: [number, number]; heightRange: [number, number]; periodRange: [number, number];
    defaults: Omit<SimulationSettings, 'kind' | 'playing' | 'vectors' | 'wireframe'>;
}
const common = { variability:.7, realization:731942, sun: 35, direction: 175, choppiness: .65, timeScale: 1, clarity: .6 };
export const environments: WaterEnvironment[] = [
    { id:'creek',name:'小溪',english:'CREEK',description:'浅滩、卵石与细小湍动',width:3,length:36,depthRange:[.2,.8],flowRange:[.2,5],heightRange:[0,.12],periodRange:[.5,3],defaults:{...common,discharge:1.3,depth:.32,wind:1,waveHeight:.025,period:1.2,clarity:.9} },
    { id:'river',name:'小河',english:'RIVER',description:'连续河流与岸边波纹',width:12,length:64,depthRange:[.3,2],flowRange:[.5,14],heightRange:[0,.35],periodRange:[.7,4],defaults:{...common,discharge:4.8,depth:.65,wind:1.8,waveHeight:.06,period:1.8,clarity:.8} },
    { id:'lake',name:'湖泊',english:'LAKE',description:'封闭水域上的风生波与涟漪',width:460,length:660,depthRange:[2,40],flowRange:[0,0],heightRange:[0,2],periodRange:[1.5,6],defaults:{...common,discharge:0,depth:12,wind:3,waveHeight:.3,period:3.2,direction:125,clarity:.7} },
    { id:'great-river',name:'大江',english:'GREAT RIVER',description:'宽阔断面、强流与风浪叠加',width:180,length:1400,depthRange:[3,30],flowRange:[200,12000],heightRange:[0,3],periodRange:[1.5,7],defaults:{...common,discharge:3800,depth:12,wind:6,waveHeight:.65,period:3.8,clarity:.2} },
    { id:'ocean',name:'大海',english:'OPEN OCEAN',description:'远海涌浪与方向性风浪',width:2000,length:2000,depthRange:[10,500],flowRange:[0,0],heightRange:[0,8],periodRange:[2,18],defaults:{...common,discharge:0,depth:120,wind:9,waveHeight:1.8,period:7,direction:155,clarity:.85} },
    { id:'storm',name:'巨浪',english:'STORM SEA',description:'长周期巨浪、尖锐浪脊与白沫',width:2600,length:2600,depthRange:[30,1000],flowRange:[0,0],heightRange:[0,25],periodRange:[6,22],defaults:{...common,discharge:0,depth:240,wind:25,waveHeight:14,period:13,direction:160,choppiness:1,sun:18,clarity:.7} },
];
export function environment(kind: WaterKind) { return environments.find(e=>e.id===kind)!; }
export function settingsFor(kind: WaterKind, playing=true): SimulationSettings {
    return { ...environment(kind).defaults,kind,playing,vectors:false,wireframe:false };
}
export function currentSpeed(s: SimulationSettings) {
    return s.discharge / (environment(s.kind).width * s.depth * (s.kind==='great-river'?.7: .35+.65*2/3));
}
export function waveNumber(period: number, depth: number) {
    const omega=2*Math.PI/period, target=omega*omega;
    let lo=0,hi=Math.max(target/G,omega/Math.sqrt(G*depth))*3;
    for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(G*mid*Math.tanh(mid*depth)>target)hi=mid;else lo=mid;}
    return (lo+hi)/2;
}
export function waveLimit(s: SimulationSettings) {
    const k=waveNumber(s.period,s.depth);
    return Math.min(s.depth*.45, .09*(2*Math.PI/k)*Math.tanh(k*s.depth));
}
export function constrainSettings(s: SimulationSettings): SimulationSettings {
    const step=s.kind==='creek'||s.kind==='river'?.005:.05;
    const height=Math.max(0,Math.min(s.waveHeight,waveLimit(s)));
    return { ...s,waveHeight:Math.floor((height+1e-9)/step)*step };
}
export const seaStates = ['平静','微澜','强风','风暴'] as const;
export type SeaState = typeof seaStates[number];
/** Paired Hs/Tp sea states: storm is a steep wind sea, rather than a long gentle swell. */
export function seaStateSettings(s:SimulationSettings,state:SeaState):SimulationSettings {
    const pairs:Record<WaterKind,[number,number][]>= {
        creek:[[0,1],[.015,.7],[.04,.85],[.09,1.1]],
        river:[[0,1.8],[.04,1.1],[.12,1.4],[.28,1.8]],
        lake:[[0,3],[.12,2],[.55,2.6],[1.2,3.2]],
        'great-river':[[0,3],[.2,2.5],[.8,3.2],[2.2,4.2]],
        ocean:[[0,7],[.25,3.5],[2.5,6],[6.5,8.5]],
        storm:[[0,7],[.35,6],[6,8.5],[18,11.5]],
    };
    const index=seaStates.indexOf(state),[waveHeight,period]=pairs[s.kind][index];
    return constrainSettings({...s,waveHeight,period,wind:[0,2.5,13,30][index],choppiness:[0,.25,.75,1][index]});
}
export interface WaveComponent { dx:number; dz:number; k:number; amplitude:number; omega:number; phase:number; horizontal:number }
export const WAVE_COUNT=48;
/** A discretized, directionally spread JONSWAP-shaped spectrum, not a spectral evolution solver.
 * Variance is normalized to m0=Hs²/16; finite-depth dispersion is solved numerically.
 * Gerstner horizontal displacement is globally limited to prevent surface folding.
 */
export function buildSpectrum(settings: SimulationSettings): WaveComponent[] {
    const s=constrainSettings(settings), wp=2*Math.PI/s.period;
    // Log bands retain both long swell and short wind waves. Integrate S(omega) d omega.
    const frequencies=Array.from({length:WAVE_COUNT},(_,i)=>wp*.55*Math.pow(5/.55,i/(WAVE_COUNT-1)));
    const gamma=1+2.3*Math.min(s.wind/12,1);
    const weights=frequencies.map((w,i)=>{
        const sigma=w<=wp?.07:.09, r=Math.exp(-Math.pow((w-wp)/(sigma*wp),2)/2);
        const dw=w*(Math.pow(5/.55,1/(WAVE_COUNT-1))-1);
        return Math.pow(w,-5)*Math.exp(-1.25*(wp/w)**4)*Math.pow(gamma,r)*dw;
    });
    const total=weights.reduce((a,b)=>a+b,0), variance=s.waveHeight*s.waveHeight/16;
    const waves=frequencies.map((omega,i)=>{
        const spread=(s.kind==='storm'?.55:.32)+Math.min(s.wind/50,.25);
        const random=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
        const angle=s.direction*Math.PI/180 + (random(i+9)*2-1)*spread*(omega>wp?1.5:1);

        return {dx:Math.sin(angle),dz:Math.cos(angle),k:waveNumber(2*Math.PI/omega,s.depth),amplitude:Math.sqrt(2*variance*weights[i]/total),omega,phase:random(i+137)*2*Math.PI,horizontal:0};
    });
    const slope=waves.reduce((a,w)=>a+w.amplitude*w.k,0);
    waves.forEach(w=>w.horizontal=s.choppiness*.72/Math.max(slope,1e-9));
    return waves;
}
export function sampleSurface(waves: WaveComponent[],x:number,z:number,time:number,current=0) {
    let height=0,dx=0,dz=0,jacobian=1;
    waves.forEach(w=>{
        const phase=w.k*(w.dx*x+w.dz*z)-(w.omega+w.k*w.dz*current)*time+w.phase;
        height+=w.amplitude*Math.sin(phase);
        dx+=w.dx*w.amplitude*w.horizontal*Math.cos(phase);
        dz+=w.dz*w.amplitude*w.horizontal*Math.cos(phase);
        jacobian-=w.horizontal*w.amplitude*w.k*Math.sin(phase);
    });
    return {height,dx,dz,jacobian};
}
