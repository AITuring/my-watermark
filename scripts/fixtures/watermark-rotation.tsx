import React, {useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import Konva from 'konva';
import WatermarkEditor from '/src/pages/watermark/components/WatermarkEditor';
import {createDefaultWatermarkPosition, buildImagesWithPositions} from '/src/pages/watermark/helpers';
import type {WatermarkPosition} from '/src/types';
import '/src/index.css';

const ids = ['A', 'B', 'C'];
const backgrounds = ids.map((id, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 800;
    const context = canvas.getContext('2d')!;
    context.fillStyle = ['#d8ccae', '#b6c8c8', '#c8b6c8'][index];
    context.fillRect(0, 0, 1200, 800);
    context.fillStyle = '#343434'; context.font = '100px serif';
    context.fillText(id, 80, 150);
    return canvas.toDataURL();
});
const pause = () => new Promise(resolve => setTimeout(resolve, 50));
async function until(check: () => boolean, message: string) {
    for (let i = 0; i < 100; i++) {if (check()) return; await pause();}
    throw new Error(message);
}

function Fixture() {
    const [positions, setPositions] = useState(ids.map(createDefaultWatermarkPosition));
    const [current, setCurrent] = useState(0);
    const [batch, setBatch] = useState(false);
    const [result, setResult] = useState('等待验证');
    const [running, setRunning] = useState(false);
    const state = useRef({positions, current, batch});
    state.current = {positions, current, batch};
    const node = () => Konva.stages[0]?.find('Image')[1] as Konva.Image | undefined;
    const switchTo = async (index: number) => {
        setCurrent(index);
        await until(() => state.current.current === index, '图片未切换');
        await pause();
    };
    const assert = (value: boolean, message: string) => {if (!value) throw new Error(message);};
    const rotate = async (angle: number) => {
        node()!.rotation(angle);
        node()!.fire('transformend', {evt: new Event('transformend')});
        await until(() => state.current.positions[state.current.current].rotation === angle, '角度未保存');
    };
    const run = async () => {
        setRunning(true); setResult('验证中');
        try {
            setPositions(ids.map(createDefaultWatermarkPosition)); setBatch(false);
            await switchTo(0);
            await until(() => Boolean(node()?.image() && node()!.width() > 0), '水印未加载');
            await rotate(37);
            await switchTo(1);
            assert(node()!.rotation() === 0, `B 应为 0°，实际 ${node()!.rotation()}°`);
            node()!.x(node()!.x() + 12);
            node()!.fire('dragend', {evt: new Event('dragend')});
            await pause();
            assert(state.current.positions[1].rotation === 0, '拖动 B 继承了 A 的角度');
            await rotate(-24);
            await switchTo(2);
            assert(node()!.rotation() === 0, 'C 继承了其他图片的角度');
            await switchTo(0);
            assert(node()!.rotation() === 37, '返回 A 未恢复 37°');
            await switchTo(1);
            assert(node()!.rotation() === -24, '返回 B 未恢复 -24°');
            const images = ids.map(id => ({id, file: new File(['fixture'], `${id}.png`), width:1200, height:800}));
            const exported = buildImagesWithPositions(images, state.current.positions);
            assert(exported.map(image => image.position.rotation).join(',') === '37,-24,0', '导出位置未按图片隔离');
            setBatch(true); await until(() => state.current.batch, '批量模式未切换'); await pause();
            await rotate(15);
            for (let index = 0; index < ids.length; index++) {
                await switchTo(index);
                assert(node()!.rotation() === 15, '批量角度未同步');
            }
            setBatch(false); await until(() => !state.current.batch, '单独模式未切换'); await pause();
            await rotate(0);
            await switchTo(0);
            assert(node()!.rotation() === 15, '退出批量后仍修改了其他图片');
            await switchTo(2);
            assert(node()!.rotation() === 0, '0° 未恢复');
            setResult('PASS：单独旋转、切图恢复、拖动、导出位置、批量旋转、退出批量均通过');
        } catch (error) {setResult(`FAIL：${error instanceof Error ? error.message : String(error)}`);}
        finally {setRunning(false);}
    };
    return <main style={{height:'100dvh', width:'100vw', display:'flex', flexDirection:'column', padding:16, gap:12}}>
        <h1>水印角度隔离回归验证</h1>
        <button disabled={running} onClick={run}>运行回归验证</button>
        <output>{result}</output>
        <p>当前图片：{ids[current]} · 保存角度：{positions.map(position => `${position.id}: ${position.rotation}°`).join(' / ')}</p>
        <WatermarkEditor watermarkUrl="/logo.png" backgroundPreviewUrl={backgrounds[current]} backgroundOriginalWidth={1200}
            currentWatermarkPosition={positions[current]} batchEditing={batch} onBatchEditingChange={setBatch}
            onTransform={position => setPositions(previous => previous.map(saved => saved.id === ids[current] ? {...position, id:saved.id} : saved))}
            onAllTransform={position => setPositions(previous => previous.map(saved => ({...position, id:saved.id})))}
            onSmartPosition={async () => {}} />
    </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
