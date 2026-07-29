import React from "react";
import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface FilterBarProps {
    mode: "desktop" | "mobile";
    resultCount: number;
    selectedBatch: string;
    selectedType: string;
    selectedEra: string;
    selectedCollection: string;
    batches: string[];
    types: string[];
    eras: string[];
    collections: string[];
    setSelectedBatch: (value: string) => void;
    setSelectedType: (value: string) => void;
    setSelectedEra: (value: string) => void;
    setSelectedCollection: (value: string) => void;
    resetFilters: () => void;
    wenwuTypeIcons: Record<string, string>;
    getEraIcon: (era: string) => string | undefined;
}

export const FilterBar: React.FC<FilterBarProps> = ({
    mode,
    resultCount,
    selectedBatch,
    selectedType,
    selectedEra,
    selectedCollection,
    batches,
    types,
    eras,
    collections,
    setSelectedBatch,
    setSelectedType,
    setSelectedEra,
    setSelectedCollection,
    resetFilters,
    wenwuTypeIcons,
    getEraIcon,
}) => {
    const hasActiveFilters =
        selectedBatch !== "all" ||
        selectedType !== "all" ||
        selectedEra !== "all" ||
        selectedCollection !== "all";

    if (mode === "desktop") {
        return (
            <div className="hidden lg:flex items-center gap-4">
                <span className="text-xs text-slate-400 mr-4 font-medium whitespace-nowrap">
                    {resultCount} 个结果
                </span>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger className="w-[120px] h-8 rounded-full border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 focus:ring-0">
                        <SelectValue placeholder="批次" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部批次</SelectItem>
                        {batches.map((batch) => (
                            <SelectItem key={batch} value={batch}>
                                {batch}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-[120px] h-8 rounded-full border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 focus:ring-0">
                        <SelectValue placeholder="类别" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部类别</SelectItem>
                        {types.map((type) => (
                            <SelectItem key={type} value={type}>
                                <div className="flex items-center gap-2">
                                    {wenwuTypeIcons[type] && (
                                        <img
                                            src={wenwuTypeIcons[type]}
                                            alt={type}
                                            className="w-5 h-5 rounded-sm"
                                        />
                                    )}
                                    <span>{type}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={selectedEra} onValueChange={setSelectedEra}>
                    <SelectTrigger className="w-[120px] h-8 rounded-full border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 focus:ring-0">
                        <SelectValue placeholder="时代" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部时代</SelectItem>
                        {eras.map((era) => (
                            <SelectItem key={era} value={era}>
                                <div className="flex items-center gap-2">
                                    {getEraIcon(era) && (
                                        <img
                                            src={getEraIcon(era) as string}
                                            alt={era}
                                            className="w-5 h-5 rounded-sm"
                                        />
                                    )}
                                    <span>{era}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={selectedCollection}
                    onValueChange={setSelectedCollection}
                >
                    <SelectTrigger className="w-[120px] h-8 rounded-full border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 focus:ring-0">
                        <SelectValue placeholder="馆藏" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">全部馆藏</SelectItem>
                        {collections.map((collection) => (
                            <SelectItem key={collection} value={collection}>
                                {collection}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetFilters}
                        className="h-8 px-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                        重置
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="lg:hidden flex items-center gap-3 mb-4">
            <Dialog>
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        className="flex-1 rounded-xl border-slate-200 shadow-sm"
                    >
                        <Filter className="w-4 h-4 mr-2" /> 筛选条件
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>筛选文物</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500 ml-1">
                                批次
                            </label>
                            <Select
                                value={selectedBatch}
                                onValueChange={setSelectedBatch}
                            >
                                <SelectTrigger className="w-full rounded-xl border-slate-200 shadow-sm">
                                    <SelectValue placeholder="全部批次" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全部批次</SelectItem>
                                    {batches.map((batch) => (
                                        <SelectItem key={batch} value={batch}>
                                            {batch}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500 ml-1">
                                类别
                            </label>
                            <Select
                                value={selectedType}
                                onValueChange={setSelectedType}
                            >
                                <SelectTrigger className="w-full rounded-xl border-slate-200 shadow-sm">
                                    <SelectValue placeholder="全部类别" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全部类别</SelectItem>
                                    {types.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            <div className="flex items-center gap-2">
                                                {wenwuTypeIcons[type] && (
                                                    <img
                                                        src={wenwuTypeIcons[type]}
                                                        alt={type}
                                                        className="w-5 h-5 rounded-sm"
                                                    />
                                                )}
                                                <span>{type}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500 ml-1">
                                时代
                            </label>
                            <Select
                                value={selectedEra}
                                onValueChange={setSelectedEra}
                            >
                                <SelectTrigger className="w-full rounded-xl border-slate-200 shadow-sm">
                                    <SelectValue placeholder="全部时代" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全部时代</SelectItem>
                                    {eras.map((era) => (
                                        <SelectItem key={era} value={era}>
                                            <div className="flex items-center gap-2">
                                                {getEraIcon(era) && (
                                                    <img
                                                        src={getEraIcon(era) as string}
                                                        alt={era}
                                                        className="w-5 h-5 rounded-sm"
                                                    />
                                                )}
                                                <span>{era}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500 ml-1">
                                馆藏
                            </label>
                            <Select
                                value={selectedCollection}
                                onValueChange={setSelectedCollection}
                            >
                                <SelectTrigger className="w-full rounded-xl border-slate-200 shadow-sm">
                                    <SelectValue placeholder="全部馆藏" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全部馆藏</SelectItem>
                                    {collections.map((collection) => (
                                        <SelectItem
                                            key={collection}
                                            value={collection}
                                        >
                                            {collection}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            variant="outline"
                            onClick={resetFilters}
                            className="w-full rounded-xl border-dashed border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 mt-4"
                        >
                            重置筛选
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <div className="text-sm text-slate-500 font-medium whitespace-nowrap">
                共 {resultCount} 个
            </div>
        </div>
    );
};
