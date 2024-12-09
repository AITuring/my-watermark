// TODO 不同sie，icon应该不一样
import React, { FC, MouseEvent, useState } from "react";
import classNames from "classnames";
import { uuid } from "@/utils";
import type { IconifyIcon } from '@iconify/types';
import { Icon } from "@iconify/react";

interface CustomButtonProps {
    variant?: "text" | "outlined" | "contained";
    color?: "default" | "primary" | "secondary";
    size?: "small" | "medium" | "large" | "xlarge";
    disabled?: boolean;
    icon?: string;
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
        // const color = "#" + Math.floor(Math.random() * 0xffffff).toString(16);
        // const buttonColor = `bg-${color}-${400}`;
        // console.log(buttonColor);

        // 生成减弱的涟漪颜色，这里简单地使用相同的颜色和透明度类
        // 你可以根据需要调整透明度级别
        // TODO 颜色有问题，没正确展示
        // const rippleColorClass = `${color}`;
        const id = uuid();
        const newRipple: Ripple = { id, x, y, color };
        setRipples((ripples) => [...ripples, newRipple]);
        setTimeout(() => {
            setRipples((ripples) =>
                ripples.filter((ripple) => ripple.id !== id)
            );
        }, 1500);
        if (onClick && !disabled) onClick();
    };

    const buttonClasses = classNames(
        "relative overflow-hidden rounded transition duration-300 focus:outline-none text-white p-2 flex justify-center items-center cursor-pointer space-x-2",
        {
            "bg-primary-500": color === "primary",
            "bg-secondary-500": color === "secondary",
            "bg-default-500": color === "default",
            "hover:bg-primary-600": color === "primary",
            "hover:bg-secondary-600": color === "secondary",
            "hover:bg-default-600": color === "default",
            "active:bg-primary-700": color === "primary",
            "active:bg-secondary-700": color === "secondary",
            "text-primary-500": variant === "text" && color === "primary",
            "text-secondary-500": variant === "text" && color === "secondary",
            "text-default-500": variant === "text" && color === "default",
            "border border-primary-500":
                variant === "outlined" && color === "primary",
            "border border-secondary-500":
                variant === "outlined" && color === "secondary",
            "border border-default-500":
                variant === "outlined" && color === "default",
            "cursor-not-allowed opacity-50": disabled,
            "text-xs": size === "small",
            "text-base": size === "medium",
            "text-lg": size === "large",
            "text-xl": size === "xlarge",
            "px-2": size === "small",
            "px-4": size === "medium",
            "px-8": size === "large",
            "px-10": size === "xlarge",
            "min-w-16": size === "small",
            "min-w-24": size === "medium",
            "min-w-32": size === "large",
            "min-w-40": size === "xlarge",
            "h-8": size === "small",
            "h-12": size === "medium",
            "h-16": size === "large",
            "h-20": size === "xlarge",
            // shadow
            "shadow-md": size === "small",
            "shadow-lg": size === "medium",
            "shadow-xl": size === "large",
            "shadow-2xl": size === "xlarge",
            // "hover: blur-sm": size === 'xlarge',
        },
        className
    );

    const sizeMap = {
        small: 16,
        medium: 24,
        large: 32,
        xlarge: 40
    } as const;

    return (
        <button
            className={buttonClasses}
            onClick={handleClick}
            disabled={disabled}
        >
            {icon && <Icon icon={icon as unknown as IconifyIcon} width={sizeMap[size]} height={sizeMap[size]} />}
            <div>{children}</div>
            {ripples.map((ripple) => {
                
                return (
                    <span
                        key={ripple.id}
                        className={
                            classNames(
                                "absolute rounded-full border-none animate-ripple z-50",
                                {
                                    "bg-primary-400": ripple.color === 'primary',
                                    "bg-secondary-400": ripple.color === 'secondary',
                                    "bg-default-400": ripple.color === 'default',
                                }
                            )
                        }
                        style={{
                            left: ripple.x,
                            top: ripple.y,
                            // borderColor: ripple.color,
                            // backgroundColor: ripple.color,
                            opacity: 0.6,
                            transform: "translate(-50%, -50%)",
                        }}
                    />
                )
            })}
        </button>
    );
};

export default CustomButton;
