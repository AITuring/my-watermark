import { ImageType } from "@/types";
function uuid(): string {
    let idStr = Date.now().toString(36);
    idStr += Math.random().toString(36).substr(2);
    return idStr;
}

// 加载图片数据
async function loadImageData(files: File[]): Promise<ImageType[]> {
    // 注意Promise<ImageType>[]和Promise<ImageType[]>
    const promises: Promise<ImageType>[] = files.map((file): Promise<ImageType> => {
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
    return Promise.all(promises);
}

// 计算水印的位置
function calculateWatermarkPosition(
    watermarkImage,
    imageWidth,
    imageHeight,
    position
) {
    // scaleX和scaleY是相等的，用随便一个就行
    const scale = position.scaleX;
    const watermarkWidth = watermarkImage.width * scale;
    const watermarkHeight = watermarkImage.height * scale;

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
        watermarkX = imageWidth - watermarkWidth - 4;
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

// 防抖
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

export { uuid, loadImageData, calculateWatermarkPosition, debounce };
