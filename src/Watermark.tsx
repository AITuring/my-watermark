import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { message, Spin, InputNumber, FloatButton, Switch, Tooltip } from "antd";
import {
  CloseCircleOutlined,
  AppstoreFilled,
  QuestionCircleFilled,
} from "@ant-design/icons";
// import { SpeedInsights } from "@vercel/speed-insights/react"
import ImageUploader from "./ImageUploader";
import WatermarkEditor from "./WatermarkEditor";
// import EmojiBg from './EmojiBg';
import * as StackBlur from "stackblur-canvas";
import ColorThief from "colorthief";
import confetti from "canvas-confetti";
import "./watermark.css";

interface ImageType {
  id: string;
  file: File;
  width: number;
  height: number;
}

function uuid() {
  let idStr = Date.now().toString(36);
  idStr += Math.random().toString(36).substr(2);
  return idStr;
}

const Watermark: React.FC = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState<ImageType[]>([]);
  // 当前照片
  const [currentImg, setCurrentImg] = useState<ImageType | null>();
  const [watermarkUrl, setWatermarkUrl] = useState("/logo.png");
  // TODO支持定制每一个水印
  const [watermarkPosition, setWatermarkPosition] = useState({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  });
  // 背景图片是否模糊
  const [isBlurred, setIsBlurred] = useState(false);
  const dropzoneRef = useRef(null);

  const [loading, setLoading] = useState(false);
  // 图片处理进度
  const [imgProgress, setImgProgress] = useState<number>(0);
  // 第一步：上传图片
  const [imageUploaderVisible, setImageUploaderVisible] = useState(true);

  // 图片质量
  const [quality, setQuality] = useState<number>(0.9);

  // 是否添加模糊边框
  const [frame, setFrame] = useState(false);
  // 水印背景模糊
  const [watermarkBlur, setWatermarkBlur] = useState<boolean>(true);

  const handleMouseMove = (event) => {
    if (dropzoneRef.current) {
      const threshold = 100;
      const rect = dropzoneRef.current.getBoundingClientRect();
      const mouseX = event.clientX;
      const mouseY = event.clientY;
      const isNear =
        mouseX > rect.left - threshold &&
        mouseX < rect.right + threshold &&
        mouseY > rect.top - threshold &&
        mouseY < rect.bottom + threshold;
      setIsBlurred(isNear);
    }
  };

  const loadImages = (files) => {
    const promises = files.map((file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
          const img = new Image();
          img.onload = function () {
            resolve({
              id: uuid(),
              width: img.width,
              height: img.height,
              file: file,
            });
          };
          img.onerror = reject;
          img.src = e.target.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises)
      .then((images) => {
        setImages(images); // 现在这里更新状态
        setCurrentImg(images[0]);
      })
      .catch((error) => {
        console.error("Error loading images: ", error);
      });
  };

  const handleImagesUpload = (files: File[]) => {
    loadImages(files);
    setImageUploaderVisible(false);

    if (files[0]) {
      // Update the original image dimensions when a new image is uploaded
      const image = new Image();
      image.onload = () => {
        setWatermarkPosition((prevPos) => ({
          ...prevPos,
        }));
      };
      image.src = URL.createObjectURL(files[0]);
    }
  };

  const handleWatermarkUpload = (files: File[]) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      setWatermarkUrl(event.target!.result as string);
    };
    reader.readAsDataURL(files[0]);
  };

  const handleWatermarkTransform = (position: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
  }) => {
    setWatermarkPosition(position);
  };

  // 计算水印位置，简单一点，别想太多
  function calculateWatermarkPosition(
    watermarkImage,
    imageWidth,
    imageHeight,
    position,
  ) {
    // scaleX和scaleY是相等的，用随便一个就行
    const scale = position.scaleX;
    const watermarkWidth = watermarkImage.width * scale;
    const watermarkHeight = watermarkImage.height * scale;

    // 保持水印的原始宽高比
    // const aspectRatio = watermarkImage.width / watermarkImage.height;
    // const watermarkHeight = watermarkWidth / aspectRatio;

    // 根据水印的百分比位置计算水印的中心坐标，坐标原点在水印图片的左上角
    // 请注意，我们需要将百分比位置转换为坐标，并且要考虑到水印尺寸
    // const watermarkCenterX = position.x * imageWidth;
    // const watermarkCenterY = position.y * imageHeight;

    // 水印的左上角坐标
    let watermarkX = position.x * imageWidth;
    let watermarkY = position.y * imageHeight;

    // 边缘检测
    // 检查水印是否超出图片的左边界
    if (watermarkX < 0) {
      watermarkX = 4;
    }
    // 检查水印是否超出图片的右边界
    if (watermarkX + watermarkWidth > imageWidth) {
      watermarkX = imageWidth.width - watermarkWidth - 4;
    }
    // 检查水印是否超出图片的顶边界
    if (watermarkY < 0) {
      watermarkY = 4;
    }
    // 检查水印是否超出图片的底边界
    if (watermarkY + watermarkHeight > imageHeight) {
      watermarkY = imageHeight - watermarkHeight - 4;
    }

    return {
      x: watermarkX,
      y: watermarkY,
      width: watermarkWidth,
      height: watermarkHeight,
    };
  }

  async function processImage(file, watermarkImage, position) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const image = new Image();
        image.onload = async () => {
          // 创建一个canvas元素
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = image.width;
          canvas.height = image.height;

          // 绘制原始图片
          ctx.drawImage(image, 0, 0, image.width, image.height);

          // 应用水印位置和变换
          const watermarkPosition = calculateWatermarkPosition(
            watermarkImage,
            image.width,
            image.height,
            position,
          );
          const watermarkX = watermarkPosition.x;
          const watermarkY = watermarkPosition.y;
          const watermarkWidth = watermarkPosition.width;
          const watermarkHeight = watermarkPosition.height;

          if (watermarkBlur) {
            // 创建一个临时canvas来应用模糊效果
            const tempCanvas = document.createElement("canvas");
            const tempCtx = tempCanvas.getContext("2d");
            tempCanvas.width = image.width;
            tempCanvas.height = image.height;
            tempCtx.drawImage(image, 0, 0, image.width, image.height);

            // 应用全图高斯模糊
            StackBlur.canvasRGBA(
              tempCanvas,
              0,
              0,
              image.width,
              image.height,
              20,
            );
            // 创建径向渐变
            const centerX = watermarkX + watermarkWidth / 2;
            const centerY = watermarkY + watermarkHeight / 2;
            const innerRadius = 0; // 从中心开始渐变
            const outerRadius = Math.max(watermarkWidth, watermarkHeight); // 渐变扩散的半径
            const gradient = ctx.createRadialGradient(
              centerX,
              centerY,
              innerRadius,
              centerX,
              centerY,
              outerRadius,
            );
            gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
            gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

            // 应用径向渐变作为蒙版
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = gradient;
            ctx.fillRect(
              watermarkX,
              watermarkY,
              watermarkWidth,
              watermarkHeight,
            );

            // 绘制模糊的背景图片
            ctx.globalCompositeOperation = "destination-over";
            ctx.drawImage(tempCanvas, 0, 0);
          }

          // 绘制清晰的水印
          ctx.globalCompositeOperation = "source-over";
          ctx.drawImage(
            watermarkImage,
            watermarkX,
            watermarkY,
            watermarkWidth,
            watermarkHeight,
          );

          // 导出最终的图片
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                resolve({ url, name: file.name });
              } else {
                reject(new Error("Canvas to Blob failed"));
              }
            },
            "image/jpeg",
            quality,
          );
        };
        image.onerror = reject;
        image.src = e.target.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function processBlurImage(file, watermarkImage, position) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const image = new Image();
        image.onload = () => {
          const colorThief = new ColorThief();
          const dominantColor = colorThief.getColor(image);
          const blurMargin = Math.floor(
            Math.min(image.width, image.height) * 0.08,
          );
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = image.width + blurMargin * 2;
          canvas.height = image.height + blurMargin * 2;

          // 使用提取的颜色填充画布
          ctx.fillStyle = `rgb(${dominantColor.join(",")})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // 将原图先绘制在填充的背景上
          ctx.globalCompositeOperation = "source-over";
          ctx.drawImage(image, blurMargin, blurMargin);
          // 添加水印
          if (watermarkImage) {
            const watermarkHeight = blurMargin - 20;
            const watermarkWidth =
              (watermarkImage.width / watermarkImage.height) * watermarkHeight;
            // 水平居中水印
            const watermarkX = (canvas.width - watermarkWidth) / 2;
            // 置于底部边框内，水印的底部位于原始图片的底部
            const watermarkY = canvas.height - watermarkHeight - 10;
            ctx.drawImage(
              watermarkImage,
              watermarkX,
              watermarkY,
              watermarkWidth,
              watermarkHeight,
            );
          }

          // 导出处理后的图片
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                resolve({ url, name: file.name });
              } else {
                reject(new Error("Canvas to Blob failed"));
              }
            },
            "image/jpeg",
            quality,
          );
        };
        image.crossOrigin = "Anonymous";
        image.src = event.target.result as string;
      };
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsDataURL(file);
    });
  }

  async function downloadImagesWithWatermarkBatch(
    files,
    watermarkImage,
    position,
    batchSize = 5,
  ) {
    const downloadLink = document.createElement("a");
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const promises = batch.map((file) => {
        if (frame) {
          return processBlurImage(file, watermarkImage, position);
        } else {
          return processImage(file, watermarkImage, position);
        }
      });
      const imageBlobs = await Promise.all(promises);

      imageBlobs.forEach(({ url, name }, index) => {
        message.success(`图${i + index + 1}下载成功！`);
        const progress = ((i + index + 1) / files.length) * 100;
        setImgProgress(Math.min(progress, 100));
        downloadLink.href = url;
        downloadLink.download = `watermarked-${i + index + 1}.jpeg`;
        downloadLink.click();
        URL.revokeObjectURL(url);
      });

      // 等待一会儿，让浏览器有时间回收内存
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    document.body.removeChild(downloadLink);
    setLoading(false);
    confetti({
      particleCount: 600,
      spread: 360,
    });
    setImgProgress(0);
  }

  const handleApplyWatermark = () => {
    if (!watermarkUrl) {
      message.error("请上传水印图片！");
      return;
    }
    setLoading(true);
    const watermarkImage = new Image();
    watermarkImage.onload = () => {
      message.success("水印下载开始！");
      const imageFiles = images.map((image) => image.file);
      downloadImagesWithWatermarkBatch(
        imageFiles,
        watermarkImage,
        watermarkPosition,
      );
    };

    watermarkImage.onerror = () => {
      message.error("Failed to load the watermark image.");
      setLoading(false);
    };
    watermarkImage.src = watermarkUrl;
  };

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 使用 debounce 包裹你的事件处理函数
  const handleApplyWatermarkDebounced = debounce(handleApplyWatermark, 500);

  return (
    <div className="watermarkApp" onMouseMove={handleMouseMove}>
      {/* <SpeedInsights /> */}
      {/* <EmojiBg direction="vertical" emojiSize={52} /> */}
      {imageUploaderVisible ? (
        <>
          <img
            src="https://bing.img.run/rand_uhd.php"
            alt="bg"
            className="watermarkBg"
          />
          <div className={`bgOverlay ${isBlurred ? "bgBlur" : ""}`}></div>
        </>
      ) : (
        <></>
      )}
      <div>
        {imageUploaderVisible ? (
          <div className="upbutton">
            <ImageUploader
              ref={dropzoneRef}
              onUpload={handleImagesUpload}
              fileType="背景"
            />
          </div>
        ) : (
          <div className="imgWatermark">
            <div className="imageParts">
              {images.length > 0 && (
                <div className="imgGallery">
                  {images.map((image, index) => (
                    <div
                      key={index}
                      onClick={() => setCurrentImg(image)}
                      className={
                        currentImg.id === image.id ? "selectedImg" : "imgCover"
                      }
                    >
                      <img
                        src={URL.createObjectURL(image?.file)}
                        style={{
                          width: `${(image.width / image.height) * 20}vh`,
                          height: "20vh",
                        }}
                        alt="bg"
                        className="bg-img"
                      />
                      <CloseCircleOutlined
                        className="deleteButton"
                        onClick={(e) => {
                          if (images.length === 1) {
                            // 只有一张图片，直接恢复上传按钮
                            setImages([]);
                            setImageUploaderVisible(true);
                          } else {
                            e.stopPropagation(); // 阻止事件冒泡到图片的点击事件
                            const newImages = images.filter(
                              (_, imgIndex) => imgIndex !== index,
                            );
                            setImages(newImages);
                            if (currentImg && currentImg.id === image.id) {
                              setCurrentImg(newImages[0] || null); // 如果删除的是当前选中的图片，则更新当前图片为新数组的第一个，或者如果没有图片则设为 null
                            }
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {watermarkUrl && currentImg && (
                <WatermarkEditor
                  watermarkUrl={watermarkUrl}
                  backgroundImageFile={currentImg.file}
                  onTransform={handleWatermarkTransform}
                />
              )}
            </div>
            <div className="operateButtons">
              <ImageUploader onUpload={handleWatermarkUpload} fileType="水印">
                <img
                  src={watermarkUrl} // 当 watermarkUrl 不存在时，显示默认图片
                  alt="watermark"
                  style={{
                    width: "12vh",
                    cursor: "pointer", // 将鼠标样式设置为指针，以指示图片是可点击的
                  }}
                  onClick={() =>
                    document.getElementById("watermarkUploader").click()
                  } // 模拟点击 input
                />
              </ImageUploader>
              <div className="operation">
                <div className="buttonText">图片质量</div>
                <InputNumber
                  placeholder="图片质量"
                  min={0.5}
                  max={1}
                  step={0.01}
                  value={quality}
                  onChange={(e: number) => setQuality(e)}
                />
              </div>
              <div className="operation">
                <div className="buttonText">
                  边框水印
                  <Tooltip
                    title="开启边框水印后无须调整水印位置，边框水印默认添加在图片中下方"
                    style={{ marginLeft: "6px" }}
                  >
                    <QuestionCircleFilled />
                  </Tooltip>
                </div>
                <Switch
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                  onChange={(checked) => setFrame(checked)}
                />
              </div>
              <div className="operation">
                <div className="buttonText">
                  水印背景模糊
                  <Tooltip
                    title="开启后水印周围有一层高斯模糊"
                    style={{ marginLeft: "6px" }}
                  >
                    <QuestionCircleFilled />
                  </Tooltip>
                </div>
                <Switch
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                  checked={watermarkBlur}
                  onChange={(checked) => setWatermarkBlur(checked)}
                />
              </div>
              <button
                onClick={handleApplyWatermarkDebounced}
                className="applyWatermark"
                disabled={loading}
              >
                {loading ? <Spin /> : "水印生成"}
              </button>
            </div>
          </div>
        )}
      </div>
      <FloatButton
        icon={<AppstoreFilled />}
        tooltip={<div>大图拼接</div>}
        onClick={() => navigate("/puzzle")}
      />
    </div>
  );
};

export default Watermark;
