import React, { useEffect, useRef, useState } from "react";
import { Input, Button, message } from "antd";

function changeImageColor(ctx, canvas, colorOrGradient) {
  // 如果是渐变色，设置 fillStyle 并填充矩形
  if (colorOrGradient instanceof CanvasGradient) {
    ctx.fillStyle = colorOrGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 然后绘制图像，仅更改白色像素的颜色
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const alpha = data[i + 3];
      if (
        data[i] === 255 &&
        data[i + 1] === 255 &&
        data[i + 2] === 255 &&
        alpha !== 0
      ) {
        if (!(colorOrGradient instanceof CanvasGradient)) {
          data[i] = colorOrGradient[0]; // R
          data[i + 1] = colorOrGradient[1]; // G
          data[i + 2] = colorOrGradient[2]; // B
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function applyGradientToImage(ctx, canvas, image, color1, color2) {
  // 首先绘制原始图片
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  // 获取图片的像素数据
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 创建渐变
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);

  // 遍历每个像素，并替换非透明像素为渐变色
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (data[i + 3] !== 0) {
        // 如果像素不是完全透明
        // 计算当前像素在渐变上的相对位置
        const ratio = x / canvas.width;
        // 使用渐变颜色填充当前像素
        const gradientColor = getGradientColor(gradient, ratio);
        data[i] = gradientColor[0]; // R
        data[i + 1] = gradientColor[1]; // G
        data[i + 2] = gradientColor[2]; // B
        // Alpha 保持不变
      }
    }
  }

  // 将更改后的像素数据放回 Canvas
  ctx.putImageData(imageData, 0, 0);
}

function getGradientColor(gradient, ratio) {
  // 创建一个临时 Canvas 来绘制渐变并获取渐变颜色
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCanvas.width = 1;
  tempCanvas.height = 1;
  tempCtx.fillStyle = gradient;
  tempCtx.fillRect(0, 0, 1, 1);
  const gradientData = tempCtx.getImageData(0, 0, 1, 1).data;

  return [gradientData[0], gradientData[1], gradientData[2]];
}

function GradientCreator(ctx, color1, color2) {
  const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

function ChangeColor() {
  const [currentColor, setCurrentColor] = useState("#ff0000");
  const [color1, setColor1] = useState("#ff0000");
  const [color2, setColor2] = useState("#0000ff");
  const [applyGradient, setApplyGradient] = useState(false);
  const [applyClicked, setApplyClicked] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const canvasRef = useRef(null);

  const loadImageAndApplyColor = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Canvas 元素不存在");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("无法获取 Canvas 上下文");
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous"; // 添加跨域支持

    image.onload = () => {
      setImageLoaded(true);
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);

      let colorOrGradient;
      if (applyGradient) {
        colorOrGradient = GradientCreator(ctx, color1, color2);
      } else {
        colorOrGradient = hexToRgb(currentColor);
      }

      if (colorOrGradient) {
        changeImageColor(ctx, canvas, colorOrGradient);
      } else {
        message.error("颜色格式无效");
      }
    };

    image.onerror = (e) => {
      console.error("图像加载失败", e);
      message.error("水印图片加载失败，请检查图片路径是否正确");
    };

    // 尝试使用绝对路径加载图片
    image.src = "/logo.png";

    // 如果 5 秒后图片仍未加载，尝试使用相对路径
    const timer = setTimeout(() => {
      if (!imageLoaded) {
        image.src = "./logo.png";
      }
    }, 5000);

    return () => clearTimeout(timer);
  };

  useEffect(() => {
    loadImageAndApplyColor();
  }, [color1, color2, applyGradient, currentColor, applyClicked]);

  const hexToRgb = (hex) => {
    const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return rgb
      ? [parseInt(rgb[1], 16), parseInt(rgb[2], 16), parseInt(rgb[3], 16)]
      : null;
  };

  const handleApplyColor = () => {
    setApplyClicked(!applyClicked);
  };

  return (
    <div>
      <div>
        <p>请输入单色：</p>
        <Input
          value={currentColor}
          type="color"
          onChange={(e) => setCurrentColor(e.target.value)}
          placeholder="请输入色值，如#ff0000"
        />
        <span
          style={{
            display: "inline-block",
            width: "20px",
            height: "20px",
            backgroundColor: currentColor,
            marginLeft: "10px",
            border: "1px solid #ddd",
          }}
        />
        <h2>渐变色</h2>
        <p>请输入渐变的第一色：</p>
        <Input
          type="color"
          value={color1}
          onChange={(e) => setColor1(e.target.value)}
          placeholder="请输入色值，如#ff0000"
        />
        <span
          style={{
            display: "inline-block",
            width: "20px",
            height: "20px",
            backgroundColor: color1,
            marginLeft: "10px",
            border: "1px solid #ddd",
          }}
        />
        <p>请输入渐变的第二色：</p>
        <Input
          type="color"
          value={color2}
          onChange={(e) => setColor2(e.target.value)}
          placeholder="请输入色值，如#0000ff"
        />
        <span
          style={{
            display: "inline-block",
            width: "20px",
            height: "20px",
            backgroundColor: color2,
            marginLeft: "10px",
            border: "1px solid #ddd",
          }}
        />
        <p>
          <label>
            <input
              type="checkbox"
              checked={applyGradient}
              onChange={(e) => setApplyGradient(e.target.checked)}
            />
            应用渐变
          </label>
        </p>
        <Button type="primary" onClick={handleApplyColor}>
          应用颜色
        </Button>
      </div>
      <canvas ref={canvasRef} style={{ background: "#000", width: "40vw", marginTop: "20px" }} />
    </div>
  );
}

export default ChangeColor;
