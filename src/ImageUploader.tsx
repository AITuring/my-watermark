import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import "./watermark.css";

// 定义 props 类型接口
interface ImageUploaderProps {
  onUpload: (files: File[]) => void;
  fileType: string;
}

// 使用 React.forwardRef 和 TypeScript 泛型来定义组件和 ref 的类型
const ImageUploader = React.forwardRef<HTMLDivElement, ImageUploaderProps>(
  (props, ref) => {
    const { onUpload, fileType } = props;

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
      <div {...getRootProps()} className="dropzone" ref={ref}>
        <input {...getInputProps()} />
        <p>上传{fileType}图片</p>
      </div>
    );
  },
);

export default ImageUploader;
