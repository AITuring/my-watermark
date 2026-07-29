import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
    content: string;
    components: Record<string, unknown>;
    highlight?: boolean;
    renderToken?: number;
    onRenderComplete?: (renderToken: number) => void;
}

export default function MarkdownRenderer({
    content,
    components,
    highlight = true,
    renderToken = 0,
    onRenderComplete,
}: MarkdownRendererProps) {
    useEffect(() => {
        onRenderComplete?.(renderToken);
    }, [content, highlight, onRenderComplete, renderToken]);

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={highlight ? [rehypeHighlight] : []}
            components={components}
        >
            {content}
        </ReactMarkdown>
    );
}
