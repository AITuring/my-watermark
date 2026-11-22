const MODEL = 'opencv-yunet-2023mar-sface-2021dec-v1';
const BASE = '/api/people-sort';
export async function loadLocalRecognition() {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) throw new Error('本机识别请打开 http://localhost:8123/people-sort；线上页面可切换浏览器模式。');
    let response: Response;
    try { response = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(8000) }); }
    catch { throw new Error('本地识别服务未连接。请在项目目录运行 npm run people:serve，然后重新导入。'); }
    if (!response.ok) throw new Error('本地识别服务未就绪。请先运行 npm run people:setup，再运行 npm run people:serve。');
    const health = await response.json();
    if (health.model !== MODEL || !health.ready) throw new Error('本地模型版本不匹配，请重启本地服务。');
    return MODEL;
}
export async function recognizeLocal(file: File) {
    const body = new FormData(); body.append('file', file);
    const response = await fetch(`${BASE}/recognize`, { method: 'POST', body, signal: AbortSignal.timeout(120000) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `本地识别失败（${response.status}）`);
    }
    const result = await response.json();
    if (result.model !== MODEL) throw new Error('本地模型版本不一致');
    if (result.descriptor && (!Array.isArray(result.descriptor) || result.descriptor.length !== 128 || !result.descriptor.every(Number.isFinite))) {
        throw new Error('本地服务返回了无效特征');
    }
    return result as { descriptor?: number[]; reason?: string };
}
