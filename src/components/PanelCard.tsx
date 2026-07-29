import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PanelCardProps = {
    title?: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    count?: ReactNode;
    actions?: ReactNode;
    className?: string;
    headerClassName?: string;
    contentClassName?: string;
    headerInnerClassName?: string;
    titleClassName?: string;
    descriptionClassName?: string;
    countClassName?: string;
    children: ReactNode;
};

export default function PanelCard({
    title,
    description,
    icon,
    count,
    actions,
    className,
    headerClassName,
    contentClassName,
    headerInnerClassName,
    titleClassName,
    descriptionClassName,
    countClassName,
    children,
}: PanelCardProps) {
    const hasHeader = title || description || actions || count;
    const hasLeading = title || description;

    return (
        <Card className={className}>
            {hasHeader ? (
                <CardHeader className={headerClassName}>
                    <div
                        className={cn(
                            "flex items-start justify-between gap-3",
                            !hasLeading && "justify-end",
                            headerInnerClassName
                        )}
                    >
                        {hasLeading ? (
                            <div className="min-w-0 space-y-1">
                                {title ? (
                                    <CardTitle
                                        className={cn(
                                            "flex items-center gap-2",
                                            titleClassName
                                        )}
                                    >
                                        {icon}
                                        {title}
                                    </CardTitle>
                                ) : null}
                                {description ? (
                                    <CardDescription className={descriptionClassName}>
                                        {description}
                                    </CardDescription>
                                ) : null}
                            </div>
                        ) : null}
                        {count !== undefined || actions ? (
                            <div className="flex shrink-0 items-center gap-2">
                                {count !== undefined ? (
                                    <Badge
                                        variant="secondary"
                                        className={countClassName}
                                    >
                                        {count}
                                    </Badge>
                                ) : null}
                                {actions}
                            </div>
                        ) : null}
                    </div>
                </CardHeader>
            ) : null}
            <CardContent className={contentClassName}>{children}</CardContent>
        </Card>
    );
}
