import React from "react";
import { Button } from "@/components/ui/button";

interface ProgressButtonProps {
    onClick: () => void;
    loading: boolean;
    progress: number;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
}

const ProgressButton: React.FC<ProgressButtonProps> = ({
    onClick,
    loading,
    progress,
    children,
    className = "",
    disabled = false,
}) => {
    return (
        <Button
            onClick={onClick}
            size="lg"
            disabled={loading || disabled}
            className={`relative overflow-hidden ${className}`}
        >
            {loading ? (
                <>
                    <div
                        className="absolute inset-0 bg-blue-600"
                        style={{
                            width: `${progress}%`,
                            transition: "width 0.3s ease",
                        }}
                    />
                    <span className="relative z-10 flex items-center">
                        图片生成中: {Math.round(progress)}%
                    </span>
                </>
            ) : (
                children
            )}
        </Button>
    );
};

export default ProgressButton;
