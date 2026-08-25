import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  Trash2,
  Plus,
  Save,
  FileText,
  RefreshCw,
  X,
  ArrowRight,
  Wand2,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import DarkToggle from '@/components/DarkToggle';

// Types for File System Access API
interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  move(newName: string): Promise<void>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  values(): AsyncIterableIterator<FileSystemHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  removeEntry(name: string): Promise<void>;
}

interface FileItem {
  id: string;
  originalName: string;
  newName: string;
  handle: FileSystemFileHandle;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

interface Rule {
  id: string;
  type: 'delete' | 'add_prefix' | 'add_suffix';
  value: string;
}

const RULE_CONFIGS: Array<{
  type: Rule['type'];
  label: string;
  placeholder: string;
  id: string;
}> = [
  { type: 'delete', label: '删除文本', placeholder: '输入要删除的文本，点击 + 添加...', id: 'delete-input' },
  { type: 'add_prefix', label: '添加前缀', placeholder: '输入前缀，点击 + 添加...', id: 'prefix-input' },
  { type: 'add_suffix', label: '添加后缀', placeholder: '输入后缀，点击 + 添加...', id: 'suffix-input' }
];

const FileNameTooltip = ({
  name,
  className
}: {
  name: string;
  className?: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <div className={className}>{name}</div>
    </TooltipTrigger>
    <TooltipContent className="max-w-[420px] break-all whitespace-pre-wrap">
      {name}
    </TooltipContent>
  </Tooltip>
);

const FileRenamer: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [ruleInputs, setRuleInputs] = useState<Record<Rule['type'], string>>({
    delete: '',
    add_prefix: '',
    add_suffix: ''
  });
  const [filterKeyword, setFilterKeyword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

  // --- File System Access ---
  const handleSelectDirectory = async () => {
    try {
      // @ts-ignore - verify browser support
      const handle = await window.showDirectoryPicker();
      setDirHandle(handle);

      const fileList: FileItem[] = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          // Filter out hidden files or system files if needed
          if (!entry.name.startsWith('.')) {
            fileList.push({
              id: Math.random().toString(36).substr(2, 9),
              originalName: entry.name,
              newName: entry.name,
              handle: entry as FileSystemFileHandle,
              status: 'pending'
            });
          }
        }
      }
      setFiles(fileList.sort((a, b) => a.originalName.localeCompare(b.originalName)));
      toast.success(`已加载 ${fileList.length} 个文件`);
    } catch (err) {
      console.error(err);
      if ((err as Error).name !== 'AbortError') {
        toast.error('无法访问目录，请重试。');
      }
    }
  };

  const handleSelectFiles = async () => {
    try {
      // @ts-ignore - verify browser support
      const handles = await window.showOpenFilePicker({ multiple: true });

      const fileList: FileItem[] = [];
      for (const handle of handles) {
        fileList.push({
          id: Math.random().toString(36).substr(2, 9),
          originalName: handle.name,
          newName: handle.name,
          handle: handle as FileSystemFileHandle,
          status: 'pending'
        });
      }

      setFiles(prev => {
        const newFiles = [...prev, ...fileList];
        return newFiles.sort((a, b) => a.originalName.localeCompare(b.originalName));
      });

      toast.success(`已添加 ${fileList.length} 个文件`);
    } catch (err) {
      console.error(err);
      if ((err as Error).name !== 'AbortError') {
        toast.error('无法选择文件，请重试。');
      }
    }
  };

  const clearFiles = () => {
    setFiles([]);
    setDirHandle(null);
    setRules([]);
    setFilterKeyword('');
    toast.success('已清空列表');
  };

