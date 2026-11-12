import { useEffect, useState } from "react";
import type React from "react";

import ImageAssetPicker from "@/components/ImageAssetPicker";
import ImageUploader from "@/components/ImageUploader";
import {ChevronLeft, ChevronRight, Plus, Trash2} from 'lucide-react';
import type { ImageType } from "@/types";

interface VerticalCarouselProps {
    images: ImageType[];
    setImages: React.Dispatch<React.SetStateAction<ImageType[]>>;
    setImageUploaderVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setCurrentImg: React.Dispatch<React.SetStateAction<ImageType | null>>;
    height?: number;
    currentImageId?: string;
}

const VerticalCarousel: React.FC<VerticalCarouselProps> = ({
    images,
    setImages,
    setImageUploaderVisible,
    setCurrentImg,
    currentImageId,
}) => {
    const [collapsed, setCollapsed] = useState(false);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(
        images[0]?.id ?? null
    );
    const selectedId = currentImageId ?? selectedImageId;

    useEffect(() => {
        if (!images.length) {
            setSelectedImageId(null);
            return;
        }

        if (!selectedImageId || !images.some((image) => image.id === selectedImageId)) {
            setSelectedImageId(images[0].id);
        }
    }, [images, selectedImageId]);

    const handleDeleteImage = (id: string) => {
        const newImages = images.filter((img) => img.id !== id);
        setImages(newImages);

        if (newImages.length === 0) {
            setImageUploaderVisible(true);
            setCurrentImg(null);
            setSelectedImageId(null);
        } else if (id === selectedId) {
            setSelectedImageId(newImages[0].id);
            setCurrentImg(newImages[0]);
        }
    };

    const handleImagesUpload = async (files: File[]) => {
        const { loadImageData } = await import("@/utils");
        const { images: newImages, failedFiles } = await loadImageData(files);

        setImages((prevImages) => [...prevImages, ...newImages]);

        if (newImages.length > 0 && images.length === 0) {
            setSelectedImageId(newImages[0].id);
            setCurrentImg(newImages[0]);
        }

        if (failedFiles.length > 0) {
            const summary =
                failedFiles.length > 3
                    ? `${failedFiles.slice(0, 3).join("、")} 等 ${failedFiles.length} 张`
                    : failedFiles.join("、");
            alert(
                `已添加 ${newImages.length} 张图片，跳过 ${failedFiles.length} 张不支持或读取失败的图片：${summary}`
            );
        }
    };

    return (
        <aside className={`wm-source-rail ${collapsed ? 'is-collapsed' : ''}`} aria-label="背景图片列表">
            <header className="wm-source-header">
                {!collapsed && <span className="wm-source-count">图片 <span>{images.length}</span></span>}
                <button type="button" className="wm-source-icon" aria-label={collapsed ? '展开图片列表' : '收起图片列表'} aria-expanded={!collapsed} title={collapsed ? '展开图片列表' : '收起图片列表'} onClick={()=>setCollapsed(previous=>!previous)}>
                    {collapsed ? <ChevronRight size={15}/> : <ChevronLeft size={15}/>}
                </button>
            </header>
            <div className="wm-source-actions">
                <ImageUploader onUpload={files=>void handleImagesUpload(files).catch(error=>{
                    console.error('添加背景图片失败',error);alert('图片添加失败，请重试。');
                })} fileType="背景图片" className="wm-source-add">
                    <button type="button" className="wm-source-add-button" aria-label="添加背景图片" title="添加背景图片"><Plus size={15}/>{!collapsed && <span>添加</span>}</button>
                </ImageUploader>
                {!collapsed && <button type="button" className="wm-source-add-button wm-source-clear" aria-label="清空图片列表" title="清空图片列表" onClick={()=>{
                    setImages([]);setImageUploaderVisible(true);setCurrentImg(null);setSelectedImageId(null);
                }}><Trash2 size={14}/><span>清空</span></button>}
            </div>
            {collapsed && <span className="wm-source-mini-count" title={`${images.length} 张背景图片`}>{images.length}</span>}
            <ImageAssetPicker
                images={images}
                selectedId={selectedId}
                layout="list"
                title="背景图片"
                showHeader={false}
                className="wm-source-picker"
                scrollAreaClassName="flex-1"
                itemsClassName="wm-source-items"
                itemClassName="wm-source-thumb"
                imageClassName="wm-source-image"
                onSelect={(image) => {
                    setSelectedImageId(image.id);
                    setCurrentImg(image);
                }}
                onDelete={handleDeleteImage}
                onClear={() => {
                    setImages([]);
                    setImageUploaderVisible(true);
                    setCurrentImg(null);
                    setSelectedImageId(null);
                }}
                onUpload={handleImagesUpload}
            />
        </aside>
    );
};

export default VerticalCarousel;
