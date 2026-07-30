import type { FC } from 'react';
import { Upload } from 'lucide-react';

type EmptyUploadStateProps = {
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  isDragActive: boolean;
};

const EmptyUploadState: FC<EmptyUploadStateProps> = ({
  getRootProps,
  getInputProps,
  isDragActive,
}) => (
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
      <p className="mt-2 text-sm text-slate-500">支持 JPEG、PNG、WebP、BMP 格式，可选择多个文件</p>
    </div>
  </div>
);

export default EmptyUploadState;
