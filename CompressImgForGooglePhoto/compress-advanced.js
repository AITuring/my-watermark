const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const cliProgress = require('cli-progress');
const colors = require('colors');

// 高级压缩配置
const advancedConfig = {
  inputDir: './',
  outputDir: './output-advanced',
  // 测试不同质量参数
  testQualities: [88, 85, 82, 80],
  // 最终使用的质量
  finalQuality: 85,
  progressive: true,
  mozjpeg: true,
  removeMetadata: true, // 移除元数据
  // Google Photos 限制
  googlePhotos: {
    maxSizeMB: 200,
    maxPixels: 200000000 // 2亿像素
  }
};

// 设置sharp优化
sharp.cache(false);
sharp.concurrency(1);
sharp.simd(false);


// 创建进度条实例
const multibar = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: ' {bar} | {filename} | {value}/{total} | {percentage}% | ETA: {eta}s | {status}'
}, cliProgress.Presets.shades_classic);

/**
 * 检查Google Photos上传限制
 */
function checkGooglePhotosLimits(metadata, fileSizeMB) {
  const totalPixels = metadata.width * metadata.height;
  const exceedsPixelLimit = totalPixels > advancedConfig.googlePhotos.maxPixels;
  const exceedsSizeLimit = fileSizeMB > advancedConfig.googlePhotos.maxSizeMB;

  return {
    totalPixels,
    exceedsPixelLimit,
    exceedsSizeLimit,
    needsResize: exceedsPixelLimit,
    needsCompress: exceedsSizeLimit || exceedsPixelLimit
  };
}

/**
 * 计算目标尺寸以满足Google Photos像素限制
 */
function calculateTargetDimensions(width, height, maxPixels) {
  const currentPixels = width * height;
  if (currentPixels <= maxPixels) {
    return { width, height, resizeNeeded: false };
  }

  const ratio = Math.sqrt(maxPixels / currentPixels);
  const targetWidth = Math.floor(width * ratio);
  const targetHeight = Math.floor(height * ratio);

  return {
    width: targetWidth,
    height: targetHeight,
    resizeNeeded: true,
    originalPixels: currentPixels,
    targetPixels: targetWidth * targetHeight
  };
}

/**
 * 检查图片元数据（增强版）
 */
async function analyzeMetadata(imagePath) {
  try {
    const image = sharp(imagePath, {
      limitInputPixels: false,
      sequentialRead: true
    });

    const metadata = await image.metadata();
    const inputStats = await fs.stat(imagePath);
    const fileSizeMB = (inputStats.size / 1024 / 1024).toFixed(2);

    // 计算总像素数
    const totalPixels = metadata.width * metadata.height;
    const megaPixels = (totalPixels / 1000000).toFixed(2);

    // 检查Google Photos限制
    const googleLimits = checkGooglePhotosLimits(metadata, parseFloat(fileSizeMB));

    console.log(`📊 图片元数据分析:`);
    console.log(`   尺寸: ${metadata.width}x${metadata.height}`);
    console.log(`   总像素: ${totalPixels.toLocaleString()} (${megaPixels}MP)`);
    console.log(`   文件大小: ${fileSizeMB}MB`);
    console.log(`   颜色空间: ${metadata.space}`);
    console.log(`   通道数: ${metadata.channels}`);
    console.log(`   位深度: ${metadata.depth}`);
    console.log(`   密度: ${metadata.density || 'N/A'}`);

    // Google Photos 限制检查
    console.log(`\n🔍 Google Photos 上传限制检查:`);
    console.log(`   像素限制 (2亿): ${googleLimits.exceedsPixelLimit ? '❌ 超出' : '✅ 符合'} (${megaPixels}MP)`);
    console.log(`   大小限制 (200MB): ${googleLimits.exceedsSizeLimit ? '❌ 超出' : '✅ 符合'} (${fileSizeMB}MB)`);

    if (googleLimits.needsResize) {
      const targetDims = calculateTargetDimensions(metadata.width, metadata.height, advancedConfig.googlePhotos.maxPixels);
      console.log(`   建议尺寸: ${targetDims.width}x${targetDims.height} (${(targetDims.targetPixels / 1000000).toFixed(2)}MP)`);
    }

    console.log(`   是否有ICC配置文件: ${metadata.icc ? '是' : '否'}`);
    console.log(`   是否有EXIF数据: ${metadata.exif ? '是 (' + metadata.exif.length + ' bytes)' : '否'}`);
    console.log(`   是否有XMP数据: ${metadata.xmp ? '是 (' + metadata.xmp.length + ' bytes)' : '否'}`);
    console.log(`   是否有IPTC数据: ${metadata.iptc ? '是 (' + metadata.iptc.length + ' bytes)' : '否'}`);

    // 计算元数据大小
    let metadataSize = 0;
    if (metadata.exif) metadataSize += metadata.exif.length;
    if (metadata.xmp) metadataSize += metadata.xmp.length;
    if (metadata.iptc) metadataSize += metadata.iptc.length;
    if (metadata.icc) metadataSize += metadata.icc.length;

    console.log(`   元数据总大小: ${(metadataSize / 1024).toFixed(2)}KB\n`);

    return {
      hasMetadata: metadataSize > 0,
      metadataSize,
      metadata,
      totalPixels,
      megaPixels: parseFloat(megaPixels),
      fileSizeMB: parseFloat(fileSizeMB),
      googleLimits
    };
  } catch (error) {
    console.error(`❌ 元数据分析失败: ${error.message}`);
    return { hasMetadata: false, metadataSize: 0, totalPixels: 0, megaPixels: 0, fileSizeMB: 0 };
  }
}

