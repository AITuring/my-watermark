import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function UploadEmptyState({ illustration, title, description, actions, hint, footer, isDragActive = false, className }: {
    illustration?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode;
    hint?: ReactNode; footer?: ReactNode; isDragActive?: boolean; className?: string;
}) {
    return <div className={cn("relative isolate overflow-hidden px-5 py-10 sm:px-10 sm:py-12", className)}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_20%,rgba(149,188,168,0.13),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_50%_20%,rgba(149,188,168,0.07),transparent_65%)]" />
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
            {illustration && <div className="mx-auto w-full max-w-[320px]" aria-hidden="true">{illustration}</div>}
            <h2 className={cn("text-[26px] font-medium leading-snug tracking-tight text-foreground sm:text-[30px]", illustration && "mt-5 sm:mt-6")}>{title}</h2>
            {description && <div className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground sm:max-w-none">{description}</div>}
            {actions && <div className="mt-7 flex flex-wrap justify-center gap-3">{actions}</div>}
            <p className="mt-4 text-xs leading-5 text-muted-foreground" role="status">{isDragActive ? "松开鼠标，导入图片" : hint ?? "或将图片拖到这里 · 支持多张图片"}</p>
        </div>
        {footer && <div className="mt-7 border-t border-border/60 pt-5 text-center text-xs text-muted-foreground">{footer}</div>}
    </div>;
}
