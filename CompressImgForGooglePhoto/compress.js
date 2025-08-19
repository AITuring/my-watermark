const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');

// 配置选项
const config = {
  inputDir: './',     // 输入目录
  outputDir: './output',   // 输出目录
  quality: 90,             // JPEG质量 (1-100)
  progressive: true,       // 渐进式JPEG
  mozjpeg: true,          // 使用mozjpeg编码器
  preserveOriginalSize: true // 保持原始尺寸
};

// 设置sharp的限制以处理超大图片
sharp.cache(false); // 禁用缓存以节省内存
sharp.concurrency(1); // 设置并发数为1
sharp.simd(false); // 禁用SIMD以提高稳定性

/**
 * 压缩单个图片文件
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 */
async function compressImage(inputPath, outputPath) {
  try {
    const startTime = Date.now();
    const inputStats = await fs.stat(inputPath);
    const inputSizeMB = (inputStats.size / 1024 / 1024).toFixed(2);
    
    console.log(`开始压缩: ${path.basename(inputPath)} (${inputSizeMB}MB)`);
    
    // 创建sharp实例并设置限制
    const image = sharp(inputPath, {
      limitInputPixels: false, // 移除像素限制
      sequentialRead: true,    // 顺序读取以节省内存
      density: 72             // 设置较低的密度以减少内存使用
    });
    
    // 获取图片信息
    const metadata = await image.metadata();
    console.log(`   图片尺寸: ${metadata.width}x${metadata.height}`);
    console.log(`   颜色空间: ${metadata.space}`);
    console.log(`   保持原始尺寸进行压缩...`);
    
    // 直接压缩，不进行缩放
    await image
      .jpeg({
        quality: config.quality,
        progressive: config.progressive,
        mozjpeg: config.mozjpeg,
        optimiseScans: true,
        optimiseCoding: true,
        quantisationTable: 0,
        trellisQuantisation: true,
        overshootDeringing: true
      })
      .toFile(outputPath);
    
    const outputStats = await fs.stat(outputPath);
    const outputSizeMB = (outputStats.size / 1024 / 1024).toFixed(2);
    const compressionRatio = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ 压缩完成: ${path.basename(outputPath)}`);
    console.log(`   原始大小: ${inputSizeMB}MB`);
    console.log(`   压缩后: ${outputSizeMB}MB`);
    console.log(`   压缩率: ${compressionRatio}%`);
    console.log(`   处理时间: ${processingTime}秒\n`);
    
    return {
      success: true,
      inputSize: inputStats.size,
      outputSize: outputStats.size,
      compressionRatio: parseFloat(compressionRatio),
      processingTime: parseFloat(processingTime)
    };
  } catch (error) {
    console.error(`❌ 压缩失败: ${path.basename(inputPath)}`);
    console.error(`   错误信息: ${error.message}\n`);
    
    // 如果内存不足，提供建议
    if (error.message.includes('memory') || 
        error.message.includes('limit') ||
        error.message.includes('allocation')) {
      console.log(`   💡 建议: 图片过大可能导致内存不足`);
      console.log(`   可以尝试以下方法:`);
      console.log(`   1. 使用更大的内存限制: node --max-old-space-size=16384 compress.js`);
      console.log(`   2. 启用垃圾回收: node --expose-gc --max-old-space-size=16384 compress.js`);
      console.log(`   3. 如果仍然失败，可以考虑适度缩放`);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 批量压缩图片
 */
async function batchCompress() {
  try {
    // 确保输出目录存在
    await fs.ensureDir(config.outputDir);
    
    // 检查输入目录是否存在
    if (!await fs.pathExists(config.inputDir)) {
      console.error(`❌ 输入目录不存在: ${config.inputDir}`);
      console.log('请创建input目录并放入要压缩的JPG图片');
      return;
    }
    
    // 读取输入目录中的所有文件
    const files = await fs.readdir(config.inputDir);
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg)$/i.test(file)
    );
    
    if (imageFiles.length === 0) {
      console.log('❌ 在输入目录中没有找到JPG图片文件');
      return;
    }
    
    console.log(`🚀 开始批量压缩 ${imageFiles.length} 个图片文件...`);
    console.log(`📐 模式: 保持原始尺寸\n`);
    
    const results = [];
    let totalInputSize = 0;
    let totalOutputSize = 0;
    let successCount = 0;
    
    // 逐个处理图片（避免内存溢出）
    for (const file of imageFiles) {
      const inputPath = path.join(config.inputDir, file);
      const outputPath = path.join(config.outputDir, file);
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
      
      const result = await compressImage(inputPath, outputPath);
      results.push(result);
      
      if (result.success) {
        totalInputSize += result.inputSize;
        totalOutputSize += result.outputSize;
        successCount++;
      }
    }
    
    // 输出总结
    console.log('📊 压缩完成统计:');
    console.log(`   成功: ${successCount}/${imageFiles.length}`);
    if (totalInputSize > 0) {
      console.log(`   总原始大小: ${(totalInputSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   总压缩后大小: ${(totalOutputSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   总压缩率: ${((1 - totalOutputSize / totalInputSize) * 100).toFixed(1)}%`);
      console.log(`   节省空间: ${((totalInputSize - totalOutputSize) / 1024 / 1024).toFixed(2)}MB`);
    }
    
  } catch (error) {
    console.error('❌ 批量压缩过程中发生错误:', error.message);
  }
}

/**
 * 压缩单个文件（命令行参数）
 */
async function compressSingleFile() {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3];
  
  if (!inputFile) {
    console.log('用法: node compress.js <输入文件> [输出文件]');
    console.log('示例: node compress.js ./large-image.jpg ./compressed-image.jpg');
    return;
  }
  
  if (!await fs.pathExists(inputFile)) {
    console.error(`❌ 输入文件不存在: ${inputFile}`);
    return;
  }
  
  const output = outputFile || inputFile.replace(/\.(jpg|jpeg)$/i, '_compressed.$1');
  
  await compressImage(inputFile, output);
}

// 主函数
async function main() {
  console.log('🖼️  JPG图片无损压缩工具（保持原始尺寸）\n');
  
  // 如果提供了命令行参数，则压缩单个文件
  if (process.argv.length > 2) {
    await compressSingleFile();
  } else {
    // 否则进行批量压缩
    await batchCompress();
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  compressImage,
  batchCompress,
  config
};