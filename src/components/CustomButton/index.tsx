import React, { FC, MouseEvent, useState } from "react";
import classNames from "classnames";
import { uuid } from "@/utils";

interface CustomButtonProps {
    variant?: "text" | "outlined" | "contained";
    color?: "default" | "primary" | "secondary";
    size?: "small" | "medium" | "large";
    disabled?: boolean;
    icon?: React.ReactNode;
    onClick?: () => void;
    children: React.ReactNode;
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
}) => {
    const [ripples, setRipples] = useState<
        Array<Ripple>
    >([]);

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const color = "#" + Math.floor(Math.random() * 0xffffff).toString(16);
        const id = uuid();
        const newRipple: Ripple = { id, x, y, color };
        setRipples(ripples => [...ripples, newRipple]);
        setTimeout(() => {
            setRipples(ripples => ripples.filter((ripple) => ripple.id !== id));
        }, 1000);
        if (onClick) onClick();
    };

    const buttonClasses = classNames(
        "relative overflow-hidden rounded transition duration-300 focus:outline-none text-white bg-gray-700 px-4 py-2 flex items-center cursor-pointer space-x-4",
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
        }
    );

    return (
        <button
            className={buttonClasses}
            onClick={handleClick}
            disabled={disabled}
        >
            {icon}
            {children}
            {ripples.map(ripple => (
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
