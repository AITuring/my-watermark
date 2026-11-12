import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
    value: string;
    onValueChange: (value: string) => void;
};

export default function WatermarkTextInput({ value, onValueChange, ...props }: Props) {
    const [draft, setDraft] = useState(value);
    const composing = useRef(false);
    useEffect(() => { if (!composing.current) setDraft(value); }, [value]);
    return <input {...props} value={draft}
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
}
