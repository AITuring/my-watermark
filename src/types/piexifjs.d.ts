declare module "piexifjs" {
    const piexif: {
        ImageIFD: Record<string, number>;
        ExifIFD: Record<string, number>;
        GPSIFD: Record<string, number>;
        InteropIFD: Record<string, number>;
        load(data: string): Record<string, unknown>;
        dump(exifObject: Record<string, unknown>): string;
        insert(exif: string, jpegData: string): string;
        remove(jpegData: string): string;
    };

    export default piexif;
}
