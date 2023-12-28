import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import "./watermark.css";

const ImageUploader: React.FC<{
  onUpload: (files: File[]) => void;
  fileType: string;
}> = ({ onUpload, fileType }) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onUpload(acceptedFiles);
    },
    [onUpload],
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png"],
    },
  });

  return (
    <div {...getRootProps()} className="dropzone">
      <input {...getInputProps()} />
      <p>
        选择（或拖拽）{fileType === "背景" ? "多" : "一"}张{fileType}图片
      </p>
    </div>
  );
};

export default ImageUploader;
