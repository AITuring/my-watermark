// 添加一个新的函数用于找到最佳的缩放比例和位置
function find_best_match(
    image1Data: ImageData,
    image2Data: ImageData,
    image1Width: number,
    image1Height: number,
    image2Width: number,
    image2Height: number,
    scale: number,
    direction: string
): {
    scale: number;
    shift_x: number;
    shift_y: number;
    direction: string;
    error: number;
} {
    console.log("Finding best match...");
    let bestMatch = {
        scale,
        shift_x: 0,
        shift_y: 0,
        direction,
        error: Number.POSITIVE_INFINITY,
    };

    const scaledWidth = Math.floor(image2Width * scale);
    const scaledHeight = Math.floor(image2Height * scale);

    // 根据方向确定搜索范围
    let searchRangeX = 0;
    let searchRangeY = 0;

    if (direction === "right" || direction === "left") {
        searchRangeX = Math.floor(Math.min(image1Width, scaledWidth) * 0.4);
        searchRangeY = Math.floor(Math.min(image1Height, scaledHeight) * 0.2);
    } else {
        searchRangeX = Math.floor(Math.min(image1Width, scaledWidth) * 0.2);
        searchRangeY = Math.floor(Math.min(image1Height, scaledHeight) * 0.4);
    }

    // 确定重叠区域的大小和位置
    let overlapWidth = 0;
    let overlapHeight = 0;
    let startX1 = 0,
        startY1 = 0;
    let startX2 = 0,
        startY2 = 0;

    switch (direction) {
        case "right":
            overlapWidth = Math.floor(scaledWidth * 0.3);
            overlapHeight = Math.min(image1Height, scaledHeight);
            startX1 = image1Width - overlapWidth;
            startY1 = 0;
            startX2 = 0;
            startY2 = 0;
            break;
        case "bottom":
            overlapWidth = Math.min(image1Width, scaledWidth);
            overlapHeight = Math.floor(scaledHeight * 0.3);
            startX1 = 0;
            startY1 = image1Height - overlapHeight;
            startX2 = 0;
            startY2 = 0;
            break;
        case "left":
            overlapWidth = Math.floor(scaledWidth * 0.3);
            overlapHeight = Math.min(image1Height, scaledHeight);
            startX1 = 0;
            startY1 = 0;
            startX2 = scaledWidth - overlapWidth;
            startY2 = 0;
            break;
        case "top":
            overlapWidth = Math.min(image1Width, scaledWidth);
            overlapHeight = Math.floor(scaledHeight * 0.3);
            startX1 = 0;
            startY1 = 0;
            startX2 = 0;
            startY2 = scaledHeight - overlapHeight;
            break;
    }

    // 性能优化：增加采样步长
    const sampleStep = 4;

    // 在重叠区域内搜索最佳匹配
    for (let y = -searchRangeY; y <= searchRangeY; y += sampleStep) {
        for (let x = -searchRangeX; x <= searchRangeX; x += sampleStep) {
            let error = 0;
            let pixelCount = 0;

            for (let h = 0; h < overlapHeight; h += sampleStep) {
                for (let w = 0; w < overlapWidth; w += sampleStep) {
                    const x1 = startX1 + w + x;
                    const y1 = startY1 + h + y;
                    const x2 = startX2 + w;
                    const y2 = startY2 + h;

                    if (
                        x1 >= 0 &&
                        x1 < image1Width &&
                        y1 >= 0 &&
                        y1 < image1Height &&
                        x2 >= 0 &&
                        x2 < scaledWidth &&
                        y2 >= 0 &&
                        y2 < scaledHeight
                    ) {
                        const index1 = (y1 * image1Width + x1) * 4;
                        const index2 = (y2 * scaledWidth + x2) * 4;

                        for (let c = 0; c < 3; c++) {
                            error += Math.pow(
                                image1Data.data[index1 + c] -
                                    image2Data.data[index2 + c],
                                2
                            );
                        }
                        pixelCount++;
                    }
                }
            }

            if (pixelCount > 0) {
                error /= pixelCount;

                if (error < bestMatch.error) {
                    bestMatch = {
                        scale,
                        shift_x: x,
                        shift_y: y,
                        direction,
                        error,
                    };
                }
            }
        }
    }

    return bestMatch;
}

