// EmojiBg.tsx
import React, { useEffect, useRef, useState } from 'react';
import './EmojiBg.css';

interface EmojiBgProps {
  direction?: 'horizontal' | 'vertical';
  emojiSize?: number; // 表情符号的大小（单位：像素）
}

const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];

const EmojiBg: React.FC<EmojiBgProps> = ({ direction = 'horizontal', emojiSize = 32 }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [emojiGrid, setEmojiGrid] = useState<JSX.Element[]>([]);
  const [numRows, setNumRows] = useState(0);
  const [numCols, setNumCols] = useState(0);

  // 计算并设置行数和列数
  useEffect(() => {
    const calculateGridSize = () => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const rows = Math.ceil(screenHeight / emojiSize);
      const cols = Math.ceil(screenWidth / emojiSize);
      // 设置两倍的格子，防止滚动时出现空白
      setNumRows(rows * 2);
      setNumCols(cols * 2);
    };

    calculateGridSize(); // 初始计算
    window.addEventListener('resize', calculateGridSize); // 调整大小时再次计算

    return () => {
      window.removeEventListener('resize', calculateGridSize);
    };
  }, [emojiSize]);

  // 根据行数和列数生成表情网格
  useEffect(() => {
    const generateEmojiGrid = () => {
      return Array.from({ length: numRows }, (_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="emoji-row">
          {Array.from({ length: numCols }, (_, colIndex) => {
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            return (
              <span key={`emoji-${rowIndex}-${colIndex}`} className="emoji" style={{ fontSize: `${emojiSize}px` }}>
                {randomEmoji}
              </span>
            );
          })}
        </div>
      ));
    };

    setEmojiGrid(generateEmojiGrid());
  }, [numRows, numCols, emojiSize]);

  // 处理滚动动画
  // useEffect(() => {
  //   const scroller = scrollerRef.current;
  //   if (scroller) {
  //     let position = 0;
  //     const speed = 2; // 可调整滚动速度
  //     const scroll = () => {
  //       position += speed;
  //       if (direction === 'vertical') {
  //         scroller.scrollTop = position;
  //       } else {
  //         scroller.scrollLeft = position;
  //       }
  //       requestAnimationFrame(scroll);
  //     };
  //     requestAnimationFrame(scroll);
  //   }
  // }, [direction]);

  return (
    <div className={`emoji-scroller ${direction}`} ref={scrollerRef}>
      {emojiGrid}
    </div>
  );
};

export default EmojiBg;