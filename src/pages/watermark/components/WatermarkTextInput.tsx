import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
    value: string;
    onValueChange: (value: string) => void;
    autoSize?: boolean;
};

export default function WatermarkTextInput({ value, onValueChange, autoSize=false, ...props }: Props) {
    const [draft, setDraft] = useState(value);
    const composing = useRef(false);
    useEffect(() => { if (!composing.current) setDraft(value); }, [value]);
    const input = <input {...props} value={draft}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={event => {
            composing.current = false;
            setDraft(event.currentTarget.value);
            onValueChange(event.currentTarget.value);
        }}
        onChange={event => {
            setDraft(event.target.value);
            if (!composing.current) onValueChange(event.target.value);
        }} />;
    return autoSize ? <span className="wm-content-sized-input"><span className="wm-content-input-measure" aria-hidden="true">{draft || props.placeholder || ' '}</span>{input}</span> : input;
}
