// TODO 不同sie，icon应该不一样

import React, { FC, MouseEvent, useState } from "react";
import classNames from "classnames";
import { uuid } from "@/utils";
import Icon from "../Icon";

interface CustomButtonProps {
    variant?: "text" | "outlined" | "contained";
    color?: "default" | "primary" | "secondary";
    size?: "small" | "medium" | "large" | "xlarge";
    disabled?: boolean;
    icon?: React.ReactNode;
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
        if (onClick) onClick();
    };

    const buttonClasses = classNames(
        "relative overflow-hidden rounded transition duration-300 focus:outline-none text-white px-4 py-2 flex justify-center items-center cursor-pointer",
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
            "text-sm": size === "small",
            "text-base": size === "medium",
            "text-lg": size === "large",
            "w-12": size === "small",
            "w-24": size === "medium",
            "w-36": size === "large",
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
        console.log(size);
        switch (size) {
            case "small":
                return { width: 16, height: 16 };
            case "medium":
                return { width: 24, height: 24 };
            case "large":
                return { width: 32, height: 32 };
            case "xlarge":
                return { width: 40, height: 40 };
            default:
                return { width: 24, height: 24 }; // 默认大小为 medium
        }
    };

    const iconSizeStyle = getIconSizeStyle(size);

    return (
        <button
            className={buttonClasses}
            onClick={handleClick}
            disabled={disabled}
        >
            {icon && <div className="mr-2">
                {/* <Icon style={{...iconSizeStyle}}>{icon}</Icon> */}
                </div>}
            {children}
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
