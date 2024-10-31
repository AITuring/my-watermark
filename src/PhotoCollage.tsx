import React, { useState, useRef, useEffect } from "react";

type ImageInfo = {
    file: File;
    src: string;
    width: number;
    height: number;
    aspectRatio?: number; // 新增属性，存储宽高比
};

type PhotoCollageProps = {
    gap?: number; // 外部传入的间距参数
};

const PhotoCollage: React.FC<PhotoCollageProps> = ({ gap = 2 }) => {
    const [images, setImages] = useState<ImageInfo[]>([]);
    const [aspectRatio, setAspectRatio] = useState<number>(3 / 4);
    const [canvasWidth, setCanvasWidth] = useState<number>(
        window.innerWidth * 0.9
    ); // 设置为屏幕宽度的90%
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const handleResize = () => {
            setCanvasWidth(window.innerWidth * 0.9);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        if (images.length > 0 && canvasRef.current) {
            generatePuzzle();
        }
    }, [images, gap]); // 增加gap为依赖

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
    const generatePuzzleold = async () => {
        if (images.length === 0) {
            alert("请先上传图片");
            return;
        }

        const canvasHeight = canvasWidth / aspectRatio; // 根据目标长宽比计算 canvas 高度
        const imagesWithAspectRatio = images.map((img) => ({
            ...img,
            aspectRatio: img.width / img.height,
        }));

        const rows: { images: ImageInfo[]; rowHeight: number }[] = [];
        let currentRow: ImageInfo[] = [];
        let currentRowAspectRatioSum = 0;
        const targetRowHeight = canvasHeight / Math.ceil(images.length / 3); // 估算每行的目标高度

        // 修改分行逻辑
        for (let i = 0; i < imagesWithAspectRatio.length; i++) {
            const img = imagesWithAspectRatio[i];
            currentRow.push(img);
            currentRowAspectRatioSum += img.aspectRatio;

            // 当前行宽度会超过画布宽度，或是最后一张图片时，结束当前行
            const rowWidth = targetRowHeight * currentRowAspectRatioSum;
            if (
                rowWidth > canvasWidth ||
                i === imagesWithAspectRatio.length - 1
            ) {
                // 计算实际行高，使图片正好填满行宽
                const actualRowHeight = canvasWidth / currentRowAspectRatioSum;
                rows.push({
                    images: currentRow,
                    rowHeight: actualRowHeight,
                });
                currentRow = [];
                currentRowAspectRatioSum = 0;
            }
        }

        let yOffset = 0;
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext("2d");

            if (ctx) {
                for (const row of rows) {
                    const rowHeight = row.rowHeight;
                    let xOffset = 0;
                    const availableWidth =
                        canvasWidth - (row.images.length - 1) * gap;
                    const totalAspectRatio = row.images.reduce(
                        (sum, img) => sum + img.aspectRatio,
                        0
                    );

                    for (let i = 0; i < row.images.length; i++) {
                        const img = row.images[i];
                        const imgWidth =
                            (img.aspectRatio / totalAspectRatio) *
                            availableWidth;
                        const imgHeight = rowHeight;

                        const image = new Image();
                        image.src = img.src;
                        await new Promise<void>((resolve) => {
                            image.onload = () => {
                                ctx.drawImage(
                                    image,
                                    xOffset,
                                    yOffset,
                                    imgWidth,
                                    imgHeight
                                );
                                resolve();
                            };
                        });

                        xOffset += imgWidth + gap;
                    }

                    yOffset += rowHeight + gap; // 添加行间距
                }
            }
        }
    };

    const generatePuzzle = async () => {
        if (images.length === 0) {
            alert("请先上传图片");
            return;
        }

        const canvasHeight = canvasWidth / aspectRatio;
        const imagesWithAspectRatio = images.map((img) => ({
            ...img,
            aspectRatio: img.width / img.height,
        }));

        // 动态分配行
        const rows: { images: ImageInfo[]; rowHeight: number }[] = [];
        let currentRow: ImageInfo[] = [];
        let currentRowAspectRatioSum = 0;
        const targetRowHeight = canvasHeight / Math.ceil(images.length / 3);

        // 根据宽度动态分行
        for (let i = 0; i < imagesWithAspectRatio.length; i++) {
            const img = imagesWithAspectRatio[i];
            currentRow.push(img);
            currentRowAspectRatioSum += img.aspectRatio;

            // 当前行宽度会超过画布宽度，或是最后一张图片时，结束当前行
            const rowWidth = targetRowHeight * currentRowAspectRatioSum;
            if (rowWidth > canvasWidth || i === imagesWithAspectRatio.length - 1) {
                // 计算实际行高，使图片正好填满行宽
                const actualRowHeight = canvasWidth / currentRowAspectRatioSum;
                rows.push({
                    images: currentRow,
                    rowHeight: actualRowHeight,
                });
                currentRow = [];
                currentRowAspectRatioSum = 0;
            }
        }

        // 调整行高以适应画布高度
        const totalHeight = rows.reduce((sum, row) => sum + row.rowHeight, 0) + (rows.length - 1) * gap;
        const scale = canvasHeight / totalHeight;

        let yOffset = 0;
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext("2d");

            if (ctx) {
                for (const row of rows) {
                    const scaledRowHeight = row.rowHeight * scale;
                    let xOffset = 0;
                    const availableWidth = canvasWidth - (row.images.length - 1) * gap;
                    const totalAspectRatio = row.images.reduce(
                        (sum, img) => sum + img.aspectRatio,
                        0
                    );

                    for (let i = 0; i < row.images.length; i++) {
                        const img = row.images[i];
                        // 计算图片在行内的宽度
                        const imgWidth = (img.aspectRatio / totalAspectRatio) * availableWidth;
                        // 根据原始宽高比计算实际高度
                        const imgHeight = imgWidth / img.aspectRatio;

                        // 计算垂直居中的偏移量
                        const yPadding = (scaledRowHeight - imgHeight) / 2;

                        const image = new Image();
                        image.src = img.src;
                        await new Promise<void>((resolve) => {
                            image.onload = () => {
                                ctx.drawImage(
                                    image,
                                    xOffset,
                                    yOffset + yPadding, // 添加垂直居中偏移
                                    imgWidth,
                                    imgHeight // 使用计算出的实际高度
                                );
                                resolve();
                            };
                        });

                        xOffset += imgWidth + gap;
                    }

                    yOffset += scaledRowHeight + gap;
                }
            }
        }
    };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // 将canvas转换为图片URL
        const dataUrl = canvas.toDataURL('image/png');

        // 创建一个临时的a标签用于下载
        const link = document.createElement('a');
        link.download = `photo-collage-${Date.now()}.png`; // 使用时间戳确保文件名唯一
        link.href = dataUrl;

        // 触发下载
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleClear = () => {
        setImages([]); // 清空图片数组

        // 清空canvas
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    return (
        <div>
            <h1>拼图组件</h1>
            <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
            />
            图片长宽比：
            <select
                onChange={(e) => {
                    setAspectRatio(parseFloat(e.target.value));
                    generatePuzzle();
                }}
                value={aspectRatio}
            >
                <option value={(16 / 9).toString()}>16:9</option>
                <option value={(4 / 3).toString()}>4:3</option>
                <option value="1">1:1</option>
                <option value={(3 / 4).toString()}>3:4</option>
                <option value={(9 / 16).toString()}>9:16</option>
            </select>
            <button onClick={generatePuzzle}>生成拼图</button>

            <button
                onClick={handleDownload}
                style={{ marginLeft: '10px' }}
                disabled={images.length === 0} // 如果没有图片则禁用下载按钮
            >
                下载拼图
            </button>

            <button
                onClick={handleClear}
                style={{ marginLeft: '10px' }}
                disabled={images.length === 0}
            >
                清空图片
            </button>

            <canvas
                ref={canvasRef}
                style={{ border: "1px solid black", marginTop: "20px" }}
            />
        </div>
    );
};

export default PhotoCollage;
