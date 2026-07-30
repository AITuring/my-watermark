import React, { memo, useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Download, Upload, Image as ImageIcon, Plus, Settings2, ChevronDown, ArrowRight } from 'lucide-react';
import GenerativeBackground from '@/components/GenerativeBackground';
import {
  consumePendingCropTransfer,
  setPendingCropTransfer,
  type TransferTarget,
} from '@/utils/crop-transfer';
import { loadImageCompression, loadJSZip, loadSaveAs } from '@/utils/lazy-deps';

type ZipInstance = {
  file: (name: string, data: Blob | File) => void;
  generateAsync: (options: { type: 'blob' }) => Promise<Blob>;
};

type ZipConstructor = new () => ZipInstance;

interface CompressedImage {
  id: string;
  originalFile: File;
  compressedFile: File | null;
  originalSize: number;
  compressedSize: number;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number | null;
  outputHeight: number | null;
  targetSizeMB: number;
  resizePercent: number;
  outputScalePercent: number | null;
  preview: string;
}

interface CompressionConfig {
  targetSizeMB: number;
  resizePercent: number;
}

const MIN_FORCE_EDGE = 128;
const PREVIEW_MAX_EDGE = 1200;
const TARGET_SIZE_PRESETS = [1, 5, 10, 30, 50];
const RESIZE_PERCENT_PRESETS = [100, 75, 50, 25];

const getImageTargetBytes = (image: CompressedImage) => Math.max(image.targetSizeMB, 0.1) * 1024 * 1024;

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getCompressionRatio = (original: number, compressed: number): string => {
  if (compressed === 0) return '0%';
  const ratio = ((original - compressed) / original) * 100;
  return `${ratio.toFixed(1)}%`;
};

const formatResolution = (width: number, height: number) => `${width} x ${height}`;
const formatResizeLabel = (percent: number) => (percent === 100 ? '原尺寸' : `保留 ${percent}%`);

const getTargetResolution = (image: CompressedImage) => {
  if (image.outputWidth && image.outputHeight) {
    return {
      width: image.outputWidth,
      height: image.outputHeight,
    };
  }

  const scale = image.resizePercent / 100;
  return {
    width: Math.max(Math.round(image.originalWidth * scale), 1),
    height: Math.max(Math.round(image.originalHeight * scale), 1),
  };
};

const getImageStatus = (image: CompressedImage) => {
  if (!image.compressedFile) {
    return {
      label: '待压缩',
      className: 'bg-white/90 text-slate-700 border-slate-200',
    };
  }

  if (image.compressedSize > getImageTargetBytes(image)) {
    return {
      label: '未达标',
      className: 'bg-orange-500/90 text-white border-orange-400',
    };
  }

  return {
    label: '已达标',
    className: 'bg-emerald-500/90 text-white border-emerald-400',
  };
};

type ImageCardProps = {
  image: CompressedImage;
  isExpanded: boolean;
  isCompressing: boolean;
  compressionAction: 'normal' | 'force' | 'single' | null;
  activeImageId: string | null;
  onRemove: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onUpdateConfig: (id: string, config: Partial<Pick<CompressedImage, 'targetSizeMB' | 'resizePercent'>>) => void;
  onSingleCompress: (id: string) => void;
};