  const verifyPermission = async (handle: any, readWrite: boolean) => {
    const options: any = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }
    try {
        if ((await handle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await handle.requestPermission(options)) === 'granted') {
            return true;
        }
    } catch (error) {
        console.error("Permission request failed", error);
    }
    return false;
  };

  // --- Rules Logic ---
  const addRule = (type: Rule['type'], value: string) => {
    if (!value.trim()) return;
    setRules(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), type, value }]);
  };

  const updateRuleInput = (type: Rule['type'], value: string) => {
    setRuleInputs(prev => ({ ...prev, [type]: value }));
  };

  const submitRule = (type: Rule['type']) => {
    const value = ruleInputs[type];
    addRule(type, value);
    setRuleInputs(prev => ({ ...prev, [type]: '' }));
  };

  const removeRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  // --- Preview Calculation ---
  const processedFiles = useMemo(() => {
    return files
      .filter(file => file.originalName.toLowerCase().includes(filterKeyword.toLowerCase()))
      .map(file => {
      let name = file.originalName;
      const extIndex = name.lastIndexOf('.');
      let baseName = extIndex !== -1 ? name.substring(0, extIndex) : name;
      const extension = extIndex !== -1 ? name.substring(extIndex) : '';

      rules.forEach(rule => {
        if (rule.type === 'delete') {
          baseName = baseName.split(rule.value).join('');
        } else if (rule.type === 'add_prefix') {
          baseName = rule.value + baseName;
        } else if (rule.type === 'add_suffix') {
          baseName = baseName + rule.value;
        }
      });

      return {
        ...file,
        newName: baseName + extension
      };
    });
  }, [files, rules, filterKeyword]);

  // --- Execution ---
  const handleRename = async () => {
    if (processedFiles.length === 0) return;

    // 尝试获取工作目录句柄，以优化批量处理权限
    let workingDirHandle = dirHandle;

    if (!workingDirHandle && processedFiles.length > 1) {
        const confirmMsg = "检测到您选择了多个文件。\n\n为了避免浏览器对每个文件都弹出权限请求，建议您授权这些文件所在的文件夹。\n\n是否现在选择文件夹？";
        if (window.confirm(confirmMsg)) {
            try {
                // @ts-ignore
                workingDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            } catch (e) {
                console.log("User cancelled directory selection");
            }
        }
    }

    // 1. 权限检查
    if (workingDirHandle) {
        const hasPerm = await verifyPermission(workingDirHandle, true);
        if (!hasPerm) {
            toast.error("请授予文件夹读写权限以进行重命名操作");
            return;
        }
    } else {
        // 如果是单文件模式，尝试获取第一个文件的权限
        if (processedFiles.length > 0) {
             const hasPerm = await verifyPermission(processedFiles[0].handle, true);
             if (!hasPerm) {
                 toast.error("请授予文件读写权限");
                 return;
             }
        }
    }

    setIsProcessing(true);

    const newFiles = [...processedFiles];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      if (file.originalName === file.newName) continue;
      if (file.status === 'success') continue; // Skip already renamed

      try {
        let renamed = false;

        // 策略 A: 如果有目录句柄，优先通过目录操作（只需要目录权限）
        if (workingDirHandle) {
            try {
                const dirFileHandle = await workingDirHandle.getFileHandle(file.originalName);
                // @ts-ignore
                const isSame = await dirFileHandle.isSameEntry(file.handle);

                if (isSame) {
                    // @ts-ignore
                    if (dirFileHandle.move) {
                        // @ts-ignore
                        await dirFileHandle.move(file.newName);
                    } else {
                        // Fallback: Copy and Delete
                        const fileData = await dirFileHandle.getFile();
                        const newHandle = await workingDirHandle.getFileHandle(file.newName, { create: true });
                        // @ts-ignore
                        const writable = await newHandle.createWritable();
                        await writable.write(fileData);
                        await writable.close();
                        await workingDirHandle.removeEntry(file.originalName);
                    }
                    renamed = true;
                }
            } catch (e) {
                console.warn(`Directory strategy failed for ${file.originalName}`, e);
            }
        }

        // 策略 B: 直接操作文件句柄（可能需要单独权限）
        if (!renamed) {
            // @ts-ignore
            if (file.handle.move) {
               // 再次检查单个文件权限
               await file.handle.move(file.newName);
               renamed = true;
            }
        }

        if (!renamed) {
            throw new Error("无法重命名：浏览器不支持直接操作且未提供有效目录权限");
        }

        newFiles[i].status = 'success';
        newFiles[i].originalName = file.newName; // Update for next run
        successCount++;
      } catch (err) {
        console.error(`Failed to rename ${file.originalName}`, err);
        newFiles[i].status = 'error';
        newFiles[i].error = (err as Error).message;
        failCount++;
      }
    }

    setFiles(prev => {
      const processedMap = new Map(newFiles.map(f => [f.id, f]));
      return prev.map(f => processedMap.get(f.id) || f);
    });
    setIsProcessing(false);

    if (successCount > 0) {
        toast.success(`成功重命名 ${successCount} 个文件`);
    }
    if (failCount > 0) {
        toast.error(`${failCount} 个文件重命名失败，请查看列表状态`);
    }
  };

  // --- UI Components ---
  return (
    <div className="min-h-screen bg-background p-6 font-sans text-foreground transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#8C7CF0] to-[#C6B9FF]">
              文件批量改名
            </h1>
            <p className="mt-2 flex items-center gap-2 text-muted-foreground">
              <Wand2 className="w-4 h-4 text-[#C6B9FF]" />
              简洁 · 优雅 · 智能文件管理
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <DarkToggle />
             {files.length > 0 && (
                <Button
                    variant="outline"
                    onClick={clearFiles}
                    className="h-8 text-sm text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    清空
                </Button>
             )}
            <Button
                onClick={handleSelectFiles}
                className="h-8 rounded-full border border-[#8C7CF0]/40 bg-background/90 px-5 text-sm text-[#8C7CF0] shadow-sm transition-all hover:bg-purple-50 dark:bg-card/80 dark:hover:bg-purple-900/20"
            >
                <FileText className="w-4 h-4 mr-2" />
                选择文件
            </Button>
            <Button
                onClick={handleSelectDirectory}
                className="h-8 text-sm bg-gradient-to-r from-[#8C7CF0] to-[#C6B9FF] hover:opacity-90 transition-opacity shadow-sm text-white border-0 rounded-full px-5"
            >
                <FolderOpen className="w-4 h-4 mr-2" />
                选择文件夹
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Panel: Rules */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="rounded-2xl border-0 bg-card/90 p-6 shadow-sm ring-1 ring-border/60 backdrop-blur-sm dark:bg-card/80">
              <h2 className="mb-4 flex items-center text-lg font-semibold text-foreground">
                <RefreshCw className="w-5 h-5 mr-2 text-[#8C7CF0]" />
                改名规则
              </h2>

              <div className="space-y-4">
                {/* Add Rule Controls */}
                <div className="space-y-3">
                  {RULE_CONFIGS.map(({ type, label, placeholder, id }) => (
                    <div
                      key={type}
                      className="rounded-xl border border-border/70 bg-muted/55 p-3"
                    >
                      <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={id}>
                        {label}
                      </label>
                      <div className="flex gap-2 items-start">
                        <Textarea
                          id={id}
                          rows={3}
                          value={ruleInputs[type]}
                          placeholder={placeholder}
                          className="min-h-[84px] flex-1 resize-y rounded-lg border-border/80 bg-background/95 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-[#C6B9FF]/45"
                          onChange={(e) => updateRuleInput(type, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              submitRule(type);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="mt-1 text-[#8C7CF0] hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          onClick={() => submitRule(type)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        支持长文本输入，使用 `Cmd/Ctrl + Enter` 或点击 + 添加
                      </p>
                    </div>
                  ))}
                </div>

                {/* Active Rules List */}
                <div className="space-y-2 mt-4">
                  <AnimatePresence>
                    {rules.map(rule => (
                      <motion.div
                        key={rule.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group flex items-center justify-between rounded-xl border border-purple-200/55 bg-background/90 p-3 shadow-sm dark:border-purple-900/40 dark:bg-card/85"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border-0">
                            {rule.type === 'delete' ? '删除' : rule.type === 'add_prefix' ? '前缀' : '后缀'}
                          </Badge>
                          <span className="text-sm font-medium text-foreground">"{rule.value}"</span>
                        </div>
                        <button
                          type="button"
                          aria-label={`删除${rule.type === 'delete' ? '删除' : rule.type === 'add_prefix' ? '前缀' : '后缀'}规则`}
                          onClick={() => removeRule(rule.id)}
                          className="text-muted-foreground/60 transition-colors hover:text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {rules.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      暂无规则，请输入上方内容并点击 + 号添加
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Button
              className="w-full h-12 text-lg bg-gradient-to-r from-[#8C7CF0] to-[#C6B9FF] hover:shadow-lg hover:shadow-purple-200 transition-all rounded-xl"
              disabled={files.length === 0 || rules.length === 0 || isProcessing}
              onClick={handleRename}
            >
              {isProcessing ? '处理中...' : '应用更改'}
              {!isProcessing && <Save className="w-5 h-5 ml-2" />}
            </Button>
          </div>

          {/* Right Panel: File List */}
          <div className="lg:col-span-8">
            <TooltipProvider>
            <Card className="flex h-[600px] flex-col overflow-hidden rounded-2xl border-0 bg-card/90 shadow-sm ring-1 ring-border/60 backdrop-blur-sm dark:bg-card/80">
              <div className="flex items-center justify-between border-b border-border/60 bg-background/45 p-4 dark:bg-card/55">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground">文件预览</span>
                  <Badge variant="outline" className="ml-2 border-border/70 text-muted-foreground">
                    {processedFiles.length !== files.length ? `${processedFiles.length} / ${files.length}` : files.length} 个文件
                  </Badge>
                </div>
                {files.length > 0 && (
                   <div className="relative">
                     <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                     <Input
                       type="text"
                       value={filterKeyword}
                       onChange={(e) => setFilterKeyword(e.target.value)}
                       placeholder="筛选文件名..."
                       className="h-7 w-40 rounded-lg border-border/70 bg-background/95 py-1 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:ring-[#8C7CF0]/40"
                     />
                   </div>
                )}
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {processedFiles.length === 0 ? (
                    <div className="flex min-h-[400px] h-full flex-col items-center justify-center text-muted-foreground">
                      <div className="mb-4 flex h-32 w-32 items-center justify-center rounded-full bg-muted/60">
                        <FolderOpen className="h-12 w-12 text-muted-foreground/65" />
                      </div>
                      <p className="text-lg font-medium">尚未选择文件</p>
                      <p className="text-sm mt-2">请选择文件夹或文件开始重命名</p>
                    </div>
                  ) : (
                    processedFiles.map(file => (
                      <motion.div
                        key={file.id}
                        layout
                        className={`group p-3 rounded-xl border flex items-center justify-between transition-colors
                          ${file.status === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30' :
                            file.status === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30' :
                            'bg-background/88 dark:bg-card/72 border-border/70 hover:border-purple-200 dark:hover:border-purple-700/50'}`}
                      >
                        <div className="flex items-center gap-4 flex-1 overflow-hidden">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                             <FileText className="w-4 h-4" />
                          </div>

                          <div className="flex-1 min-w-0 grid grid-cols-2 gap-4">
                            <FileNameTooltip
                              name={file.originalName}
                              className="truncate text-sm text-muted-foreground"
                            />
                            <div className="flex items-center gap-2 min-w-0">
                              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                              <FileNameTooltip
                                name={file.newName}
                                className={`truncate text-sm font-medium ${
                                  file.originalName !== file.newName
                                    ? 'text-[#8C7CF0] dark:text-[#A79AF5]'
                                    : 'text-foreground'
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        {file.status === 'success' && (
                          <span className="text-xs font-medium text-green-600 px-2">完成</span>
                        )}
                        {file.status === 'error' && (
                          <span className="text-xs font-medium text-red-600 px-2">错误</span>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileRenamer;
