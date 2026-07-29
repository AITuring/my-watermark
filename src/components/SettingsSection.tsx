import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SettingsSectionProps = {
    title?: ReactNode;
    action?: ReactNode;
    className?: string;
    headerClassName?: string;
    bodyClassName?: string;
    children: ReactNode;
};

type SettingsSectionHeaderProps = {
    title: ReactNode;
    action?: ReactNode;
    className?: string;
};

export function SettingsSection({
    title,
    action,
    className,
    headerClassName,
    bodyClassName,
    children,
}: SettingsSectionProps) {
    return (
        <section
            className={cn(
                "space-y-5 border-b border-border/60 pb-6 last:border-b-0 last:pb-0",
                className
            )}
        >
            {title ? (
                <div
                    className={cn(
                        "flex items-center justify-between gap-3",
                        headerClassName
                    )}
                >
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {title}
                    </div>
                    {action}
                </div>
            ) : null}
            <div className={bodyClassName}>{children}</div>
        </section>
    );
}

export function SettingsSectionHeader({
    title,
    action,
    className,
}: SettingsSectionHeaderProps) {
    return (
        <div className={cn("flex items-center justify-between gap-3", className)}>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
            </div>
            {action}
        </div>
    );
}
