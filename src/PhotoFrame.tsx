import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Text, Group } from 'react-konva';
import useImage from 'use-image';
import ExifReader from 'exifreader';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import ImageUploader from './ImageUploader';
import { Download, RotateCcw, Upload, Trash2, Plus, Image as ImageIcon, Film, BoxSelect, Camera, Newspaper, Aperture } from 'lucide-react';
import { toast } from 'sonner';

interface ExifData {
    make: string;
    model: string;
    lens: string;
    iso: string;
    fNumber: string;
    exposureTime: string;
    dateTime: string;
    focalLength: string;
    software?: string;
    fileSize?: string;
    resolution?: string;
    fileName?: string;
}

interface FrameImage {
    id: string;
    file: File;
    url: string;
    exif: ExifData;
}

type FrameTemplate = 'gallery' | 'floating' | 'polaroid' | 'magazine' | 'film';

const PhotoFrame: React.FC = () => {
    // State
    const [images, setImages] = useState<FrameImage[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [template, setTemplate] = useState<FrameTemplate>('gallery');

    // Style Settings
    const [borderSize, setBorderSize] = useState(0.05); // 0.0 - 0.15
    const [bottomSize, setBottomSize] = useState(0.15); // 0.0 - 0.25 (Only for Gallery)
    const [fontSize, setFontSize] = useState(1);
    const [borderColor, setBorderColor] = useState('#ffffff');
    const [textColor, setTextColor] = useState('#000000');
    const [autoTextColor, setAutoTextColor] = useState(true);

    // Editable Params (Per image overrides could be complex, keeping global for now or sync on select)
    // To support per-image edits, we might need to store these in the FrameImage object.
    // For simplicity, let's keep it bound to the selected image's displayed values.
    const [customParams, setCustomParams] = useState<ExifData | null>(null);

    const stageRef = useRef<any>(null);
    const selectedImage = useMemo(() => images.find(img => img.id === selectedId), [images, selectedId]);
    const [konvaImage] = useImage(selectedImage?.url || '', 'anonymous');

    // Sync custom params when image changes
    useEffect(() => {
        if (selectedImage) {
            setCustomParams(selectedImage.exif);
        }
    }, [selectedImage]);

    const handleUpload = async (files: File[]) => {
        const newImages: FrameImage[] = [];

        for (const file of files) {
            try {
                const tags = await ExifReader.load(file);
                const width = tags['Image Width']?.value || 0;
                const height = tags['Image Height']?.value || 0;

                const exif: ExifData = {
                    make: tags['Make']?.description || '',
                    model: tags['Model']?.description || 'Unknown Camera',
                    lens: tags['LensModel']?.description || '',
                    iso: tags['ISOSpeedRatings']?.description ? `${tags['ISOSpeedRatings']?.description}` : '',
                    fNumber: tags['FNumber']?.description || '',
                    exposureTime: tags['ExposureTime']?.description ? `${tags['ExposureTime']?.description}` : '',
                    dateTime: tags['DateTimeOriginal']?.description || '',
                    focalLength: tags['FocalLength']?.description ? `${tags['FocalLength']?.description}` : '',
                    software: tags['Software']?.description || '',
                    fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                    resolution: width && height ? `${width} x ${height}` : 'Unknown',
                    fileName: file.name
                };

                newImages.push({
                    id: crypto.randomUUID(),
                    file,
                    url: URL.createObjectURL(file),
                    exif
                });
            } catch (e) {
                console.error("EXIF Error", e);
                newImages.push({
                    id: crypto.randomUUID(),
                    file,
                    url: URL.createObjectURL(file),
                    exif: {
                        make: '', model: 'Unknown', lens: '', iso: '', fNumber: '',
                        exposureTime: '', dateTime: '', focalLength: '',
                        fileName: file.name, fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB'
                    }
                });
            }
        }

        setImages(prev => [...prev, ...newImages]);
        if (!selectedId && newImages.length > 0) {
            setSelectedId(newImages[0].id);
        }
    };

    const handleDelete = (id: string) => {
        const index = images.findIndex(img => img.id === id);
        const newImages = images.filter(img => img.id !== id);
        setImages(newImages);

        if (selectedId === id) {
            if (newImages.length > 0) {
                // Select previous image, or the new first image if we deleted the first one
                const newIndex = Math.max(0, index - 1);
                setSelectedId(newImages[newIndex].id);
            } else {
                setSelectedId(null);
            }
        }
    };

    const downloadImage = () => {
        if (stageRef.current && selectedImage) {
            const pixelRatio = 3;
            const uri = stageRef.current.toDataURL({ pixelRatio });
            const link = document.createElement('a');
            link.download = `framed_${selectedImage.file.name.replace(/\.[^/.]+$/, "")}.png`;
            link.href = uri;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("图片已保存");
        }
    };

    // Calculate Layout
    const stageWidth = window.innerWidth * 0.6;
    const stageHeight = window.innerHeight * 0.7;

    const layout = useMemo(() => {
        if (!konvaImage) return null;

        const imgW = konvaImage.width;
        const imgH = konvaImage.height;

        let borderW = imgW * borderSize;
        let bottomH = 0;
        let totalW = 0;
        let totalH = 0;
        let imgX = 0;
        let imgY = 0;

        if (template === 'gallery') {
            // Gallery: Classic Polaroid/Museum mat
            // Sides and Top are equal (borderW), Bottom is larger (borderW + bottomH)
            const bottomPadding = imgH * Math.max(bottomSize, 0.05); // Ensure at least some bottom

            totalW = imgW + borderW * 2;
            totalH = imgH + borderW + bottomPadding;

            imgX = borderW;
            imgY = borderW;
            bottomH = bottomPadding; // For text positioning

        } else if (template === 'floating') {
            // Floating: Image sits in center of large canvas with shadow
            // borderSize controls the canvas "padding" around the image

            const padding = Math.max(imgW * 0.1, imgW * borderSize * 2);

            totalW = imgW + padding * 2;
            totalH = imgH + padding * 2;

            imgX = padding;
            imgY = padding;

        } else if (template === 'polaroid') {
            // Polaroid: Thicker borders, very large chin
            const pBorder = imgW * 0.06;
            const pBottom = imgH * 0.25;

            totalW = imgW + pBorder * 2;
            totalH = imgH + pBorder + pBottom;

            imgX = pBorder;
            imgY = pBorder;
            bottomH = pBottom;

        } else if (template === 'magazine') {
            // Magazine: Image on top, large white area below with editorial typography
            // Minimal side borders
            const mBorder = imgW * 0.03;
            const mBottom = imgH * 0.3;

            totalW = imgW + mBorder * 2;
            totalH = imgH + mBorder + mBottom;

            imgX = mBorder;
            imgY = mBorder;
            bottomH = mBottom;

        } else if (template === 'film') {
            // Film Strip: Black bars on top/bottom with sprocket holes
            const fBar = imgH * 0.15;

            totalW = imgW;
            totalH = imgH + fBar * 2;

            imgX = 0;
            imgY = fBar;
            bottomH = fBar;
        }

        const scale = Math.min(stageWidth / totalW, stageHeight / totalH);

        return { totalW, totalH, imgX, imgY, imgW, imgH, scale, bottomH, borderW };
    }, [konvaImage, template, borderSize, bottomSize, stageWidth, stageHeight]);

    // Handle param changes
    const updateParam = (key: keyof ExifData, value: string) => {
        if (customParams) {
            setCustomParams({ ...customParams, [key]: value });
        }
    };

    // Auto color logic
    useEffect(() => {
        if (autoTextColor) {
            // Simple logic: if bg is dark, text white.
            const isDark = ['#000000', '#1a1a1a', '#2c2c2c', '#000'].includes(borderColor);
            setTextColor(isDark ? '#ffffff' : '#000000');
        }
    }, [borderColor, autoTextColor]);


    if (images.length === 0) {
         return (
             <div className="fixed inset-0 z-50 flex flex-col items-center justify-center  bg-zinc-950 text-white">
                <div className="w-full max-w-xl p-8 border border-white/10 rounded-xl bg-zinc-900/50 backdrop-blur-sm text-center">
                    <div className="mb-6 flex justify-center">
                        <div className="p-4 bg-white/10 rounded-full">
                            <Upload className="w-10 h-10 text-white" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">上传图片</h2>
                    <p className="text-gray-400 mb-8">添加优雅的边框和拍摄参数</p>
                    <ImageUploader onUpload={handleUpload} />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col h-full w-full bg-zinc-950 text-white overflow-hidden">
            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Style Controls */}
                <div className="w-80 bg-zinc-950 border-r border-white/10 flex flex-col z-10 h-full overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                        <h3 className="font-semibold text-sm">外观样式</h3>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-6">
                            {/* Templates */}
                            <div className="space-y-3">
                                <Label>模版风格</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'gallery', name: '画廊', icon: ImageIcon },
                                        { id: 'film', name: '电影胶卷', icon: Film },
                                        { id: 'floating', name: '悬浮', icon: BoxSelect },
                                        { id: 'polaroid', name: '拍立得', icon: Camera },
                                        { id: 'magazine', name: '杂志', icon: Newspaper },
                                    ].map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTemplate(t.id as FrameTemplate)}
                                            className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                                                template === t.id
                                                    ? 'bg-white text-black border-white'
                                                    : 'bg-zinc-900 border-zinc-800 text-gray-400 hover:bg-zinc-800'
                                            }`}
                                        >
                                            <t.icon className="w-6 h-6 mb-2" />
                                            <span className="text-xs">{t.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Sliders */}
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <Label>字体大小</Label>
                                        <span className="text-xs text-muted-foreground">{fontSize.toFixed(1)}x</span>
                                    </div>
                                    <Slider
                                        value={[fontSize]} min={0.5} max={2} step={0.1}
                                        onValueChange={(v) => setFontSize(v[0])}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <Label>边框尺寸</Label>
                                        <span className="text-xs text-muted-foreground">{Math.round(borderSize * 100)}%</span>
                                    </div>
                                    <Slider
                                        value={[borderSize * 100]} max={15} step={0.5}
                                        onValueChange={(v) => setBorderSize(v[0] / 100)}
                                    />
                                </div>
                            </div>

                            {/* Colors */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>边框背景</Label>
                                    <div className="flex gap-2">
                                        {['#ffffff', '#000000'].map(c => (
                                            <button
                                                key={c}
                                                className={`w-6 h-6 rounded-full border ${borderColor === c ? 'border-blue-500 scale-110' : 'border-gray-600'}`}
                                                style={{ backgroundColor: c }}
                                                onClick={() => setBorderColor(c)}
                                            />
                                        ))}
                                        <input
                                            type="color"
                                            value={borderColor}
                                            onChange={(e) => setBorderColor(e.target.value)}
                                            className="w-6 h-6 rounded-full overflow-hidden border-0 p-0"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label>文字颜色</Label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 mr-2">自动</span>
                                        <Switch checked={autoTextColor} onCheckedChange={setAutoTextColor} />
                                        {!autoTextColor && (
                                            <input
                                                type="color"
                                                value={textColor}
                                                onChange={(e) => setTextColor(e.target.value)}
                                                className="w-6 h-6 rounded-full overflow-hidden border-0 p-0"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                {/* Center: Canvas Area */}
                <div className="flex-1 flex items-center justify-center bg-zinc-900/30 p-8 relative">
                    {layout && (
                        <div className="shadow-2xl shadow-black/50">
                            <Stage
                                width={layout.totalW * layout.scale}
                                height={layout.totalH * layout.scale}
                                scaleX={layout.scale}
                                scaleY={layout.scale}
                                ref={stageRef}
                            >
                                <Layer>
                                    {/* Background */}
                                    <Rect
                                        x={0}
                                        y={0}
                                        width={layout.totalW}
                                        height={layout.totalH}
                                        fill={template === 'film' ? '#111111' : borderColor}
                                    />

                                    {/* Shadow for Floating */}
                                    {template === 'floating' && (
                                        <Rect
                                            x={layout.imgX}
                                            y={layout.imgY}
                                            width={layout.imgW}
                                            height={layout.imgH}
                                            fill="black"
                                            shadowColor="black"
                                            shadowBlur={layout.imgW * 0.05}
                                            shadowOffset={{ x: layout.imgW * 0.02, y: layout.imgW * 0.02 }}
                                            shadowOpacity={0.4}
                                        />
                                    )}

                                    {/* Image */}
                                    <KonvaImage
                                        image={konvaImage}
                                        x={layout.imgX}
                                        y={layout.imgY}
                                        width={layout.imgW}
                                        height={layout.imgH}
                                        // Add a thin white border for Floating to separate from bg
                                        stroke={template === 'floating' ? 'white' : undefined}
                                        strokeWidth={template === 'floating' ? layout.imgW * 0.01 : 0}
                                        cornerRadius={template === 'film' ? layout.imgW * 0.005 : 0}
                                    />

                                    {/* Text Info */}
                                    {customParams && (
                                        <Group>
                                            {(template === 'gallery' || template === 'polaroid') && (
                                                <Group x={layout.imgX} y={layout.imgY + layout.imgH + (layout.bottomH - layout.borderW) / 2}>
                                                    {/* Left: Brand/Model */}
                                                    <Text
                                                        text={`${customParams.make}\n${customParams.model}`}
                                                        fontSize={layout.imgH * 0.025 * fontSize * 1.2}
                                                        fontStyle="bold"
                                                        fill={textColor}
                                                        fontFamily={template === 'polaroid' ? 'Courier New, monospace' : 'Inter, sans-serif'}
                                                        lineHeight={1.2}
                                                        y={-layout.imgH * 0.025 * fontSize * 0.5}
                                                    />

                                                    {/* Right: Params */}
                                                    <Group>
                                                         <Text
                                                            text={`${customParams.focalLength}  ${customParams.fNumber}  ${customParams.exposureTime}  ${customParams.iso}`}
                                                            fontSize={layout.imgH * 0.025 * fontSize * 1.2}
                                                            fontStyle="bold"
                                                            fill={textColor}
                                                            fontFamily={template === 'polaroid' ? 'Courier New, monospace' : 'Inter, sans-serif'}
                                                            align="right"
                                                            width={layout.imgW}
                                                            y={-layout.imgH * 0.025 * fontSize * 0.5}
                                                        />
                                                        <Text
                                                            text={customParams.dateTime}
                                                            fontSize={layout.imgH * 0.02 * fontSize}
                                                            fill={textColor}
                                                            opacity={0.6}
                                                            fontFamily={template === 'polaroid' ? 'Courier New, monospace' : 'Inter, sans-serif'}
                                                            align="right"
                                                            width={layout.imgW}
                                                            y={layout.imgH * 0.025 * fontSize * 1.2}
                                                        />
                                                    </Group>
                                                </Group>
                                            )}

                                            {template === 'magazine' && (
                                                <Group x={layout.imgX} y={layout.imgY + layout.imgH + layout.bottomH * 0.1}>
                                                    <Text
                                                        text={customParams.model.toUpperCase()}
                                                        fontSize={layout.imgH * 0.08 * fontSize}
                                                        fontStyle="bold"
                                                        fill={textColor}
                                                        fontFamily="Impact, sans-serif"
                                                        align="center"
                                                        width={layout.imgW}
                                                        y={0}
                                                    />
                                                    <Rect
                                                        x={layout.imgW * 0.4}
                                                        y={layout.imgH * 0.1 * fontSize}
                                                        width={layout.imgW * 0.2}
                                                        height={2}
                                                        fill={textColor}
                                                    />
                                                    <Text
                                                        text={`${customParams.focalLength} | ${customParams.fNumber} | ${customParams.iso}`}
                                                        fontSize={layout.imgH * 0.025 * fontSize}
                                                        fill={textColor}
                                                        fontFamily="Inter, sans-serif"
                                                        align="center"
                                                        width={layout.imgW}
                                                        y={layout.imgH * 0.12 * fontSize}
                                                        letterSpacing={2}
                                                    />
                                                     <Text
                                                        text={customParams.dateTime}
                                                        fontSize={layout.imgH * 0.015 * fontSize}
                                                        fill={textColor}
                                                        opacity={0.5}
                                                        fontFamily="Inter, sans-serif"
                                                        align="center"
                                                        width={layout.imgW}
                                                        y={layout.imgH * 0.16 * fontSize}
                                                    />
                                                </Group>
                                            )}

                                            {template === 'film' && (
                                                <Group>
                                                    {/* Film Strip Simulation */}
                                                    {/* Sprocket Holes: Standard 35mm pitch is 4.75mm, hole is 2.8mm x 2mm */}
                                                    {/* We approximate ratio: Hole W ~ 0.6 * H, Gap ~ 0.4 * W */}
                                                    {Array.from({ length: Math.ceil(layout.totalW / (layout.bottomH * 0.5)) }).map((_, i) => {
                                                        const holeH = layout.bottomH * 0.6; // Taller holes
                                                        const holeW = holeH * 0.65; // Aspect ratio
                                                        const gap = holeW * 0.8;
                                                        const startX = (layout.totalW - (Math.ceil(layout.totalW / (holeW + gap)) * (holeW + gap))) / 2; // Center alignment
                                                        const x = startX + i * (holeW + gap);

                                                        if (x < -holeW || x > layout.totalW) return null;

                                                        return (
                                                            <Group key={`hole-${i}`}>
                                                                {/* Top Hole */}
                                                                <Rect
                                                                    x={x}
                                                                    y={(layout.bottomH - holeH) / 2}
                                                                    width={holeW}
                                                                    height={holeH}
                                                                    fill="#e2e2e2" // Slightly off-white for realistic light source
                                                                    cornerRadius={holeW * 0.25}
                                                                    shadowColor="white"
                                                                    shadowBlur={2}
                                                                    shadowOpacity={0.3}
                                                                />
                                                                {/* Bottom Hole */}
                                                                <Rect
                                                                    x={x}
                                                                    y={layout.totalH - layout.bottomH + (layout.bottomH - holeH) / 2}
                                                                    width={holeW}
                                                                    height={holeH}
                                                                    fill="#e2e2e2"
                                                                    cornerRadius={holeW * 0.25}
                                                                    shadowColor="white"
                                                                    shadowBlur={2}
                                                                    shadowOpacity={0.3}
                                                                />
                                                            </Group>
                                                        );
                                                    })}

                                                    {/* Edge Data (simulating Kodak/Fuji edge markings) */}
                                                    <Group opacity={0.85}>
                                                        <Text
                                                            text={`${customParams.make.toUpperCase()} ${customParams.model.toUpperCase()}   ►   ${customParams.iso}`}
                                                            fontSize={layout.bottomH * 0.2 * fontSize}
                                                            fill="#f59e0b" // Amber-500
                                                            fontFamily="Courier New, monospace"
                                                            fontStyle="bold"
                                                            align="center"
                                                            width={layout.totalW}
                                                            y={layout.totalH - layout.bottomH * 0.78}
                                                            shadowColor="#d97706"
                                                            shadowBlur={1}
                                                            shadowOpacity={0.5}
                                                        />
                                                        {/* Top Edge: Frame Numbers & Date */}
                                                        <Text
                                                            text={`${customParams.dateTime}    •    24    24A`}
                                                            fontSize={layout.bottomH * 0.2 * fontSize}
                                                            fill="#f59e0b"
                                                            fontFamily="Courier New, monospace"
                                                            fontStyle="bold"
                                                            align="center"
                                                            width={layout.totalW}
                                                            y={layout.bottomH * 0.58}
                                                            shadowColor="#d97706"
                                                            shadowBlur={1}
                                                            shadowOpacity={0.5}
                                                        />
                                                        {/* Frame Number Graphic on side */}
                                                        <Text
                                                            text="24"
                                                            fontSize={layout.bottomH * 0.35 * fontSize}
                                                            fill="#f59e0b"
                                                            fontFamily="Impact, sans-serif"
                                                            x={layout.totalW - layout.bottomH * 2}
                                                            y={layout.totalH - layout.bottomH * 0.85}
                                                            opacity={0.9}
                                                        />
                                                    </Group>
                                                </Group>
                                            )}

                                            {template === 'floating' && (
                                                <Group x={0} y={layout.totalH - layout.imgY / 2}>
                                                    <Text
                                                        text={`${customParams.dateTime} · ${customParams.model}`}
                                                        fontSize={layout.imgH * 0.015 * fontSize}
                                                        fill={textColor}
                                                        opacity={0.7}
                                                        fontFamily="Inter, sans-serif"
                                                        align="center"
                                                        width={layout.totalW}
                                                        offsetY={layout.imgH * 0.015 * fontSize / 2}
                                                        letterSpacing={1}
                                                    />
                                                </Group>
                                            )}
                                        </Group>
                                    )}
                                </Layer>
                            </Stage>
                        </div>
                    )}
                </div>

                {/* Right: Controls & EXIF */}
                <div className="w-80 bg-zinc-950 border-l border-white/10 flex flex-col z-10 h-full overflow-hidden">
                    <Tabs defaultValue="params" className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-white/10">
                            <h3 className="font-semibold text-sm mb-3">图片信息</h3>
                            <TabsList className="grid w-full grid-cols-2 bg-zinc-900 p-1">
                                <TabsTrigger value="params">参数编辑</TabsTrigger>
                                <TabsTrigger value="exif">原始数据</TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-6">
                                <TabsContent value="params" className="m-0 space-y-6">
                                    {/* Params Editing */}
                                    <div className="space-y-4">
                                        {customParams && (
                                            <div className="grid gap-3">
                                                <div className="grid grid-cols-4 items-center gap-2">
                                                    <Label className="text-xs text-gray-400">品牌</Label>
                                                    <Input
                                                        className="col-span-3 h-8 bg-zinc-900 border-zinc-800"
                                                        value={customParams.make}
                                                        onChange={(e) => updateParam('make', e.target.value)}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-4 items-center gap-2">
                                                    <Label className="text-xs text-gray-400">型号</Label>
                                                    <Input
                                                        className="col-span-3 h-8 bg-zinc-900 border-zinc-800"
                                                        value={customParams.model}
                                                        onChange={(e) => updateParam('model', e.target.value)}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-4 items-center gap-2">
                                                    <Label className="text-xs text-gray-400">镜头</Label>
                                                    <Input
                                                        className="col-span-3 h-8 bg-zinc-900 border-zinc-800"
                                                        value={customParams.lens}
                                                        onChange={(e) => updateParam('lens', e.target.value)}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Input
                                                        className="h-8 bg-zinc-900 border-zinc-800"
                                                        value={customParams.focalLength}
                                                        onChange={(e) => updateParam('focalLength', e.target.value)}
                                                        placeholder="焦距"
                                                    />
                                                    <Input
                                                        className="h-8 bg-zinc-900 border-zinc-800"
                                                        value={customParams.fNumber}
                                                        onChange={(e) => updateParam('fNumber', e.target.value)}
                                                        placeholder="光圈"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Input
                                                        className="h-8 bg-zinc-900 border-zinc-800"
                                                        value={customParams.exposureTime}
                                                        onChange={(e) => updateParam('exposureTime', e.target.value)}
                                                        placeholder="快门"
                                                    />
                                                    <Input
                                                        className="h-8 bg-zinc-900 border-zinc-800"
                                                        value={customParams.iso}
                                                        onChange={(e) => updateParam('iso', e.target.value)}
                                                        placeholder="ISO"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-4 items-center gap-2">
                                                    <Label className="text-xs text-gray-400">日期</Label>
                                                    <Input
                                                        className="col-span-3 h-8 bg-zinc-900 border-zinc-800"
                                                        value={customParams.dateTime}
                                                        onChange={(e) => updateParam('dateTime', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="exif" className="m-0">
                                    {selectedImage && (
                                        <Card className="bg-zinc-900 border-zinc-800 p-4 space-y-6">
                                            <div className="space-y-4">
                                                <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-400">文件</span>
                                                        <span className="font-mono truncate max-w-[150px]">{selectedImage.exif.fileName}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-400">分辨率</span>
                                                        <span className="font-mono">{selectedImage.exif.resolution}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-400">大小</span>
                                                        <span className="font-mono">{selectedImage.exif.fileSize}</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm py-1 border-b border-zinc-800">
                                                        <span className="text-gray-400">厂商</span>
                                                        <span>{selectedImage.exif.make}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm py-1 border-b border-zinc-800">
                                                        <span className="text-gray-400">型号</span>
                                                        <span>{selectedImage.exif.model}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm py-1 border-b border-zinc-800">
                                                        <span className="text-gray-400">软件</span>
                                                        <span className="truncate max-w-[150px]">{selectedImage.exif.software || '-'}</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-zinc-800/30 p-2 rounded text-center">
                                                        <div className="text-xs text-gray-500 uppercase">Focal</div>
                                                        <div className="font-medium">{selectedImage.exif.focalLength}</div>
                                                    </div>
                                                    <div className="bg-zinc-800/30 p-2 rounded text-center">
                                                        <div className="text-xs text-gray-500 uppercase">Aperture</div>
                                                        <div className="font-medium">{selectedImage.exif.fNumber}</div>
                                                    </div>
                                                    <div className="bg-zinc-800/30 p-2 rounded text-center">
                                                        <div className="text-xs text-gray-500 uppercase">Shutter</div>
                                                        <div className="font-medium">{selectedImage.exif.exposureTime}</div>
                                                    </div>
                                                    <div className="bg-zinc-800/30 p-2 rounded text-center">
                                                        <div className="text-xs text-gray-500 uppercase">ISO</div>
                                                        <div className="font-medium">{selectedImage.exif.iso}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    )}
                                </TabsContent>
                            </div>
                        </ScrollArea>

                        <div className="p-4 border-t border-white/10">
                            <Button className="w-full" size="lg" onClick={downloadImage}>
                                <Download className="w-4 h-4 mr-2" />
                                保存图片
                            </Button>
                        </div>
                    </Tabs>
                </div>
            </div>

            {/* Bottom: Gallery Bar */}
            <div className=" bg-zinc-900 border-t border-white/10 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">图库 ({images.length})</span>
                    </div>
                    <div className="flex gap-2">
                         {selectedId && (
                            <Button variant="ghost" size="sm" className="h-8 text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={() => handleDelete(selectedId)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                        <div className="relative">
                            <Button variant="ghost" size="sm" className="h-8">
                                <Plus className="w-4 h-4" />
                            </Button>
                            <div className="absolute inset-0 opacity-0 cursor-pointer">
                                <ImageUploader onUpload={handleUpload} className="w-full h-full" />
                            </div>
                        </div>
                    </div>
                </div>

                <ScrollArea className="flex-1 w-full whitespace-nowrap p-3">
                    <div className="flex gap-4 px-4 pb-2">
                        {images.map((img) => (
                            <div
                                key={img.id}
                                onClick={() => setSelectedId(img.id)}
                                className={`relative group cursor-pointer transition-all duration-300 flex-shrink-0 ${
                                    selectedId === img.id
                                        ? 'ring-2 ring-white scale-105'
                                        : 'opacity-60 hover:opacity-100 hover:scale-105'
                                }`}
                            >
                                <div className="w-20 h-20 rounded-lg overflow-hidden bg-black">
                                    <img
                                        src={img.url}
                                        alt="thumbnail"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        ))}
                         {/* Add Button in List */}
                        <div className="w-20 h-20 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center cursor-pointer hover:border-zinc-500 hover:bg-zinc-800 transition-all flex-shrink-0 relative">
                             <Plus className="w-6 h-6 text-zinc-600" />
                             <div className="absolute inset-0 opacity-0">
                                <ImageUploader onUpload={handleUpload} className="w-full h-full" />
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
};

export default PhotoFrame;
