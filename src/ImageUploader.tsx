import { useCallback,forwardRef } from "react";
import { useDropzone } from "react-dropzone";
import "./watermark.css";

// 定义 props 类型接口
interface ImageUploaderProps {
    onUpload: (files: File[]) => void;
    fileType: string;
    children?: React.ReactNode;
}

// 使用 React.forwardRef 和 TypeScript 泛型来定义组件和 ref 的类型
const ImageUploader = forwardRef<HTMLDivElement, ImageUploaderProps>(
    (props, ref) => {
        const { onUpload, fileType, children } = props;

        const onDrop = useCallback(
            (acceptedFiles: File[]) => {
                onUpload(acceptedFiles);
            },
            [onUpload]
        );

        const { getRootProps, getInputProps } = useDropzone({
            onDrop,
            accept: {
                "image/*": [".jpeg", ".jpg", ".png"],
            },
        });

        return (
            <div
                {...getRootProps()}
                className="dropzone"
                id="watermarkUploader"
                ref={ref}
            >
                <input {...getInputProps()} />
                {children ? children : <p>上传{fileType}图片</p>}{" "}
                {/* 使用 children 或默认显示文本 */}
            </div>
        );
    }
);

ImageUploader.displayName = "ImageUploader";

export default ImageUploader;
