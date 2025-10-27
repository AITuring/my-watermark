import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Download, Upload, Image as ImageIcon } from 'lucide-react';

interface CompressedImage {
  id: string;
  originalFile: File;
  compressedFile: File | null;
  originalSize: number;
  compressedSize: number;
  preview: string;
}

const BatchImageCompressor: React.FC = () => {
  const [images, setImages] = useState<CompressedImage[]>([]);
  const [quality, setQuality] = useState([0.8]); // 默认质量80%
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // 文件上传处理
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImages: CompressedImage[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      originalFile: file,
      compressedFile: null,
      originalSize: file.size,
      compressedSize: 0,
      preview: URL.createObjectURL(file),
    }));
    setImages(prev => [...prev, ...newImages]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.bmp']
    },
    multiple: true
  });

  // 压缩单张图片
  const compressImage = async (file: File, qualityValue: number): Promise<File> => {
    const options = {
      maxSizeMB: 10, // 最大文件大小
      maxWidthOrHeight: 1920, // 最大宽度或高度
      useWebWorker: true,
      quality: qualityValue, // 压缩质量
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      console.error('压缩失败:', error);
      throw error;
    }
  };

  // 批量压缩图片
  const handleBatchCompress = async () => {
    if (images.length === 0) return;

    setIsCompressing(true);
    setCompressionProgress(0);

    const updatedImages: CompressedImage[] = [];
    const qualityValue = quality[0];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      try {
        const compressedFile = await compressImage(image.originalFile, qualityValue);
        updatedImages.push({
          ...image,
          compressedFile,
          compressedSize: compressedFile.size,
        });
      } catch (error) {
        console.error(`压缩图片 ${image.originalFile.name} 失败:`, error);
        updatedImages.push(image);
      }

      setCompressionProgress(((i + 1) / images.length) * 100);
    }

    setImages(updatedImages);
    setIsCompressing(false);
  };

  // 批量导出压缩后的图片
  const handleBatchExport = async () => {
    const compressedImages = images.filter(img => img.compressedFile);
    if (compressedImages.length === 0) {
      alert('没有压缩后的图片可以导出');
      return;
    }

    setIsExporting(true);

    if (compressedImages.length === 1) {
      // 单张图片直接下载
      const image = compressedImages[0];
      saveAs(image.compressedFile!, `compressed_${image.originalFile.name}`);
    } else {
      // 多张图片打包成ZIP
      const zip = new JSZip();

      compressedImages.forEach((image) => {
        if (image.compressedFile) {
          zip.file(`compressed_${image.originalFile.name}`, image.compressedFile);
        }
      });

      try {
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, 'compressed_images.zip');
      } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败，请重试');
      }
    }

    setIsExporting(false);
  };

  // 删除图片
  const removeImage = (id: string) => {
    setImages(prev => {
      const updated = prev.filter(img => img.id !== id);
      return updated;
    });
  };

  // 清空所有图片
  const clearAllImages = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 计算压缩率
  const getCompressionRatio = (original: number, compressed: number): string => {
    if (compressed === 0) return '0%';
    const ratio = ((original - compressed) / original) * 100;
    return `${ratio.toFixed(1)}%`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-6 h-6" />
            批量图片压缩工具
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 上传区域 */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-700">
              {isDragActive ? '释放文件到这里' : '拖拽图片到这里，或点击选择文件'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              支持 JPEG、PNG、WebP、BMP 格式，可选择多个文件
            </p>
          </div>

          {/* 质量控制 */}
          {images.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">压缩质量: {Math.round(quality[0] * 100)}%</label>
                <div className="flex gap-2">
                  <Button
                    onClick={handleBatchCompress}
                    disabled={isCompressing}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isCompressing ? '压缩中...' : '开始压缩'}
                  </Button>
                  <Button
                    onClick={clearAllImages}
                    variant="outline"
                    disabled={isCompressing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    清空所有
                  </Button>
                </div>
              </div>

              <div className="px-3">
                <Slider
                  value={quality}
                  onValueChange={setQuality}
                  max={1}
                  min={0.1}
                  step={0.1}
                  className="w-full"
                  disabled={isCompressing}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>低质量 (10%)</span>
                  <span>高质量 (100%)</span>
                </div>
              </div>

              {isCompressing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>压缩进度</span>
                    <span>{Math.round(compressionProgress)}%</span>
                  </div>
                  <Progress value={compressionProgress} className="w-full" />
                </div>
              )}
            </div>
          )}

          {/* 导出按钮 */}
          {images.some(img => img.compressedFile) && (
            <div className="flex justify-center">
              <Button
                onClick={handleBatchExport}
                disabled={isExporting}
                className="bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <Download className="w-4 h-4 mr-2" />
                {isExporting ? '导出中...' : '批量导出压缩图片'}
              </Button>
            </div>
          )}

          {/* 图片列表 */}
          {images.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">图片列表 ({images.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map((image) => (
                  <Card key={image.id} className="overflow-hidden">
                    <div className="aspect-video relative">
                      <img
                        src={image.preview}
                        alt={image.originalFile.name}
                        className="w-full h-full object-cover"
                      />
                      <Button
                        onClick={() => removeImage(image.id)}
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        disabled={isCompressing}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <p className="font-medium text-sm truncate" title={image.originalFile.name}>
                        {image.originalFile.name}
                      </p>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex justify-between">
                          <span>原始大小:</span>
                          <span>{formatFileSize(image.originalSize)}</span>
                        </div>
                        {image.compressedFile && (
                          <>
                            <div className="flex justify-between">
                              <span>压缩后:</span>
                              <span>{formatFileSize(image.compressedSize)}</span>
                            </div>
                            <div className="flex justify-between font-medium text-green-600">
                              <span>节省:</span>
                              <span>{getCompressionRatio(image.originalSize, image.compressedSize)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BatchImageCompressor;
