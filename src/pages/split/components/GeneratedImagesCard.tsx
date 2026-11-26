import ImagePreview from "@/components/ImagePreview";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SplitImage } from '@/pages/split/types';
import { downloadExportFiles } from "@/utils/image-export";
import { useImageExport } from "@/hooks/useImageExport";
import ImageExportMenu from "@/components/image-workbench/ImageExportMenu";
import { toast } from "sonner";

interface GeneratedImagesCardProps {
  images: SplitImage[];
  isPreviewOpen: boolean;
  previewIndex: number | null;
  onOpenChange: (open: boolean) => void;
  onPreviewIndexChange: (index: number | null) => void;
  onSendToWatermark: () => void;
}

export function GeneratedImagesCard(props: GeneratedImagesCardProps) {
  const {
    images,
    isPreviewOpen,
    previewIndex,
    onOpenChange,
    onPreviewIndexChange,
    onSendToWatermark,
  } = props;

  const imageExport = useImageExport({ items: images, current: previewIndex === null ? null : images[previewIndex], archiveName: "split_images.zip", folder: "split_images",
    render: (image: SplitImage) => ({ data: image.blob, name: image.fileName }),
  });
  const runExport = async (mode: "current" | "files" | "zip") => {
    try { await imageExport.run(mode); } catch (error) { toast.error(error instanceof Error ? error.message : "导出失败"); }
  };

  if (images.length === 0) {
    return null;
  }

  const handleDownloadSingle = async (image: SplitImage | undefined) => {
    if (!image) {
      return;
    }

    await downloadExportFiles([{ data: image.blob, name: image.fileName }], { mode: "current" });
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
            <ImageExportMenu placement="bottom" imageCount={images.length} currentDisabled={previewIndex === null}
              loading={imageExport.loading} progress={imageExport.progress}
              onExportCurrent={() => void runExport("current")} onExportAll={() => void runExport("files")} onExportZip={() => void runExport("zip")} />
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
                  <img src={image.previewUrl || image.url} alt={image.fileName} className="block h-auto w-full" />
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
        images={images.map((image) => image.previewUrl || image.url)}
        currentIndex={previewIndex ?? 0}
        open={isPreviewOpen}
        onOpenChange={onOpenChange}
        onIndexChange={onPreviewIndexChange}
        footerActions={
          (index) => (
            <Button onClick={() => void handleDownloadSingle(images[index])}>
              下载此图
            </Button>
          )
        }
      />
    </>
  );
}
