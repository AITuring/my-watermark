import UploadEmptyState from "@/components/image-workbench/UploadEmptyState";
import { Button } from "@/components/ui/button";
import type { FC } from 'react';
import { Upload } from 'lucide-react';

type EmptyUploadStateProps = {
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  isDragActive: boolean;
};

const EmptyUploadState: FC<EmptyUploadStateProps> = ({ getRootProps, getInputProps, isDragActive }) => (
  <div {...getRootProps()} className="overflow-hidden rounded-2xl border border-border bg-card">
    <input {...getInputProps()} />
    <UploadEmptyState isDragActive={isDragActive} title="批量压缩图片" description="调整体积与尺寸，让图片更方便分享。"
      illustration={<Upload className="mx-auto h-16 w-16 text-muted-foreground" strokeWidth={1.2} />}
      actions={<Button type="button">选择图片</Button>} hint="支持 JPEG、PNG、WebP、BMP · 可拖入多张图片" />
  </div>
);
export default EmptyUploadState;
