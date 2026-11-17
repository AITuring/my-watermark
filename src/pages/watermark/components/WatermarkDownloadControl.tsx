import type {WatermarkDownloadMode} from '../export-downloads';

export default function WatermarkDownloadControl({value, onChange, disabled = false}: {
    value: WatermarkDownloadMode;
    onChange: (value: WatermarkDownloadMode) => void;
    disabled?: boolean;
}) {
    return <div className="wm-download-setting">
        <span className="wm-label">下载方式</span>
        <div className="wm-download-mode" role="group" aria-label="批量下载方式">
            <button type="button" disabled={disabled} aria-pressed={value === 'zip'} onClick={() => onChange('zip')}>打包 ZIP</button>
            <button type="button" disabled={disabled} aria-pressed={value === 'files'} onClick={() => onChange('files')}>分别下载</button>
        </div>
        {value === 'files' && <p className="wm-help">如浏览器询问，请允许多个文件下载。</p>}
    </div>;
}
