import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pause, Play, RotateCcw, Camera, Droplets, ChevronDown, Waves, SlidersHorizontal, ArrowUpRight, Eye, Activity } from 'lucide-react';
import { createRiverScene, type RiverScene } from './scene';
import { environments, environment, settingsFor, currentSpeed, waveNumber, constrainSettings, buildSpectrum, seaStates, seaStateSettings, type SimulationSettings, type WaterKind } from './system';
import './index.css';

type Parameter = 'discharge'|'depth'|'wind'|'sun'|'waveHeight'|'period'|'direction'|'choppiness'|'timeScale'|'clarity'|'variability';
function displayNumber(value:number) {return value>=1000?value.toLocaleString('en-US',{maximumFractionDigits:0}):value>=10?value.toFixed(1):value>0&&value<.1?value.toFixed(3):value.toFixed(2);}
export default function WaterSystem(){
    const [settings,setSettings]=useState<SimulationSettings>(()=>settingsFor('river',!window.matchMedia('(prefers-reduced-motion: reduce)').matches));
    const settingsRef=useRef(settings);settingsRef.current=settings;
    const host=useRef<HTMLDivElement>(null),engine=useRef<RiverScene|null>(null);
    const [ready,setReady]=useState(false),[error,setError]=useState(''),[panel,setPanel]=useState(true),[immersive,setImmersive]=useState(false);
    const [tab,setTab]=useState<'environment'|'waves'|'observe'>('environment');
    const env=environment(settings.kind),channel=settings.kind==='creek'||settings.kind==='river',isFlow=channel||settings.kind==='great-river';
    useEffect(()=>{
        const previous=document.title;document.title='万水 · 水流模拟系统';
        return()=>{document.title=previous;};
    },[]);
    useEffect(()=>{
        let cancelled=false,instance:RiverScene|null=null;
        setReady(false);setError('');
        async function initialize(){
            try {
                const create=channel?createRiverScene:(await import('./openScene')).createOpenScene;
                if(cancelled||!host.current)return;
                instance=create(host.current,()=>settingsRef.current,()=>{if(!cancelled)setReady(true);});
                engine.current=instance;
            }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'无法初始化 WebGL');}
        }
        initialize();
        return()=>{cancelled=true;instance?.dispose();engine.current=null;};
    },[settings.kind,channel]);
    const choose=(kind:WaterKind)=>{setSettings(s=>settingsFor(kind,s.playing));setTab('environment');};
    const change=(key:Parameter,value:number)=>setSettings(s=>constrainSettings({...s,[key]:value}));
    const velocity=currentSpeed(settings),k=waveNumber(settings.period,settings.depth),wavelength=2*Math.PI/k,phaseSpeed=wavelength/settings.period;
    const spectrum=buildSpectrum(settings),spectrumMax=Math.max(...spectrum.map(w=>w.amplitude*w.amplitude),.000001);
    const fields: [Parameter,string,number,number,number,string][] = tab==='environment' ? [
        ...(isFlow?[['discharge','断面流量',...env.flowRange,channel?.1:100,'m³/s'] as [Parameter,string,number,number,number,string]]:[]),
        ['depth',channel?'中心水深':'代表水深',...env.depthRange,channel?.01:1,'m'],
        ['wind','风速 U₁₀',0,35,.1,'m/s'],['sun','太阳高度',5,75,1,'°'],['clarity','水体清澈度',0,1,.01,''],
    ] : tab==='waves' ? [
        ['waveHeight','有效波高 Hs',...env.heightRange,channel?.005:.05,'m'],
        ['period','主周期 Tp',...env.periodRange,.1,'s'],['direction','波传播方向',0,359,1,'°'],
        ['choppiness','浪脊锐度',0,1,.01,''],
        ['variability','波群变化',0,1,.01,''],
    ] : [['timeScale','时间倍率',.25,3,.25,'×']];
    return <main className={`river-page water-system mode-${settings.kind} ${immersive?'water-immersive':''}`}>
        <div ref={host} className="river-canvas" role="img" aria-label={`${env.name}三维水流模拟，拖动旋转视角，点击水面产生扰动`}/>
        {!ready&&!error&&<div className="river-loading"><Waves size={32}/><p>正在构建{env.name}的水流与光影…</p></div>}
        {error&&<div className="river-loading" role="alert"><p>三维场景未能启动</p><small>{error}</small><p>请使用支持 WebGL 2 的浏览器并启用硬件加速。</p></div>}
        <header className="river-header">
            <div className="river-heading"><Link to="/" className="river-icon-button" aria-label="返回应用库"><ArrowLeft size={18}/></Link><div><p>WATER DYNAMICS / FROM STREAM TO SEA</p><h1>万水 <span>水流模拟系统</span></h1></div></div>
            <div className="river-actions"><button onClick={()=>setImmersive(v=>!v)} aria-label={immersive?'退出沉浸观景':'沉浸观景'}><Eye size={17}/><span>{immersive?'显示控制':'观景'}</span></button><button onClick={()=>setSettings(s=>({...s,playing:!s.playing}))} aria-label={settings.playing?'暂停模拟':'继续模拟'}>{settings.playing?<Pause size={16}/>:<Play size={16}/>}<span>{settings.playing?'暂停':'继续'}</span></button><button onClick={()=>engine.current?.screenshot()} disabled={!ready} aria-label="保存当前画面"><Camera size={17}/></button><button onClick={()=>setPanel(p=>!p)} aria-expanded={panel} aria-controls="river-controls" aria-label="显示或隐藏参数面板"><SlidersHorizontal size={17}/></button></div>
        </header>
        <nav className="water-environments" aria-label="水域类型">{environments.map((e,i)=><button key={e.id} className={e.id===settings.kind?'active':''} aria-pressed={e.id===settings.kind} onClick={()=>choose(e.id)}><small>0{i+1}</small><span>{e.name}<em>{e.english}</em></span><ArrowUpRight size={14}/></button>)}</nav>
        <section className="water-scene-title"><p>{env.english} / {channel?'SHALLOW WATER':'DIRECTIONAL WAVE SPECTRUM'}</p><h2>{env.name}<span>{settings.kind==='storm'?'浪起如山':settings.kind==='ocean'?'无边的起伏':settings.kind==='lake'?'风与水的回声':settings.kind==='great-river'?'奔流向远方':settings.kind==='creek'?'细流穿石':'一川流动'}</span></h2><p>{env.description}</p></section>
        <section className={`river-panel ${panel?'':'river-panel-hidden'}`} id="river-controls" aria-label="水流模拟参数" aria-hidden={!panel}>
            <div className="river-panel-title"><span><SlidersHorizontal size={16}/> 模拟控制台</span><button onClick={()=>setPanel(false)} aria-label="收起设置"><ChevronDown size={17}/></button></div>
            <div className="water-tabs" role="tablist" aria-label="参数分类">{([['environment','环境'],['waves','波浪'],['observe','观测']] as const).map(([id,label])=><button id={`tab-${id}`} key={id} role="tab" aria-selected={tab===id} aria-controls="water-tab-panel" onClick={()=>setTab(id)}>{label}</button>)}</div>
            <div id="water-tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
                {tab==='waves'&&<><div className="water-sea-states">{seaStates.map(state=>{const preset=seaStateSettings(settings,state);const selected=['waveHeight','period','wind','choppiness'].every(key=>Math.abs(settings[key]-preset[key])<.001);return <button key={state} aria-pressed={selected} onClick={()=>setSettings(s=>seaStateSettings(s,state))}>{state}</button>;})}</div><p className="water-note">波高与周期独立设定；超出水深或波陡约束时，自动降低波高。</p></>}
                {tab==='waves'&&<><button className="water-realization" onClick={()=>setSettings(s=>({...s,realization:(Math.imul(s.realization,1664525)+1013904223)>>>0}))}>换一组波群 ↗</button><p className="water-note">改变波群组合和相位，保留当前波高与海况。</p></>}<div className="river-fields">{fields.map(([key,label,min,max,step,unit])=><label key={key}><span>{label}<output>{displayNumber(settings[key])} <small>{unit}</small></output></span><input aria-label={label} type="range" min={Math.min(min,settings[key])} max={max} step={step} value={settings[key]} onChange={e=>change(key,Number(e.target.value))}/></label>)}</div>
                {tab==='observe'&&<><div className="water-views"><button onClick={()=>engine.current?.setView('surface')}><Eye size={14}/> 水面视角</button><button onClick={()=>engine.current?.setView('overview')}>俯瞰全景</button></div><label className="water-check"><input type="checkbox" checked={settings.vectors} onChange={e=>setSettings(s=>({...s,vectors:e.target.checked}))}/>{isFlow?'显示平均流向':'显示波传播方向'}</label><label className="water-check"><input type="checkbox" checked={settings.wireframe} onChange={e=>setSettings(s=>({...s,wireframe:e.target.checked}))}/>显示水面网格</label><p className="water-note">所有尺寸以米为单位。{!channel&&`参照浮标总高约 ${settings.kind==='storm'?6.8:3.4} 米，随局部水面起伏。`}</p></>}
            </div>
            <div className="river-readings"><div><small>{isFlow?'断面平均流速':'主波相速度'}</small><strong>{(isFlow?velocity:phaseSpeed).toFixed(2)}<span> m/s</span></strong></div><div><small>{isFlow?'弗劳德数':'主波波长'}</small><strong>{isFlow?(velocity/Math.sqrt(9.81*settings.depth)).toFixed(2):wavelength.toFixed(1)}<span>{isFlow?(velocity/Math.sqrt(9.81*settings.depth)<1?' 缓流':' 急流'):' m'}</span></strong></div></div>
            <button className="river-splash" disabled={!ready} onClick={()=>engine.current?.disturb()}><Droplets size={16}/> 施加局部扰动 <span>↗</span></button>
            <button className="river-reset" onClick={()=>{setSettings(settingsFor(settings.kind,settings.playing));engine.current?.reset();}}><RotateCcw size={13}/> 重置当前水域</button>
            <details className="river-model"><summary>物理模型与适用范围</summary><p>{channel?'浅水扰动采用交错网格、变水深通量和迎风输运，CFL 子步控制；方向性多频波列与细波按有限水深色散传播。':'三层 256 × 256 GPU 逆 FFT 演化方向性 JONSWAP 波谱，按 Hs = 4√m₀ 归一化。重力与表面张力色散随水深变化，水平位移形成尖锐浪脊。'}</p><p>{isFlow?'平均水流由 Q = U A 计算，波动叠加在背景流上。':'无外加平均流，风速改变谱峰增强、细波粗糙度及白沫覆盖。波高和周期由使用者独立指定，不代表自动风场预报。'}</p><p>均为实时近似。未求解完整三维湍流、翻卷破浪、飞溅体积、洪水淹没或岸边完整波反射；巨浪白沫由浪脊压缩生成并衰减，喷雾粒子遵循重力轨迹；两者均为视觉近似。</p></details>
        </section>
        <div className="water-monitor" aria-label="水域尺度与波浪诊断"><div><Activity size={13}/><span>{channel?'多频波列 + 局部扰动':'方向性风浪谱'}</span></div>{!channel&&<svg viewBox="0 0 180 34" role="img" aria-label="波谱形状预览"><path d={`M 0 33 ${spectrum.map((w,i)=>`L ${i*180/(spectrum.length-1)} ${32-w.amplitude*w.amplitude/spectrumMax*27}`).join(' ')} L 180 33`} fill="#d9e4bd22" stroke="#cedfc0" strokeWidth="1"/></svg>}<p>尺度 {env.width} × {env.length} m <span>·</span> Hs {displayNumber(settings.waveHeight)} m <span>·</span> Tp {settings.period.toFixed(1)} s</p></div>
        <footer className="river-footer"><div><span className={settings.playing?'river-live':'river-still'}/>{settings.playing?'实时模拟':'时间暂停'}<span className="river-footer-divider"/>{settings.timeScale.toFixed(2)}× · THREE.JS</div><p>拖动旋转 · 滚轮缩放 · 轻点水面施加扰动</p></footer>
    </main>;
}
