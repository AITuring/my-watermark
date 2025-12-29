import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Text, Group, Circle, Line } from 'react-konva';
import useImage from 'use-image';
import ExifReader from 'exifreader';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import ImageUploader from './ImageUploader';
import { Download, RotateCcw, Upload, Trash2, Plus, Image as ImageIcon, Film, BoxSelect, Camera, Newspaper, Aperture, Copy, Calendar as CalendarIcon } from 'lucide-react';
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

type FrameTemplate = 'gallery' | 'floating' | 'polaroid' | 'magazine' | 'film' | 'round';
type AspectRatio = 'original' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3' | '21:9';
type WatermarkStyle = 'classic' | 'tech' | 'minimal' | 'bold' | 'simple';

const PhotoFrame: React.FC = () => {
    // State
    const [images, setImages] = useState<FrameImage[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [template, setTemplate] = useState<FrameTemplate>('gallery');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('original');
    const [watermarkStyle, setWatermarkStyle] = useState<WatermarkStyle>('classic');

    // Style Settings
    const [borderSize, setBorderSize] = useState(0.05); // 0.0 - 0.15
    const [bottomSize, setBottomSize] = useState(0.15); // 0.0 - 0.25 (Only for Gallery)
    const [fontSize, setFontSize] = useState(1);
    const [borderColor, setBorderColor] = useState('#ffffff');
    const [textColor, setTextColor] = useState('#000000');
    const [autoTextColor, setAutoTextColor] = useState(true);

    // Floating Specific
    const [floatingBorderColor, setFloatingBorderColor] = useState('#ffffff');
    const [floatingShadow, setFloatingShadow] = useState(true);
    const [floatingShadowSize, setFloatingShadowSize] = useState(0.05);
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [bgImageObj] = useImage(backgroundImage || '', 'anonymous');

    const [roundRingColor, setRoundRingColor] = useState('#000000');
    const [roundRingWidth, setRoundRingWidth] = useState(0.015);

    // Unified Image Transform State (Scale & Position)
    const [imgParams, setImgParams] = useState({ scale: 1, x: 0, y: 0 });

    const PRESETS = {
        brands: ['Sony', 'Fujifilm', 'Canon', 'Nikon', 'Leica', 'Apple', 'DJI', 'Hasselblad', 'Panasonic', 'Olympus', 'Ricoh', 'Sigma'],
        models: ['A7M4', 'A7R5', 'X100VI', 'X-T5', 'R5', 'R6', 'Zf', 'Z8', 'M11', 'Q3', 'iPhone 16 Pro', 'GR IIIx'],
        focalLengths: ['16mm', '24mm', '28mm', '35mm', '50mm', '85mm', '105mm', '135mm', '200mm'],
        apertures: ['f/1.2', 'f/1.4', 'f/1.8', 'f/2.0', 'f/2.8', 'f/4', 'f/5.6', 'f/8', 'f/11', 'f/16', 'f/22'],
        isos: ['50', '100', '125', '160', '200', '400', '800', '1600', '3200', '6400', '12800'],
        shutters: ['1/8000', '1/4000', '1/2000', '1/1000', '1/500', '1/250', '1/125', '1/60', '1/30', '1/15', '1/8', '1/4', '1/2', '1"', '30"']
    };

    const ZEN_BACKGROUNDS = [
        { name: '纯净', url: null, color: '#ffffff' },
        { name: '宣纸', url: 'https://images.unsplash.com/photo-1528459061998-56fd57ad86e3?auto=format&fit=crop&w=800&q=80', color: '#f5f5f0' },
        { name: '水墨', url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=800&q=80', color: '#e0e5ec' },
        { name: '迷雾', url: 'https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?auto=format&fit=crop&w=800&q=80', color: '#cfd8dc' },
        { name: '枯山水', url: 'https://images.unsplash.com/photo-1599940778173-e276d4acb2e7?auto=format&fit=crop&w=800&q=80', color: '#e6d2b5' },
    ];

    // Editable Params (Per image overrides could be complex, keeping global for now or sync on select)
    // To support per-image edits, we might need to store these in the FrameImage object.
    // For simplicity, let's keep it bound to the selected image's displayed values.
    const [customParams, setCustomParams] = useState<ExifData | null>(null);

    const stageRef = useRef<any>(null);
    const selectedImage = useMemo(() => images.find(img => img.id === selectedId), [images, selectedId]);
    const [konvaImage] = useImage(selectedImage?.url || '', 'anonymous');

    // Reset image params when image, template or aspect ratio changes
    useEffect(() => {
        setImgParams({ scale: 1, x: 0, y: 0 });
    }, [selectedId, template, aspectRatio]);

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

    const copyImage = async () => {
        if (stageRef.current && selectedImage) {
            try {
                const pixelRatio = 3;
                const dataUrl = stageRef.current.toDataURL({ pixelRatio });
                const blob = await (await fetch(dataUrl)).blob();
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
                toast.success("已复制到剪贴板");
            } catch (err) {
                console.error(err);
                toast.error("复制失败，请尝试使用保存功能");
            }
        }
    };

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedId || images.length <= 1) return;
            // Avoid conflict with input fields
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const currentIndex = images.findIndex(img => img.id === selectedId);
            if (currentIndex === -1) return;

            if (e.key === 'ArrowLeft') {
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
                setSelectedId(images[prevIndex].id);
            } else if (e.key === 'ArrowRight') {
                const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
                setSelectedId(images[nextIndex].id);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [images, selectedId]);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            await handleUpload(files);
            toast.success(`已添加 ${files.length} 张图片`);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
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

        let imgW = konvaImage.width;
        let imgH = konvaImage.height;

        // Apply Aspect Ratio Crop (Skip for Round, it uses Canvas Padding)
        if (aspectRatio !== 'original' && template !== 'round') {
            const currentRatio = imgW / imgH;
            let targetRatio = 1;

            switch (aspectRatio) {
                case '1:1': targetRatio = 1; break;
                case '4:3': targetRatio = 4 / 3; break;
                case '3:4': targetRatio = 3 / 4; break;
                case '16:9': targetRatio = 16 / 9; break;
                case '9:16': targetRatio = 9 / 16; break;
                case '3:2': targetRatio = 3 / 2; break;
                case '2:3': targetRatio = 2 / 3; break;
                case '21:9': targetRatio = 21 / 9; break;
            }

            if (currentRatio > targetRatio) {
                // Image is wider than target: Crop Width
                imgW = imgH * targetRatio;
            } else {
                // Image is taller than target: Crop Height
                imgH = imgW / targetRatio;
            }
        }

        let borderW = imgW * borderSize;
        let bottomH = 0;
        let totalW = 0;
        let totalH = 0;
        let imgX = 0;
        let imgY = 0;
        let roundDiameter = 0;
        let roundPad = 0;

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
        } else if (template === 'round') {
            const diameter = Math.min(imgW, imgH);
            const pad = Math.max(diameter * 0.15, imgW * borderSize);

            // Base Dimensions (Square)
            let finalW = diameter + pad * 2;
            let finalH = diameter + pad * 2;

            // Apply Aspect Ratio as Canvas Padding for Round
            if (aspectRatio !== 'original') {
                let targetRatio = 1;
                switch (aspectRatio) {
                    case '1:1': targetRatio = 1; break;
                    case '4:3': targetRatio = 4 / 3; break;
                    case '3:4': targetRatio = 3 / 4; break;
                    case '16:9': targetRatio = 16 / 9; break;
                    case '9:16': targetRatio = 9 / 16; break;
                    case '3:2': targetRatio = 3 / 2; break;
                    case '2:3': targetRatio = 2 / 3; break;
                    case '21:9': targetRatio = 21 / 9; break;
                }

                const currentRatio = finalW / finalH; // Always 1 initially
                if (targetRatio > currentRatio) {
                    finalW = finalH * targetRatio;
                } else {
                    finalH = finalW / targetRatio;
                }
            }

            totalW = finalW;
            totalH = finalH;

            // Center the Round Content (Circle) in the Canvas
            imgX = (totalW - diameter) / 2;
            imgY = (totalH - diameter) / 2;

            bottomH = 0;
            borderW = pad;
            roundDiameter = diameter;
            roundPad = pad;
        }

        const scale = Math.min(stageWidth / totalW, stageHeight / totalH);

        return { totalW, totalH, imgX, imgY, imgW, imgH, scale, bottomH, borderW, roundPad, roundDiameter };
    }, [konvaImage, template, borderSize, bottomSize, stageWidth, stageHeight, aspectRatio]);

    // Handle param changes
    const updateParam = (key: keyof ExifData, value: string) => {
        if (customParams) {
            setCustomParams({ ...customParams, [key]: value });
        }
    };

    // Helper to get ISO string for the date input value
    const getIsoDate = (dateStr: string) => {
        if (!dateStr) return '';
        const cleanStr = dateStr.trim();
        // Replace colons in date part (YYYY:MM:DD) with dashes
        let iso = cleanStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
        // Replace space with T
        if (iso.includes(' ')) iso = iso.replace(' ', 'T');

        const date = new Date(iso);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        return '';
    };

    const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateVal = e.target.value; // YYYY-MM-DDTHH:mm
        if (!dateVal) return;

        const date = new Date(dateVal);
        if (isNaN(date.getTime())) return;

        // Format to YYYY:MM:DD HH:MM:SS
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = '00';

        const formatted = `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
        updateParam('dateTime', formatted);
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
             <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white text-black dark:bg-zinc-950 dark:text-white">
                <div className="w-full max-w-xl p-8 border rounded-xl backdrop-blur-sm text-center bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-white/10">
                    <div className="mb-6 flex justify-center">
                        <div className="p-4 rounded-full bg-black/10 dark:bg-white/10">
                            <Upload className="w-10 h-10 text-black dark:text-white" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">上传图片</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">添加优雅的边框和拍摄参数</p>
                    <ImageUploader onUpload={handleUpload} />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col h-full w-full bg-white text-black dark:bg-zinc-950 dark:text-white overflow-hidden">
            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Style Controls */}
                <div className="w-80 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/10 flex flex-col z-10 h-full overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                        <h3 className="font-semibold text-sm">外观样式</h3>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-6">
                            {/* Aspect Ratio Selector */}
                            {template !== 'round' && (
                                <div className="space-y-3">
                                    <Label>图片比例</Label>
                                    <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                                        <SelectTrigger className="w-full bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                                            <span className="truncate">{aspectRatio === 'original' ? '原始比例' : aspectRatio}</span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="original">原始比例</SelectItem>
                                            <SelectItem value="1:1">1:1 (正方形)</SelectItem>
                                            <SelectItem value="4:3">4:3 (横向)</SelectItem>
                                            <SelectItem value="3:4">3:4 (纵向)</SelectItem>
                                            <SelectItem value="3:2">3:2 (标准)</SelectItem>
                                            <SelectItem value="2:3">2:3 (标准)</SelectItem>
                                            <SelectItem value="16:9">16:9 (电影)</SelectItem>
                                            <SelectItem value="9:16">9:16 (快拍)</SelectItem>
                                            <SelectItem value="21:9">21:9 (宽屏)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                             {/* Watermark Style Selector (Gallery Only) */}
                             {template === 'gallery' && (
                                <div className="space-y-3">
                                    <Label>水印布局</Label>
                                    <Select value={watermarkStyle} onValueChange={(v) => setWatermarkStyle(v as WatermarkStyle)}>
                                        <SelectTrigger className="w-full bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                                            <span className="truncate">
                                                {watermarkStyle === 'classic' && '经典布局'}
                                                {watermarkStyle === 'tech' && '旗舰影像 (模拟)'}
                                                {watermarkStyle === 'minimal' && '极简居中'}
                                                {watermarkStyle === 'bold' && '居中大字'}
                                                {watermarkStyle === 'simple' && '左对齐'}
                                            </span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="classic">经典布局</SelectItem>
                                            <SelectItem value="tech">旗舰影像 (模拟)</SelectItem>
                                            <SelectItem value="minimal">极简居中</SelectItem>
                                            <SelectItem value="bold">居中大字</SelectItem>
                                            <SelectItem value="simple">左对齐</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Templates */}
                            <div className="space-y-3">
                                <Label>模版风格</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'gallery', name: '画廊', icon: ImageIcon },
                                        { id: 'round', name: '圆形', icon: Aperture },
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
                                                    : 'bg-zinc-100 border-zinc-200 text-gray-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-800'
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
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <Label>图片缩放</Label>
                                        <span className="text-xs text-muted-foreground">{Math.round(imgParams.scale * 100)}%</span>
                                    </div>
                                    <Slider
                                        value={[imgParams.scale * 100]}
                                        min={50}
                                        max={500}
                                        step={5}
                                        onValueChange={(v) => setImgParams(prev => ({ ...prev, scale: v[0] / 100 }))}
                                    />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => setImgParams({ scale: 1, x: 0, y: 0 })} className="h-6 text-xs text-muted-foreground">
                                        重置图片位置
                                    </Button>
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
                                                onClick={() => {
                                                    setBorderColor(c);
                                                    setBackgroundImage(null);
                                                }}
                                            />
                                        ))}
                                        <input
                                            type="color"
                                            value={borderColor}
                                            onChange={(e) => {
                                                setBorderColor(e.target.value);
                                                setBackgroundImage(null);
                                            }}
                                            className="w-6 h-6 rounded-full overflow-hidden border-0 p-0"
                                        />
                                    </div>
                                </div>

                                {template === 'floating' && (
                                    <div className="space-y-4 border-t border-white/10 pt-4 mt-4">
                                        <Label className="text-xs font-semibold text-gray-400">悬浮样式设置</Label>

                                        {/* Zen Backgrounds */}
                                        <div className="space-y-2">
                                            <Label className="text-xs">禅意背景</Label>
                                            <div className="grid grid-cols-5 gap-2">
                                                {ZEN_BACKGROUNDS.map((bg) => (
                                                    <button
                                                        key={bg.name}
                                                        onClick={() => {
                                                            setBackgroundImage(bg.url);
                                                            if (bg.url === null) setBorderColor('#ffffff');
                                                        }}
                                                        className={`w-full aspect-square rounded-md overflow-hidden border transition-all ${
                                                            backgroundImage === bg.url ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-white/10 hover:border-white/30'
                                                        }`}
                                                        title={bg.name}
                                                    >
                                                        {bg.url ? (
                                                            <img src={bg.url} className="w-full h-full object-cover" alt={bg.name} />
                                                        ) : (
                                                            <div className="w-full h-full bg-white flex items-center justify-center">
                                                                <span className="text-[10px] text-black">无</span>
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">内边框颜色</Label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="color"
                                                    value={floatingBorderColor}
                                                    onChange={(e) => setFloatingBorderColor(e.target.value)}
                                                    className="w-6 h-6 rounded-full overflow-hidden border-0 p-0"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">显示阴影</Label>
                                            <Switch checked={floatingShadow} onCheckedChange={setFloatingShadow} />
                                        </div>

                                        {floatingShadow && (
                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <Label className="text-xs">阴影宽度</Label>
                                                    <span className="text-xs text-muted-foreground">{Math.round(floatingShadowSize * 100)}%</span>
                                                </div>
                                                <Slider
                                                    value={[floatingShadowSize * 100]} max={15} step={0.5}
                                                    onValueChange={(v) => setFloatingShadowSize(v[0] / 100)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {template === 'round' && (
                                    <div className="space-y-4 border-t border-white/10 pt-4 mt-4">
                                        <Label className="text-xs font-semibold text-gray-400">圆形样式设置</Label>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">圆环颜色</Label>
                                            <input type="color" value={roundRingColor} onChange={(e) => setRoundRingColor(e.target.value)} className="w-6 h-6 rounded-full overflow-hidden border-0 p-0" />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <Label className="text-xs">圆环宽度</Label>
                                                <span className="text-xs text-muted-foreground">{Math.round(roundRingWidth * 100)}%</span>
                                            </div>
                                            <Slider value={[roundRingWidth * 100]} max={10} step={0.5} onValueChange={(v) => setRoundRingWidth(v[0] / 100)} />
                                        </div>
                                    </div>
                                )}

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
                <div
                    className="flex-1 flex items-center justify-center bg-zinc-100/50 dark:bg-zinc-900/30 p-8 relative"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >
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
                                        fill={template === 'film' ? '#111111' : (backgroundImage ? undefined : borderColor)}
                                        fillPatternImage={backgroundImage && bgImageObj ? bgImageObj : undefined}
                                        fillPatternScale={
                                            backgroundImage && bgImageObj ? {
                                                x: layout.totalW / bgImageObj.width,
                                                y: layout.totalH / bgImageObj.height
                                            } : undefined
                                        }
                                    />

                                    {/* Shadow for Floating */}
                                    {template === 'floating' && floatingShadow && (
                                        <Rect
                                            x={layout.imgX}
                                            y={layout.imgY}
                                            width={layout.imgW}
                                            height={layout.imgH}
                                            fill="black"
                                            shadowColor="black"
                                            shadowBlur={layout.imgW * floatingShadowSize}
                                            shadowOffset={{ x: layout.imgW * (floatingShadowSize * 0.4), y: layout.imgW * (floatingShadowSize * 0.4) }}
                                            shadowOpacity={0.4}
                                        />
                                    )}

                                    {/* Image */}
                                    {(() => {
                                        // Unified Image Rendering Logic
                                        const isRound = template === 'round';

                                        // Viewport Dimensions (The masking area)
                                        const viewW = isRound ? layout.roundDiameter : layout.imgW;
                                        const viewH = isRound ? layout.roundDiameter : layout.imgH;

                                        // Base Scale to Fit/Cover
                                        const baseScale = Math.max(viewW / konvaImage.width, viewH / konvaImage.height);

                                        // Current Display Dimensions
                                        const currentScale = baseScale * imgParams.scale;
                                        const dispW = konvaImage.width * currentScale;
                                        const dispH = konvaImage.height * currentScale;

                                        // Bounds Calculation for Drag
                                        // We want to allow dragging but keep image covering the view if possible (if larger)
                                        // Or contained if smaller?
                                        // "Fill display area" -> We enforce covering if scale >= 1

                                        const minX = viewW - dispW;
                                        const minY = viewH - dispH;
                                        const maxX = 0; // Assuming top-left alignment base
                                        const maxY = 0;

                                        // Position
                                        // We apply imgParams.x/y as offsets
                                        // But we need to clamp them effectively during drag end

                                        // Group Position
                                        const groupX = layout.imgX;
                                        const groupY = layout.imgY;

                                        return (
                                            <Group
                                                x={groupX}
                                                y={groupY}
                                                clipFunc={isRound ? (ctx) => {
                                                    const d = layout.roundDiameter;
                                                    ctx.beginPath();
                                                    ctx.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2);
                                                    ctx.closePath();
                                                } : undefined}
                                                clipX={!isRound ? 0 : undefined}
                                                clipY={!isRound ? 0 : undefined}
                                                clipWidth={!isRound ? viewW : undefined}
                                                clipHeight={!isRound ? viewH : undefined}
                                            >
                                                <KonvaImage
                                                    image={konvaImage}
                                                    x={imgParams.x} // Controlled position
                                                    y={imgParams.y}
                                                    scaleX={currentScale}
                                                    scaleY={currentScale}
                                                    draggable
                                                    onDragEnd={(e) => {
                                                        const node = e.target;
                                                        const x = node.x();
                                                        const y = node.y();

                                                        // Calculate Bounds based on *current* scale
                                                        // Re-calculate local vars because closure might be stale?
                                                        // No, render scope is fresh.

                                                        let newX = x;
                                                        let newY = y;

                                                        // Constrain: Image should not leave the Viewport empty
                                                        // If dispW > viewW, x must be between minX and maxX
                                                        if (dispW >= viewW) {
                                                            if (newX < minX) newX = minX;
                                                            if (newX > maxX) newX = maxX;
                                                        } else {
                                                            // If image is smaller than view (e.g. zoomed out below fit), center it?
                                                            // Or just clamp to bounds?
                                                            // For now, let's clamp to center or left?
                                                            // Simple: clamp to bounds usually works.
                                                            // If dispW < viewW, minX is POSITIVE. maxX is 0.
                                                            // So x must be between minX (positive) and 0? No.
                                                            // If dispW < viewW, we probably want to center.
                                                            newX = (viewW - dispW) / 2;
                                                        }

                                                        if (dispH >= viewH) {
                                                            if (newY < minY) newY = minY;
                                                            if (newY > maxY) newY = maxY;
                                                        } else {
                                                            newY = (viewH - dispH) / 2;
                                                        }

                                                        // Snap animation
                                                        if (Math.abs(newX - x) > 1 || Math.abs(newY - y) > 1) {
                                                            node.to({
                                                                x: newX,
                                                                y: newY,
                                                                duration: 0.2,
                                                                easing: Konva.Easings.EaseOut,
                                                                onFinish: () => {
                                                                    setImgParams(p => ({ ...p, x: newX, y: newY }));
                                                                }
                                                            });
                                                        } else {
                                                            setImgParams(p => ({ ...p, x: newX, y: newY }));
                                                        }
                                                    }}
                                                    onWheel={(e) => {
                                                        e.evt.preventDefault();
                                                        e.evt.stopPropagation();

                                                        const stage = e.target.getStage();
                                                        if (!stage) return;

                                                        const scaleBy = 1.05;
                                                        const oldScale = imgParams.scale;
                                                        const pointer = stage.getPointerPosition();

                                                        if (!pointer) return;

                                                        // Pointer relative to the Group
                                                        // Group absolute position = groupX * layout.scale
                                                        // Wait, stage scale affects everything.
                                                        // The Group is at (groupX, groupY) inside the Stage.
                                                        // Stage is scaled by layout.scale.
                                                        // So Group screen pos = (groupX * layout.scale, groupY * layout.scale).
                                                        // Pointer is in screen coordinates? No, Konva pointer is usually stage relative?
                                                        // getPointerPosition returns position relative to container (stage).

                                                        // Mouse relative to Group (unscaled by stage)
                                                        const mouseX = (pointer.x / layout.scale) - groupX;
                                                        const mouseY = (pointer.y / layout.scale) - groupY;

                                                        // Mouse relative to Image (before zoom)
                                                        // Image is at (imgParams.x, imgParams.y) inside Group
                                                        const mousePointTo = {
                                                            x: (mouseX - imgParams.x) / oldScale,
                                                            y: (mouseY - imgParams.y) / oldScale,
                                                        };

                                                        const newScaleRaw = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
                                                        // Limit scale (0.5x to 5x)
                                                        const newScale = Math.max(0.5, Math.min(5, newScaleRaw));

                                                        const newPos = {
                                                            x: mouseX - mousePointTo.x * newScale,
                                                            y: mouseY - mousePointTo.y * newScale,
                                                        };

                                                        setImgParams({ scale: newScale, ...newPos });
                                                    }}
                                                    // Add stroke/border properties for non-Round templates
                                                    stroke={!isRound && template === 'floating' ? floatingBorderColor : undefined}
                                                    strokeWidth={!isRound && template === 'floating' ? layout.imgW * 0.01 : 0}
                                                    cornerRadius={!isRound && template === 'film' ? layout.imgW * 0.005 : 0}
                                                />
                                                {/* Round Template Ring (Overlay) */}
                                                {isRound && (
                                                    <Circle
                                                        x={layout.roundDiameter / 2}
                                                        y={layout.roundDiameter / 2}
                                                        radius={layout.roundDiameter / 2}
                                                        stroke={roundRingColor}
                                                        strokeWidth={Math.max(2, layout.roundDiameter * roundRingWidth)}
                                                        listening={false} // Pass events through to image
                                                    />
                                                )}
                                            </Group>
                                        );
                                    })()}

                                    {/* Text Info */}
                                    {customParams && (
                                        <Group>
                                            {(template === 'gallery' || template === 'polaroid') && (
                                                <Group x={layout.imgX} y={layout.imgY + layout.imgH + (layout.bottomH - layout.borderW) / 2}>

                                                    {/* Style: Classic (Original) */}
                                                    {(watermarkStyle === 'classic' || template === 'polaroid') && (
                                                        <Group>
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

                                                    {/* Style: Tech (Simulated Brand Layout) */}
                                                    {template === 'gallery' && watermarkStyle === 'tech' && (
                                                        <Group>
                                                            {/* Logo/Brand Area (Simulated Red Dot if Leica/Xiaomi, or just text) */}
                                                            <Group y={-layout.imgH * 0.015 * fontSize}>
                                                                <Circle
                                                                    radius={layout.imgH * 0.035 * fontSize}
                                                                    fill="#D90000"
                                                                    y={layout.imgH * 0.015 * fontSize}
                                                                    x={layout.imgH * 0.035 * fontSize}
                                                                />
                                                                <Text
                                                                    text={customParams.make.substring(0, 1).toUpperCase()}
                                                                    fontSize={layout.imgH * 0.03 * fontSize}
                                                                    fontStyle="bold"
                                                                    fill="white"
                                                                    align="center"
                                                                    width={layout.imgH * 0.07 * fontSize}
                                                                    y={0}
                                                                />
                                                            </Group>

                                                            <Text
                                                                text={`${customParams.model}`}
                                                                fontSize={layout.imgH * 0.03 * fontSize}
                                                                fontStyle="bold"
                                                                fill={textColor}
                                                                x={layout.imgH * 0.09 * fontSize}
                                                                y={-layout.imgH * 0.005 * fontSize}
                                                            />

                                                            {/* Divider & Params */}
                                                            <Group x={layout.imgW} offsetX={0}>
                                                                <Line
                                                                    points={[0, -layout.imgH * 0.02 * fontSize, 0, layout.imgH * 0.05 * fontSize]}
                                                                    stroke={textColor}
                                                                    strokeWidth={1}
                                                                    opacity={0.3}
                                                                    x={-layout.imgW * 0.35} // Approx pos
                                                                />
                                                                {/* We need precise alignment, using right alignment on width */}
                                                                <Text
                                                                    text={`${customParams.focalLength} ${customParams.fNumber} ${customParams.exposureTime} ${customParams.iso}`}
                                                                    fontSize={layout.imgH * 0.022 * fontSize}
                                                                    fontStyle="bold"
                                                                    fill={textColor}
                                                                    align="right"
                                                                    width={layout.imgW}
                                                                    y={-layout.imgH * 0.015 * fontSize}
                                                                />
                                                                 <Text
                                                                    text={customParams.dateTime}
                                                                    fontSize={layout.imgH * 0.018 * fontSize}
                                                                    fill={textColor}
                                                                    opacity={0.5}
                                                                    align="right"
                                                                    width={layout.imgW}
                                                                    y={layout.imgH * 0.02 * fontSize}
                                                                />
                                                            </Group>
                                                        </Group>
                                                    )}

                                                    {/* Style: Minimal (Centered) */}
                                                    {template === 'gallery' && watermarkStyle === 'minimal' && (
                                                        <Group>
                                                            <Text
                                                                text={`${customParams.model}  ·  ${customParams.focalLength} ${customParams.fNumber} ${customParams.iso}`}
                                                                fontSize={layout.imgH * 0.02 * fontSize}
                                                                fill={textColor}
                                                                opacity={0.8}
                                                                align="center"
                                                                width={layout.imgW}
                                                                y={-layout.imgH * 0.01 * fontSize}
                                                            />
                                                            <Text
                                                                text={customParams.dateTime}
                                                                fontSize={layout.imgH * 0.015 * fontSize}
                                                                fill={textColor}
                                                                opacity={0.5}
                                                                align="center"
                                                                width={layout.imgW}
                                                                y={layout.imgH * 0.02 * fontSize}
                                                            />
                                                        </Group>
                                                    )}

                                                    {/* Style: Bold (Center Big Model) */}
                                                    {template === 'gallery' && watermarkStyle === 'bold' && (
                                                        <Group>
                                                            <Text
                                                                text={customParams.model.toUpperCase()}
                                                                fontSize={layout.imgH * 0.04 * fontSize}
                                                                fontStyle="bold"
                                                                fill={textColor}
                                                                align="center"
                                                                width={layout.imgW}
                                                                y={-layout.imgH * 0.02 * fontSize}
                                                                letterSpacing={2}
                                                            />
                                                            <Text
                                                                text={`${customParams.focalLength} | ${customParams.fNumber} | ${customParams.exposureTime} | ${customParams.iso}`}
                                                                fontSize={layout.imgH * 0.018 * fontSize}
                                                                fill={textColor}
                                                                opacity={0.7}
                                                                align="center"
                                                                width={layout.imgW}
                                                                y={layout.imgH * 0.035 * fontSize}
                                                            />
                                                        </Group>
                                                    )}

                                                     {/* Style: Simple (Left Aligned) */}
                                                     {template === 'gallery' && watermarkStyle === 'simple' && (
                                                        <Group>
                                                            <Text
                                                                text={`${customParams.model}`}
                                                                fontSize={layout.imgH * 0.025 * fontSize}
                                                                fontStyle="bold"
                                                                fill={textColor}
                                                                y={-layout.imgH * 0.015 * fontSize}
                                                            />
                                                            <Text
                                                                text={`${customParams.focalLength}  ${customParams.fNumber}  ${customParams.iso}  ${customParams.dateTime}`}
                                                                fontSize={layout.imgH * 0.02 * fontSize}
                                                                fill={textColor}
                                                                opacity={0.6}
                                                                y={layout.imgH * 0.02 * fontSize}
                                                            />
                                                        </Group>
                                                    )}

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
                                                        const holeH = layout.bottomH * 0.55; // Slightly reduced height to give more room for text
                                                        const holeW = holeH * 0.65;
                                                        const gap = holeW * 0.8;
                                                        const startX = (layout.totalW - (Math.ceil(layout.totalW / (holeW + gap)) * (holeW + gap))) / 2;
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
                                                                    fill="#e2e2e2"
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
                                                        {/* Bottom Bar Text: Camera Model & ISO - Moved strictly to the top edge of bottom bar */}
                                                        <Text
                                                            text={`${customParams.make.toUpperCase()} ${customParams.model.toUpperCase()}   ►   ${customParams.iso}`}
                                                            fontSize={layout.bottomH * 0.12 * fontSize}
                                                            fill="#f59e0b" // Amber-500
                                                            fontFamily="Courier New, monospace"
                                                            fontStyle="bold"
                                                            align="center"
                                                            width={layout.totalW}
                                                            y={layout.totalH - layout.bottomH + layout.bottomH * 0.05}
                                                            shadowColor="#d97706"
                                                            shadowBlur={1}
                                                            shadowOpacity={0.5}
                                                        />
                                                        {/* Top Bar Text: Frame Numbers & Date - Moved strictly to the bottom edge of top bar */}
                                                        <Text
                                                            text={`${customParams.dateTime}    •    24    24A`}
                                                            fontSize={layout.bottomH * 0.12 * fontSize}
                                                            fill="#f59e0b"
                                                            fontFamily="Courier New, monospace"
                                                            fontStyle="bold"
                                                            align="center"
                                                            width={layout.totalW}
                                                            y={layout.bottomH * 0.85}
                                                            shadowColor="#d97706"
                                                            shadowBlur={1}
                                                            shadowOpacity={0.5}
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
                <div className="w-80 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-white/10 flex flex-col z-10 h-full overflow-hidden">
                    <Tabs defaultValue="params" className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-white/10">
                            <h3 className="font-semibold text-sm mb-3">图片信息</h3>
                            <TabsList className="grid w-full grid-cols-2 bg-zinc-100 dark:bg-zinc-900 p-1">
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
                                                    <div className="col-span-3 flex gap-1">
                                                        <Input
                                                            className="h-8 flex-1 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-black dark:text-white"
                                                            value={customParams.make}
                                                            onChange={(e) => updateParam('make', e.target.value)}
                                                        />
                                                        <Select onValueChange={(v) => updateParam('make', v)}>
                                                            <SelectTrigger className="h-8 w-8 px-0 justify-center bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-muted-foreground">
                                                                <span className="sr-only">选择品牌</span>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {PRESETS.brands.map(b => (
                                                                    <SelectItem key={b} value={b}>{b}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-4 items-center gap-2">
                                                    <Label className="text-xs text-gray-400">型号</Label>
                                                    <div className="col-span-3 flex gap-1">
                                                        <Input
                                                            className="h-8 flex-1 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-black dark:text-white"
                                                            value={customParams.model}
                                                            onChange={(e) => updateParam('model', e.target.value)}
                                                        />
                                                        <Select onValueChange={(v) => updateParam('model', v)}>
                                                            <SelectTrigger className="h-8 w-8 px-0 justify-center bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-muted-foreground">
                                                                <span className="sr-only">选择型号</span>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {PRESETS.models.map(m => (
                                                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-4 items-center gap-2">
                                                    <Label className="text-xs text-gray-400">镜头</Label>
                                                    <Input
                                                        className="col-span-3 h-8 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-black dark:text-white"
                                                        value={customParams.lens}
                                                        onChange={(e) => updateParam('lens', e.target.value)}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="flex gap-1">
                                                        <Input
                                                            className="h-8 flex-1 min-w-0 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-black dark:text-white"
                                                            value={customParams.focalLength}
                                                            onChange={(e) => updateParam('focalLength', e.target.value)}
                                                            placeholder="焦距"
                                                        />
                                                        <Select onValueChange={(v) => updateParam('focalLength', v)}>
                                                            <SelectTrigger className="h-8 w-6 px-0 justify-center bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-muted-foreground">
                                                                <span className="sr-only">焦距</span>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {PRESETS.focalLengths.map(f => (
                                                                    <SelectItem key={f} value={f}>{f}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Input
                                                            className="h-8 flex-1 min-w-0 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-black dark:text-white"
                                                            value={customParams.fNumber}
                                                            onChange={(e) => updateParam('fNumber', e.target.value)}
                                                            placeholder="光圈"
                                                        />
                                                        <Select onValueChange={(v) => updateParam('fNumber', v)}>
                                                            <SelectTrigger className="h-8 w-6 px-0 justify-center bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-muted-foreground">
                                                                <span className="sr-only">光圈</span>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {PRESETS.apertures.map(a => (
                                                                    <SelectItem key={a} value={a}>{a}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="flex gap-1">
                                                        <Input
                                                            className="h-8 flex-1 min-w-0 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-black dark:text-white"
                                                            value={customParams.exposureTime}
                                                            onChange={(e) => updateParam('exposureTime', e.target.value)}
                                                            placeholder="快门"
                                                        />
                                                        <Select onValueChange={(v) => updateParam('exposureTime', v)}>
                                                            <SelectTrigger className="h-8 w-6 px-0 justify-center bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-muted-foreground">
                                                                <span className="sr-only">快门</span>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {PRESETS.shutters.map(s => (
                                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Input
                                                            className="h-8 flex-1 min-w-0 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-black dark:text-white"
                                                            value={customParams.iso}
                                                            onChange={(e) => updateParam('iso', e.target.value)}
                                                            placeholder="ISO"
                                                        />
                                                        <Select onValueChange={(v) => updateParam('iso', v)}>
                                                            <SelectTrigger className="h-8 w-6 px-0 justify-center bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-muted-foreground">
                                                                <span className="sr-only">ISO</span>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {PRESETS.isos.map(i => (
                                                                    <SelectItem key={i} value={i}>{i}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-4 items-center gap-2">
                                                    <Label className="text-xs text-gray-400">日期</Label>
                                                    <div className="col-span-3 flex gap-2">
                                                        <Input
                                                            className="flex-1 h-8 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-black dark:text-white"
                                                            value={customParams.dateTime}
                                                            onChange={(e) => updateParam('dateTime', e.target.value)}
                                                        />
                                                        <div className="relative">
                                                            <Button variant="outline" size="icon" className="h-8 w-8 border-zinc-300 bg-white text-gray-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-muted-foreground">
                                                                <CalendarIcon className="h-4 w-4" />
                                                            </Button>
                                                            <input
                                                                type="datetime-local"
                                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                                value={getIsoDate(customParams.dateTime)}
                                                                onChange={handleDateSelect}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="exif" className="m-0">
                                    {selectedImage && (
                                        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 p-4 space-y-6">
                                            <div className="space-y-4">
                                                <div className="bg-zinc-100/60 dark:bg-zinc-800/50 rounded-lg p-3 space-y-2">
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
                                                    <div className="flex justify-between text-sm py-1 border-b border-zinc-200 dark:border-zinc-800">
                                                        <span className="text-gray-600 dark:text-gray-400">厂商</span>
                                                        <span>{selectedImage.exif.make}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm py-1 border-b border-zinc-200 dark:border-zinc-800">
                                                        <span className="text-gray-600 dark:text-gray-400">型号</span>
                                                        <span>{selectedImage.exif.model}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm py-1 border-b border-zinc-200 dark:border-zinc-800">
                                                        <span className="text-gray-600 dark:text-gray-400">软件</span>
                                                        <span className="truncate max-w-[150px]">{selectedImage.exif.software || '-'}</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-zinc-100/60 dark:bg-zinc-800/30 p-2 rounded text-center">
                                                        <div className="text-xs text-gray-500 uppercase">Focal</div>
                                                        <div className="font-medium">{selectedImage.exif.focalLength}</div>
                                                    </div>
                                                    <div className="bg-zinc-100/60 dark:bg-zinc-800/30 p-2 rounded text-center">
                                                        <div className="text-xs text-gray-500 uppercase">Aperture</div>
                                                        <div className="font-medium">{selectedImage.exif.fNumber}</div>
                                                    </div>
                                                    <div className="bg-zinc-100/60 dark:bg-zinc-800/30 p-2 rounded text-center">
                                                        <div className="text-xs text-gray-500 uppercase">Shutter</div>
                                                        <div className="font-medium">{selectedImage.exif.exposureTime}</div>
                                                    </div>
                                                    <div className="bg-zinc-100/60 dark:bg-zinc-800/30 p-2 rounded text-center">
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

                        <div className="p-4 border-t border-white/10 flex gap-2">
                            <Button className="flex-1" variant="secondary" onClick={copyImage}>
                                <Copy className="w-4 h-4 mr-2" />
                                复制
                            </Button>
                            <Button className="flex-1" onClick={downloadImage}>
                                <Download className="w-4 h-4 mr-2" />
                                保存
                            </Button>
                        </div>
                    </Tabs>
                </div>
            </div>

            {/* Bottom: Gallery Bar */}
            <div className="bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-white/10 flex flex-col">
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
                                        ? 'ring-2 ring-black dark:ring-white scale-105'
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
