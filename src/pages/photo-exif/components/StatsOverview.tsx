import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Files, MapPin, PencilLine, Save } from "lucide-react";

interface StatsOverviewProps {
    dirtyCount: number;
    gpsCount: number;
    inplaceCount: number;
    itemCount: number;
    writableCount: number;
}

const statCards = [
    { key: "itemCount", label: "已加载图片", icon: Files, iconClass: "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300" },
    { key: "writableCount", label: "可导出修改", icon: PencilLine, iconClass: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300" },
    { key: "dirtyCount", label: "待导出修改", icon: CheckCircle2, iconClass: "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300" },
    { key: "gpsCount", label: "含 GPS 信息", icon: MapPin, iconClass: "bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300" },
    { key: "inplaceCount", label: "可原地改写", icon: Save, iconClass: "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300" },
] as const;

const StatsOverview = ({
    dirtyCount,
    gpsCount,
    inplaceCount,
    itemCount,
    writableCount,
}: StatsOverviewProps) => {
    const values = { dirtyCount, gpsCount, inplaceCount, itemCount, writableCount };

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {statCards.map((card) => {
                const Icon = card.icon;

                return (
                    <Card key={card.key} className="border-slate-200/70 bg-white/85 dark:bg-slate-900/80 dark:border-slate-800">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconClass}`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
                                <p className="text-xl font-semibold">{values[card.key]}</p>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};

export default StatsOverview;
