import React, { useState, useRef, useEffect, useContext } from "react";
import { Icon } from "@iconify/react";
import { ThemeContext } from "@/context";
import ImageUploader from "./ImageUploader";
import { CustomButton } from "./components";
import { loadImageData } from "./utils";
import { ImageType } from "./types";

interface VerticalCarouselProps {
    images: ImageType[];
    setImages: React.Dispatch<React.SetStateAction<ImageType[]>>;
    setImageUploaderVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setCurrentImg: React.Dispatch<React.SetStateAction<ImageType | null>>;
    height?: number;
}

const VerticalCarousel: React.FC<VerticalCarouselProps> = ({
    images,
    setImages,
    setImageUploaderVisible,
    setCurrentImg,
    height = window.innerHeight * 0.8,
}) => {
    const { isDark } = useContext(ThemeContext);
    const carouselRef = useRef<HTMLDivElement>(null);
    // 创建一个用于存放图片元素引用的数组
    const imageRefs = useRef<(HTMLImageElement | null)[]>([]);

    const handleImagesUpload = async (files: File[]) => {
        const uploadImages: ImageType[] = await loadImageData(files);
        setImages((images) => [...images, ...uploadImages]);
    };

    // 为每张图片创建一个ref，并在渲染时更新它们
    const setRef = (ref: HTMLImageElement | null, index: number) => {
        imageRefs.current[index] = ref;
    };

    return (
        <div
            className="relative overflow-hidden flex flex-col items-center"
            style={{ height: height }}
            ref={carouselRef}
        >
            <div className="flex flex-col items-center overflow-y-auto">
                {images.map((image, index) => (
                    <div key={image.id} className="relative m-2 ">
                        <img
                            // ref={(ref) => setRef(ref, index)}
                            src={URL.createObjectURL(image?.file)} // 假设`image.src`是图片的源路径
                            alt={`Slide ${index}`}
                            onClick={() => setCurrentImg(image)}
                        />
                        <Icon
                            icon="ic:baseline-cancel"
                            className={`w-4 h-4 absolute right-1 top-1 cursor-pointer`}
                            style={{ color: isDark ? "#fff" : "#000" }}
                            onClick={() => {
                                setImages((images) => {
                                    const newImages = images.filter(
                                        (item) => item.id !== image.id
                                    );
                                    setCurrentImg(newImages[0]);
                                    return newImages;
                                });
                            }}
                        />
                    </div>
                ))}
            </div>
            <div>共计{images.length}张</div>
            <div className="flex justify-between items-center w-full">
                <CustomButton
                    variant="contained"
                    // color="primary"
                    size="medium"
                    onClick={() => {
                        setImages([]);
                        setImageUploaderVisible(true);
                    }}
                    icon="FolderX"
                >
                    清空
                </CustomButton>

                <ImageUploader onUpload={handleImagesUpload} className="flex">
                    <CustomButton
                        variant="contained"
                        color="primary"
                        size="medium"
                        icon="ImageUp"
                    >
                        添加
                    </CustomButton>
                    {/* <ImageUp style={{ color: darkMode ? "#fff" : "#000" }} />{" "}
                    添加 */}
                </ImageUploader>
            </div>
        </div>
    );
};

export default VerticalCarousel;
