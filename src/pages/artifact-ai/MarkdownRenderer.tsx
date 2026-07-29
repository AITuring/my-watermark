import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
    content: string;
    components: Record<string, unknown>;
    highlight?: boolean;
}

export default function MarkdownRenderer({
    content,
    components,
    highlight = true,
}: MarkdownRendererProps) {
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