const ImageCard = memo(({
  image,
  isExpanded,
  isCompressing,
  compressionAction,
  activeImageId,
  onRemove,
  onToggleExpanded,
  onUpdateConfig,
  onSingleCompress,
}: ImageCardProps) => {
  const imageStatus = getImageStatus(image);
  const targetResolution = getTargetResolution(image);

  return (
    <Card className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.07)]">
      <div className="relative aspect-video overflow-hidden bg-slate-100">
        <img
          src={image.preview}
          alt={image.originalFile.name}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <Badge className={`rounded-full border px-2 py-0.5 text-[11px] ${imageStatus.className}`}>
            {imageStatus.label}
          </Badge>
          <Button
            onClick={() => onRemove(image.id)}
            variant="destructive"
            size="sm"
            className="h-7 w-7 rounded-full p-0 shadow-md"
            disabled={isCompressing}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {image.outputScalePercent !== null && (
          <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
            <Badge
              variant="outline"
              className="rounded-full border-white/30 bg-black/45 px-2 py-0.5 text-[11px] text-white backdrop-blur"
            >
              {formatResizeLabel(image.outputScalePercent)}
            </Badge>
            {image.compressedFile && (
              <Badge
                variant="outline"
                className="rounded-full border-white/30 bg-black/45 px-2 py-0.5 text-[11px] text-white backdrop-blur"
              >
                节省 {getCompressionRatio(image.originalSize, image.compressedSize)}
              </Badge>
            )}
          </div>
        )}
      </div>
      <CardContent className="space-y-2.5 p-3">
        <div className="space-y-0.5">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <p
                className="truncate text-[13px] font-medium text-slate-900"
                title={image.originalFile.name}
              >
                {image.originalFile.name}
              </p>
              <p className="text-[11px] text-slate-500">
                目标 {image.targetSizeMB} MB · {formatResizeLabel(image.resizePercent)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCompressing}
              onClick={() => onToggleExpanded(image.id)}
              className="h-7 rounded-full border-slate-200 bg-white px-2.5 text-[12px] text-slate-600"
            >
              <Settings2 className="mr-1 h-3.5 w-3.5" />
              单张设置
              <ChevronDown
                className={`ml-1 h-3.5 w-3.5 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </Button>
          </div>
        </div>
        {isExpanded && (
          <div className="space-y-2.5 rounded-[18px] border border-slate-200/80 bg-slate-50/80 p-2.5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>单张目标体积</span>
                <span className="font-medium text-slate-900">{image.targetSizeMB} MB</span>
              </div>
              <Input
                type="number"
                min={0.1}
                step={0.5}
                value={image.targetSizeMB}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    onUpdateConfig(image.id, { targetSizeMB: Math.max(value, 0.1) });
                  }
                }}
                disabled={isCompressing}
                className="h-9 rounded-xl border-slate-200 bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>单张输出尺寸</span>
                <span className="font-medium text-slate-900">{formatResizeLabel(image.resizePercent)}</span>
              </div>
              <Slider
                value={[image.resizePercent]}
                onValueChange={(value) => onUpdateConfig(image.id, { resizePercent: Math.round(value[0]) })}
                max={100}
                min={10}
                step={5}
                className="w-full"
                disabled={isCompressing}
              />
            </div>
            <Button
              type="button"
              onClick={() => onSingleCompress(image.id)}
              disabled={isCompressing}
              className="h-9 w-full rounded-xl bg-slate-900 text-[13px] text-white hover:bg-slate-800"
            >
              {isCompressing && compressionAction === 'single' && activeImageId === image.id
                ? '压缩中...'
                : '压缩这张'}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
          <div className="rounded-[16px] bg-slate-50 p-2.5">
            <div className="text-slate-500">原始大小</div>
            <div className="mt-0.5 text-[13px] font-semibold text-slate-900">
              {formatFileSize(image.originalSize)}
            </div>
          </div>
          <div className="rounded-[16px] bg-slate-50 p-2.5">
            <div className="text-slate-500">压缩后</div>
            <div className="mt-0.5 text-[13px] font-semibold text-slate-900">
              {image.compressedFile ? formatFileSize(image.compressedSize) : '--'}
            </div>
          </div>
        </div>
        <div className="rounded-[16px] border border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-2.5 py-2">
          <div className="mb-1 text-[10px] font-medium text-slate-500">
            分辨率
          </div>
          <div className="flex items-center gap-1 text-[12px] font-semibold text-slate-900">
            <span className="rounded-full bg-white px-2 py-0.5 shadow-sm shadow-slate-200/60">
              {formatResolution(image.originalWidth, image.originalHeight)}
            </span>
            <ArrowRight className="h-3 w-3 text-slate-400" />
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-white shadow-sm shadow-slate-300/40">
              {formatResolution(targetResolution.width, targetResolution.height)}
            </span>
          </div>
        </div>
        {image.compressedFile && (
          <div className="space-y-1.5 rounded-[16px] border border-slate-200/80 bg-slate-50/80 p-2.5 text-[11px] text-slate-600">
            <div className="flex justify-between">
              <span>输出尺寸</span>
              <span className="font-medium text-slate-900">
                {formatResizeLabel(image.outputScalePercent)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>节省体积</span>
              <span className="font-medium text-emerald-600">
                {formatFileSize(Math.max(image.originalSize - image.compressedSize, 0))}
              </span>
            </div>
            <div className="flex justify-between">
              <span>结果状态</span>
              <span
                className={`font-medium ${
                  image.compressedSize > getImageTargetBytes(image) ? 'text-orange-600' : 'text-emerald-600'
                }`}
              >
                {image.compressedSize > getImageTargetBytes(image) ? '仍高于目标体积' : '已达目标体积'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

ImageCard.displayName = 'ImageCard';

const BatchImageCompressor: React.FC = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState<CompressedImage[]>([]);
  const [targetSizeMB, setTargetSizeMB] = useState(30);
  const [resizePercent, setResizePercent] = useState([100]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionAction, setCompressionAction] = useState<'normal' | 'force' | 'single' | null>(null);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedImageId, setExpandedImageId] = useState<string | null>(null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);

  const invalidateCompressedResult = (
    image: CompressedImage,
    overrides?: Partial<Pick<CompressedImage, 'targetSizeMB' | 'resizePercent'>>
  ): CompressedImage => ({
    ...image,
    ...overrides,
    compressedFile: null,
    compressedSize: 0,
    outputWidth: null,
    outputHeight: null,
    outputScalePercent: null,
  });
  const syncBatchConfigToImages = useCallback((
    updates: Partial<Pick<CompressedImage, 'targetSizeMB' | 'resizePercent'>>
  ) => {
    setImages((prev) => prev.map((image) => invalidateCompressedResult(image, updates)));
  }, []);
  const normalizedTargetSizeMB = Math.max(targetSizeMB, 0.1);
  const compressedCount = images.filter((image) => image.compressedFile).length;
  const imagesExceedingTarget = images.filter(
    (image) => image.compressedFile && image.compressedSize > getImageTargetBytes(image)
  );
  const totalSavedBytes = images.reduce((sum, image) => {
    if (!image.compressedFile) {
      return sum;
    }

    return sum + Math.max(image.originalSize - image.compressedSize, 0);
  }, 0);

  const getFileNameWithoutExtension = (fileName: string) =>
    fileName.replace(/\.[^.]+$/, '');

  const getFileExtensionByMimeType = (mimeType: string) => {
    switch (mimeType) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/bmp':
        return 'bmp';
      default:
        return '';
    }
  };

  const getOutputFileName = (file: File) => {
    const baseName = getFileNameWithoutExtension(file.name);
    const extension = getFileExtensionByMimeType(file.type);
    return extension ? `compressed_${baseName}.${extension}` : `compressed_${file.name}`;
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
    new Promise((resolve, reject) => {
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
        URL.revokeObjectURL(imageUrl);
      };

      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error(`读取图片尺寸失败: ${file.name}`));
      };

      image.src = imageUrl;
    });

  const createThumbnailPreview = async (file: File): Promise<string> => {
    const { width, height } = await getImageDimensions(file);
    const longestEdge = Math.max(width, height);

    if (longestEdge <= PREVIEW_MAX_EDGE) {
      return URL.createObjectURL(file);
    }

    const scale = PREVIEW_MAX_EDGE / longestEdge;
    const targetWidth = Math.max(Math.round(width * scale), 1);
    const targetHeight = Math.max(Math.round(height * scale), 1);
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      return URL.createObjectURL(file);
    }

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file, {
        resizeWidth: targetWidth,
        resizeHeight: targetHeight,
        resizeQuality: 'high',
      });
      try {
        context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      } finally {
        bitmap.close();
      }
    } else {
      const sourceUrl = URL.createObjectURL(file);
      try {
        await new Promise<void>((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            context.drawImage(image, 0, 0, targetWidth, targetHeight);
            resolve();
          };
          image.onerror = () => reject(new Error(`生成缩略图失败: ${file.name}`));
          image.src = sourceUrl;
        });
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
    }

    const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error(`生成缩略图失败: ${file.name}`));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        0.82
      );
    });

    return URL.createObjectURL(thumbnailBlob);
  };

  // 文件上传处理
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newImages = await Promise.all(
      acceptedFiles.map(async (file) => {
        const { width, height } = await getImageDimensions(file);
        const preview = await createThumbnailPreview(file);
        return {
          id: Math.random().toString(36).slice(2, 11),
          originalFile: file,
          compressedFile: null,
          originalSize: file.size,
          compressedSize: 0,
          originalWidth: width,
          originalHeight: height,
          outputWidth: null,
          outputHeight: null,
          targetSizeMB: normalizedTargetSizeMB,
          resizePercent: Math.round(resizePercent[0]),
          outputScalePercent: null,
          preview,
        } satisfies CompressedImage;
      })
    );
    setImages(prev => [...prev, ...newImages]);
  }, [normalizedTargetSizeMB, resizePercent]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.bmp']
    },
    multiple: true,
    noClick: images.length > 0,
  });

  useEffect(() => {
    const incomingFiles = consumePendingCropTransfer('compress');
    if (!incomingFiles.length) {
      return;
    }

    void onDrop(incomingFiles);
  }, [onDrop]);

  // 压缩单张图片
  const compressImage = async (
    file: File,
    config: CompressionConfig
  ): Promise<{ file: File; outputScalePercent: number; outputWidth: number; outputHeight: number }> => {
    const normalizedSizeMB = Math.max(config.targetSizeMB, 0.1);
    const normalizedResizePercent = Math.min(Math.max(config.resizePercent, 1), 100);
    const { width, height } = await getImageDimensions(file);
    const longestEdge = Math.max(width, height);
    const shouldResize = normalizedResizePercent < 100;
    const options = {
      maxSizeMB: normalizedSizeMB,
      useWebWorker: true,
      initialQuality: 0.82,
      alwaysKeepResolution: !shouldResize,
      ...(shouldResize
        ? {
            maxWidthOrHeight: Math.max(
              Math.round(longestEdge * (normalizedResizePercent / 100)),
              MIN_FORCE_EDGE
            ),
          }
        : {}),
    };

    try {
      const imageCompression = await loadImageCompression();
      const compressedFile = await imageCompression(file, options);
      const outputDimensions = await getImageDimensions(compressedFile);
      return {
        file: compressedFile,
        outputScalePercent: normalizedResizePercent,
        outputWidth: outputDimensions.width,
        outputHeight: outputDimensions.height,
      };
    } catch (error) {
      console.error('压缩失败:', error);
      throw error;
    }
  };

  const forceCompressImage = async (
    file: File,
    targetSizeLimitMB: number
  ): Promise<{ file: File; outputScalePercent: number; outputWidth: number; outputHeight: number }> => {
    const imageCompression = await loadImageCompression();
    const { width, height } = await getImageDimensions(file);
    const normalizedSizeMB = Math.max(targetSizeLimitMB, 0.1);
    const targetBytes = normalizedSizeMB * 1024 * 1024;
    const originalLongestEdge = Math.max(width, height);
    let longestEdge = originalLongestEdge;
    let currentQuality = 0.72;
    let bestResult: File = file;
    let bestScalePercent = 100;
    let bestOutputWidth = width;
    let bestOutputHeight = height;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: normalizedSizeMB,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: currentQuality,
        maxWidthOrHeight: Math.max(Math.round(longestEdge), MIN_FORCE_EDGE),
        maxIteration: 12,
      });
      const outputDimensions = await getImageDimensions(compressedFile);

      bestResult = compressedFile;
      bestOutputWidth = outputDimensions.width;
      bestOutputHeight = outputDimensions.height;
      bestScalePercent = Math.max(
        Math.round((Math.max(Math.round(longestEdge), MIN_FORCE_EDGE) / originalLongestEdge) * 100),
        Math.round((MIN_FORCE_EDGE / originalLongestEdge) * 100)
      );

      if (compressedFile.size <= targetBytes || longestEdge <= MIN_FORCE_EDGE) {
        return {
          file: compressedFile,
          outputScalePercent: Math.min(bestScalePercent, 100),
          outputWidth: outputDimensions.width,
          outputHeight: outputDimensions.height,
        };
      }

      longestEdge = Math.max(Math.round(longestEdge * 0.72), MIN_FORCE_EDGE);
      currentQuality = Math.max(currentQuality * 0.82, 0.12);
    }

    return {
      file: bestResult,
      outputScalePercent: Math.min(bestScalePercent, 100),
      outputWidth: bestOutputWidth,
      outputHeight: bestOutputHeight,
    };
  };

  // 批量压缩图片
  const handleBatchCompress = async () => {
    if (images.length === 0) return;

    setIsCompressing(true);
    setCompressionAction('normal');
    setActiveImageId(null);
    setCompressionProgress(0);

    const updatedImages = [...images];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      try {
        const { file: compressedFile, outputScalePercent, outputWidth, outputHeight } = await compressImage(
          image.originalFile,
          {
            targetSizeMB: image.targetSizeMB,
            resizePercent: image.resizePercent,
          }
        );
        updatedImages[i] = {
          ...image,
          compressedFile,
          compressedSize: compressedFile.size,
          outputWidth,
          outputHeight,
          outputScalePercent,
        };
      } catch (error) {
        console.error(`压缩图片 ${image.originalFile.name} 失败:`, error);
        updatedImages[i] = image;
      }

      setCompressionProgress(((i + 1) / images.length) * 100);
    }

    setImages(updatedImages);
    setIsCompressing(false);
    setCompressionAction(null);
    setActiveImageId(null);
  };

  const handleForceCompressToTarget = async () => {
    if (imagesExceedingTarget.length === 0) {
      alert('当前所有图片都已经达到目标体积');
      return;
    }

    setIsCompressing(true);
    setCompressionAction('force');
    setActiveImageId(null);
    setCompressionProgress(0);

    const pendingIds = new Set(imagesExceedingTarget.map((image) => image.id));
    const updatedImages = [...images];
    let processedCount = 0;

    for (let i = 0; i < updatedImages.length; i += 1) {
      const image = updatedImages[i];

      if (!pendingIds.has(image.id)) {
        continue;
      }

      try {
        const { file: compressedFile, outputScalePercent, outputWidth, outputHeight } = await forceCompressImage(
          image.originalFile,
          image.targetSizeMB
        );
        updatedImages[i] = {
          ...image,
          compressedFile,
          compressedSize: compressedFile.size,
          outputWidth,
          outputHeight,
          outputScalePercent,
        };
      } catch (error) {
        console.error(`强制压缩图片 ${image.originalFile.name} 失败:`, error);
      }

      processedCount += 1;
      setCompressionProgress((processedCount / pendingIds.size) * 100);
    }

    setImages(updatedImages);
    setIsCompressing(false);
    setCompressionAction(null);
    setActiveImageId(null);
  };

  const handleSingleCompress = useCallback(async (id: string) => {
    const image = images.find((item) => item.id === id);
    if (!image) {
      return;
    }

    setIsCompressing(true);
    setCompressionAction('single');
    setActiveImageId(id);
    setCompressionProgress(0);

    try {
      const { file: compressedFile, outputScalePercent, outputWidth, outputHeight } = await compressImage(image.originalFile, {
        targetSizeMB: image.targetSizeMB,
        resizePercent: image.resizePercent,
      });

      setImages((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                compressedFile,
                compressedSize: compressedFile.size,
                outputWidth,
                outputHeight,
                outputScalePercent,
              }
            : item
        )
      );
      setCompressionProgress(100);
    } catch (error) {
      console.error(`压缩图片 ${image.originalFile.name} 失败:`, error);
    } finally {
      setIsCompressing(false);
      setCompressionAction(null);
      setActiveImageId(null);
    }
  }, [images]);

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
      const saveAs = await loadSaveAs();
      saveAs(image.compressedFile!, getOutputFileName(image.compressedFile!));
    } else {
      // 多张图片打包成ZIP
      const JSZip = (await loadJSZip()) as ZipConstructor;
      const saveAs = await loadSaveAs();
      const zip = new JSZip();

      compressedImages.forEach((image) => {
        if (image.compressedFile) {
          zip.file(getOutputFileName(image.compressedFile), image.compressedFile);
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

  const handleRouteTransfer = (target: TransferTarget) => {
    const files = images
      .map((image) => image.compressedFile)
      .filter((file): file is File => Boolean(file));

    if (!files.length) {
      alert('没有压缩后的图片可发送');
      return;
    }

    setPendingCropTransfer(target, files);
    navigate(target === 'watermark' ? '/watermark' : '/crop');
  };

  const updateImageConfig = useCallback((
    id: string,
    config: Partial<Pick<CompressedImage, 'targetSizeMB' | 'resizePercent'>>
  ) => {
    setImages((prev) =>
      prev.map((image) => {
        if (image.id !== id) {
          return image;
        }

        return invalidateCompressedResult(image, config);
      })
    );
  }, []);

  // 删除图片
  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const target = prev.find((img) => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      const updated = prev.filter(img => img.id !== id);
      return updated;
    });
    setExpandedImageId((prev) => (prev === id ? null : prev));
  }, []);

  // 清空所有图片
  const clearAllImages = useCallback(() => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setExpandedImageId(null);
  }, [images]);

  const toggleExpandedImage = useCallback((id: string) => {
    setExpandedImageId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="min-h-screen w-full relative">
      <div className="fixed inset-0 z-0 overflow-hidden bg-[#f4f1ea]">
        <GenerativeBackground />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(244,241,234,0.22)_0%,rgba(244,241,234,0.12)_24%,rgba(244,241,234,0.18)_100%)]" />
      </div>

      <div className="relative z-10 p-6">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <Card className="border-white/50 bg-white/82 shadow-xl backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                <ImageIcon className="h-5 w-5 text-slate-700" />
                图片压缩
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {images.length === 0 && (
                <div
                  {...getRootProps()}
                  className={`relative cursor-pointer overflow-hidden rounded-[24px] border-2 border-dashed p-8 text-center transition-all duration-200 ${
                    isDragActive
                      ? 'border-sky-500 bg-sky-50/80 shadow-[0_18px_50px_rgba(14,165,233,0.18)]'
                      : 'border-slate-300/80 bg-gradient-to-br from-white/80 to-slate-50/80 hover:border-slate-400 hover:bg-white'
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_45%)]" />
                  <div className="relative z-10">
                    <input {...getInputProps()} />
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/15">
                      <Upload className="h-7 w-7" />
                    </div>
                    <p className="text-lg font-medium text-slate-800">
                      {isDragActive ? '释放文件到这里' : '拖拽图片到这里，或点击选择文件'}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      支持 JPEG、PNG、WebP、BMP 格式，可选择多个文件
                    </p>
                  </div>
                </div>
              )}

              {images.length > 0 && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_320px] xl:grid-cols-[minmax(0,4.2fr)_340px]">
                  <input {...getInputProps()} />
                  <div className="space-y-4 lg:min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">图片列表 ({images.length})</h3>
                      <Button
                        type="button"
                        onClick={open}
                        disabled={isCompressing}
                        className="h-10 rounded-2xl bg-slate-900 px-4 text-white hover:bg-slate-800"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        添加图片
                      </Button>
                    </div>
                    {images.some(img => img.compressedFile) && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm">
                        <div className="text-sm text-slate-600">
                          {imagesExceedingTarget.length > 0
                            ? `还有 ${imagesExceedingTarget.length} 张未达标`
                            : '当前结果已达标'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {imagesExceedingTarget.length > 0 && (
                            <Button
                              onClick={handleForceCompressToTarget}
                              disabled={isCompressing || isExporting}
                              className="h-10 rounded-2xl bg-orange-600 px-4 hover:bg-orange-700"
                            >
                              {isCompressing && compressionAction === 'force'
                                ? '强制压缩中...'
                                : `强制压到目标体积 (${imagesExceedingTarget.length})`}
                            </Button>
                          )}
                          <Button
                            onClick={handleBatchExport}
                            disabled={isExporting}
                            className="h-10 rounded-2xl bg-emerald-600 px-4 hover:bg-emerald-700"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {isExporting ? '导出中...' : '批量导出'}
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {images.map((image) => (
                        <ImageCard
                          key={image.id}
                          image={image}
                          isExpanded={expandedImageId === image.id}
                          isCompressing={isCompressing}
                          compressionAction={compressionAction}
                          activeImageId={activeImageId}
                          onRemove={removeImage}
                          onToggleExpanded={toggleExpandedImage}
                          onUpdateConfig={updateImageConfig}
                          onSingleCompress={handleSingleCompress}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
                    <div className="flex flex-wrap gap-2 rounded-[20px] border border-slate-200/80 bg-white/88 p-3 shadow-sm backdrop-blur-sm">
                      <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-600">
                        {images.length} 张
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-600">
                        已压缩 {compressedCount}
                      </Badge>
                      {imagesExceedingTarget.length > 0 && (
                        <Badge className="rounded-full bg-orange-500 text-white hover:bg-orange-500">
                          未达标 {imagesExceedingTarget.length}
                        </Badge>
                      )}
                      {totalSavedBytes > 0 && (
                        <Badge className="rounded-full bg-emerald-500 text-white hover:bg-emerald-500">
                          已节省 {formatFileSize(totalSavedBytes)}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-4 rounded-[24px] border border-slate-200/80 bg-white/92 p-4 shadow-sm">
                      <div>
                        <div className="text-sm font-medium text-slate-900">批量设置</div>
                        <div className="mt-1 text-xs text-slate-500">修改后会立即同步到左侧图片列表</div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-slate-800">目标体积</label>
                          <span className="text-sm font-semibold text-slate-900">{normalizedTargetSizeMB} MB</span>
                        </div>
                        <Input
                          type="number"
                          min={0.1}
                          step={0.5}
                          value={targetSizeMB}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (Number.isFinite(value)) {
                              const nextValue = Math.max(value, 0.1);
                              setTargetSizeMB(nextValue);
                              syncBatchConfigToImages({ targetSizeMB: nextValue });
                            }
                          }}
                          disabled={isCompressing}
                          className="h-10 rounded-2xl border-slate-200 bg-white/90"
                        />
                        <div className="flex flex-wrap gap-2">
                          {TARGET_SIZE_PRESETS.map((preset) => (
                            <Button
                              key={preset}
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isCompressing}
                              onClick={() => {
                                setTargetSizeMB(preset);
                                syncBatchConfigToImages({ targetSizeMB: preset });
                              }}
                              className={`rounded-full border-slate-200 bg-white px-3 ${
                                Math.abs(normalizedTargetSizeMB - preset) < 0.001
                                  ? 'border-sky-500 bg-sky-50 text-sky-700'
                                  : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {preset} MB
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-slate-800">输出尺寸</label>
                          <span className="text-sm font-semibold text-slate-900">{formatResizeLabel(Math.round(resizePercent[0]))}</span>
                        </div>
                        <Slider
                          value={resizePercent}
                          onValueChange={(value) => {
                            setResizePercent(value);
                            syncBatchConfigToImages({ resizePercent: Math.round(value[0]) });
                          }}
                          max={100}
                          min={10}
                          step={5}
                          className="w-full"
                          disabled={isCompressing}
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>更小 (10%)</span>
                          <span>原尺寸 (100%)</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {RESIZE_PERCENT_PRESETS.map((preset) => (
                            <Button
                              key={preset}
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isCompressing}
                              onClick={() => {
                                setResizePercent([preset]);
                                syncBatchConfigToImages({ resizePercent: preset });
                              }}
                              className={`rounded-full border-slate-200 bg-white px-3 ${
                                Math.round(resizePercent[0]) === preset
                                  ? 'border-sky-500 bg-sky-50 text-sky-700'
                                  : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {preset}%
                            </Button>
                          ))}
                        </div>
                      </div>

                      {isCompressing && (
                        <div className="space-y-2 rounded-[18px] border border-sky-200 bg-sky-50/90 p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-800">
                              {compressionAction === 'force'
                                ? '强制压缩进度'
                                : compressionAction === 'single'
                                  ? '单张压缩进度'
                                  : '压缩进度'}
                            </span>
                            <span className="font-semibold text-slate-900">{Math.round(compressionProgress)}%</span>
                          </div>
                          <Progress value={compressionProgress} className="w-full" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-[24px] border border-slate-200/80 bg-slate-900 p-4 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
                      <div className="text-sm text-slate-300">
                        目标 {normalizedTargetSizeMB} MB · {formatResizeLabel(Math.round(resizePercent[0]))}
                      </div>
                      <Button
                        onClick={handleBatchCompress}
                        disabled={isCompressing}
                        className="h-11 rounded-2xl bg-sky-500 text-white hover:bg-sky-600"
                      >
                        {isCompressing && compressionAction === 'normal' ? '压缩中...' : '开始压缩'}
                      </Button>
                      <Button
                        onClick={() => handleRouteTransfer('watermark')}
                        variant="outline"
                        disabled={isCompressing}
                        className="h-10 rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      >
                        发送到水印
                      </Button>
                      <Button
                        onClick={() => handleRouteTransfer('crop')}
                        variant="outline"
                        disabled={isCompressing}
                        className="h-10 rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      >
                        发送到裁切
                      </Button>
                      <Button
                        onClick={clearAllImages}
                        variant="outline"
                        disabled={isCompressing}
                        className="h-10 rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        清空
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BatchImageCompressor;
