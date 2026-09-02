import React from "react";
import { Landmark } from "lucide-react";

import { ArtifactImage } from "./ArtifactImage";
import { HighlightText, MarkdownContent } from "./components";
import type { Artifact } from "./types";

interface ArtifactCardProps {
    artifact: Artifact;
    searchTerm: string;
    onClick: (artifact: Artifact) => void;
    wenwuTypeIcons: Record<string, string>;
    getEraIcon: (era: string) => string | undefined;
    getEraColor: (era: string) => string;
    getTypeColor: (type: string) => string;
}

export const ArtifactCard: React.FC<ArtifactCardProps> = ({
    artifact,
    searchTerm,
    onClick,
    wenwuTypeIcons,
    getEraIcon,
    getEraColor,
    getTypeColor,
}) => {
    const eraIcon = getEraIcon(artifact.era);
    const typeIcon = wenwuTypeIcons[artifact.type];

    return (
        <div
            onClick={() => onClick(artifact)}
            className="
                group cursor-pointer bg-white dark:bg-slate-900 rounded-xl transition-all duration-300 ease-out
                border border-slate-200/60 dark:border-slate-800
                hover:border-indigo-300 dark:hover:border-indigo-700
                hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-none
                hover:-translate-y-1 relative overflow-hidden
            "
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <ArtifactImage
                artifact={artifact}
                alt={artifact.name}
                className="h-44 border-b border-slate-200/70 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.08),transparent_55%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] p-3 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.92))]"
                imageClassName="h-full w-full rounded-lg object-contain shadow-[0_10px_30px_rgba(15,23,42,0.08)] transition-transform duration-300 group-hover:scale-[1.01] dark:shadow-none"
            />
            <div className="p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-2.5">
                        <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 border border-slate-100 dark:border-slate-700/50 ${getTypeColor(artifact.type)} bg-opacity-10 text-opacity-90 transition-all hover:bg-opacity-20`}
                        >
                            {typeIcon && (
                                <img
                                    src={typeIcon}
                                    alt={artifact.type}
                                    className="w-5 h-5 rounded-sm object-contain"
                                />
                            )}
                            {artifact.type}
                        </span>
                        <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 border border-slate-100 dark:border-slate-700/50 ${getEraColor(artifact.era)} bg-opacity-10 text-opacity-90 transition-all hover:bg-opacity-20`}
                        >
                            {eraIcon && (
                                <img
                                    src={eraIcon}
                                    alt={artifact.era}
                                    className="w-5 h-5 object-contain"
                                />
                            )}
                            {artifact.era}
                        </span>
                    </div>
                </div>

                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2 font-serif group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1 tracking-tight">
                    <HighlightText text={artifact.name} highlight={searchTerm} />
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-500 font-medium mb-4">
                    <Landmark className="w-3.5 h-3.5 shrink-0 opacity-60 text-indigo-400" />
                    <span className="truncate tracking-wide">
                        {artifact.collectionLocation}
                    </span>
                </div>

                <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mt-auto font-light group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                    {searchTerm ? (
                        <HighlightText
                            text={artifact.desc}
                            highlight={searchTerm}
                            contextLength={40}
                        />
                    ) : (
                        <MarkdownContent
                            content={artifact.desc}
                            className="[&>p]:mb-0 text-slate-500 dark:text-slate-400"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
