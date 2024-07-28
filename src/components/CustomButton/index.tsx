// TODO 不同sie，icon应该不一样
import { icons } from "lucide-react";
import React, { FC, MouseEvent, useState } from "react";
import classNames from "classnames";
import { uuid } from "@/utils";
import Icon from "../Icon";

interface CustomButtonProps {
    variant?: "text" | "outlined" | "contained";
    color?: "default" | "primary" | "secondary";
    size?: "small" | "medium" | "large" | "xlarge";
    disabled?: boolean;
    icon?: keyof typeof icons;
    onClick?: () => void;
    children: React.ReactNode;
    className?: string;
}

type Ripple = {
    id: string;
    x: number;
    y: number;
    color: string;
};

const CustomButton: FC<CustomButtonProps> = ({
    variant = "contained",
    color = "default",
    size = "medium",
    disabled = false,
    onClick,
    icon,
    children,
    className,
}) => {
    const [ripples, setRipples] = useState<Array<Ripple>>([]);

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const color = "#" + Math.floor(Math.random() * 0xffffff).toString(16);
        const id = uuid();
        const newRipple: Ripple = { id, x, y, color };
        setRipples((ripples) => [...ripples, newRipple]);
        setTimeout(() => {
            setRipples((ripples) =>
                ripples.filter((ripple) => ripple.id !== id)
            );
        }, 1000);
        if (onClick && !disabled) onClick();
    };

    const buttonClasses = classNames(
        "relative overflow-hidden rounded transition duration-300 focus:outline-none text-white p-2 flex justify-center items-center cursor-pointer space-x-2",
        {
            "bg-blue-500": color === "primary",
            "bg-purple-500": color === "secondary",
            "bg-gray-500": color === "default",
            "text-blue-500": variant === "text" && color === "primary",
            "text-purple-500": variant === "text" && color === "secondary",
            "text-gray-500": variant === "text" && color === "default",
            "border border-blue-500":
                variant === "outlined" && color === "primary",
            "border border-purple-500":
                variant === "outlined" && color === "secondary",
            "border border-gray-500":
                variant === "outlined" && color === "default",
            "cursor-not-allowed opacity-50": disabled,
            "text-xs": size === "small",
            "text-base": size === "medium",
            "text-lg": size === "large",
            "text-xl": size === "xlarge",
            "px-2": size === "small",
            "px-4": size === "medium",
            "px-8": size === "large",
            "px-12": size === "xlarge",
            // "w-16": size === "small",
            // "w-24": size === "medium",
            // "w-40": size === "large",
            "w-48": size === "xlarge",
            "h-8": size === "small",
            "h-12": size === "medium",
            "h-20": size === "large",
            "h-24": size === "xlarge",
            // icon size
        },
        className
    );

    const getIconSizeStyle = (size: CustomButtonProps["size"]) => {
        switch (size) {
            case "small":
                return 12;
            case "medium":
                return 16;
            case "large":
                return 24;
            case "xlarge":
                return 32;
            default:
                return 16; // 默认大小为 medium
        }
    };

    const iconSize = getIconSizeStyle(size);

    return (
        <button
            className={buttonClasses}
            onClick={handleClick}
            disabled={disabled}
        >
            {icon && <Icon name={icon} size={iconSize}  /> }
            <div>{children}</div>
            {ripples.map((ripple) => (
                <span
                    key={ripple.id}
                    className="absolute rounded-full border-2 animate-ripple"
                    style={{
                        left: ripple.x,
                        top: ripple.y,
                        borderColor: ripple.color,
                        // backgroundColor: ripple.color,
                        // opacity: 0.2,
                        transform: "translate(-50%, -50%)",
                    }}
                />
            ))}
        </button>
    );
};

export default CustomButton;
