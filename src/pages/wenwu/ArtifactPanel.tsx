import React from "react";
import { Calendar, ExternalLink, FileText, Landmark, MapPin, X } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";

import { MarkdownContent } from "./components";
import type { Artifact } from "./types";

interface ArtifactPanelProps {
    artifact: Artifact | null;
    isOpen: boolean;
    onClose: () => void;
    onFocusMuseum: (artifact: Artifact) => void;
    resolveArtifactImageUrl: (imagePath?: string) => string | undefined;
    wenwuTypeIcons: Record<string, string>;
    getEraIcon: (era: string) => string | undefined;
    getEraColor: (era: string) => string;
    getTypeColor: (type: string) => string;
}

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
    artifact,
    isOpen,
    onClose,
    onFocusMuseum,
    resolveArtifactImageUrl,
    wenwuTypeIcons,
    getEraIcon,
    getEraColor,
    getTypeColor,
}) => {
    if (!artifact) return null;

    const artifactImage = resolveArtifactImageUrl(artifact.image);
    const eraIcon = getEraIcon(artifact.era);
    const typeIcon = wenwuTypeIcons[artifact.type];

    return (
        <div
            className={`fixed left-6 top-24 z-50 h-[calc(100vh-7.5rem)] w-[560px] max-w-[92vw] rounded-2xl bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/50 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transform-gpu transition-[transform,opacity] duration-300 ease-out will-change-transform ${
                isOpen
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-10 opacity-0 pointer-events-none"
            }`}
        >
            <div className="px-8 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 relative">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center"
                    aria-label="关闭"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="text-xl md:text-2xl font-bold font-serif text-slate-800 dark:text-slate-100 pr-10">
                    {artifact.name}
                </div>
                <div className="flex gap-3 mt-4">
                    <span
                        className={`text-sm px-3 py-1 rounded-full font-medium flex items-center gap-2 border border-slate-100 dark:border-slate-700/50 ${getEraColor(artifact.era)} bg-opacity-10 text-opacity-90`}
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
                    <span
                        className={`text-sm px-3 py-1 rounded-full font-medium flex items-center gap-2 border border-slate-100 dark:border-slate-700/50 ${getTypeColor(artifact.type)} bg-opacity-10 text-opacity-90`}
                    >
                        {typeIcon && (
                            <img
                                src={typeIcon}
                                alt={artifact.type}
                                className="w-5 h-5 rounded-sm"
                            />
                        )}
                        {artifact.type}
                    </span>
                </div>
            </div>

            <ScrollArea className="flex-1 px-8">
                <div className="space-y-8 pt-4 pb-6">
                    {artifact.image && artifactImage && (
                        <div className="w-full h-[280px] md:h-[340px] overflow-hidden rounded-xl bg-slate-50/60 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                            <img
                                src={artifactImage}
                                alt={artifact.name}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" />
                                出土地点
                            </span>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 pl-5">
                                {artifact.excavationLocation}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                出土时间
                            </span>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 pl-5">
                                {artifact.excavationTime}
                            </p>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                <Landmark className="w-3.5 h-3.5" />
                                馆藏地点
                            </span>
                            <p
                                className="text-sm font-medium text-slate-700 dark:text-slate-300 pl-5 cursor-pointer hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex items-center gap-2 group/loc"
                                onClick={() => onFocusMuseum(artifact)}
                                title="在地图上查看"
                            >
                                {artifact.collectionLocation}
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover/loc:opacity-100 transition-opacity" />
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400" />
                            文物描述
                        </h4>
                        <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-400">
                            <MarkdownContent
                                content={
                                    artifact.detail && artifact.detail.trim()
                                        ? artifact.detail
                                        : artifact.desc
                                }
                            />
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
};
