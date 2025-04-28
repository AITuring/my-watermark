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
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/30 rounded-xl bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300 shadow-lg">
                        <div className="relative">
                            <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-purple-500/30 to-green-500/30 blur-xl opacity-70 animate-pulse"></div>
                            {isDragActive ? (
                                <UploadCloud className="w-12 h-12 text-green-400 mb-2 relative z-10" />
                            ) : (
                                <Upload className="w-12 h-12 text-white/70 mb-2 relative z-10" />
                            )}
                        </div>
                        <p className="text-sm text-white/90 font-medium mt-2 relative z-10">
                            拖拽{fileType}到此处，或点击上传
                        </p>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-green-500/20 blur-xl"></div>
                    </div>
                )}
            </div>
        );
    }
);

ImageUploader.displayName = "ImageUploader";

export default ImageUploader;
