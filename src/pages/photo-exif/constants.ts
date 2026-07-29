import type {
    EditableExif,
    EditableExifKey,
    EditableFieldDefinition,
    EditableGps,
    GpsPoint,
    ImportScopeDefinition,
    ImportScopeKey,
    ImportScopeSelection,
    PickerWindow,
    RenameRuleDefinition,
} from "@/pages/photo-exif/types";

export const EMPTY_EDITABLE: EditableExif = {
    make: "",
    model: "",
    lensModel: "",
    software: "",
    focalLength: "",
    fNumber: "",
    exposureTime: "",
    iso: "",
    artist: "",
    copyright: "",
    imageDescription: "",
    dateTimeOriginal: "",
    dateTimeDigitized: "",
};

export const PREVIEW_MAX_EDGE = 256;
export const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const PNG_EXIF_CHUNK_TYPE = "eXIf";
export const EXIF_HEADER = "Exif\x00\x00";
export const COPYRIGHT_PRESET_STORAGE_KEY = "photo-exif-copyright-preset";
export const COPYRIGHT_PRESET_ENABLED_STORAGE_KEY = "photo-exif-copyright-preset-enabled";
export const DEFAULT_COPYRIGHT_PRESET = {
    artist: "笑谈间气吐霓虹",
    copyright: `Copyright ${new Date().getFullYear()} 笑谈间气吐霓虹. All Rights Reserved.`,
};

export const EMPTY_GPS: EditableGps = {
    enabled: false,
    lat: "",
    lng: "",
    locationName: "",
};

export const EDITABLE_FIELDS: EditableFieldDefinition[] = [
    { key: "make", label: "品牌", placeholder: "例如 Sony / Fujifilm" },
    { key: "model", label: "机型", placeholder: "例如 A7R5 / X100VI" },
    { key: "lensModel", label: "镜头", placeholder: "例如 FE 35mm F1.4 GM" },
    { key: "software", label: "软件", placeholder: "例如 Lightroom / Capture One" },
    { key: "focalLength", label: "焦距", placeholder: "例如 35 mm" },
    { key: "fNumber", label: "光圈", placeholder: "例如 f/2.8" },
    { key: "exposureTime", label: "快门", placeholder: "例如 1/125" },
    { key: "iso", label: "感光度", placeholder: "例如 100" },
    { key: "imageDescription", label: "描述", placeholder: "简短说明或拍摄主题" },
    { key: "dateTimeOriginal", label: "拍摄时间", placeholder: "格式 2026:07:12 18:30:00" },
    { key: "dateTimeDigitized", label: "数字化时间", placeholder: "格式 2026:07:12 18:30:00" },
];

export const pickerWindow = window as PickerWindow;
export const IMAGE_FILE_PATTERN = /\.(jpg|jpeg|png|webp|heic|heif|tif|tiff)$/i;
export const DEFAULT_MAP_CENTER: GpsPoint = { lat: 39.90923, lng: 116.397428 };

export const secondaryButtonClass =
    "rounded-xl border-slate-300 bg-white px-4 text-slate-700 hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900";
export const primaryButtonClass =
    "rounded-xl bg-slate-900 px-4 text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";
export const accentButtonClass =
    "rounded-xl bg-blue-600 px-4 text-white shadow-sm hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400";
export const dangerButtonClass =
    "rounded-xl bg-rose-600 px-4 text-white shadow-sm hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400";
export const dangerSubtleButtonClass =
    "rounded-xl border-rose-200 bg-rose-50 px-4 text-rose-700 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50";

export const DEFAULT_IMPORT_SCOPE_SELECTION: ImportScopeSelection = {
    gps: true,
    core: true,
    time: true,
    copyright: true,
    description: true,
};

export const IMPORT_SCOPE_DEFINITIONS: ImportScopeDefinition[] = [
    { key: "gps", label: "GPS", description: "导入经纬度和地点名称" },
    { key: "core", label: "核心信息", description: "导入品牌、机型、镜头、软件、焦距、光圈、快门和 ISO" },
    { key: "time", label: "时间", description: "导入拍摄时间和数字化时间" },
    { key: "copyright", label: "版权", description: "导入作者和版权声明" },
    { key: "description", label: "图片说明", description: "导入图片描述" },
];

export const RENAME_RULE_DEFINITIONS: RenameRuleDefinition[] = [
    { type: "delete", label: "删除文本", placeholder: "例如 IMG_ / DSC_" },
    { type: "add_prefix", label: "添加前缀", placeholder: "例如 旅行_" },
    { type: "add_suffix", label: "添加后缀", placeholder: "例如 _精选" },
];

export const IMPORT_SCOPE_EDITABLE_FIELDS: Record<Exclude<ImportScopeKey, "gps">, EditableExifKey[]> = {
    core: ["make", "model", "lensModel", "software", "focalLength", "fNumber", "exposureTime", "iso"],
    time: ["dateTimeOriginal", "dateTimeDigitized"],
    copyright: ["artist", "copyright"],
    description: ["imageDescription"],
};
