import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

export const HighlightText: React.FC<{
    text: string;
    highlight: string;
    contextLength?: number;
}> = ({ text, highlight, contextLength }) => {
    if (!text) return null;
    if (!highlight || !highlight.trim()) {
        if (contextLength && text.length > contextLength * 2) {
            return <span>{text.slice(0, contextLength * 2)}...</span>;
        }
        return <>{text}</>;
    }

    try {
        const escapedHighlight = highlight.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
        const regex = new RegExp(`(${escapedHighlight})`, "gi");
        let displayText = text;

        if (contextLength) {
            const match = regex.exec(text);
            if (match) {
                const start = Math.max(0, match.index - contextLength);
                const end = Math.min(
                    text.length,
                    match.index + match[0].length + contextLength
                );
                displayText =
                    (start > 0 ? "..." : "") +
                    text.slice(start, end) +
                    (end < text.length ? "..." : "");
            } else if (text.length > contextLength * 2) {
                displayText = text.slice(0, contextLength * 2) + "...";
            }
        }

        const parts = displayText.split(regex);
        return (
            <span>
                {parts.map((part, index) =>
                    regex.test(part) ? (
                        <span
                            key={index}
                            className="bg-yellow-200 text-slate-900 rounded-[2px] px-0.5 box-decoration-clone"
                        >
                            {part}
                        </span>
                    ) : (
                        <span key={index}>{part}</span>
                    )
                )}
            </span>
        );
    } catch (error) {
        console.error("Highlighting error:", error);
        return <>{text}</>;
    }
};

export const MarkdownContent: React.FC<{
    content: string;
    className?: string;
}> = ({ content, className = "" }) => {
    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-100">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-base font-semibold mb-2 text-slate-700 dark:text-slate-200">
                            {children}
                        </h3>
                    ),
                    p: ({ children }) => (
                        <p className="mb-3 leading-relaxed text-slate-700 dark:text-slate-300">
                            {children}
                        </p>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-3 space-y-1 dark:text-slate-300">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-3 space-y-1 dark:text-slate-300">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-slate-700 dark:text-slate-300">{children}</li>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold text-slate-800 dark:text-slate-100">
                            {children}
                        </strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-slate-700 dark:text-slate-300">{children}</em>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-200 dark:border-blue-900 pl-4 py-2 mb-3 bg-blue-50 dark:bg-blue-950/30 text-slate-700 dark:text-slate-300">
                            {children}
                        </blockquote>
                    ),
                    code: ({ children, className: codeClassName }) => {
                        const isInline = !codeClassName;
                        return isInline ? (
                            <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-sm font-mono text-slate-800 dark:text-slate-200">
                                {children}
                            </code>
                        ) : (
                            <code className={codeClassName}>{children}</code>
                        );
                    },
                    pre: ({ children }) => (
                        <pre className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg overflow-x-auto mb-3">
                            {children}
                        </pre>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};
