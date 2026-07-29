export type EditableExifKey =
    | "make"
    | "model"
    | "lensModel"
    | "software"
    | "focalLength"
    | "fNumber"
    | "exposureTime"
    | "iso"
    | "artist"
    | "copyright"
    | "imageDescription"
    | "dateTimeOriginal"
    | "dateTimeDigitized";

export interface EditableExif {
    make: string;
    model: string;
    lensModel: string;
    software: string;
    focalLength: string;
    fNumber: string;
    exposureTime: string;
    iso: string;
    artist: string;
    copyright: string;
    imageDescription: string;
    dateTimeOriginal: string;
    dateTimeDigitized: string;
}

export interface CopyrightPreset {
    artist: string;
    copyright: string;
}

export interface ExifTagRow {
    key: string;
    label: string;
    value: string;
}

export interface GpsPoint {
    lat: number;
    lng: number;
}

export interface EditableGps {
    enabled: boolean;
    lat: string;
    lng: string;
    locationName: string;
}

export type ImportScopeKey = "gps" | "core" | "time" | "copyright" | "description";

export type ImportScopeSelection = Record<ImportScopeKey, boolean>;

export interface ImportDiffRow {
    fieldLabel: string;
    targetValue: string;
    sourceValue: string;
    changed: boolean;
    willClearTarget: boolean;
}

export interface ImportScopeDefinition {
    key: ImportScopeKey;
    label: string;
    description: string;
}

export type RenameRuleType = "delete" | "add_prefix" | "add_suffix";

export interface RenameRule {
    id: string;
    type: RenameRuleType;
    value: string;
}

export interface RenameRuleDefinition {
    type: RenameRuleType;
    label: string;
    placeholder: string;
}

export interface RenamePreviewRow {
    itemId: string;
    originalName: string;
    nextName: string;
    changed: boolean;
    validationError: string;
    duplicate: boolean;
    canApply: boolean;
}

export interface EditableFieldDefinition {
    key: EditableExifKey;
    label: string;
    placeholder: string;
}

export interface ExifSummary {
    make: string;
    model: string;
    lensModel: string;
    software: string;
    dateTimeOriginal: string;
    focalLength: string;
    fNumber: string;
    exposureTime: string;
    iso: string;
    gps: string;
    resolution: string;
}

export interface FileSystemPermissionDescriptor {
    mode?: "read" | "readwrite";
}

export interface FileSystemWritableFileStream {
    write(data: Blob | BufferSource | string): Promise<void>;
    close(): Promise<void>;
}

export interface FileSystemHandle {
    kind: "file" | "directory";
    name: string;
    queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<"granted" | "denied" | "prompt">;
    requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<"granted" | "denied" | "prompt">;
}

export interface FileSystemFileHandle extends FileSystemHandle {
    kind: "file";
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: "directory";
    values(): AsyncIterableIterator<FileSystemHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    removeEntry(name: string): Promise<void>;
}

export interface PickerWindow extends Window {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
}

export interface PhotoExifItem {
    id: string;
    file: File;
    originalFileName: string;
    currentFileName: string;
    previewUrl: string;
    canWriteExif: boolean;
    canOverwriteInPlace: boolean;
    summary: ExifSummary;
    editableOriginal: EditableExif;
    editableCurrent: EditableExif;
    tags: ExifTagRow[];
    gpsPoint: GpsPoint | null;
    gpsOriginal: EditableGps;
    gpsCurrent: EditableGps;
    fileHandle: FileSystemFileHandle | null;
    source: "dropzone" | "linked" | "directory";
}

export interface DirectoryImageEntry {
    fileHandle: FileSystemFileHandle;
    file: File;
}

export interface PiexifData {
    [key: string]: unknown;
    "0th": Record<number, unknown>;
    Exif: Record<number, unknown>;
    GPS: Record<number, unknown>;
    Interop: Record<number, unknown>;
    "1st": Record<number, unknown>;
    thumbnail: unknown;
}

export interface MapSdkLike {
    Map: new (container: HTMLDivElement, options: Record<string, unknown>) => MapInstanceLike;
    Marker: new (options: Record<string, unknown>) => MarkerLike;
    Geocoder: new (options?: Record<string, unknown>) => GeocoderLike;
    PlaceSearch: new (options?: Record<string, unknown>) => PlaceSearchLike;
}

export interface MapInstanceLike {
    setZoomAndCenter(zoom: number, center: [number, number]): void;
    add(marker: MarkerLike): void;
    clearMap(): void;
    on(eventName: string, handler: (event: unknown) => void): void;
    destroy?: () => void;
}

export interface MarkerLike {
    setPosition(position: [number, number]): void;
    on(eventName: string, handler: (event: unknown) => void): void;
}

export interface GeocoderLike {
    getAddress(location: [number, number], callback: (status: string, result: unknown) => void): void;
    getLocation(address: string, callback: (status: string, result: unknown) => void): void;
}

export interface PlaceSearchLike {
    search(keyword: string, callback: (status: string, result: unknown) => void): void;
}

export interface MapLoadState {
    loading: boolean;
    error: string | null;
}
