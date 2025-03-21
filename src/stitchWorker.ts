// 删除导入语句
// import cv from "opencv.js";

// 当 OpenCV 加载完成时的标志
let cvReady = false;
let cv: any = null;

// 初始化 OpenCV
async function initOpenCV() {
    return new Promise((resolve, reject) => {
        // 如果已经加载完成，直接返回
        if (cvReady && cv) {
            resolve(true);
            return;
        }

        try {
            // 设置 Module 对象以捕获 OpenCV 初始化完成事件
            (self as any).Module = {
                onRuntimeInitialized: function () {
                    cv = (self as any).cv;
                    cvReady = true;
                    console.log("OpenCV 在 Worker 中初始化完成");
                    resolve(true);
                },
            };

            // 加载 OpenCV.js
            self.importScripts("https://docs.opencv.org/4.5.5/opencv.js");

            // 设置超时，防止无限等待
            setTimeout(() => {
                if (!cvReady) {
                    reject(new Error("OpenCV 加载超时"));
                }
            }, 30000); // 30秒超时
        } catch (error) {
            reject(error);
        }
    });
}

// 使用 OpenCV 的 Stitcher 模块进行图像拼接
async function stitchImages(images: any[]): Promise<any> {
    // 确保 OpenCV 已加载
    if (!cv) {
        throw new Error("OpenCV 未初始化");
    }

    try {
        console.log("开始拼接图像",cv.Stitcher, cv);
        // 创建 Stitcher 对象
        const stitcher = new cv.Stitcher();

        // 将图像转换为 OpenCV 格式的矩阵数组
        const matVector = new cv.MatVector();
        for (const img of images) {
            matVector.push_back(img);
        }

        // 创建输出矩阵
        const pano = new cv.Mat();

        // 执行拼接
        const status = stitcher.stitch(matVector, pano);

        // 检查拼接结果
        if (status !== cv.Stitcher_OK) {
            throw new Error(`拼接失败，错误代码: ${status}`);
        }

        // 释放资源
        matVector.delete();
        stitcher.delete();

        return pano;
    } catch (error) {
        console.error("拼接过程中出错:", error);
        throw error;
    }
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

                if (!cv) {
                    throw new Error("OpenCV 初始化失败");
                }

                self.postMessage({
                    type: "progress",
                    data: { step: "OpenCV 初始化完成", percent: 10 },
                });
            } catch (error: any) {
                console.error("OpenCV 初始化失败:", error);
                self.postMessage({
                    type: "error",
                    data: "OpenCV 初始化失败: " + (error.message || "未知错误"),
                });
                return;
            }

            const { imagesData, imagesSizes } = data;

            // 创建 OpenCV 图像
            const cvImages = [];
            for (let i = 0; i < imagesData.length; i++) {
                self.postMessage({
                    type: "progress",
                    data: {
                        step: "准备图像",
                        percent: 10 + (i * 20) / imagesData.length,
                        detail: `处理图像 ${i + 1}/${imagesData.length}`,
                    },
                });

                try {
                    const img = cv.matFromImageData(imagesData[i]);
                    cvImages.push(img);
                } catch (error: any) {
                    console.error(`处理图像 ${i + 1} 时出错:`, error);
                    self.postMessage({
                        type: "error",
                        data: `处理图像 ${i + 1} 失败: ${
                            error.message || "未知错误"
                        }`,
                    });

                    // 释放已创建的资源
                    for (const img of cvImages) {
                        img.delete();
                    }
                    return;
                }
            }

            self.postMessage({
                type: "progress",
                data: {
                    step: "执行图像拼接",
                    percent: 30,
                    detail: "使用 OpenCV Stitcher 进行拼接",
                },
            });

            try {
                // 使用 Stitcher 进行拼接
                const panorama = await stitchImages(cvImages);

                self.postMessage({
                    type: "progress",
                    data: {
                        step: "拼接完成",
                        percent: 80,
                        detail: "正在处理结果",
                    },
                });

                // 获取拼接结果的尺寸
                const width = panorama.cols;
                const height = panorama.rows;

                // 创建临时 Canvas 获取图像数据
                const canvas = new OffscreenCanvas(width, height);
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    throw new Error("无法创建 Canvas 上下文");
                }

                // 将 OpenCV Mat 转换为 ImageData
                cv.imshow(canvas, panorama);

                // 获取图像数据
                const imageData = ctx.getImageData(0, 0, width, height);

                // 发送结果到主线程
                self.postMessage({
                    type: "result",
                    data: {
                        panoramaData: imageData,
                        width,
                        height,
                    },
                });

                // 释放资源
                panorama.delete();
            } catch (error: any) {
                console.error("拼接过程中出错:", error);
                self.postMessage({
                    type: "error",
                    data:
                        "拼接失败: " +
                        (error.message || "未知错误，请尝试使用更相似的图片"),
                });
            }

            // 释放资源
            for (const img of cvImages) {
                img.delete();
            }
        } catch (error: any) {
            console.error("Worker 处理错误:", error);
            self.postMessage({
                type: "error",
                data: error.message || "未知错误，请刷新页面重试",
            });
        }
    }
};
