import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { PhotoAlbum, RenderContainer } from "react-photo-album";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";

interface ImgProp {
  src: string;
  width: number;
  height: number;
}

const Puzzle = () => {
  const galleryRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState<ImgProp[]>([]);

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
    const galleryElement = galleryRef.current;
    console.log(galleryElement);

    if (galleryElement) {
      const canvas = await html2canvas(galleryElement, { scale: 10 });
      canvas.toBlob((blob) => {
        saveAs(blob, "my-image.png");
      });
    } else {
      const galleryElement = document.getElementById("container");
      const canvas = await html2canvas(galleryElement, { scale: 10 });
      canvas.toBlob((blob) => {
        saveAs(blob, "my-image.png");
      });
      console.log("Element not found");
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
        renderContainer={renderContainer}
      />
    </div>
  );
};

export default Puzzle;
