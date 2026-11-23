import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FolderOpen, Users, Download, ShieldCheck } from 'lucide-react';
import { groupFaces, matchReferences, REVIEW, uniqueName, type PersonGroup } from './grouping';
import './people-sort.css';

type Photo = { id: string; file: File; url: string; descriptor?: number[]; reason?: string };
const yieldFrame = () => new Promise(resolve => setTimeout(resolve, 0));
export default function PeopleSort() {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [groups, setGroups] = useState<PersonGroup[]>([]);
    const [active, setActive] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [referenceIds, setReferenceIds] = useState<Set<string>>(new Set());
    const [target, setTarget] = useState(REVIEW);
    const [engine, setEngine] = useState<'onnx' | 'browser'>('onnx');
    const [threshold, setThreshold] = useState(0.95);
    const [busy, setBusy] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const cancel = useRef(false);
    const stopEngine = useRef<() => void>(() => {});
    const mounted = useRef(true);
    const urls = useRef<string[]>([]);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; cancel.current = true; stopEngine.current(); urls.current.forEach(URL.revokeObjectURL); };
    }, []);
    const byId = useMemo(() => new Map(photos.map(p => [p.id, p])), [photos]);
    const current = groups.find(g => g.id === active);
    const locked = busy || exporting;
    const reviewReasons = useMemo(() => {
        const counts = new Map<string, number>();
        for (const id of groups.find(g => g.id === REVIEW)?.photoIds || []) {
            const reason = byId.get(id)?.reason || '与多个人物相近，请确认';
            counts.set(reason, (counts.get(reason) || 0) + 1);
        }
        return [...counts];
    }, [groups, byId]);
    function regroup(value = threshold) {
        setReferenceIds(new Set()); setGroups(groupFaces(photos, value)); setActive('person-1'); setSelected(new Set());
    }
    async function importFiles(files: File[]) {
        if (locked) return;
        const accepted = files.filter(file => /\.(jpe?g|png|webp)$/i.test(file.name) &&
            !(file.webkitRelativePath || file.name).split('/').some(part => part.startsWith('.') || part === '__MACOSX'));
        if (!accepted.length) { setError('文件夹中没有支持的图片，请选择 JPEG、PNG 或 WebP 文件。'); return; }
        urls.current.forEach(URL.revokeObjectURL);
        urls.current = [];
        const next = accepted.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, 'zh-CN', { numeric: true }))
            .map((file, i) => { const url = URL.createObjectURL(file); urls.current.push(url); return { id: `photo-${i}`, file, url } as Photo; });
        setReferenceIds(new Set()); setPhotos(next); setGroups([]); setSelected(new Set()); setError(''); setBusy(true); setProgress(0);
        setStatus(engine === 'onnx' ? '正在加载浏览器 YuNet + SFace 模型…' : '正在加载浏览器识别模型…'); cancel.current = false;
        try {
            const run = engine === 'onnx' ? await (async () => {
                const { loadOnnxRecognition, recognizeOnnx, stopOnnxRecognition } = await import('./onnx-recognition');
                stopEngine.current = stopOnnxRecognition;
                if (cancel.current || !mounted.current) throw new Error('识别已停止');
                await loadOnnxRecognition(message => { if (mounted.current) setStatus(message); });
                return (photo: Photo) => recognizeOnnx(photo.file);
            })() : await (async () => {
                const { loadRecognition, recognize } = await import('./recognition');
                const api = await loadRecognition();
                return (photo: Photo) => recognize(photo.url, api);
            })();
            for (let i = 0; i < next.length; i++) {
                if (cancel.current) break;
                setStatus(`正在识别 ${i + 1} / ${next.length} · ${next[i].file.name}`);
                try { Object.assign(next[i], await run(next[i])); }
                catch (err) { next[i].reason = err instanceof Error ? err.message : '图片解码或识别失败'; }
                if (!mounted.current) return;
                setProgress(i + 1);
                await yieldFrame();
            }
            if (!mounted.current) return;
            for (const photo of next) if (!photo.descriptor && !photo.reason) photo.reason = '尚未识别';
            setPhotos([...next]); setGroups(groupFaces(next, threshold)); setActive(next.some(p => p.descriptor) ? 'person-1' : REVIEW);
            setStatus(cancel.current ? '已停止，未处理照片已放入待确认。' : `识别完成，共 ${next.length} 张照片。请检查分组后导出。`);
        } catch (err) {
            if (!mounted.current) return;
            setGroups([{ id: REVIEW, name: '待确认', photoIds: next.map(p => p.id) }]); setActive(REVIEW);
            setStatus('识别未完成，可重新选择文件夹重试。');
            if (!cancel.current) setError(err instanceof Error ? err.message : '浏览器识别模型加载失败，请重新导入重试。');
            else setStatus('已停止，未处理照片已放入待确认。');
        } finally { if (mounted.current) setBusy(false); }
    }
    function move(ids: string[], destination: string) {
        if (!ids.length || !groups.some(g => g.id === destination) || destination === active) return;
        const moving = new Set(ids);
        setGroups(prev => prev.map(g => ({ ...g, photoIds: g.id === destination ? [...g.photoIds, ...ids] : g.photoIds.filter(id => !moving.has(id)) })));
        setSelected(new Set());
    }
    function rematch() {
        const references = groups.filter(g => g.id !== REVIEW).map(group => ({ groupId: group.id,
            descriptors: group.photoIds.filter(id => referenceIds.has(id) && byId.get(id)?.descriptor).map(id => byId.get(id)!.descriptor!) }));
        const assignments = new Map<string, string>();
        for (const id of groups.find(g => g.id === REVIEW)?.photoIds || []) {
            const destination = matchReferences(byId.get(id)!, references, threshold);
            if (destination) assignments.set(id, destination);
        }
        setGroups(prev => prev.map(g => ({ ...g, photoIds: g.id === REVIEW ? g.photoIds.filter(id => !assignments.has(id)) :
            [...g.photoIds, ...[...assignments].filter(([, destination]) => destination === g.id).map(([id]) => id)] })));
        setSelected(new Set()); setStatus(`参考匹配完成：${assignments.size} 张移入人物组。未检出人脸的照片仍需人工处理。`);
    }
    async function exportZip() {
        setExporting(true); setError(''); setStatus('正在打包原图，请保留此页面…');
        try {
            const { default: JSZip } = await import('jszip');
            const zip = new JSZip(); const folders = new Set<string>();
            for (const group of groups.filter(g => g.photoIds.length)) {
                const folder = uniqueName(group.name, folders); const names = new Set<string>();
                for (const id of group.photoIds) {
                    const photo = byId.get(id)!;
                    zip.file(`${folder}/${uniqueName(photo.file.name, names)}`, photo.file);
                }
            }
            const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, meta => { if (mounted.current) setStatus(`正在打包原图 ${Math.round(meta.percent)}%`); });
            if (!mounted.current) return;
            const url = URL.createObjectURL(blob); const link = document.createElement('a');
            link.href = url; link.download = '人物分类.zip'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
            setStatus('已生成分类压缩包，原图与原文件名均已保留（重名文件自动加序号）。');
        } catch { if (mounted.current) setError('导出失败，可能是浏览器内存不足。请尝试分批导入较小的文件夹。'); }
        finally { if (mounted.current) setExporting(false); }
    }
    const button = 'ps-button';
    return <main className="ps-page">
        <header className="ps-header"><div><Link to="/" className="ps-back"><ArrowLeft size={16} /> 应用库</Link><h1><Users size={28} /> 人物分类</h1><p>把同一个人的照片整理到一起。</p></div><span className="ps-private"><ShieldCheck size={17} /> 照片仅在本机处理</span></header>
        <section className="ps-toolbar" aria-label="导入与识别设置">
            <div className="ps-actions"><button className={`${button} ps-primary`} disabled={locked} onClick={() => input.current?.click()}><FolderOpen size={18} /> 选择文件夹</button>
                <input hidden ref={input} type="file" multiple accept=".jpg,.jpeg,.png,.webp" {...{ webkitdirectory: '', directory: '' }} onChange={e => { void importFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
                <button className={button} disabled={locked || !groups.length} onClick={() => void exportZip()}><Download size={17} /> {exporting ? '正在导出…' : '导出分类 ZIP'}</button>
                {busy && <button className={button} onClick={() => { cancel.current = true; stopEngine.current(); }}>停止识别</button>}
            </div>
            <p>包含子文件夹 · JPEG / PNG / WebP · {engine === 'onnx' ? 'YuNet + SFace 浏览器识别' : '浏览器识别 · 首次加载约 13 MB 模型'} · 原文件不会被修改</p>
            <div className="ps-actions"><label>识别引擎 <select aria-label="识别引擎" value={engine} disabled={locked || photos.length > 0} onChange={e => { const value = e.target.value as 'onnx' | 'browser'; setEngine(value); setThreshold(value === 'onnx' ? 0.95 : 0.48); }}><option value="onnx">浏览器 · YuNet + SFace（推荐）</option><option value="browser">浏览器 · Face API</option></select></label>
                {photos.length > 0 && <button className={button} disabled={locked} onClick={() => { stopEngine.current(); urls.current.forEach(URL.revokeObjectURL); urls.current = []; setReferenceIds(new Set()); setPhotos([]); setGroups([]); setStatus(''); setError(''); setSelected(new Set()); }}>清空并切换引擎</button>}
            </div>
            {engine === 'onnx' && <p>无需安装或启动本机服务。首次下载约 48 MB 模型与运行资源，模型会尽量缓存在此浏览器中；照片与人脸特征只在浏览器内处理。清除浏览器缓存后需重新下载。</p>}
            <div className="ps-threshold"><label htmlFor="ps-threshold">分组严格度</label><span>严格</span><input id="ps-threshold" type="range" min={engine === 'onnx' ? 0.7 : 0.35} max={engine === 'onnx' ? 1.13 : 0.6} step="0.01" value={threshold} disabled={locked} onChange={e => setThreshold(Number(e.target.value))} /><span>宽松</span><output>{threshold.toFixed(2)}</output><button className={button} disabled={locked || !photos.some(p => p.descriptor)} onClick={() => regroup()}>重新分组（重置人工调整）</button></div>
            <p>严格模式更容易分成多组；宽松模式更容易合并。优先识别明显的主体人脸；背影、严重遮挡或主体不明确的多人照片需要人工确认。</p>
            <div role="status" aria-live="polite">{status}</div>{busy && <progress aria-label="识别进度" max={photos.length || 1} value={progress} />}
            {error && <p role="alert" className="ps-error">{error}</p>}
        </section>
        {!groups.length ? <section className="ps-empty"><div className="ps-empty-icon"><Users size={38} /></div><h2>{busy ? '正在寻找照片里的人物' : '从一个照片文件夹开始'}</h2><p>选择文件夹后自动识别人脸，为每个人建立独立分组。</p><p>识别完成后，可以命名、合并和逐张调整，再导出原图。</p></section> :
        <div className="ps-workspace"><aside className="ps-sidebar" aria-label="人物分组"><div className="ps-side-title">人物分组 <span>{groups.filter(g => g.id !== REVIEW && g.photoIds.length).length} 人 · {photos.length} 张</span></div>
            {groups.filter(g => g.photoIds.length || g.id === REVIEW || g.id.startsWith('manual-')).map(g => <button key={g.id} className={`ps-group ${g.id === active ? 'ps-active' : ''}`} onClick={() => { setActive(g.id); setSelected(new Set()); }} aria-pressed={g.id === active}>{g.photoIds[0] ? <img src={byId.get(g.photoIds[0])?.url} alt="" loading="lazy" /> : <Users size={24} />}<span>{g.name}</span><small>{g.photoIds.length}</small></button>)}
            <button className={button} disabled={locked} onClick={() => { const id = `manual-${crypto.randomUUID()}`; setGroups(prev => [...prev, { id, name: '新人物', photoIds: [] }]); setActive(id); setSelected(new Set()); }}>＋ 新建人物</button>
        </aside><section className="ps-results" aria-label="分组照片">
            {current && <><div className="ps-result-header"><div>{current.id === REVIEW ? <h2>待确认</h2> : <input className="ps-name" aria-label="人物名称" value={current.name} disabled={locked} onChange={e => setGroups(prev => prev.map(g => g.id === active ? { ...g, name: e.target.value } : g))} />}<p>{current.photoIds.length} 张照片{current.id === REVIEW ? ' · 请手动移动到人物分组' : ' · 点击名称可修改'}</p></div></div>
            <div className="ps-actions ps-move"><button className={button} disabled={locked} onClick={() => setSelected(new Set(current.photoIds))}>全选</button><button className={button} disabled={locked} onClick={() => setSelected(new Set())}>取消选择</button><label>移动到 <select aria-label="目标人物分组" value={target} disabled={locked} onChange={e => setTarget(e.target.value)}>{groups.map(g => <option key={g.id} value={g.id}>{g.name || '未命名'}{g.id === active ? '（当前组）' : ''}</option>)}</select></label><button className={button} disabled={locked || !selected.size || target === active} onClick={() => move([...selected], target)}>移动 {selected.size || ''} 张</button><button className={button} disabled={locked || !current.photoIds.length || target === active} onClick={() => move(current.photoIds, target)}>整组合并</button></div>
            {current.id === REVIEW && reviewReasons.length > 0 && <div className="ps-review-reasons" aria-label="待确认原因统计">{reviewReasons.map(([reason, count]) => <p key={reason}>{reason}：{count} 张</p>)}</div>}
            <div className="ps-actions ps-reference"><button className={button} disabled={locked || current.id === REVIEW || ![...selected].some(id => byId.get(id)?.descriptor)} onClick={() => { setReferenceIds(prev => new Set([...prev, ...[...selected].filter(id => byId.get(id)?.descriptor)])); setStatus('已设为参考照片。可用这些照片重新匹配待确认中有可用人脸特征的照片。'); }}>将所选设为参考</button><button className={button} disabled={locked || !referenceIds.size} onClick={rematch}>用参考照片匹配待确认</button><span className="text-xs text-muted-foreground">{referenceIds.size} 张参考 · 无人脸照片仍需人工移动</span></div>
            <div className="ps-grid">{current.photoIds.map(id => { const photo = byId.get(id)!; return <label key={id} className={`ps-photo ${selected.has(id) ? 'ps-selected' : ''}`}><img src={photo.url} alt={photo.file.name} loading="lazy" decoding="async" /><div><input type="checkbox" disabled={locked} checked={selected.has(id)} onChange={e => setSelected(prev => { const copy = new Set(prev); if (e.target.checked) copy.add(id); else copy.delete(id); return copy; })} /><span title={photo.file.webkitRelativePath || photo.file.name}>{referenceIds.has(id) ? "★ " : ""}{photo.file.name}</span></div>{current.id === REVIEW && <small>{photo.reason || '与多个人物相近，请确认'}</small>}</label>; })}</div>{!current.photoIds.length && <p className="ps-empty">此分组暂无照片，可从其他分组移动照片到这里。</p>}</>}
        </section></div>}
    </main>;
}
