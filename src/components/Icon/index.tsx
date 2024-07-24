import React from "react";
import { icons } from "lucide-react"; // 假设 'lucide-react' 提供了 IconBaseProps 类型

interface IconProps {
    name: keyof typeof icons; // 假设 icons 是一个对象，其键是图标名称
    color?: string; // 假设颜色是可选的
    size?: number | string; // 假设大小也是可选的，并可以是数字或字符串
}

const Icon: React.FC<IconProps> = ({ name, color, size }) => {
    const LucideIcon = icons[name];

    if (!LucideIcon) {
        // 可以添加错误处理，比如渲染一个占位符或抛出错误
        console.error(`Icon with name ${name} not found.`);
        return null; // 或者返回一个空元素
    }

    return <LucideIcon color={color} size={size} />;
};

export default Icon;