// 处理来自主线程的消息
self.onmessage = function (e) {
    const { type, data } = e.data;

    if (type === "find_matches") {
        const { imagesData, imagesSizes } = data;

        try {
            // 创建一个图像位置映射，记录每个图像的位置和缩放
            const positions = imagesSizes.map((size: any, index: number) => ({
                index,
                width: size.width,
                height: size.height,
                x: 0,
                y: 0,
                scale: 1,
                placed: false,
            }));

            // 先放置第一张图像
            positions[0].placed = true;

            self.postMessage({
                type: "progress",
                data: { step: "计算最佳匹配", percent: 10 },
            });

            // 计算所有图像对之间的最佳匹配
            const matches: any[] = [];
            const scales = [0.8, 0.9, 0.95, 1.0, 1.05, 1.1, 1.2];
            const directions = ["right", "bottom", "left", "top"];

            for (let i = 0; i < imagesData.length; i++) {
                for (let j = 0; j < imagesData.length; j++) {
                    if (i !== j) {
                        self.postMessage({
                            type: "progress",
                            data: {
                                step: "计算图像匹配",
                                percent:
                                    10 +
                                    ((i * imagesData.length + j) * 40) /
                                        (imagesData.length * imagesData.length),
                                detail: `比较图像 ${i + 1} 和 ${j + 1}`,
                            },
                        });

                        let bestMatch = {
                            scale: 1,
                            shift_x: 0,
                            shift_y: 0,
                            direction: "right",
                            error: Number.POSITIVE_INFINITY,
                        };

                        for (const scale of scales) {
                            for (const direction of directions) {
                                const match = find_best_match(
                                    imagesData[i],
                                    imagesData[j],
                                    imagesSizes[i].width,
                                    imagesSizes[i].height,
                                    imagesSizes[j].width,
                                    imagesSizes[j].height,
                                    scale,
                                    direction
                                );

                                if (match.error < bestMatch.error) {
                                    bestMatch = match;
                                }
                            }
                        }

                        matches.push({
                            from: i,
                            to: j,
                            ...bestMatch,
                        });
                    }
                }
            }

            // 按错误率排序匹配
            matches.sort((a, b) => a.error - b.error);

            self.postMessage({
                type: "progress",
                data: { step: "构建拼接图", percent: 50 },
            });

            // 贪心算法放置图像
            while (positions.some((p: any) => !p.placed)) {
                // 找到已放置图像到未放置图像的最佳匹配
                const bestMatch = matches.find(
                    (m: any) =>
                        positions[m.from].placed && !positions[m.to].placed
                );

                if (!bestMatch) break; // 无法找到更多匹配

                const fromPos = positions[bestMatch.from];
                const toPos = positions[bestMatch.to];

                // 根据方向和偏移计算新图像的位置
                toPos.scale = bestMatch.scale;

                switch (bestMatch.direction) {
                    case "right":
                        toPos.x =
                            fromPos.x +
                            imagesSizes[fromPos.index].width * fromPos.scale -
                            bestMatch.shift_x;
                        toPos.y = fromPos.y + bestMatch.shift_y;
                        break;
                    case "bottom":
                        toPos.x = fromPos.x + bestMatch.shift_x;
                        toPos.y =
                            fromPos.y +
                            imagesSizes[fromPos.index].height * fromPos.scale -
                            bestMatch.shift_y;
                        break;
                    case "left":
                        toPos.x =
                            fromPos.x -
                            imagesSizes[toPos.index].width * toPos.scale +
                            bestMatch.shift_x;
                        toPos.y = fromPos.y + bestMatch.shift_y;
                        break;
                    case "top":
                        toPos.x = fromPos.x + bestMatch.shift_x;
                        toPos.y =
                            fromPos.y -
                            imagesSizes[toPos.index].height * toPos.scale +
                            bestMatch.shift_y;
                        break;
                }

                toPos.placed = true;

                // 更新进度
                const placedCount = positions.filter(
                    (p: any) => p.placed
                ).length;
                self.postMessage({
                    type: "progress",
                    data: {
                        step: "放置图像",
                        percent: 50 + (placedCount * 30) / imagesData.length,
                        detail: `放置图像 ${bestMatch.to + 1}, 方向: ${
                            bestMatch.direction
                        }, 缩放: ${bestMatch.scale.toFixed(2)}`,
                    },
                });
            }

            // 计算画布大小
            let minX = 0,
                minY = 0,
                maxX = 0,
                maxY = 0;

            for (const pos of positions) {
                minX = Math.min(minX, pos.x);
                minY = Math.min(minY, pos.y);
                maxX = Math.max(
                    maxX,
                    pos.x + imagesSizes[pos.index].width * pos.scale
                );
                maxY = Math.max(
                    maxY,
                    pos.y + imagesSizes[pos.index].height * pos.scale
                );
            }

            // 返回位置信息，让主线程绘制最终图像
            self.postMessage({
                type: "result",
                data: {
                    positions,
                    canvasInfo: {
                        width: maxX - minX,
                        height: maxY - minY,
                        offsetX: minX,
                        offsetY: minY,
                    },
                },
            });
        } catch (error: any) {
            self.postMessage({ type: "error", data: error.message });
        }
    }
};
