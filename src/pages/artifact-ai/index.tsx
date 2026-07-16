import React, { useState, useRef, useEffect } from "react";
import OpenAI from "openai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import html2canvas from "html2canvas";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
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
    RotateCcw,
    Copy,
    Share2,
    Download,
    Check,
    X,
    Columns,
    Maximize2,
    ArrowUp,
} from "lucide-react";

interface ArtifactAIProps {}

const MarkdownLink = ({ href, children, title }: any) => {
    // Helper to get text content
    const getText = (node: any): string => {
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(getText).join('');
        if (node?.props?.children) return getText(node.props.children);
        return '';
    };

    const text = getText(children);
    const isShort = text.length < 15 || /^\[?\d+\]?$/.test(text) || text.includes('链接') || text.includes('来源') || text.includes('PDF');

    // Preview content component
    const PreviewContent = () => (
        <div className="flex flex-col gap-2 w-full h-full">
            <div className="flex items-center gap-2 p-2 border-b border-stone-100 bg-stone-50">
                 <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border border-stone-200 shrink-0">
                    <img
                        src={`https://www.google.com/s2/favicons?domain=${href}&sz=64`}
                        alt="favicon"
                        className="w-3 h-3 opacity-70"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                 </div>
                 <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-medium text-stone-700 truncate">{new URL(href).hostname}</span>
                 </div>
            </div>

            <div className="relative w-full h-[200px] bg-white">
                <iframe
                    src={href}
                    className="w-full h-full border-0"
                    title="Link Preview"
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                    onLoad={(e) => {
                        // Hide loading state if needed
                    }}
                />
                {/* Overlay to catch clicks and prevent navigation inside iframe */}
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 bg-transparent"
                    title="点击打开链接"
                />
            </div>
        </div>
    );

    if (!isShort) {
        return (
            <HoverCard openDelay={200}>
                <HoverCardTrigger asChild>
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#8b4513] hover:text-[#5d4037] hover:underline underline-offset-4 break-all transition-colors"
                    >
                        {children}
                        <ExternalLink className="w-3 h-3 opacity-50 inline ml-0.5" />
                    </a>
                </HoverCardTrigger>
                <HoverCardContent className="w-[400px] p-0 overflow-hidden bg-white border-stone-200 shadow-xl" side="top" align="start">
                    <PreviewContent />
                </HoverCardContent>
            </HoverCard>
        );
    }

    return (
        <HoverCard openDelay={200}>
            <HoverCardTrigger asChild>
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center mx-1 align-baseline no-underline"
                >
                    <Badge
                        variant="secondary"
                        className="h-5 px-2 py-0 text-[10px] bg-stone-100 text-stone-600 hover:bg-[#8b4513] hover:text-white transition-colors cursor-pointer gap-1 whitespace-nowrap border border-stone-200"
                    >
                        {children}
                        <ExternalLink className="w-2 h-2" />
                    </Badge>
                </a>
            </HoverCardTrigger>
            <HoverCardContent className="w-[400px] p-0 overflow-hidden bg-white border-stone-200 shadow-xl" side="top" align="start">
                <PreviewContent />
            </HoverCardContent>
        </HoverCard>
    );
};

