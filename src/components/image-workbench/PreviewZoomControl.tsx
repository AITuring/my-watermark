import { useId } from "react";
import "./preview-zoom.css";

export default function PreviewZoomControl({value, onChange}: {value: number; onChange: (value: number) => void}) {
    const id = useId();
    const percentage = Math.round(value * 100);
    return <div className="wm-canvas-zoom" role="group" aria-label="预览缩放" title="100% 为适应画面，仅影响预览。放大后可拖动画面。">
        <label className="wm-canvas-zoom-inline">
            <output htmlFor={id}>{percentage}%</output>
            <input id={id} type="range" aria-label="调整预览缩放" aria-valuetext={`${percentage}%`} min={100} max={500} step={5}
                value={percentage} onChange={event => onChange(Number(event.target.value) / 100)}/>
        </label>
        <button type="button" className="wm-canvas-fit" title="显示完整画面" onClick={() => onChange(1)}>适应</button>
    </div>;
}
