import React, { useState, useRef, useEffect } from "react";
import { message, Spin, InputNumber, Switch, Tooltip } from "antd";
import { ImageUp, CircleHelp } from "lucide-react";
import { CustomButton } from "./components";
import { loadImageData,debounce, processImage } from "./utils";
import { ImageType } from "./types";
// import { SpeedInsights } from "@vercel/speed-insights/react"
import ImageUploader from "./ImageUploader";
import WatermarkEditor from "./WatermarkEditor";
import VerticalCarousel from "./VerticalCarousel";
// import EmojiBg from './EmojiBg';
import confetti from "canvas-confetti";
import "./watermark.css";

const Watermark: React.FC = () => {
    const [images, setImages] = useState<ImageType[]>([]);

    const editorHeight = window.innerHeight * 0.8;

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

    const dropzoneRef = useRef(null);

    const [loading, setLoading] = useState(false);
    // 图片处理进度
    const [imgProgress, setImgProgress] = useState<number>(0);
    // 第一步：上传图片
    const [imageUploaderVisible, setImageUploaderVisible] = useState(true);

    // 图片质量
    const [quality, setQuality] = useState<number>(0.9);
    // 水印背景模糊
    const [watermarkBlur, setWatermarkBlur] = useState<boolean>(true);

    useEffect(() => {
        if (images.length === 0) {
            setImageUploaderVisible(true)
        }
    }, [images])

    const handleImagesUpload = async (files: File[]) => {
        const uploadImages = await loadImageData(files);
        setImages(uploadImages);
        setCurrentImg(uploadImages[0]);
        setImageUploaderVisible(false);
        // loadImageData(files).then((images) => {
        //     setImages(images); // 现在这里更新状态
        //     setCurrentImg(images[0]);
        // });
        // loadImages(files);

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

    async function downloadImagesWithWatermarkBatch(
        files,
        watermarkImage,
        position,
        batchSize = 5
    ) {
        const downloadLink = document.createElement("a");
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);

        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const promises = batch.map((file) =>
                processImage(file, watermarkImage, position, watermarkBlur, quality)
            );
            const imageBlobs = await Promise.all(promises);

            imageBlobs.forEach(({ url, name }, index) => {
                const sliceName = name.split(".")[0];
                message.success(`图${i + index + 1}下载成功！`);
                const progress = ((i + index + 1) / files.length) * 100;
                setImgProgress(Math.min(progress, 100));
                downloadLink.href = url;
                downloadLink.download = `${sliceName}-mark.jpeg`;
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
                watermarkPosition
            );
        };

        watermarkImage.onerror = () => {
            message.error("Failed to load the watermark image.");
            setLoading(false);
        };
        watermarkImage.src = watermarkUrl;
    };


    // 使用 debounce 包裹你的事件处理函数
    const handleApplyWatermarkDebounced = debounce(handleApplyWatermark, 500);

    return (
        <div className="watermarkApp">
            {/* {imageUploaderVisible ? <div className="watermarkBg"></div> : <></>} */}
            <div>
                {imageUploaderVisible ? (
                    <div className="upbutton">
                        <ImageUploader
                            ref={dropzoneRef}
                            onUpload={handleImagesUpload}
                            fileType="背景"
                            // className="w-40 h-20 cursor-pointer bg-blue-500 flex justify-center items-center font-sans font-bold text-white rounded focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <CustomButton
                                variant="contained"
                                color="primary"
                                size="xlarge"
                                icon="ImageUp"
                            >
                                上传背景图片
                            </CustomButton>
                        </ImageUploader>
                    </div>
                ) : (
                    <div className="imgWatermark">
                        <div className="flex p-4 justify-between">
                            {images.length > 0 && (
                                <div className="imgGallery">
                                    <VerticalCarousel
                                        images={images}
                                        setImages={setImages}
                                        setImageUploaderVisible={
                                            setImageUploaderVisible
                                        }
                                        setCurrentImg={setCurrentImg}
                                        height={editorHeight}
                                    />
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
                        <div className="flex justify-around items-center backdrop-blur-lg shadow-inner">
                            <ImageUploader
                                onUpload={handleWatermarkUpload}
                                fileType="水印"
                                className="w-20 cursor-pointer bg-blue-500 "
                            >
                                <img
                                    src={watermarkUrl} // 当 watermarkUrl 不存在时，显示默认图片
                                    alt="watermark"
                                    // style={{
                                    //     height: "4vh",
                                    //     cursor: "pointer", // 将鼠标样式设置为指针，以指示图片是可点击的
                                    //     background: "#268af8", // 背景色为白色，以显示图片
                                    // }}

                                    onClick={() =>
                                        document
                                            .getElementById("watermarkUploader")
                                            .click()
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
                                <div className="my-2 flex items-center">
                                    水印背景模糊
                                    <Tooltip title="开启后水印周围有一层高斯模糊">
                                        <CircleHelp className="w-4 h-4 ml-2" />
                                    </Tooltip>
                                </div>
                                <Switch
                                    checkedChildren="开启"
                                    unCheckedChildren="关闭"
                                    checked={watermarkBlur}
                                    onChange={(checked) =>
                                        setWatermarkBlur(checked)
                                    }
                                />
                            </div>
                            <CustomButton
                                color="primary"
                                variant="contained"
                                onClick={handleApplyWatermarkDebounced}
                                className="applyWatermark"
                                disabled={loading}
                            >
                                {loading ? <Spin /> : "水印生成"}
                            </CustomButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Watermark;