const ArtifactAI: React.FC<ArtifactAIProps> = () => {
    // Qwen States
    const [apiKey, setApiKey] = useState(
        import.meta.env.VITE_DASHSCOPE_API_KEY || ""
    );
    const [result, setResult] = useState<string>("");
    const [thought, setThought] = useState<string>("");
    const [isThoughtOpen, setIsThoughtOpen] = useState(true);

    // Doubao States
    const [doubaoApiKey, setDoubaoApiKey] = useState(
        import.meta.env.VITE_DOUBAO_API_KEY || ""
    );
    const [doubaoModel, setDoubaoModel] = useState(
        import.meta.env.VITE_DOUBAO_MODEL || ""
    );
    const [doubaoResult, setDoubaoResult] = useState<string>("");
    const [doubaoThought, setDoubaoThought] = useState<string>("");
    const [isDoubaoThoughtOpen, setIsDoubaoThoughtOpen] = useState(true);

    // Tavily Search State
    const [tavilyApiKey, setTavilyApiKey] = useState(
        import.meta.env.VITE_TAVILY_API_KEY || ""
    );

    // Global States
    const [loading, setLoading] = useState(false);
    const [compareMode, setCompareMode] = useState(false);
    const [singleModel, setSingleModel] = useState<'qwen' | 'doubao'>('qwen');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Form states
    const [rawInput, setRawInput] = useState("");
    const [hasSearched, setHasSearched] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
    const [exportContent, setExportContent] = useState("");

    // Auto-scroll ref
    const scrollRef = useRef<HTMLDivElement>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if ((loading || result || doubaoResult) && autoScrollEnabled) {
            scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }, [thought, result, doubaoThought, doubaoResult, loading, autoScrollEnabled]);

    const performStream = async (
        messages: any[],
        apiKey: string,
        baseURL: string,
        model: string,
        onThought: (t: string) => void,
        onResult: (r: string) => void,
        onThoughtOpen: (o: boolean) => void,
        onError?: (error: any) => void
    ) => {
        try {
            const client = new OpenAI({
                apiKey: apiKey,
                baseURL: baseURL,
                dangerouslyAllowBrowser: true,
            });

            const stream = await client.chat.completions.create({
                model: model,
                messages: messages,
                stream: true,
                temperature: 0, // Zero temperature for strict RAG adherence
            });

            let fullContent = "";
            let fullReasoning = "";
            let hasCollapsedThought = false;

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;
                const content = delta?.content || "";
                const reasoning = (delta as any)?.reasoning_content || "";

                // Update native reasoning
                if (reasoning) {
                    fullReasoning += reasoning;
                }

                // Update content
                if (content) {
                    fullContent += content;
                }

                // Process thoughts from tags
                let thoughtFromTags = "";
                const thinkStart = fullContent.indexOf("<think>");
                const thinkEnd = fullContent.indexOf("</think>");

                let cleanResult = fullContent;

                if (thinkStart !== -1) {
                    if (thinkEnd !== -1) {
                        // Thought block complete
                        thoughtFromTags = fullContent.substring(thinkStart + 7, thinkEnd);
                        // Remove the thought block from result
                        cleanResult = fullContent.substring(0, thinkStart) + fullContent.substring(thinkEnd + 8);
                    } else {
                        // Thought block in progress
                        thoughtFromTags = fullContent.substring(thinkStart + 7);
                        // Hide the thought block from result
                        cleanResult = fullContent.substring(0, thinkStart);
                    }
                }

                // Combine thoughts: Native + Tags
                // If both exist, we join them. Usually only one exists.
                const combinedThought = [fullReasoning, thoughtFromTags].filter(Boolean).join("\n\n");

                if (combinedThought) {
                    onThought(combinedThought);
                }

                // Update Result
                onResult(cleanResult);

                // Auto-collapse logic
                // Collapse if we have some real result content (ignoring whitespace)
                if (cleanResult.trim().length > 0 && !hasCollapsedThought) {
                    onThoughtOpen(false);
                    hasCollapsedThought = true;
                }
            }
        } catch (error: any) {
            console.error("API Error:", error);
            if (onError) onError(error);
            toast.error(`调用失败 (${model}): ${error.message}`);
            onResult(`\n\n**API Error**: ${error.message}`);
        }
    };

    const searchWeb = async (query: string, apiKey: string) => {
        try {
            const response = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    api_key: apiKey,
                    query: query,
                    search_depth: "advanced",
                    include_answer: true,
                    max_results: 5,
                }),
            });
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            console.error("Search failed:", error);
            return [];
        }
    };

    const handleSearch = async (target?: 'qwen' | 'doubao' | any) => {
        if (!rawInput.trim()) {
            toast.error("请输入文物描述信息");
            return;
        }

        const specificTarget = (typeof target === 'string') ? target : undefined;

        let runQwen = true;
        let runDoubao = compareMode;

        if (specificTarget === 'qwen') {
            runQwen = true;
            runDoubao = false;
        } else if (specificTarget === 'doubao') {
            runQwen = false;
            runDoubao = true;
        } else {
             // Default behavior (search button or enter key)
             if (compareMode) {
                 runQwen = true;
                 runDoubao = true;
             } else {
                 runQwen = singleModel === 'qwen';
                 runDoubao = singleModel === 'doubao';
             }
        }

        if (runQwen && !apiKey) {
            toast.error("请先配置 Qwen API Key");
            return;
        }
        if (runDoubao && (!doubaoApiKey || !doubaoModel)) {
            toast.error("请先配置 Doubao API Key 和 Model Endpoint");
            return;
        }

        setLoading(true);
        setHasSearched(true);

        // Reset States
        if (runQwen) {
            setResult("");
            setThought("");
            setIsThoughtOpen(true);
        }
        if (runDoubao) {
            setDoubaoResult("");
            setDoubaoThought("");
            setIsDoubaoThoughtOpen(true);
        }

        // 1. Web Search Step (RAG)
        let searchContext = "";
        if (tavilyApiKey) {
            // Notify user we are searching (optional, could use a specific state)
            // toast.info("正在检索互联网信息...");
            const searchResults = await searchWeb(rawInput, tavilyApiKey);

            if (searchResults && searchResults.length > 0) {
                searchContext = searchResults.map((doc: any, index: number) =>
                    `来源ID [${index + 1}]:\n标题: ${doc.title}\nURL: ${doc.url}\n摘要: ${doc.content}`
                ).join("\n\n");
            }
        }

        // 2. Construct Grounded Prompt
        let systemPrompt = `你是一位严谨的**考古学家**和**博物馆资深研究员**。请根据用户提供的文物描述信息，识别该文物，并撰写一份**学术性强、数据准确、有理有据**的百科综述。

**思维链（Chain of Thought）要求**：
请在正式回答之前，先进行深度的逻辑推理和资料检索分析。
1.  **提取特征**：从描述中提取关键信息（时代、材质、尺寸、出土信息等）。
2.  **匹配文物**：根据特征检索匹配的知名文物，排除类似但不符合的选项。
3.  **验证信息**：验证文物的馆藏地、出土时间是否与描述一致。
4.  **构建大纲**：规划回复的结构。
**请务必将你的思考过程包裹在 \`<think>\` 和 \`</think>\` 标签中。**

**撰写要求**：
1.  **真实性第一**：所有关键信息（名称、时代、尺寸、出土时间/地点、馆藏地）必须基于真实存在的考古报告、博物馆官方资料或学术文献。**严禁编造数据**。
2.  **文笔生动**：在保持学术严谨的同时，使用**优美、生动、富有画面感**的语言描述文物特征和历史背景，使其具有博物馆展览级别的可读性。
3.  **引用标注（CRITICAL）**：在文中提及关键数据（特别是**尺寸、重量、年代**）或特定学术观点时，**必须**使用 Markdown 链接格式标注来源脚注。
    *   **链接质量控制**：
        *   **首选**：博物馆官网、政府文化机构网站（.gov/.org）、学术数据库（如 CNKI, JSTOR DOI链接）、知名百科（维基/百度百科作为次选）。
        *   **严禁**：死链、个人博客、不可访问的内网链接、临时链接。
        *   **校验**：请尽量确保提供的 URL 是 HTTPS 协议且长期有效的。
    *   **格式**：\`[1](URL)\` 或 \`[据上海博物馆官网](URL)\`。
    *   **错误示例**：\`[1]\` (无链接)，\`(据官网)\` (无链接)。
    *   **正确示例**：\`纵27.1厘米[1](https://www.shanghaimuseum.net/...)\`。
3.  **参考文献**：文末必须列出参考资料，并提供在线访问链接。

**输出格式**：
请严格按照以下 Markdown 格式输出（在 </think> 之后）：

---
### 1. 基本信息
- **名称**：[标准文物名称]
- **时代**：[准确时代]
- **出土**：[详细出土信息]
- **馆藏**：[现藏博物馆]
- **尺寸**：[详细数据，如：纵27.1厘米，横36.6厘米] [1](URL)

### 2. 外观与形制
请用**细腻的笔触**详细描述文物的形制特征、纹饰图案、材质工艺。关注细节，如光泽、质感、色彩变化等。

### 3. 出土与流传
像讲故事一样叙述文物的出土经过或流传历史，还原历史现场。

### 4. 功能与用途
分析该文物的功能和文化意义。

### 5. 学术综述
总结历史价值与艺术价值。

### 6. 参考文献
请列出真实可靠的参考资料（如博物馆官网页面、考古简报、学术论文链接）。
格式要求：**完整引文信息** + **[链接/来源](URL)**
示例：
1. 上海博物馆官网：黄庭坚《小子相帖》 [官网链接](http://...)
2. 赵丰：《宋代书画用纸研究》，《文物》2021年第3期 [DOI:10.13619...](http://...)

### 7. 推荐标题
请基于文内容，生成 3-8 个富有吸引力、文化韵味或学术深度的标题（每个标题 20 字以内）。
格式：
- [标题1]
- [标题2]
- [标题3]
---`;

        // 3. Inject Search Context (Grounding)
        if (searchContext) {
            systemPrompt += `\n\n### 【关键】互联网搜索结果 (Grounding Context)：\n请基于以下最新的搜索结果来回答问题。如果搜索结果包含确切的文物信息，请优先采用并引用。\n\n${searchContext}\n\n### RAG 特别指令：\n1. **绝对依据**：你的回答应主要基于上述【搜索结果】和你的专业考古知识。如果搜索结果提供了确切的尺寸、出土时间等数据，请直接引用并标注来源ID。\n2. **引用映射**：如果你使用了来源ID [1] 的信息，请尝试在文中以 \`[1](URL)\` 的形式标注（如果 URL 可用）。`;
        } else if (tavilyApiKey) {
             systemPrompt += `\n\n### 注意：\n本次尝试了互联网搜索但未找到直接相关结果。请基于你内部的专业知识库进行回答，但务必保持严谨，不确定的数据请说明或不写。`;
        }

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: rawInput }
        ];

        try {
            const promises = [];

            if (runQwen) {
                promises.push(
                    performStream(
                        messages,
                        apiKey,
                        "https://dashscope.aliyuncs.com/compatible-mode/v1",
                        "qwen-plus-2025-12-01",
                        setThought,
                        setResult,
                        setIsThoughtOpen,
                        (error) => {
                            if (compareMode && (error.message?.includes("Input data may contain inappropriate content") || error.message?.includes("inappropriate"))) {
                                setCompareMode(false);
                                setSingleModel('doubao');
                                toast.warning("Qwen 内容受限，自动切换至 Doubao");
                            }
                        }
                    )
                );
            }

            if (runDoubao) {
                promises.push(
                    performStream(
                        messages,
                        doubaoApiKey,
                        "https://ark.cn-beijing.volces.com/api/v3",
                        doubaoModel,
                        setDoubaoThought,
                        setDoubaoResult,
                        setIsDoubaoThoughtOpen,
                        (error) => {
                            if (compareMode && (error.message?.includes("Input data may contain inappropriate content") || error.message?.includes("inappropriate"))) {
                                setCompareMode(false);
                                setSingleModel('qwen');
                                toast.warning("Doubao 内容受限，自动切换至 Qwen");
                            }
                        }
                    )
                );
            }

            await Promise.all(promises);
        } finally {
            setLoading(false);
        }
    };


    const handleCopy = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopySuccess(true);
        toast.success("内容已复制");
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const handleShare = async (content: string) => {
        setExportContent(content);
        if (!exportRef.current) return;
        setIsExporting(true);
        try {
            // Wait for images to load if any (though we mostly have text)
            await new Promise((resolve) => setTimeout(resolve, 500));

            const canvas = await html2canvas(exportRef.current, {
                useCORS: true,
                scale: 4, // Higher scale for better quality
                backgroundColor: "#Fdfbf5",
                logging: false,
                onclone: (clonedDoc) => {
                    // Optional: adjustments to cloned document before screenshot
                    const element = clonedDoc.querySelector('.export-container') as HTMLElement;
                    if (element) {
                        element.style.display = 'block';
                    }
                }
            });

            const url = canvas.toDataURL("image/png");
            setPreviewUrl(url);
            setShowPreview(true);
            toast.success("花笺生成成功");
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("生成图片失败，请重试");
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownloadImage = () => {
        if (!previewUrl) return;
        const link = document.createElement("a");
        link.download = `ArtifactAI_${new Date().getTime()}.png`;
        link.href = previewUrl;
        link.click();
        setShowPreview(false);
        toast.success("图片已开始下载");
    };

    // Custom Markdown Components for better typography
    const components = {
        a: MarkdownLink,
        h1: ({ node, ...props }: any) => (
            <h1 className="text-2xl font-serif font-bold text-stone-900 mt-8 mb-4 border-b border-stone-200 pb-2 lining-nums" {...props} />
        ),
        h2: ({ node, ...props }: any) => (
            <h2 className="text-xl font-serif font-bold text-stone-800 mt-8 mb-4 flex items-center gap-2 lining-nums" {...props}>
                <span className="w-1 h-5 bg-stone-600 rounded-full inline-block" />
                {props.children}
            </h2>
        ),
        h3: ({ node, ...props }: any) => (
            <h3 className="text-lg font-serif font-semibold text-stone-700 mt-6 mb-3 lining-nums" {...props} />
        ),
        p: ({ node, ...props }: any) => (
            <p className="text-stone-600 leading-relaxed mb-4 text-justify break-words lining-nums" {...props} />
        ),
        ul: ({ node, ...props }: any) => (
            <ul className="list-disc list-outside ml-5 space-y-1 text-stone-600 mb-4 break-words lining-nums" {...props} />
        ),
        ol: ({ node, ...props }: any) => (
            <ol className="list-decimal list-outside ml-5 space-y-1 text-stone-600 mb-4 break-words lining-nums" {...props} />
        ),
        blockquote: ({ node, ...props }: any) => (
            <blockquote className="border-l-4 border-stone-300 pl-4 py-1 my-4 text-stone-500 italic bg-stone-50 rounded-r lining-nums" {...props} />
        ),
        strong: ({ node, ...props }: any) => (
            <strong className="font-semibold text-stone-900" {...props} />
        ),
    };

    // Components for Export (No Links, Simplified)
    const exportComponents = {
        ...components,
        a: ({ children }: any) => <span className="text-[#8b4513] font-medium break-all lining-nums">{children}</span>, // Remove link functionality, keep text
        // Optimize headings for print/image
        h1: ({ node, ...props }: any) => (
            <h1 className="text-3xl font-serif font-bold text-[#5d4037] mt-8 mb-6 border-b-2 border-[#8b4513]/20 pb-4 lining-nums" {...props} />
        ),
        h2: ({ node, ...props }: any) => (
            <h2 className="text-2xl font-serif font-bold text-[#5d4037] mt-10 mb-5 flex items-center gap-3 lining-nums" {...props}>
                <span className="w-1.5 h-6 bg-[#8b4513] rounded-sm inline-block opacity-80" />
                {props.children}
            </h2>
        ),
        p: ({ node, ...props }: any) => (
            <p className="text-[#5d4037] leading-[2] mb-6 text-justify text-lg lining-nums" {...props} />
        ),
        li: ({ node, ...props }: any) => (
             <li className="text-[#5d4037] leading-[1.8] text-lg mb-2 lining-nums" {...props} />
        ),
    };

    // Helper to extract content and titles
    const extractContentAndTitles = (markdown: string) => {
        const titleSectionIndex = markdown.indexOf("### 7. 推荐标题");
        if (titleSectionIndex === -1) {
            return { content: markdown, titles: [] };
        }

        const content = markdown.substring(0, titleSectionIndex).trim();
        const titlesRaw = markdown.substring(titleSectionIndex);

        // Extract titles using regex to find list items
        const titles = titlesRaw
            .split('\n')
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
            .map(line => line.replace(/^[\-\*]\s*/, '').replace(/^\[|\]$/g, '').trim()) // Remove bullet and brackets
            .filter(line => line.length > 0);

        return { content, titles };
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-[#FAFAF9] text-stone-800 z-40 font-sans">
            {/* 顶部标题栏 - Minimal & Elegant */}
            <div className="flex-none p-4 bg-[#FAFAF9]/95 backdrop-blur z-10 sticky top-0 flex items-center justify-between border-b border-stone-100">
                <div className="w-10" />
                <h1 className="text-lg font-serif font-medium text-center text-stone-700 tracking-wide">
                    格物 <span className="text-stone-400 text-xs ml-1 font-sans font-normal">Artifact AI</span>
                </h1>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSettingsOpen(true)}
                    className="w-10 h-10 hover:bg-stone-100 transition-colors text-stone-500"
                >
                    <Settings className="w-5 h-5" />
                </Button>
            </div>

            {/* 设置侧边栏 */}
            {isSettingsOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40 animate-in fade-in duration-300"
                        onClick={() => setIsSettingsOpen(false)}
                    />
                    <div className="fixed inset-y-0 right-0 w-80 bg-[#FAFAF9] border-l border-stone-200 shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
                        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                            <h2 className="font-serif font-bold text-lg flex items-center gap-2 text-stone-700">
                                <Settings className="w-4 h-4" />
                                设置
                            </h2>
                            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(false)} className="hover:bg-stone-100 text-stone-500">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="p-6 space-y-6 flex-1">
                            <div className="space-y-2">
                                <Label htmlFor="sidebar-apikey" className="text-stone-600">Qwen API Key</Label>
                                <Input
                                    id="sidebar-apikey"
                                    type="password"
                                    placeholder="sk-..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="bg-white border-stone-200 focus-visible:ring-stone-400 focus-visible:border-stone-400"
                                />
                                <p className="text-xs text-stone-400">
                                    请使用兼容 OpenAI 格式的 API Key (如 DashScope)
                                </p>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-stone-100">
                                <Label htmlFor="sidebar-tavily-apikey" className="text-stone-600">Tavily Search API Key (RAG)</Label>
                                <Input
                                    id="sidebar-tavily-apikey"
                                    type="password"
                                    placeholder="tvly-..."
                                    value={tavilyApiKey}
                                    onChange={(e) => setTavilyApiKey(e.target.value)}
                                    className="bg-white border-stone-200 focus-visible:ring-stone-400 focus-visible:border-stone-400"
                                />
                                <p className="text-xs text-stone-400">
                                    配置后将自动开启联网搜索增强 (Search-RAG)
                                </p>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-stone-100">
                                <Label htmlFor="sidebar-doubao-apikey" className="text-stone-600">Doubao API Key (对比用)</Label>
                                <Input
                                    id="sidebar-doubao-apikey"
                                    type="password"
                                    placeholder="sk-..."
                                    value={doubaoApiKey}
                                    onChange={(e) => setDoubaoApiKey(e.target.value)}
                                    className="bg-white border-stone-200 focus-visible:ring-stone-400 focus-visible:border-stone-400"
                                />
                                <Label htmlFor="sidebar-doubao-model" className="text-stone-600 text-xs mt-2 block">Doubao Model ID</Label>
                                <Input
                                    id="sidebar-doubao-model"
                                    type="text"
                                    placeholder="ep-..."
                                    value={doubaoModel}
                                    onChange={(e) => setDoubaoModel(e.target.value)}
                                    className="bg-white border-stone-200 focus-visible:ring-stone-400 focus-visible:border-stone-400 text-xs"
                                />
                                <p className="text-xs text-stone-400">
                                    Doubao (Volcengine) Endpoint ID
                                </p>
                            </div>

                            <div className="pt-4 border-t border-dashed border-stone-200">
                                <p className="text-xs text-center text-stone-400">
                                    Qwen-Plus & Doubao
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* 主要内容区域 - 聊天流 */}
            <div
                className="flex-1 overflow-y-auto p-4 pb-32 custom-scrollbar bg-[#FAFAF9]"
                onScroll={(e) => {
                    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                    // If user scrolls up (not at bottom), disable auto-scroll
                    // If user scrolls to bottom, re-enable auto-scroll
                    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
                    setAutoScrollEnabled(isAtBottom);
                }}
            >
                <div className={`mx-auto space-y-8 ${compareMode ? 'max-w-[1600px] w-full px-4' : 'max-w-3xl'}`}>
                    {/* 初始状态 - 仅在未搜索时显示 */}
                    {!hasSearched && (
                        <div className="text-center py-32 space-y-8">
                             <div className="relative group w-24 h-24 mx-auto mb-8 animate-in zoom-in-50 fade-in duration-1000 ease-out">
                                <div className="absolute inset-0 bg-stone-100 rounded-full blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-1000 animate-pulse"></div>
                                <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center border border-stone-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] animate-float">
                                    <BookOpen className="w-10 h-10 text-stone-700 opacity-80 animate-breathe" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-3xl font-serif font-bold text-stone-800 tracking-wider animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 fill-mode-backwards">
                                    格物致知 · 探寻历史
                                </h2>
                                <div className="flex items-center justify-center gap-2 text-stone-400 text-sm animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-backwards">
                                    <span className="w-8 h-[1px] bg-stone-300"></span>
                                    <span className="font-serif tracking-widest uppercase text-xs">Investigate Things to Extend Knowledge</span>
                                    <span className="w-8 h-[1px] bg-stone-300"></span>
                                </div>
                                <p className="text-stone-500 text-sm max-w-md mx-auto leading-relaxed pt-2 font-light animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-backwards">
                                    输入文物信息，获取专业的学术综述与考证
                                </p>
                            </div>
                        </div>
                    )}

                    <div className={compareMode ? "grid grid-cols-2 gap-6 items-start" : ""}>
                        {/* Column 1: Qwen */}
                        {(compareMode || singleModel === 'qwen') && (
                        <div className="flex flex-col gap-6 min-w-0">
                             {compareMode && hasSearched && (
                                <div className="flex items-center gap-2 pb-2 border-b border-stone-200">
                                    <Badge variant="outline" className="bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20">
                                        Qwen-Plus
                                    </Badge>
                                </div>
                            )}

                            {/* Qwen Thought Process */}
                            {(thought || loading) && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                     <div className="bg-white rounded-lg overflow-hidden border border-stone-200 shadow-sm transition-all duration-300 group">
                                        <div
                                            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors select-none"
                                            onClick={() => setIsThoughtOpen(!isThoughtOpen)}
                                        >
                                            <div className="flex items-center gap-2">
                                                {!result && loading ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 text-stone-400 animate-spin" />
                                                        <span className="text-xs text-stone-400 font-medium tracking-wider uppercase">Searching & Reasoning...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <BrainCircuit className="w-3.5 h-3.5 text-stone-400" />
                                                        <span className="text-xs text-stone-500 font-medium tracking-wide">考证思路 · Qwen</span>
                                                    </>
                                                )}
                                            </div>
                                            <ChevronDown className={`w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500 transition-transform duration-300 ${isThoughtOpen ? 'rotate-180' : ''}`} />
                                        </div>

                                        <div
                                            className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${
                                                isThoughtOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                            }`}
                                        >
                                            <div className="overflow-hidden">
                                                <div className="px-5 pb-5 pt-1">
                                                    <div className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-stone-200 font-serif bg-stone-50/50 p-4 rounded-r-md shadow-inner">
                                                        {thought}
                                                        {!result && loading && (
                                                            <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-stone-400 animate-pulse rounded-sm"></span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Qwen Result */}
                            {result && (() => {
                                const { content, titles } = extractContentAndTitles(result);
                                return (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-4">
                                        <article className="bg-white p-10 md:p-12 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-stone-100">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                rehypePlugins={[rehypeHighlight]}
                                                components={components}
                                            >
                                                {content}
                                            </ReactMarkdown>

                                            <div className="mt-16 pt-8 border-t border-stone-100 flex items-center justify-center gap-3 text-stone-300">
                                                <div className="w-1.5 h-1.5 rounded-full bg-stone-200" />
                                                <span className="text-[10px] tracking-[0.2em] font-serif uppercase text-stone-400">Gewu · Artifact Intelligence</span>
                                                <div className="w-1.5 h-1.5 rounded-full bg-stone-200" />
                                            </div>
                                        </article>

                                        {/* Titles Card */}
                                        {titles.length > 0 && (
                                            <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-100">
                                                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2 font-serif">
                                                    <Sparkles className="w-3.5 h-3.5" />
                                                    推荐标题
                                                </h3>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {titles.map((title, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-3.5 bg-stone-50/50 rounded-lg border border-stone-100 group hover:border-stone-300 hover:bg-white transition-all duration-300">
                                                            <span className="font-serif text-stone-700 font-medium tracking-wide">{title}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleCopy(title)}
                                                                className="h-8 w-8 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md"
                                                                title="复制标题"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 操作按钮组 */}
                                        {!loading && (
                                            <div className="flex items-center justify-end gap-2 mt-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleCopy(content)}
                                                    className="text-stone-600 hover:text-stone-900 border-stone-200"
                                                >
                                                    {copySuccess ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                                                    复制正文
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleSearch('qwen')}
                                                    className="text-stone-600 hover:text-stone-900 border-stone-200"
                                                >
                                                    <RotateCcw className="w-4 h-4 mr-1" />
                                                    重试
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleShare(content)}
                                                    disabled={isExporting}
                                                    className="text-stone-600 hover:text-stone-900 border-stone-200"
                                                >
                                                    {isExporting ? (
                                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                    ) : (
                                                        <Share2 className="w-4 h-4 mr-1" />
                                                    )}
                                                    分享
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                        )}

                        {/* Column 2: Doubao */}
                        {(compareMode || singleModel === 'doubao') && (
                            <div className="flex flex-col gap-6 min-w-0">
                                {(compareMode || singleModel === 'doubao') && hasSearched && (
                                <div className="flex items-center gap-2 pb-2 border-b border-[#9d2933]/20">
                                    <Badge variant="outline" className="bg-[#9d2933]/5 text-[#9d2933] border-[#9d2933]/20 font-serif tracking-wide">
                                        Doubao (豆包)
                                    </Badge>
                                </div>
                                )}

                                {/* Doubao Thought Process */}
                                {(doubaoThought || loading) && (
                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                         <div className="bg-white rounded-lg overflow-hidden border border-[#9d2933]/20 shadow-sm transition-all duration-300 group">
                                            <div
                                                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#9d2933]/5 transition-colors select-none"
                                                onClick={() => setIsDoubaoThoughtOpen(!isDoubaoThoughtOpen)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {!doubaoResult && loading ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 text-[#9d2933]/60 animate-spin" />
                                                            <span className="text-xs text-[#9d2933]/60 font-medium tracking-wider uppercase">Reasoning...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <BrainCircuit className="w-3.5 h-3.5 text-[#9d2933]/40" />
                                                            <span className="text-xs text-[#9d2933]/80 font-medium tracking-wide">考证思路 · Doubao</span>
                                                        </>
                                                    )}
                                                </div>
                                                <ChevronDown className={`w-3.5 h-3.5 text-[#9d2933]/30 group-hover:text-[#9d2933]/60 transition-transform duration-300 ${isDoubaoThoughtOpen ? 'rotate-180' : ''}`} />
                                            </div>

                                            <div
                                                className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${
                                                    isDoubaoThoughtOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                                }`}
                                            >
                                                <div className="overflow-hidden">
                                                    <div className="px-5 pb-5 pt-1">
                                                        <div className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-[#9d2933]/20 font-serif bg-[#9d2933]/5 p-4 rounded-r-md shadow-inner">
                                                            {doubaoThought}
                                                            {!doubaoResult && loading && (
                                                                <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-[#9d2933]/40 animate-pulse rounded-sm"></span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Doubao Result */}
                                {doubaoResult && (() => {
                                    const { content, titles } = extractContentAndTitles(doubaoResult);
                                    return (
                                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-4">
                                        <article className="bg-white p-10 md:p-12 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-stone-100">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                rehypePlugins={[rehypeHighlight]}
                                                components={components}
                                            >
                                                {content}
                                            </ReactMarkdown>

                                            <div className="mt-16 pt-8 border-t border-stone-100 flex items-center justify-center gap-3 text-stone-300">
                                                <div className="w-1.5 h-1.5 rounded-full bg-stone-200" />
                                                <span className="text-[10px] tracking-[0.2em] font-serif uppercase text-stone-400">Gewu · Artifact Intelligence</span>
                                                <div className="w-1.5 h-1.5 rounded-full bg-stone-200" />
                                            </div>
                                        </article>

                                        {/* Titles Card */}
                                        {titles.length > 0 && (
                                            <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-100">
                                                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2 font-serif">
                                                    <Sparkles className="w-3.5 h-3.5" />
                                                    推荐标题
                                                </h3>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {titles.map((title, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-3.5 bg-stone-50/50 rounded-lg border border-stone-100 group hover:border-stone-300 hover:bg-white transition-all duration-300">
                                                            <span className="font-serif text-stone-700 font-medium tracking-wide">{title}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleCopy(title)}
                                                                className="h-8 w-8 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md"
                                                                title="复制标题"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                            {/* 操作按钮组 (Doubao) */}
                                            {!loading && (
                                                <div className="flex items-center justify-end gap-2 mt-4">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleCopy(content)}
                                                        className="text-stone-600 hover:text-stone-900 border-stone-200"
                                                    >
                                                        {copySuccess ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                                                        复制正文
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleSearch('doubao')}
                                                        className="text-stone-600 hover:text-stone-900 border-stone-200"
                                                    >
                                                        <RotateCcw className="w-4 h-4 mr-1" />
                                                        重试
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleShare(content)}
                                                        disabled={isExporting}
                                                        className="text-stone-600 hover:text-stone-900 border-stone-200"
                                                    >
                                                        {isExporting ? (
                                                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                        ) : (
                                                            <Share2 className="w-4 h-4 mr-1" />
                                                        )}
                                                        分享
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {/* 滚动锚点 */}
                    <div ref={scrollRef} className="h-4" />
                </div>
            </div>

            {/* 隐藏的导出容器 - 花笺样式 */}
            <div className="absolute top-0 left-[-9999px]">
                <div
                    ref={exportRef}
                    className="export-container w-[1200px] bg-[#Fdfbf5] p-20 text-stone-800 font-serif relative overflow-hidden"
                    style={{
                        backgroundImage: 'radial-gradient(#e6e2d8 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                    }}
                >
                    {/* 装饰边框 */}
                    <div className="absolute inset-6 border-4 border-double border-[#8b4513]/30 pointer-events-none" />
                    <div className="absolute inset-8 border border-[#8b4513]/10 pointer-events-none" />

                    {/* 头部装饰 */}
                    <div className="flex flex-col items-center justify-center mb-12 border-b-2 border-[#8b4513]/20 pb-8 mx-10">
                        <div className="w-16 h-16 border-2 border-[#8b4513] rounded-full flex items-center justify-center mb-5">
                            <span className="font-serif font-bold text-[#8b4513] text-2xl">格</span>
                        </div>
                        <h1 className="text-5xl font-bold text-[#5d4037] tracking-[0.3em] mb-2">格物</h1>
                        <p className="text-[#8b4513]/60 text-lg uppercase tracking-[0.4em]">Gewu · Artifact Intelligence</p>
                    </div>

                    {/* 正文内容 - 使用专用渲染组件 */}
                    <div className="prose prose-stone max-w-none">
                         <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={exportComponents}
                        >
                            {exportContent || result}
                        </ReactMarkdown>
                    </div>

                    {/* 底部落款 */}
                    <div className="mt-20 pt-10 border-t border-[#8b4513]/20 flex justify-between items-center mx-10">
                        <div className="flex flex-col gap-2">
                             <span className="text-[#8b4513]/40 text-sm tracking-wider font-medium">GENERATED BY GEWU AI</span>
                             <span className="text-[#8b4513]/40 text-sm font-mono">{new Date().toLocaleDateString()}</span>
                        </div>
                        {/* 隶书印章 (Lishu Seal) - Solid Red Block */}
                        <div className="w-24 h-24 bg-[#b91c1c] rounded-md shadow-sm flex items-center justify-center opacity-90">
                             <div className="border border-white/20 w-[88px] h-[88px] rounded-[4px] p-2 grid grid-cols-2 grid-rows-2 gap-1">
                                {/* Traditional Layout: Right Col (格物), Left Col (致知) -> Visually: Row 1 (致 格), Row 2 (知 物) */}
                                <div className="flex items-center justify-center text-white text-3xl font-bold leading-none" style={{ fontFamily: '"LiSu", "STLiti", "KaiTi", serif' }}>致</div>
                                <div className="flex items-center justify-center text-white text-3xl font-bold leading-none" style={{ fontFamily: '"LiSu", "STLiti", "KaiTi", serif' }}>格</div>
                                <div className="flex items-center justify-center text-white text-3xl font-bold leading-none" style={{ fontFamily: '"LiSu", "STLiti", "KaiTi", serif' }}>知</div>
                                <div className="flex items-center justify-center text-white text-3xl font-bold leading-none" style={{ fontFamily: '"LiSu", "STLiti", "KaiTi", serif' }}>物</div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 底部输入框区域 */}
            <div className="flex-none bg-[#FAFAF9] pb-8 pt-4 border-t border-stone-100">
                <div className={`mx-auto px-6 space-y-3 transition-all duration-300 ${compareMode ? 'max-w-[1600px]' : 'max-w-3xl'}`}>
                    <div className="flex items-center justify-end gap-3">
                         {!compareMode && (
                             <div className="flex items-center bg-stone-100/50 rounded-md p-0.5 border border-stone-200">
                                 <Button
                                     variant="ghost"
                                     size="sm"
                                     onClick={() => setSingleModel('qwen')}
                                     className={`h-7 text-xs px-3 rounded-sm transition-all font-serif ${singleModel === 'qwen' ? 'bg-white shadow-sm text-stone-800 font-bold border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}
                                 >
                                     通义 Qwen
                                 </Button>
                                 <Button
                                     variant="ghost"
                                     size="sm"
                                     onClick={() => setSingleModel('doubao')}
                                     className={`h-7 text-xs px-3 rounded-sm transition-all font-serif ${singleModel === 'doubao' ? 'bg-white shadow-sm text-[#9d2933] font-bold border border-[#9d2933]/10' : 'text-stone-400 hover:text-stone-600'}`}
                                 >
                                     豆包 Doubao
                                 </Button>
                             </div>
                         )}

                         <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCompareMode(!compareMode)}
                            className={`text-xs gap-1.5 h-7 rounded-sm font-serif tracking-wide ${compareMode ? 'bg-stone-200 text-stone-800 font-medium' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'}`}
                            title="开启对比模式"
                        >
                            {compareMode ? <Columns className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                            {compareMode ? "对比视图" : "单视图"}
                        </Button>
                    </div>

                    <div className="relative bg-white rounded-xl border border-stone-200 focus-within:ring-1 focus-within:ring-stone-400 focus-within:border-stone-400 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] hover:border-stone-300">
                        <Textarea
                            id="rawInput"
                            placeholder="描述文物特征、铭文或历史背景..."
                            className="min-h-[60px] max-h-[200px] border-0 bg-transparent resize-none focus-visible:ring-0 p-5 pr-16 shadow-none custom-scrollbar text-base text-stone-700 placeholder:text-stone-300 font-serif leading-relaxed"
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
                            className="absolute right-3 bottom-3 h-10 w-10 rounded-lg bg-stone-800 hover:bg-stone-700 text-[#FAFAF9] shadow-sm transition-all disabled:opacity-30 disabled:bg-stone-200 flex items-center justify-center group"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <ArrowUp className="h-5 w-5 group-hover:-translate-y-0.5 transition-transform" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>

             {/* Preview Dialog */}
             <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-4xl w-[90vw] h-[90vh] flex flex-col p-0 gap-0 bg-[#FAFAF9] border-stone-200">
                    <DialogHeader className="p-4 border-b border-stone-100 bg-white flex-none">
                        <DialogTitle className="font-serif text-stone-800 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                            花笺预览
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto p-8 bg-stone-100 flex items-center justify-center custom-scrollbar">
                        {previewUrl && (
                            <div className="shadow-2xl border-4 border-white">
                                <img
                                    src={previewUrl}
                                    alt="Generated Artifact Card"
                                    className="max-w-full h-auto object-contain"
                                    style={{ maxHeight: 'calc(90vh - 150px)' }}
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t border-stone-100 bg-white flex-none flex-row justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowPreview(false)} className="border-stone-200 text-stone-600">
                            关闭
                        </Button>
                        <Button onClick={handleDownloadImage} className="bg-[#8b4513] hover:bg-[#5d4037] text-white gap-2">
                            <Download className="w-4 h-4" />
                            下载保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ArtifactAI;
