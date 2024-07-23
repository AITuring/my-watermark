// Icon.js
import React from 'react';

interface IconProps {
    size?: 'small' | 'medium' | 'large' | 'xlarge';
    // 可以添加更多的属性，比如 color, className 等
}

const Icon: React.FC<IconProps> = ({ size = 'medium', ...props }) => {
    const iconSizeStyle = {
        width: size === 'small' ? '16px' : size === 'medium' ? '24px' : size === 'large' ? '32px' : '40px',
        height: size === 'small' ? '16px' : size === 'medium' ? '24px' : size === 'large' ? '32px' : '40px',
    };

    return (
        <svg style={iconSizeStyle} {...props}>
        </svg>
    );
};

export default Icon;
