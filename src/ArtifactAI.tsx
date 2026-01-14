import React, { useState } from "react";
import OpenAI from "openai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
    Loader2,
    BookOpen,
    ExternalLink,
    BrainCircuit,
    ChevronDown,
    ChevronUp,
    Send,
    Sparkles,
    Settings,
    X,
} from "lucide-react";

interface ArtifactAIProps {}

const MarkdownLink = ({ href, children, title }: any) => {
    return (
        <TooltipProvider>
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center mx-1 align-baseline no-underline"
                    >
                        <Badge
                            variant="secondary"
                            className="h-5 px-2 py-0 text-[10px] hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer gap-1 whitespace-nowrap"
                        >
                            {children}
                            <ExternalLink className="w-2 h-2" />
                        </Badge>
                    </a>
                </TooltipTrigger>
                {title && (
                    <TooltipContent>
                        <p className="max-w-xs text-xs break-words">{title}</p>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
};

const ArtifactAI: React.FC<ArtifactAIProps> = () => {
    const [apiKey, setApiKey] = useState(
        import.meta.env.VITE_DASHSCOPE_API_KEY || ""
    );
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string>("");
    const [thought, setThought] = useState<string>("");
    const [isThoughtOpen, setIsThoughtOpen] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Form states
    const [rawInput, setRawInput] = useState("");
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!apiKey) {
            toast.error("请输入 Qwen API Key");
            return;
        }
        if (!rawInput.trim()) {
            toast.error("请输入文物描述信息");
            return;
        }

        setLoading(true);
        setResult("");
        setThought("");
        setHasSearched(true);
        setIsThoughtOpen(true);

        try {
            const prompt = `你是一位严谨的**考古学家**和**博物馆资深研究员**。请根据用户提供的文物描述信息，识别该文物，并撰写一份**学术性强、数据准确、有理有据**的百科综述。

**用户提供的描述信息**：
${rawInput}

**思维链（Chain of Thought）要求**：
请在正式回答之前，先进行深度的逻辑推理和资料检索分析。
1.  **提取特征**：从描述中提取关键信息（时代、材质、尺寸、出土信息等）。
2.  **匹配文物**：根据特征检索匹配的知名文物，排除类似但不符合的选项。
3.  **验证信息**：验证文物的馆藏地、出土时间是否与描述一致。
4.  **构建大纲**：规划回复的结构。
**请务必将你的思考过程包裹在 \`<think>\` 和 \`</think>\` 标签中。**

**撰写要求**：
1.  **真实性第一**：所有关键信息（名称、时代、尺寸、出土时间/地点、馆藏地）必须基于真实存在的考古报告、博物馆官方资料或学术文献。**严禁编造数据**。如果某项信息在学术界有争议或不详，请明确标注“不详”或“存疑”。
2.  **来源标注**：在文中提及关键事实（如具体尺寸、特定考证观点）时，请尽可能附带来源链接。
3.  **参考文献**：文末必须列出参考资料，并提供在线访问链接。

**输出格式**：
请严格按照以下 Markdown 格式输出（在 </think> 之后）：
**特别注意链接格式**：请使用 \`[来源名称](URL "详细标题或说明")\` 的格式。例如：\`[苏州博物馆](http://... "苏州博物馆官网藏品介绍")\`。

---
### 1. 基本信息
- **名称**：[标准文物名称]
- **时代**：[准确时代]
- **出土**：[详细出土信息，包括时间、地点、墓葬编号等]
- **馆藏**：[现藏博物馆]
- **尺寸**：[长宽高、重等数据]

### 2. 外观与形制
详细描述文物的形制特征、纹饰图案、材质工艺。请使用专业的考古术语（如“剔地阳纹”、“浅浮雕”等）。

### 3. 出土与流传
详细叙述文物的出土经过（考古发掘背景）或流传历史。

### 4. 功能与用途
分析该文物在当时社会生活、礼仪制度或宗教信仰中的具体功能和文化意义。

### 5. 学术综述
总结该文物的历史价值、艺术价值及在考古学上的地位。

### 6. 参考文献
请列出真实可靠的参考资料（如博物馆官网页面、考古简报、学术论文链接）。
- [文献标题或来源名称](URL "悬浮提示内容")
---`;

            const client = new OpenAI({
                apiKey: apiKey,
                baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
                dangerouslyAllowBrowser: true,
            });

            const stream = await client.chat.completions.create({
                model: "qwen-plus-2025-12-01",
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                stream: true,
            });

            let fullContent = "";

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || "";
                fullContent += content;

                // 实时解析 <think> 标签
                const thinkStart = fullContent.indexOf("<think>");
                const thinkEnd = fullContent.indexOf("</think>");

                if (thinkStart !== -1) {
                    if (thinkEnd !== -1) {
                        // 思考已结束，显示完整的思考过程和后续的正文
                        setThought(fullContent.substring(thinkStart + 7, thinkEnd));
                        setResult(fullContent.substring(thinkEnd + 8));
                    } else {
                        // 思考进行中，只显示思考过程
                        setThought(fullContent.substring(thinkStart + 7));
                        setResult("");
                    }
                } else {
                    // 没有发现思考标签（异常情况或尚未生成），暂视为正文
                    setResult(fullContent);
                }
            }
        } catch (error: any) {
            console.error("API Error:", error);
            toast.error(`查询失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background text-foreground relative">
            {/* 顶部标题栏 - Minimal */}
            <div className="flex-none p-4 bg-background/95 backdrop-blur z-10 sticky top-0 flex items-center justify-between">
                <div className="w-10" />
                <h1 className="text-lg font-medium text-center text-foreground/80">
                    文物智能百科
                </h1>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSettingsOpen(true)}
                    className="w-10 h-10 hover:bg-muted transition-colors text-muted-foreground"
                >
                    <Settings className="w-5 h-5" />
                </Button>
            </div>

            {/* 设置侧边栏 */}
            {isSettingsOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-300"
                        onClick={() => setIsSettingsOpen(false)}
                    />
                    <div className="fixed inset-y-0 right-0 w-80 bg-background border-l shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <Settings className="w-4 h-4 text-[#D4AF37]" />
                                设置
                            </h2>
                            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="p-6 space-y-6 flex-1">
                            <div className="space-y-2">
                                <Label htmlFor="sidebar-apikey">API Key 设置</Label>
                                <Input
                                    id="sidebar-apikey"
                                    type="password"
                                    placeholder="sk-..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="bg-muted/50 border-muted-foreground/20 focus-visible:ring-[#D4AF37]"
                                />
                                <p className="text-xs text-muted-foreground">
                                    请使用兼容 OpenAI 格式的 API Key (如 DashScope)
                                </p>
                            </div>

                            <div className="pt-4 border-t border-dashed">
                                <p className="text-xs text-center text-muted-foreground">
                                    由 Qwen-Plus 提供支持
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* 主要内容区域 - 聊天流 */}
            <div className="flex-1 overflow-y-auto p-4 pb-32 custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-8">
                    {/* 初始状态 - 仅在未搜索时显示 */}
                    {!hasSearched && (
                        <div className="text-center py-32 space-y-4 animate-in fade-in duration-500">
                             <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <Sparkles className="w-8 h-8 text-[#D4AF37]" />
                            </div>
                            <h2 className="text-xl font-medium text-foreground/90">
                                有什么可以帮您？
                            </h2>
                        </div>
                    )}

                    {/* 思维链区域 - Minimal Accordion */}
                    {(thought || loading) && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                             <div className="bg-muted/30 rounded-lg overflow-hidden border border-border/50">
                                <div
                                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors select-none"
                                    onClick={() => setIsThoughtOpen(!isThoughtOpen)}
                                >
                                    <div className="flex items-center gap-2">
                                        {!result && loading ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 text-[#D4AF37] animate-spin" />
                                                <span className="text-sm text-muted-foreground">深度思考中...</span>
                                            </>
                                        ) : (
                                            <>
                                                <BrainCircuit className="w-3.5 h-3.5 text-muted-foreground" />
                                                <span className="text-sm text-muted-foreground">已完成思考</span>
                                            </>
                                        )}
                                    </div>
                                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/70 transition-transform duration-200 ${isThoughtOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {isThoughtOpen && thought && (
                                    <div className="px-4 pb-4 pt-1 animate-in slide-in-from-top-1 duration-200">
                                        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap pl-5 border-l-2 border-[#D4AF37]/20">
                                            {thought}
                                            {!result && loading && (
                                                <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-[#D4AF37] animate-pulse rounded-sm"></span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 结果展示区域 */}
                    {result && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <article className="prose prose-stone dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-medium prose-headings:text-foreground/90">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeHighlight]}
                                    components={{
                                        a: MarkdownLink,
                                    }}
                                >
                                    {result}
                                </ReactMarkdown>
                            </article>
                        </div>
                    )}
                </div>
            </div>

            {/* 底部输入框区域 */}
            <div className="flex-none bg-background pb-6 pt-2">
                <div className="max-w-3xl mx-auto px-4">
                    <div className="relative bg-muted/30 rounded-3xl border border-input/50 focus-within:ring-1 focus-within:ring-[#D4AF37]/50 focus-within:border-[#D4AF37]/50 transition-all shadow-sm">
                        <Textarea
                            id="rawInput"
                            placeholder="输入文物信息..."
                            className="min-h-[52px] max-h-[200px] border-0 bg-transparent resize-none focus-visible:ring-0 p-3.5 pr-12 shadow-none custom-scrollbar text-base"
                            value={rawInput}
                            onChange={(e) => setRawInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSearch();
                                }
                            }}
                        />
                        <Button
                            onClick={handleSearch}
                            disabled={loading || !rawInput.trim()}
                            size="icon"
                            className="absolute right-2 bottom-2 h-8 w-8 rounded-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white shadow-sm transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    <div className="text-center mt-2">
                        <p className="text-[10px] text-muted-foreground/50">
                            内容由 AI 生成，请以官方资料为准
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArtifactAI;
