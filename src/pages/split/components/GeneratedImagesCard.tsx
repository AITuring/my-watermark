import { saveAs } from 'file-saver';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SplitImage } from '@/pages/split/types';

interface GeneratedImagesCardProps {
  images: SplitImage[];
  isPreviewOpen: boolean;
  previewIndex: number | null;
  onOpenChange: (open: boolean) => void;
  onPreviewIndexChange: (index: number | null) => void;
  onSendToWatermark: () => void;
  onExport: () => void;
}

export function GeneratedImagesCard(props: GeneratedImagesCardProps) {
  const {
    images,
    isPreviewOpen,
    previewIndex,
    onOpenChange,
    onPreviewIndexChange,
    onSendToWatermark,
    onExport,
  } = props;

  if (images.length === 0) {
    return null;
  }

  const previewImage = previewIndex !== null ? images[previewIndex] : null;

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">成功生成 {images.length} 张切片</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onSendToWatermark} variant="outline">
              转到水印
            </Button>
            <Button onClick={onExport} variant="outline">
              下载全部 (.zip)
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="cursor-pointer overflow-hidden rounded-lg border bg-white shadow-sm transition hover:bg-slate-50"
                onClick={() => {
                  onPreviewIndexChange(index);
                  onOpenChange(true);
                }}
              >
                <div className="relative">
                  <img src={image.url} alt={image.fileName} className="block h-auto w-full" />
                  <div className="absolute bottom-0 right-0 bg-black/50 px-2 py-1 text-xs text-white">
                    {index + 1}
                  </div>
                </div>
                <div className="px-3 py-2 text-center text-xs text-slate-600">{image.fileName}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPreviewOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>生成图预览</DialogTitle>
            <DialogDescription>{previewImage?.fileName ?? ''}</DialogDescription>
          </DialogHeader>

          {previewImage && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-lg border">
                <img
                  src={previewImage.url}
                  alt={previewImage.fileName}
                  className="mx-auto max-h-[70vh] w-auto"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      onPreviewIndexChange((previewIndex ?? 0) > 0 ? (previewIndex ?? 0) - 1 : 0)
                    }
                    disabled={(previewIndex ?? 0) <= 0}
                  >
                    上一张
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      onPreviewIndexChange(
                        (previewIndex ?? 0) < images.length - 1
                          ? (previewIndex ?? 0) + 1
                          : images.length - 1
                      )
                    }
                    disabled={(previewIndex ?? 0) >= images.length - 1}
                  >
                    下一张
                  </Button>
                </div>
                <Button onClick={() => saveAs(previewImage.blob, previewImage.fileName)}>
                  下载此图
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
