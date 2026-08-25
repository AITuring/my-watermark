import {
    Crop,
    FileArchive,
    Focus,
    ImagePlus,
    Images,
    Info,
    Landmark,
    LayoutGrid,
    Pencil,
    PanelsTopLeft,
} from "lucide-react";

export const menuItems = [
    { path: "/", icon: LayoutGrid, label: "应用库" },
    { path: "/watermark", icon: ImagePlus, label: "水印添加" },
    { path: "/puzzle", icon: PanelsTopLeft, label: "图片拼接" },
    { path: "/crop", icon: Crop, label: "图片裁切" },
    { path: "/rename", icon: Pencil, label: "图片重命名" },
    { path: "/photo-exif", icon: Info, label: "照片 EXIF" },
    { path: "/focus-stack", icon: Focus, label: "焦点合成" },
    { path: "/google-photo", icon: Images, label: "Google 相册" },
    { path: "/compress", icon: FileArchive, label: "图片压缩" },
    { path: "/wenwu", icon: Landmark, label: "195禁出" },
] as const;

export const menuButtonClass =
    "w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95";

export const inactiveMenuButtonClass =
    "text-muted-foreground hover:bg-accent hover:text-foreground";

export const activeMenuButtonClass =
    "bg-primary text-primary-foreground shadow-sm";

export const iconClass = "w-4 h-4";
