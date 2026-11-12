import {Switch} from '@/components/ui/switch';

export default function WatermarkDirectionSwitch({value = 'horizontal', onChange}: {
    value?: 'horizontal' | 'vertical';
    onChange: (value: 'horizontal' | 'vertical') => void;
}) {
    return <div className="wm-direction-switch" role="group" aria-label="排版方向">
        <button type="button" className="wm-direction-label" aria-pressed={value === 'horizontal'} onClick={() => onChange('horizontal')}>横排</button>
        <Switch aria-label="竖排" title="关闭为横排，开启为竖排" checked={value === 'vertical'} onCheckedChange={checked => onChange(checked ? 'vertical' : 'horizontal')}/>
        <button type="button" className="wm-direction-label" aria-pressed={value === 'vertical'} onClick={() => onChange('vertical')}>竖排</button>
    </div>;
}
