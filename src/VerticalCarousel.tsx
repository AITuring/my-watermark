import React, { useState, useRef, useEffect } from "react";
import { Image as AntdImage } from "antd";
import "./verticalCarousel.css";

interface ImageType {
  id: string;
  file: File;
  width: number;
  height: number;
}

interface VerticalCarouselProps {
  images: ImageType[];
}

const VerticalCarousel: React.FC<VerticalCarouselProps> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  // 创建一个用于存放图片元素引用的数组
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);

  const windowHeight = window.innerHeight;
  const carouselHeight = windowHeight * 0.8;

  useEffect(() => {
    const handleResize = () => {
      // 窗口大小改变时，重新计算组件高度
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const scrollToImage = (index: number) => {
    setCurrentIndex(index);
    const carousel = carouselRef.current;
    if (carousel) {
      let scrollPosition = 0;
      for (let i = 0; i < index; i++) {
        const img = imageRefs.current[i];
        if (img) {
          const imgHeight = img.getBoundingClientRect().height;
          // 你可能需要考虑图片之间的间距，如果有的话
          scrollPosition += imgHeight + (i !== 0 ? 10 /* 间距 */ : 0);
        }
      }
      carousel.scrollTop = scrollPosition;
    }
  };

  // 为每张图片创建一个ref，并在渲染时更新它们
  const setRef = (ref: HTMLImageElement | null, index: number) => {
    imageRefs.current[index] = ref;
  };

  return (
    <div
      className="vertical-carousel"
      style={{ height: carouselHeight }}
      ref={carouselRef}
    >
      <button
        className="arrow-button top"
        onClick={() => scrollToImage(Math.max(currentIndex - 1, 0))}
      >
        &uarr;
      </button>
      <div className="images-container" style={{ overflowY: "auto" }}>
        <AntdImage.PreviewGroup>
          {images.map((image, index) => (
            <AntdImage
              key={image.id}
              // ref={(ref) => setRef(ref, index)}
              src={URL.createObjectURL(image?.file)} // 假设`image.src`是图片的源路径
              alt={`Slide ${index}`}
              className="carousel-image"
            />
          ))}
        </AntdImage.PreviewGroup>
      </div>
      <button
        className="arrow-button bottom"
        onClick={() =>
          scrollToImage(Math.min(currentIndex + 1, images.length - 1))
        }
      >
        &darr;
      </button>
    </div>
  );
};

export default VerticalCarousel;
