import ImagePreview from "@/components/ImagePreview";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SplitImage } from '@/pages/split/types';
import { loadSaveAs } from '@/utils/lazy-deps';

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

  const handleDownloadSingle = async () => {
    if (!previewImage) {
      return;
    }

    const saveAs = await loadSaveAs();
    saveAs(previewImage.blob, previewImage.fileName);
  };

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
                className="cursor-pointer overflow-hidden rounded-lg border border-border/70 bg-card/90 shadow-sm transition hover:bg-accent/55 dark:bg-card/80"
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
                <div className="px-3 py-2 text-center text-xs text-muted-foreground">{image.fileName}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ImagePreview
        images={images.map((image) => image.url)}
        currentIndex={previewIndex ?? 0}
        open={isPreviewOpen}
        onOpenChange={onOpenChange}
        onIndexChange={(index) => onPreviewIndexChange(index)}
        footerActions={
          previewImage ? (
            <Button onClick={() => void handleDownloadSingle()}>
              下载此图
            </Button>
          ) : null
        }
      />
    </>
  );
}
