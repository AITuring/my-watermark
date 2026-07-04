/// <reference types="vite/client" />

declare module "utif" {
    export interface IFD {
        width?: number | number[];
        height?: number | number[];
        t256?: number | number[];
        t257?: number | number[];
        [key: string]: unknown;
    }

    export function decode(buffer: ArrayBuffer): IFD[];
    export function decodeImage(buffer: ArrayBuffer, ifd: IFD, ifds?: IFD[]): void;
    export function toRGBA8(ifd: IFD): Uint8Array;
}
