// node图片合成
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const imageFolderPath = "../../Downloads/壁纸"; // 图像文件夹路径
const outputFilePath = "../../Downloads/combined_image1.png"; // 输出文件路径
const size = 5; // 你想要合并的图像数量

async function combineImages() {
  // 获取图像文件夹中的所有文件
  const fileNames = fs.readdirSync(imageFolderPath);
  const imageNames = [];

  // 过滤出sharp库可以处理的图像文件
  for (let i = 0; i < fileNames.length && imageNames.length < size; i++) {
    try {
      await sharp(path.join(imageFolderPath, fileNames[i])).metadata();
      imageNames.push(fileNames[i]);
    } catch (err) {
      console.warn(`Skipping file ${fileNames[i]} due to unsupported format.`);
    }
  }

  const imagePaths = imageNames.map((name) => path.join(imageFolderPath, name));

  let totalHeight = 0;
  let maxWidth = 0;
  const resizedImages = [];

  // 遍历每个图像，并调整宽度以使其与最大宽度匹配
  for (let i = 0; i < imagePaths.length; i++) {
    const image = sharp(imagePaths[i]);
    const metadata = await image.metadata();
    totalHeight += metadata.height;
    maxWidth = Math.max(maxWidth, metadata.width);
    resizedImages.push(
      image.resize({
        width: maxWidth,
        fit: "fill", // 使用 fill 以避免修改宽高比
      }),
    );
  }

  const buffers = await Promise.all(
    resizedImages.map((image) => image.toBuffer()),
  );
  const metadata = await Promise.all(
    buffers.map((buffer) => sharp(buffer).metadata()),
  );

  // 创建一个新的空白图像作为画布
  const canvas = sharp({
    create: {
      width: maxWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  let top = 0;
  const composite = [];

  // 将每个图像添加到画布上
  for (let i = 0; i < buffers.length; i++) {
    composite.push({ input: buffers[i], left: 0, top });
    top += metadata[i].height;
  }

  canvas
    .composite(composite)
    .toFile(outputFilePath)
    .then(() => console.log("Images were successfully combined!"))
    .catch((err) => console.error("Failed to combine images:", err));
}

combineImages();
