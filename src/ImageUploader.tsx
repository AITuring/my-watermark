import React, { useCallback, forwardRef } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, UploadCloud } from "lucide-react";

interface ImageUploaderProps {
    onUpload: (files: File[]) => void;
    fileType?: string;
    children?: React.ReactNode;
    className?: string;
}

const ImageUploader = forwardRef<HTMLDivElement, ImageUploaderProps>(
    ({ onUpload, fileType = "图片", children, className = "" }, ref) => {
        const onDrop = useCallback(
            (acceptedFiles: File[]) => {
                if (acceptedFiles.length > 0) {
                    onUpload(acceptedFiles);
                }
            },
            [onUpload]
        );

        const { getRootProps, getInputProps, isDragActive } = useDropzone({
            onDrop,
            accept: {
                "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
            },
        });

        return (
            <div
                {...getRootProps()}
                ref={ref}
                className={`${className} ${
                    isDragActive ? "border-primary" : ""
                }`}
            >
                <input {...getInputProps()} />
                {children || (
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                        {isDragActive ? (
                            <UploadCloud className="w-12 h-12 text-primary mb-2" />
                        ) : (
                            <Upload className="w-12 h-12 text-gray-400 mb-2" />
                        )}
                        <p className="text-sm text-gray-600">
                            拖拽{fileType}到此处，或点击上传
                        </p>
                    </div>
                )}
            </div>
        );
    }
);

ImageUploader.displayName = "ImageUploader";

export default ImageUploader;