import React from "react";
import { View, Image } from "@tarojs/components";

// 导入 SVG 文件
import chevronDownIcon from "@/assets/icons/chevron-down.svg";
import refreshIcon from "@/assets/icons/refresh.svg";
import mapPinIcon from "@/assets/icons/map-pin.svg";
import homeIcon from "@/assets/icons/home.svg";
import closeIcon from "@/assets/icons/close.svg";
import calendarIcon from "@/assets/icons/calendar.svg";
import fileTextIcon from "@/assets/icons/file-text.svg";

const MyIcon: React.FC<{ name: string; size?: number; className?: string }> = ({
  name,
  size = 16,
  className = ""
}) => {
  const getIconSrc = (iconName: string) => {
    const icons = {
      'chevron-down': chevronDownIcon,
      'refresh': refreshIcon,
      'map-pin': mapPinIcon,
      'home': homeIcon,
      'close': closeIcon,
      'calendar': calendarIcon,
      'file-text': fileTextIcon
    };

    return icons[iconName as keyof typeof icons] || closeIcon;
  };

  return (
    <View
      className={`custom-icon ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`
      }}
    >
      <Image
        src={getIconSrc(name)}
        style={{
          width: `${size}px`,
          height: `${size}px`
        }}
        mode="aspectFit"
      />
    </View>
  );
};

export default MyIcon;
