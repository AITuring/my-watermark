import React, { useState, useRef } from "react";

type ImageInfo = {
    file: File;
    src: string;
    width: number;
    height: number;
    aspectRatio?: number; // 新增属性，存储宽高比
};

const PhotoCollage: React.FC = () => {
    const [images, setImages] = useState<ImageInfo[]>([]);
    const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // 处理用户上传图片
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const fileArray = Array.from(files);

            Promise.all(
                fileArray.map((file) => {
                    return new Promise<ImageInfo>((resolve) => {
                        const img = new Image();
                        const src = URL.createObjectURL(file);
                        img.src = src;
                        img.onload = () => {
                            resolve({
                                file,
                                src,
                                width: img.width,
                                height: img.height,
                            });
                        };
                    });
                })
            ).then((newImages) => {
                setImages((prevImages) => [...prevImages, ...newImages]);
            });
        }
    };

    // 拼图算法
    const generatePuzzle = async () => {
        if (images.length === 0) {
            alert("请先上传图片");
            return;
        }

        const canvasWidth = 1000; // 固定 canvas 宽度
        const canvasHeight = canvasWidth / aspectRatio; // 根据目标长宽比计算 canvas 高度

        // 准备图片数据，计算每张图片的宽高比
        const imagesWithAspectRatio = images.map((img) => ({
            ...img,
            aspectRatio: img.width / img.height,
        }));

        const rows: { images: ImageInfo[]; rowHeight: number }[] = [];
        let currentRow: ImageInfo[] = [];
        let currentRowAspectRatioSum = 0;

        const maxRowHeight = 200; // 行最大高度，可以根据需要调整

        for (let i = 0; i < imagesWithAspectRatio.length; i++) {
            const img = imagesWithAspectRatio[i];
            currentRow.push(img);
            currentRowAspectRatioSum += img.aspectRatio;

            // 计算当前行的高度，使行内图片的总宽度等于 canvasWidth
            const rowHeight = canvasWidth / currentRowAspectRatioSum;

            // 如果当前行的高度小于等于最大行高，或者是最后一张图片，则结束当前行
            if (
                rowHeight <= maxRowHeight ||
                i === imagesWithAspectRatio.length - 1
            ) {
                rows.push({ images: currentRow, rowHeight });
                currentRow = [];
                currentRowAspectRatioSum = 0;
            }
        }

        // 计算所有行的总高度
        const totalRowHeight = rows.reduce(
            (sum, row) => sum + row.rowHeight,
            0
        );

        // 计算高度缩放比例，使总行高等于 canvasHeight
        const heightScale = canvasHeight / totalRowHeight;
        let yOffset = 0;

        // 创建 canvas
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext("2d");

            if (ctx) {
                const padding = 5; // 图片之间的间距
                for (let row of rows) {
                    const scaledRowHeight = row.rowHeight * heightScale;
                    let xOffset = 0;
                    const rowWidth = canvasWidth;
                    let totalAspectRatio = row.images.reduce((sum, img) => sum + img.aspectRatio, 0);
                    const availableWidth = rowWidth - (row.images.length - 1) * padding;

                    for (let i = 0; i < row.images.length; i++) {
                        const img = row.images[i];
                        // 计算图片宽度，保持原始宽高比
                        const imgWidth = (img.aspectRatio / totalAspectRatio) * availableWidth;
                        const imgHeight = imgWidth / img.aspectRatio;

                        // 计算垂直居中的 y 偏移
                        const yPadding = (scaledRowHeight - imgHeight) / 2;

                        // 加载图片
                        const image = new Image();
                        image.src = img.src;

                        // 等待图片加载完成后再绘制
                        await new Promise<void>((resolve) => {
                            image.onload = () => {
                                ctx.drawImage(
                                    image,
                                    xOffset,
                                    yOffset + yPadding,
                                    imgWidth,
                                    imgHeight
                                );
                                resolve();
                            };
                        });

                        xOffset += imgWidth + padding;
                    }

                    yOffset += scaledRowHeight;
                }
            }
        }
    };

    return (
        <div>
            <h1>拼图组件</h1>

            {/* 图片上传 */}
            <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
            />

            {/* 选择长宽比 */}
            <select
                onChange={(e) => setAspectRatio(parseFloat(e.target.value))}
            >
                <option value={(16 / 9).toString()}>16:9</option>
                <option value={(4 / 3).toString()}>4:3</option>
                <option value="1">1:1</option>
                <option value={(3 / 4).toString()}>3:4</option>
                <option value={(9 / 16).toString()}>9:16</option>
            </select>

            {/* 生成拼图按钮 */}
            <button onClick={generatePuzzle}>生成拼图</button>

            {/* 画布用于绘制结果 */}
            <canvas
                ref={canvasRef}
                style={{ border: "1px solid black", marginTop: "20px" }}
            />
        </div>
    );
};

export default PhotoCollage;
