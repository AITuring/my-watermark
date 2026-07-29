import type { ReactNode } from "react";

import PanelCard from "@/components/PanelCard";

type UploadCardProps = {
    title?: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    count?: ReactNode;
    actions?: ReactNode;
    className?: string;
    headerClassName?: string;
    contentClassName?: string;
    tips?: ReactNode;
    status?: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
};

export default function UploadCard({
    title,
    description,
    icon,
    count,
    actions,
    className,
    headerClassName,
    contentClassName,
    tips,
    status,
    footer,
    children,
}: UploadCardProps) {
    return (
        <PanelCard
            title={title}
            description={description}
            icon={icon}
            count={count}
            actions={actions}
            className={className}
            headerClassName={headerClassName}
            contentClassName={contentClassName ?? "space-y-4 p-5"}
        >
            {tips}
            {children}
            {status}
            {footer}
        </PanelCard>
    );
}
