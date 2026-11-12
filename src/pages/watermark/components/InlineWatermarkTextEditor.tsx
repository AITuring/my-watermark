import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type Konva from 'konva';
import type { MixedWatermarkConfig } from '@/types';
import { createTextWatermark, type WatermarkTextRegion } from '@/utils/text-watermark';

export interface InlineWatermarkEditorHandle {
    edit: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
}

type EditSession = {
    node: Konva.Image;
    region: WatermarkTextRegion;
    value: string;
    vertical: boolean;
    color: string;
    originalImage: CanvasImageSource;
    maskedImage: HTMLCanvasElement;
};

function restoreWatermark(session: EditSession | null) {
    if (session && session.node.image() === session.maskedImage) {
        session.node.image(session.originalImage);
        session.node.getLayer()?.batchDraw();
    }
}

type Props = {
    sessionKey: string;
    config?: MixedWatermarkConfig;
    onChange: (patch: Partial<MixedWatermarkConfig>) => void;
};

/** Native text editing over the canvas; no canvas redraws while composing. */
const InlineWatermarkTextEditor = forwardRef<InlineWatermarkEditorHandle, Props>(function InlineWatermarkTextEditor(
    { sessionKey, config, onChange }, ref,
) {
    const [session, setSession] = useState<EditSession | null>(null);
    const active = useRef<EditSession | null>(null);
    const input = useRef<HTMLTextAreaElement>(null);
    const request = useRef(0);
    const composing = useRef(false);
    const [draft, setDraft] = useState('');

    const finish = (save: boolean) => {
        const current = active.current;
        if (!current) return;
        const value = (input.current?.value ?? current.value).replace(/[\r\n]+/g, ' ');
        active.current = null;
        restoreWatermark(current);
        composing.current = false;
        setSession(null);
        if (save && value !== current.value) onChange({ [current.region.field]: value });
    };

    useEffect(() => {
        request.current++;
        restoreWatermark(active.current);
        active.current = null;
        setSession(null);
        return () => { request.current++; restoreWatermark(active.current); };
    }, [sessionKey, Boolean(config)]);

    useImperativeHandle(ref, () => ({ edit(event) {
        if (!config) return;
        const node = event.target as Konva.Image;
        const point = node.getRelativePointerPosition();
        if (!point || !node.width() || !node.height()) return;
        const ticket = ++request.current;
        // Convert the cropped preview back to coordinates in the rendered PNG.
        const crop = node.crop();
        const x = crop.x + point.x * crop.width / node.width();
        const y = crop.y + point.y * crop.height / node.height();
        void createTextWatermark(config, regions => {
            if (ticket !== request.current || !node.getStage()) return;
            const region = regions.find(item => x >= item.x && x <= item.x + item.width
                && y >= item.y && y <= item.y + item.height);
            if (!region) return; // Clicking the logo keeps the transform handles.
            restoreWatermark(active.current);
            const originalImage = node.image();
            if (!(originalImage instanceof HTMLImageElement || originalImage instanceof HTMLCanvasElement)) return;
            // Remove just the edited text from the preview, keeping the icon and
            // other line visible behind the transparent native editing surface.
            const maskedImage = document.createElement('canvas');
            maskedImage.width = originalImage.width;
            maskedImage.height = originalImage.height;
            const context = maskedImage.getContext('2d');
            if (!context) return;
            context.drawImage(originalImage, 0, 0);
            context.clearRect(region.x, region.y, region.width, region.height);
            const next = {node, region, value: config[region.field], vertical: config.layout === 'vertical',
                color: config.color, originalImage, maskedImage};
            node.image(maskedImage);
            node.getLayer()?.batchDraw();
            active.current = next;
            setDraft(next.value);
            setSession(next);
        }).catch(error => { console.error('无法打开水印文字编辑', error); });
    } }));

    useLayoutEffect(() => {
        if (!session) return;
        input.current?.focus({ preventScroll: true });
        // Start with a caret, so entering edit mode does not paint a selection
        // rectangle over the artwork.
        input.current?.setSelectionRange(session.value.length, session.value.length);
    }, [session]);

    useEffect(() => {
        if (!session) return;
        const outside = (event: PointerEvent) => {
            if (!input.current?.contains(event.target as Node)) finish(true);
        };
        document.addEventListener('pointerdown', outside, true);
        return () => document.removeEventListener('pointerdown', outside, true);
    });

    if (!session || !session.node.getStage()) return null;
    const {node, region, vertical} = session;
    const stage = node.getStage()!;
    const crop = node.crop();
    // Use the same complete source-to-stage transform as the PNG. This keeps
    // font size, position, zoom and rotation unchanged when editing begins.
    const transform = node.getAbsoluteTransform().copy()
        .scale(node.width() / crop.width, node.height() / crop.height)
        .translate(region.x - crop.x, region.y - crop.y);
    const fontSize = region.fontSize;
    const extra = fontSize * .3;
    const context = session.maskedImage.getContext('2d')!;
    context.font = `${fontSize}px ${region.fontFamily}`;
    const characters = Array.from(draft);
    const width = vertical ? region.width : Math.max(region.width,
        context.measureText(draft).width + Math.max(0, characters.length - 1) * region.letterSpacing);
    const height = vertical ? Math.max(region.height,
        characters.length * fontSize * 1.2 + Math.max(0, characters.length - 1) * region.letterSpacing) : region.height;
    return createPortal(<textarea ref={input} className="wm-inline-text-editor"
        aria-label={region.field === 'textLine1' ? '原位编辑主标题' : '原位编辑说明文字'}
        title="Enter 确认 · Esc 取消 · 点击外部保存"
        defaultValue={session.value} maxLength={120} rows={1} spellCheck={false}
        style={{left: 0, top: 0, width: width + (vertical ? 0 : extra), height: height + (vertical ? extra : 0),
            fontSize, fontFamily: region.fontFamily, color: session.color, caretColor: session.color,
            opacity: node.getAbsoluteOpacity(), lineHeight: vertical ? 1.3 : 1.4,
            letterSpacing: region.letterSpacing + (vertical ? fontSize * .2 : 0),
            writingMode: vertical ? 'vertical-lr' : 'horizontal-tb',
            textOrientation: vertical ? 'upright' : undefined,
            transform: `matrix(${transform.getMatrix().join(',')})`}}
        onChange={event => setDraft(event.currentTarget.value)}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        onBlur={() => finish(true)}
        onKeyDown={event => {
            event.stopPropagation();
            if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault();
                finish(event.key === 'Enter');
            }
        }} />, stage.container());
});

export default InlineWatermarkTextEditor;
