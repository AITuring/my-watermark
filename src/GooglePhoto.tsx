import { useState, useRef, useMemo, useEffect } from "react";
import { Icon } from "@iconify/react";
import { Image as AntdImage } from "antd";
import { RowsPhotoAlbum } from "react-photo-album";
import "react-photo-album/rows.css";
import photosData from "./photos.json";
import "./puzzle.css";


interface PhotoType {
    src: string;
    width: number;
    height: number;
    srcSet?: { src: string; width: number; height: number }[];
}

const GooglePhoto = () => {
    const [images, setImages] = useState<PhotoType[]>(
        (photosData as PhotoType[]) || []
    );

    const margin = 8;
    const radius = 4;

    const renderImage = (props: any, ctx: any) => {
        const { alt = "", style, ...restImageProps } = props;

        // Fix: Select the highest resolution image for preview
        // The default ctx.photo.src might be a resized version.
        // We iterate through srcSet to find the largest width.
        let fullSrc = ctx?.photo?.src ?? restImageProps.src;

        if (ctx?.photo?.srcSet && Array.isArray(ctx.photo.srcSet) && ctx.photo.srcSet.length > 0) {
            const largest = ctx.photo.srcSet.reduce((prev: any, current: any) => {
                return (prev.width > current.width) ? prev : current;
            });
            if (largest && largest.src) {
                fullSrc = largest.src;
            }
        }

        return (
            <AntdImage
                alt={alt}
                style={{
                    ...style,
                    width: "100%",
                    height: "auto",
                    padding: 0,
                    margin: 0,
                    borderRadius: radius || 0,
                }}
                preview={{
                    src: fullSrc,
                    minScale: 0.5,
                    maxScale: 5,
                    maskClassName:
                        "group-hover:opacity-100 opacity-0 transition-opacity duration-200",
                    mask: (
                        <div className="flex items-center justify-center">
                            <Icon icon="ph:eye-bold" className="w-5 h-5 mr-2" />
                            预览
                        </div>
                    ),
                }}
                {...restImageProps}
            />
        );
    };

    const renderContainer = (containerProps: any) => (
        <div id="container">
            <div
                {...containerProps}
                id="gallery"
                style={{
                    ...(containerProps?.style ?? {}),
                    padding: `${margin}px`,
                    boxSizing: "border-box",
                }}
            >
                {containerProps?.children}
            </div>
        </div>
    );

    const pickLocalDirectory = async () => {
        if (!('showDirectoryPicker' in window)) return;
        const dir = await (window as any).showDirectoryPicker();
        const newImages: PhotoType[] = [];
        for await (const [name, handle] of (dir as any).entries()) {
            if (!/\.(jpe?g|png)$/i.test(name)) continue;
            const file = await (handle as any).getFile();
            const url = URL.createObjectURL(file);
            await new Promise<void>((resolve) => {
                const imgEl = new Image();
                imgEl.onload = () => {
                    newImages.push({ src: url, width: imgEl.width, height: imgEl.height });
                    resolve();
                };
                imgEl.src = url;
            });
        }
        setImages(newImages);
    };

    // 使用 useMemo 优化渲染的图片列表
    const memoizedPhotoAlbum = useMemo(
        () => (
            <AntdImage.PreviewGroup>
                <RowsPhotoAlbum
                    photos={images}
                    padding={0}
                    spacing={margin}
                    render={{
                        container: renderContainer,
                        image: renderImage,
                    }}
                />
            </AntdImage.PreviewGroup>
        ),
        [images]
    );



    return (
        <div className="h-[calc(100vh-56px)]">
            <div className="w-full flex items-center justify-center gap-2 my-4">
                <Icon
                    icon="logos:google-photos"
                    className=" w-5 h-5"
                />
                <span className="ml-2 text-lg font-bold"> 笑谈间气吐霓虹</span>
            </div>
            {
                <div className="album">
                     {/* <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 30px 0' }}>
                        <button onClick={pickLocalDirectory} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
                            选择本地文件夹
                        </button>
                    </div> */}
                    <div style={{ margin: 30 }}>{memoizedPhotoAlbum}</div>
                </div>
            }
        </div>
    );
};

export default GooglePhoto;
