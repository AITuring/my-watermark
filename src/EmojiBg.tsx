// EmojiBg.tsx
import React, { useEffect, useRef, useState } from "react";
import Marquee from "@/components/animata/container/marquee";
import "./EmojiBg.css";

interface EmojiBgProps {
    direction?: "horizontal" | "vertical";
    emojiSize?: number; // 表情符号的大小（单位：像素）
}

const emojis = [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "😂",
    "🤣",
    "😊",
    "😇",
    "🙂",
    "🙃",
    "😉",
    "😌",
    "😍",
    "🥰",
    "😘",
    "😗",
    "😙",
    "😚",
    "😋",
    "😛",
    "😝",
    "😜",
    "🤪",
    "🤨",
    "🧐",
    "🤓",
    "😎",
    "🤩",
    "🥳",
    "😏",
    "😒",
    "😞",
    "😔",
    "😟",
    "😕",
    "🙁",
    "😣",
    "😖",
    "😫",
    "😩",
    "🥺",
    "😢",
    "😭",
    "😤",
    "😠",
    "😡",
    "🤬",
    "🤯",
    "😳",
    "🥵",
    "🥶",
    "😱",
    "😨",
    "😰",
    "😥",
    "😓",
    "🤗",
    "🤔",
    "🤭",
    "🤫",
    "🤥",
    "😶",
    "😐",
    "😑",
    "😬",
    "🙄",
    "😯",
    "😦",
    "😧",
    "😮",
    "😲",
    "🥱",
    "😴",
    "🤤",
    "😪",
    "😵",
    "🤐",
    "🥴",
    "🤢",
    "🤮",
    "🤧",
    "😷",
    "🤒",
    "🤕",
    "🤑",
    "🤠",
    "😈",
    "👿",
    "👹",
    "👺",
    "🤡",
    "💩",
    "👻",
    "💀",
    "☠️",
    "👽",
    "👾",
    "🤖",
    "🎃",
    "😺",
    "😸",
    "😹",
    "😻",
    "😼",
    "😽",
    "🙀",
    "😿",
    "😾",
];

// ... existing code ...

const EmojiBg: React.FC<EmojiBgProps> = ({ direction = "vertical" }) => {
    const [marqueeCount, setMarqueeCount] = useState(2);
    const [emojiSize, setEmojiSize] = useState(32);

    // 计算需要的 Marquee 层数
    const calculateMarqueeCount = () => {
        const screenHeight = window.innerHeight;
        const rowHeight = emojiSize * 1.5; // 每行的高度
        return Math.max(2, Math.floor(screenHeight / rowHeight)); // 至少保持2层
    };

    const calculateEmojiSize = () => {
        const screenWidth = window.innerWidth;
        // 根据屏幕宽度设置不同的大小
        if (screenWidth < 640) {
            // 移动设备
            return 24;
        } else if (screenWidth < 1024) {
            // 平板
            return 32;
        } else if (screenWidth < 1440) {
            // 小型桌面
            return 40;
        } else {
            // 大屏幕
            return 48;
        }
    };

    // 根据总层数平均分配 emoji
    const getEmojisForRow = () => {
        const emojisPerRow = Math.ceil(emojis.length / marqueeCount);
        return emojis.reduce((acc: string[][], curr, i) => {
            const rowIndex = Math.floor(i / emojisPerRow);
            if (!acc[rowIndex]) acc[rowIndex] = [];
            acc[rowIndex].push(curr);
            return acc;
        }, []);
    };

    // 监听屏幕变化
    useEffect(() => {
        const handleResize = () => {
            setEmojiSize(calculateEmojiSize());
            setMarqueeCount(calculateMarqueeCount());
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // 生成 Marquee 组件
    const generateMarquees = () => {
        const emojiRows = getEmojisForRow();
        return emojiRows.map((rowEmojis, index) => {
            const rowEmojiDivs = rowEmojis.map((emoji, i) => (
                <div
                    key={i}
                    className="flex items-center justify-center"
                    style={{
                        height: `${emojiSize * 1.5}px`,
                        width: `${emojiSize * 1.5}px`,
                        fontSize: `${emojiSize}px`,
                    }}
                >
                    {emoji}
                </div>
            ));

            return (
                <Marquee
                    key={index}
                    reverse={index % 2 === 1} // 相邻行反向移动
                    pauseOnHover
                    className="my-4 border-none "
                >
                    {rowEmojiDivs}
                </Marquee>
            );
        });
    };

    return <div className="w-screen overflow-hidden ">{generateMarquees()}</div>;
};

export default EmojiBg;
