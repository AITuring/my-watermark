// 导入 OpenCV.js
import cv from "opencv.js";

// 当 OpenCV 加载完成时的标志
let cvReady = false;
let cv: any = null;

// 初始化 OpenCV
async function initOpenCV() {
    return new Promise((resolve) => {
        // 如果已经加载完成，直接返回
        if (cvReady) {
            resolve(true);
            return;
        }

        // 加载 OpenCV.js
        self.importScripts("https://docs.opencv.org/4.5.5/opencv.js");

        // 监听 OpenCV 加载完成事件
        self.addEventListener("opencv_loaded", () => {
            cv = (self as any).cv;
            cvReady = true;
            resolve(true);
        });
    });
}

// 使用 OpenCV 的特征点匹配算法
async function findFeatureMatch(
    img1: any,
    img2: any
): Promise<{ homography: any; matchesCount: number }> {
    // 转换为灰度图像
    const gray1 = new cv.Mat();
    const gray2 = new cv.Mat();
    cv.cvtColor(img1, gray1, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(img2, gray2, cv.COLOR_RGBA2GRAY);

    // 使用 ORB 特征检测器
    const orb = new cv.ORB(500); // 最多检测500个特征点

    // 检测关键点并计算描述符
    const keypoints1 = new cv.KeyPointVector();
    const keypoints2 = new cv.KeyPointVector();
    const descriptors1 = new cv.Mat();
    const descriptors2 = new cv.Mat();

    orb.detectAndCompute(gray1, new cv.Mat(), keypoints1, descriptors1);
    orb.detectAndCompute(gray2, new cv.Mat(), keypoints2, descriptors2);

    // 使用暴力匹配器进行特征匹配
    const matcher = new cv.BFMatcher(cv.NORM_HAMMING);
    const matches = new cv.DMatchVector();
    matcher.match(descriptors1, descriptors2, matches);

    // 筛选好的匹配点
    const goodMatches = new cv.DMatchVector();
    const maxDistance = 50; // 设置距离阈值

    for (let i = 0; i < matches.size(); i++) {
        const match = matches.get(i);
        if (match.distance < maxDistance) {
            goodMatches.push_back(match);
        }
    }

    // 如果匹配点太少，返回空结果
    if (goodMatches.size() < 4) {
        gray1.delete();
        gray2.delete();
        descriptors1.delete();
        descriptors2.delete();
        keypoints1.delete();
        keypoints2.delete();
        matches.delete();
        goodMatches.delete();
        orb.delete();
        matcher.delete();

        return { homography: null, matchesCount: 0 };
    }

    // 提取匹配点的坐标
    const srcPoints = [];
    const dstPoints = [];

    for (let i = 0; i < goodMatches.size(); i++) {
        const match = goodMatches.get(i);
        const kp1 = keypoints1.get(match.queryIdx);
        const kp2 = keypoints2.get(match.trainIdx);
        srcPoints.push(new cv.Point(kp1.pt.x, kp1.pt.y));
        dstPoints.push(new cv.Point(kp2.pt.x, kp2.pt.y));
    }

    // 将点转换为 Mat 格式
    const srcPointsMat = cv.matFromArray(
        srcPoints.length,
        1,
        cv.CV_32FC2,
        srcPoints.flatMap((p) => [p.x, p.y])
    );
    const dstPointsMat = cv.matFromArray(
        dstPoints.length,
        1,
        cv.CV_32FC2,
        dstPoints.flatMap((p) => [p.x, p.y])
    );

    // 计算单应性矩阵
    const homography = cv.findHomography(srcPointsMat, dstPointsMat, cv.RANSAC);

    // 释放内存
    gray1.delete();
    gray2.delete();
    descriptors1.delete();
    descriptors2.delete();
    keypoints1.delete();
    keypoints2.delete();
    matches.delete();
    goodMatches.delete();
    srcPointsMat.delete();
    dstPointsMat.delete();
    orb.delete();
    matcher.delete();

    return { homography, matchesCount: goodMatches.size() };
}

// 处理来自主线程的消息
self.onmessage = async function (e) {
    const { type, data } = e.data;

    if (type === "find_matches") {
        try {
            self.postMessage({
                type: "progress",
                data: { step: "初始化 OpenCV", percent: 5 },
            });

            try {
                await initOpenCV();
            } catch (error) {
                console.error("Failed to initialize OpenCV:", error);
                self.postMessage({
                    type: "error",
                    data: "OpenCV 初始化失败，请刷新页面重试",
                });
                return;
            }

            self.postMessage({
                type: "progress",
                data: { step: "OpenCV 初始化完成", percent: 5 },
            });

            const { imagesData, imagesSizes } = data;

            // 创建 OpenCV 图像
            const cvImages = [];
            for (let i = 0; i < imagesData.length; i++) {
                self.postMessage({
                    type: "progress",
                    data: {
                        step: "准备图像",
                        percent: 5 + (i * 5) / imagesData.length,
                        detail: `处理图像 ${i + 1}/${imagesData.length}`,
                    },
                });

                const img = cv.matFromImageData(imagesData[i]);
                cvImages.push(img);
            }

            // 创建一个图像位置映射
            const positions = imagesSizes.map((size: any, index: number) => ({
                index,
                width: size.width,
                height: size.height,
                x: 0,
                y: 0,
                transform: new cv.Mat(), // 变换矩阵
                placed: false,
            }));

            // 先放置第一张图像
            positions[0].placed = true;
            positions[0].transform = cv.Mat.eye(3, 3, cv.CV_64F); // 单位矩阵

            self.postMessage({
                type: "progress",
                data: { step: "计算特征匹配", percent: 10 },
            });

            // 计算所有图像对之间的特征匹配
            const matches = [];

            for (let i = 0; i < cvImages.length; i++) {
                for (let j = 0; j < cvImages.length; j++) {
                    if (i !== j) {
                        self.postMessage({
                            type: "progress",
                            data: {
                                step: "计算图像匹配",
                                percent:
                                    10 +
                                    ((i * cvImages.length + j) * 60) /
                                        (cvImages.length * cvImages.length),
                                detail: `比较图像 ${i + 1} 和 ${j + 1}`,
                            },
                        });

                        const { homography, matchesCount } =
                            await findFeatureMatch(cvImages[i], cvImages[j]);

                        if (homography && matchesCount > 10) {
                            matches.push({
                                from: i,
                                to: j,
                                homography,
                                matchesCount,
                            });
                        }
                    }
                }
            }

            // 按匹配点数量排序
            matches.sort((a, b) => b.matchesCount - a.matchesCount);

            self.postMessage({
                type: "progress",
                data: { step: "构建拼接图", percent: 70 },
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

                // 计算变换矩阵
                const combinedTransform = new cv.Mat();
                cv.matMul(
                    fromPos.transform,
                    bestMatch.homography,
                    combinedTransform
                );
                toPos.transform = combinedTransform;

                // 计算变换后的四个角点位置
                const corners = [
                    { x: 0, y: 0 },
                    { x: imagesSizes[toPos.index].width, y: 0 },
                    {
                        x: imagesSizes[toPos.index].width,
                        y: imagesSizes[toPos.index].height,
                    },
                    { x: 0, y: imagesSizes[toPos.index].height },
                ];

                // 应用变换矩阵到角点
                const transformedCorners = corners.map((corner) => {
                    const pt = new cv.Mat(3, 1, cv.CV_64F);
                    pt.data64F[0] = corner.x;
                    pt.data64F[1] = corner.y;
                    pt.data64F[2] = 1;

                    const transformedPt = new cv.Mat();
                    cv.matMul(toPos.transform, pt, transformedPt);

                    const x =
                        transformedPt.data64F[0] / transformedPt.data64F[2];
                    const y =
                        transformedPt.data64F[1] / transformedPt.data64F[2];

                    pt.delete();
                    transformedPt.delete();

                    return { x, y };
                });

                // 计算变换后图像的边界框
                let minX = Infinity,
                    minY = Infinity,
                    maxX = -Infinity,
                    maxY = -Infinity;

                for (const corner of transformedCorners) {
                    minX = Math.min(minX, corner.x);
                    minY = Math.min(minY, corner.y);
                    maxX = Math.max(maxX, corner.x);
                    maxY = Math.max(maxY, corner.y);
                }

                toPos.x = minX;
                toPos.y = minY;
                toPos.width = maxX - minX;
                toPos.height = maxY - minY;
                toPos.placed = true;

                // 更新进度
                const placedCount = positions.filter(
                    (p: any) => p.placed
                ).length;
                self.postMessage({
                    type: "progress",
                    data: {
                        step: "放置图像",
                        percent: 70 + (placedCount * 20) / cvImages.length,
                        detail: `放置图像 ${bestMatch.to + 1}, 匹配点: ${
                            bestMatch.matchesCount
                        }`,
                    },
                });
            }

            // 计算画布大小
            let minX = 0,
                minY = 0,
                maxX = 0,
                maxY = 0;

            for (const pos of positions) {
                if (pos.placed) {
                    minX = Math.min(minX, pos.x);
                    minY = Math.min(minY, pos.y);
                    maxX = Math.max(maxX, pos.x + pos.width);
                    maxY = Math.max(maxY, pos.y + pos.height);
                }
            }

            // 返回位置信息和变换矩阵，让主线程绘制最终图像
            self.postMessage({
                type: "result",
                data: {
                    positions: positions.map((pos) => ({
                        index: pos.index,
                        x: pos.x,
                        y: pos.y,
                        width: pos.width,
                        height: pos.height,
                        transform: pos.transform
                            ? Array.from(pos.transform.data64F)
                            : null,
                        placed: pos.placed,
                    })),
                    canvasInfo: {
                        width: maxX - minX,
                        height: maxY - minY,
                        offsetX: minX,
                        offsetY: minY,
                    },
                },
            });

            // 释放 OpenCV 资源
            for (const img of cvImages) {
                img.delete();
            }

            for (const pos of positions) {
                if (pos.transform) pos.transform.delete();
            }

            for (const match of matches) {
                if (match.homography) match.homography.delete();
            }
        } catch (error: any) {
            self.postMessage({ type: "error", data: error.message });
        }
    }
};
