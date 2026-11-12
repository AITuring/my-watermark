import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import WatermarkEditor from '/src/pages/watermark/components/WatermarkEditor';
import WatermarkFontPicker from '/src/pages/watermark/components/WatermarkFontPicker';
import WatermarkLayoutControl from '/src/pages/watermark/components/WatermarkLayoutControl';
import {createTextWatermark} from '/src/utils/text-watermark';
import {extractWatermarkCaption} from '/src/pages/watermark/filename-watermark';
import type {MixedWatermarkConfig, WatermarkPosition} from '/src/types';
import '/src/index.css';

const filenames = [
    '唐-韩休墓北壁《山水图》-2013年西安少陵原唐韩休墓出土-陕西历史博物馆藏-未标题-215.jpg',
    '北宋-祁序《江山放牧图卷》-故宫博物院藏-合成图层清晰度差一些-tm_20261112_001.jpg',
    '南宋-马远梅石溪凫图-故宫博物院藏-尺寸小颜色好-DSC_0123.jpg',
];
const caption = extractWatermarkCaption(filenames[0])!;
const initial: MixedWatermarkConfig = {enabled:true, icon:'/watermark-symbol.png', textOnly:true, ...caption,
    fontSize:30, color:'#443b31', gap:20, layout:'horizontal'};

function Fixture() {
    const [config,setConfig] = useState(initial);
    const [url,setUrl] = useState('');
    const [background,setBackground] = useState('');
    const [zoom,setZoom] = useState(1);
    const [position,setPosition] = useState<WatermarkPosition>({id:'first',x:.06,y:.12,scaleX:4,scaleY:4,rotation:0});
    const [error,setError] = useState('');
    const [filename,setFilename] = useState(filenames[0]);
    useEffect(() => {
        const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=800;
        const context=canvas.getContext('2d')!;
        context.fillStyle='#d8ccae';context.fillRect(0,0,1200,800);
        context.strokeStyle='#8f9a89';context.lineWidth=2;
        for(let i=0;i<15;i++) {
            context.beginPath();context.moveTo(400+i*50,800);context.bezierCurveTo(300+i*30,550,700+i*15,500,500+i*40,200);context.stroke();
        }
        setBackground(canvas.toDataURL());
    },[]);
    useEffect(() => {
        let cancelled=false;
        void createTextWatermark(config).then(next=>{if(!cancelled)setUrl(next);}).catch(error=>setError(String(error)));
        return ()=>{cancelled=true;};
    },[config]);
    return <main style={{height:'100dvh',width:'100vw',display:'flex',flexDirection:'column',background:'#f5f5f4',padding:16,gap:12}}>
        <h1 style={{margin:0,fontSize:18}}>水印原位编辑验证</h1>
        <p style={{margin:0}}>点击标题或说明原位编辑 · Enter 确认 · Esc 取消 · 点击外部保存 · 按住拖动水印</p>
        <label style={{display:'flex',gap:8}}>原文件名 <select aria-label="测试文件名" value={filename} style={{minWidth:0,flex:1}} onChange={event=>{
            setFilename(event.target.value);setConfig({...initial,...extractWatermarkCaption(event.target.value)});
            setPosition({...position,id:event.target.value,x:.06,y:.08,scaleX:4});
        }}>{filenames.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
        <div style={{display:'flex',gap:16}}>
            <label>排版 <select aria-label="测试排版" value={config.layout} onChange={event=>{
                const layout=event.target.value as 'horizontal'|'vertical';
                setConfig({...config,layout});setPosition({...position,x:.06,y:.08,scaleX:layout==='vertical'?.6:4});
            }}><option value="horizontal">横排</option><option value="vertical">竖排</option></select></label>
            <label><input type="checkbox" checked={!config.textOnly} onChange={event=>setConfig({...config,textOnly:!event.target.checked})}/>包含图标</label>
            <button onClick={()=>setZoom(zoom===1?1.5:1)}>预览缩放 {zoom}</button>
            <button onClick={()=>{setConfig(initial);setPosition({...position,id:position.id==='first'?'second':'first',x:.06,y:.12,scaleX:4});}}>切换图片</button>
        </div>
        <div style={{display:'flex',gap:16}}>
            <WatermarkFontPicker value={config.fontId} text={config.textLine1+config.textLine2} onChange={fontId=>setConfig({...config,fontId,captionFontId:fontId})}/>
            <WatermarkLayoutControl config={config} onChange={patch=>setConfig(previous=>({...previous,...patch}))}/>
        </div>
        <output aria-label="当前文字">{JSON.stringify({textLine1:config.textLine1,textLine2:config.textLine2})}</output>
        {error && <p role="alert">{error}</p>}
        <WatermarkEditor watermarkUrl={url} textConfig={config} onTextChange={patch=>setConfig(previous=>({...previous,...patch}))}
            backgroundPreviewUrl={background} backgroundOriginalWidth={1200} currentWatermarkPosition={position}
            onTransform={setPosition} onAllTransform={setPosition} onSmartPosition={async()=>{}}
            previewZoom={zoom} onPreviewZoomChange={setZoom}/>
    </main>;
}

createRoot(document.getElementById('root')!).render(<Fixture/>);