/**
 * 高级JPEG压缩（包含Google Photos优化）
 */
async function advancedJpegCompress(inputPath, outputPath, progressBar = null) {
  try {
    const startTime = Date.now();
    const inputStats = await fs.stat(inputPath);
    const inputSizeMB = (inputStats.size / 1024 / 1024).toFixed(2);
    const fileName = path.basename(inputPath);

    // 更新进度条状态
    if (progressBar) {
      progressBar.update(0, {
        filename: fileName.substring(0, 20) + (fileName.length > 20 ? '...' : ''),
        status: '分析中...'
      });
    }

    console.log(`🔬 开始高级JPEG压缩: ${fileName} (${inputSizeMB}MB)`);

    // 分析元数据
    const metadataInfo = await analyzeMetadata(inputPath);

    if (progressBar) {
      progressBar.update(20, { status: '处理中...' });
    }

    // 创建sharp实例
    let image = sharp(inputPath, {
      limitInputPixels: false,
      sequentialRead: true,
      density: 72
    });

    // 检查是否需要调整尺寸以满足Google Photos限制
    if (metadataInfo.googleLimits && metadataInfo.googleLimits.needsResize) {
      const targetDims = calculateTargetDimensions(
        metadataInfo.metadata.width,
        metadataInfo.metadata.height,
        advancedConfig.googlePhotos.maxPixels
      );

      console.log(`📐 调整尺寸以满足Google Photos限制:`);
      console.log(`   原始: ${metadataInfo.metadata.width}x${metadataInfo.metadata.height}`);
      console.log(`   目标: ${targetDims.width}x${targetDims.height}`);

      if (progressBar) {
        progressBar.update(40, { status: '调整尺寸...' });
      }

      image = image.resize(targetDims.width, targetDims.height, {
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: true
      });
    }

    if (progressBar) {
      progressBar.update(60, { status: '移除元数据...' });
    }

    // 移除元数据（如果存在）
    if (advancedConfig.removeMetadata) {
      console.log(`🗑️  移除所有元数据...`);
      image = image.withMetadata({
        exif: {},
        icc: undefined,
        iptc: undefined,
        xmp: undefined
      });
    }

    // 动态调整质量参数
    let quality = advancedConfig.finalQuality;
    if (metadataInfo.googleLimits && metadataInfo.googleLimits.exceedsSizeLimit) {
      quality = Math.max(70, quality - 10);
      console.log(`📉 文件过大，降低质量参数至: ${quality}`);
    }

    if (progressBar) {
      progressBar.update(80, { status: '压缩中...' });
    }

    // 应用高级JPEG压缩
    console.log(`⚙️  应用高级JPEG压缩参数...`);
    await image
      .jpeg({
        quality: quality,
        progressive: true,
        mozjpeg: true,
        optimiseScans: true,
        optimiseCoding: true,
        quantisationTable: 2,
        trellisQuantisation: true,
        overshootDeringing: true,
        optimizeScans: true,
        chromaSubsampling: '4:2:0',
        force: true
      })
      .toFile(outputPath);

    if (progressBar) {
      progressBar.update(95, { status: '验证中...' });
    }

    const outputStats = await fs.stat(outputPath);
    const outputSizeMB = (outputStats.size / 1024 / 1024).toFixed(2);
    const compressionRatio = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const savedSpace = ((inputStats.size - outputStats.size) / 1024 / 1024).toFixed(2);

    // 检查输出文件是否满足Google Photos限制
    const outputImage = sharp(outputPath);
    const outputMetadata = await outputImage.metadata();
    const outputPixels = outputMetadata.width * outputMetadata.height;
    const meetsGoogleLimits = outputPixels <= advancedConfig.googlePhotos.maxPixels &&
                             parseFloat(outputSizeMB) <= advancedConfig.googlePhotos.maxSizeMB;

    if (progressBar) {
      progressBar.update(100, {
        status: meetsGoogleLimits ? '✅ 完成' : '⚠️ 完成'
      });
    }

    console.log(`✅ 高级压缩完成: ${path.basename(outputPath)}`);
    console.log(`   原始大小: ${inputSizeMB}MB`);
    console.log(`   压缩后: ${outputSizeMB}MB`);
    console.log(`   压缩率: ${compressionRatio}%`);
    console.log(`   节省空间: ${savedSpace}MB`);
    console.log(`   输出尺寸: ${outputMetadata.width}x${outputMetadata.height}`);
    console.log(`   输出像素: ${outputPixels.toLocaleString()} (${(outputPixels / 1000000).toFixed(2)}MP)`);
    console.log(`   Google Photos兼容: ${meetsGoogleLimits ? '✅ 是' : '❌ 否'}`);
    if (metadataInfo.hasMetadata) {
      console.log(`   元数据节省: ${(metadataInfo.metadataSize / 1024).toFixed(2)}KB`);
    }
    console.log(`   处理时间: ${processingTime}秒\n`);

    return {
      success: true,
      inputSize: inputStats.size,
      outputSize: outputStats.size,
      compressionRatio: parseFloat(compressionRatio),
      processingTime: parseFloat(processingTime),
      metadataSaved: metadataInfo.metadataSize,
      meetsGoogleLimits,
      outputPixels
    };
  } catch (error) {
    if (progressBar) {
      progressBar.update(100, { status: '❌ 失败' });
    }
    console.error(`❌ 高级压缩失败: ${path.basename(inputPath)}`);
    console.error(`   错误信息: ${error.message}\n`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 质量测试模式 - 找出最佳压缩参数
 */
async function qualityTest(inputPath, outputDir) {
  console.log(`🧪 开始质量测试模式...\n`);

  const results = [];
  const fileName = path.basename(inputPath, path.extname(inputPath));
  const ext = path.extname(inputPath);

  for (const quality of advancedConfig.testQualities) {
    const testOutputPath = path.join(outputDir, `${fileName}_test_q${quality}${ext}`);

    try {
      console.log(`🔍 测试质量参数: ${quality}`);

      const image = sharp(inputPath, {
        limitInputPixels: false,
        sequentialRead: true,
        density: 72
      });

      await image
        .withMetadata({
          exif: {},
          icc: undefined,
          iptc: undefined,
          xmp: undefined
        })
        .jpeg({
          quality: quality,
          progressive: true,
          mozjpeg: true,
          optimiseScans: true,
          optimiseCoding: true,
          quantisationTable: 2,
          trellisQuantisation: true,
          overshootDeringing: true,
          chromaSubsampling: '4:2:0'
        })
        .toFile(testOutputPath);

      const inputStats = await fs.stat(inputPath);
      const outputStats = await fs.stat(testOutputPath);
      const compressionRatio = ((1 - outputStats.size / inputStats.size) * 100);

      results.push({
        quality,
        outputPath: testOutputPath,
        outputSize: outputStats.size,
        compressionRatio,
        sizeMB: (outputStats.size / 1024 / 1024).toFixed(2)
      });

      console.log(`   结果: ${(outputStats.size / 1024 / 1024).toFixed(2)}MB (${compressionRatio.toFixed(1)}% 压缩)`);

    } catch (error) {
      console.log(`   ❌ 质量${quality}测试失败: ${error.message}`);
    }
  }

  // 显示测试结果
  console.log(`\n📈 质量测试结果对比:`);
  results.forEach(result => {
    console.log(`   质量${result.quality}: ${result.sizeMB}MB (压缩率${result.compressionRatio.toFixed(1)}%)`);
  });

  // 推荐最佳质量
  const bestBalance = results.find(r => r.compressionRatio >= 25 && r.compressionRatio <= 35) ||
                     results.reduce((best, current) =>
                       Math.abs(current.compressionRatio - 30) < Math.abs(best.compressionRatio - 30) ? current : best
                     );

  console.log(`\n💡 推荐质量参数: ${bestBalance.quality} (${bestBalance.sizeMB}MB, ${bestBalance.compressionRatio.toFixed(1)}% 压缩)`);

  return results;
}

/**
 * 批量高级压缩（带进度条）
 */
async function batchAdvancedCompress() {
  try {
    // 确保输出目录存在
    await fs.ensureDir(advancedConfig.outputDir);

    // 读取输入目录中的所有文件
    const files = await fs.readdir(advancedConfig.inputDir);
    const imageFiles = files.filter(file => /\.(jpg|jpeg)$/i.test(file));

    if (imageFiles.length === 0) {
      console.log('❌ 在输入目录中没有找到JPG图片文件');
      return;
    }

    console.log(`🚀 开始高级批量压缩 ${imageFiles.length} 个图片文件...`);
    console.log(`📋 配置: 质量${advancedConfig.finalQuality}, 移除元数据: ${advancedConfig.removeMetadata ? '是' : '否'}\n`);

    // 创建总体进度条
    const overallProgress = multibar.create(imageFiles.length, 0, {
      filename: '总体进度',
      status: '准备中...'
    });

    const results = [];
    let totalInputSize = 0;
    let totalOutputSize = 0;
    let totalMetadataSaved = 0;
    let successCount = 0;

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const inputPath = path.join(advancedConfig.inputDir, file);
      const outputPath = path.join(advancedConfig.outputDir,
        file.replace(/\.(jpg|jpeg)$/i, '_advanced_compressed.$1')
      );

      // 创建单个文件进度条
      const fileProgress = multibar.create(100, 0, {
        filename: file.substring(0, 20) + (file.length > 20 ? '...' : ''),
        status: '等待中...'
      });

      // 更新总体进度
      overallProgress.update(i, {
        status: `处理中 (${i + 1}/${imageFiles.length})`
      });

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      const result = await advancedJpegCompress(inputPath, outputPath, fileProgress);
      results.push(result);

      if (result.success) {
        totalInputSize += result.inputSize;
        totalOutputSize += result.outputSize;
        totalMetadataSaved += result.metadataSaved || 0;
        successCount++;
      }

      // 移除单个文件进度条
      multibar.remove(fileProgress);
    }

    // 完成总体进度
    overallProgress.update(imageFiles.length, {
      status: '✅ 全部完成'
    });

    // 停止进度条
    multibar.stop();

    // 输出总结
    console.log('\n📊 高级压缩完成统计:');
    console.log(`   成功: ${successCount}/${imageFiles.length}`);
    if (totalInputSize > 0) {
      console.log(`   总原始大小: ${(totalInputSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   总压缩后大小: ${(totalOutputSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   总压缩率: ${((1 - totalOutputSize / totalInputSize) * 100).toFixed(1)}%`);
      console.log(`   总节省空间: ${((totalInputSize - totalOutputSize) / 1024 / 1024).toFixed(2)}MB`);
      if (totalMetadataSaved > 0) {
        console.log(`   元数据节省: ${(totalMetadataSaved / 1024).toFixed(2)}KB`);
      }
    }

  } catch (error) {
    multibar.stop();
    console.error('❌ 批量高级压缩过程中发生错误:', error.message);
  }
}


/**
 * 主函数
 */
async function main() {
  console.log('🔬 高级JPEG压缩工具（含元数据移除）\n');

  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    // 质量测试模式
    await fs.ensureDir(advancedConfig.outputDir);
    const files = await fs.readdir(advancedConfig.inputDir);
    const imageFiles = files.filter(file => /\.(jpg|jpeg)$/i.test(file));

    if (imageFiles.length > 0) {
      const inputPath = path.join(advancedConfig.inputDir, imageFiles[0]);
      await qualityTest(inputPath, advancedConfig.outputDir);
    }
  } else {
    // 正常压缩模式
    await batchAdvancedCompress();
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  advancedJpegCompress,
  analyzeMetadata,
  qualityTest,
  batchAdvancedCompress,
  advancedConfig
};
