import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { FloatButton, Spin, message } from "antd";
import { PictureFilled } from "@ant-design/icons";
import { PhotoAlbum, RenderContainer } from "react-photo-album";
import html2canvas from "html2canvas";

interface ImgProp {
  src: string;
  width: number;
  height: number;
}

const Puzzle = () => {
  const navigate = useNavigate();
  const galleryRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState<ImgProp[]>([]);
  const [spinning, setSpinning] = useState<boolean>(false);

  const onDrop = useCallback((acceptedFiles) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    acceptedFiles.forEach((file) => {
      const src = URL.createObjectURL(file);
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setImages((prev) => [
          ...prev,
          {
            src: src,
            width: img.width,
            height: img.height,
          },
        ]);
      };
    });
  }, []);

  console.log(files);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png"],
    },
  });

  const downloadImage = async () => {
    if (files.length === 0) {
      message.error("请选择图片");
      return;
    }
    const galleryElement = galleryRef.current;
    console.log(galleryElement);
    setSpinning(true);
    if (galleryElement) {
      const canvas = await html2canvas(galleryElement, { scale: 8 });
      // 导出最终的图片
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "my-image.png";
            link.click();
            setSpinning(false);
          }
        },
        "image/jpeg",
        0.9,
      );
    } else {
      const galleryElement = document.getElementById("container");
      const canvas = await html2canvas(galleryElement, { scale: 8 });
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "my-image.png";
            link.click();
            setSpinning(false);
          }
        },
        "image/jpeg",
        0.9,
      );
    }
  };

  const renderContainer: RenderContainer = ({
    containerProps,
    children,
    containerRef,
  }) => (
    <div ref={galleryRef} id="container">
      <div ref={containerRef} {...containerProps} id="gallery">
        {children}
      </div>
    </div>
  );

  return (
    <div>
      <div {...getRootProps()}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the files here ...</p>
        ) : (
          <p>Drag and drop some files here, or click to select files</p>
        )}
      </div>
      <button onClick={downloadImage}>Download Image</button>
      <PhotoAlbum
        layout="columns"
        photos={images}
        padding={0}
        spacing={0}
        // TODO 增加定制
        columns={3}
        renderContainer={renderContainer}
      />
      <FloatButton
        icon={<PictureFilled />}
        tooltip={<div>添加水印</div>}
        onClick={() => navigate("/")}
      />
      <Spin spinning={spinning} fullscreen size="large" />
    </div>
  );
};

export default Puzzle;
