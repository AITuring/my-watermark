module.exports = {
  // 基本配置
  inputDir: './input',
  outputDir: './output',

  // 压缩配置
  jpeg: {
    quality: 90,              // 质量 (1-100)
    progressive: true,        // 渐进式JPEG
    mozjpeg: true,           // 使用mozjpeg编码器
    optimiseScans: true,     // 优化扫描
    optimiseCoding: true,    // 优化编码
    quantisationTable: 0     // 量化表 (0-8)
  },

  // 处理配置
  processing: {
    concurrent: 1,           // 并发处理数量（大文件建议设为1）
    memoryLimit: 512,        // 内存限制(MB)
    timeout: 300000          // 超时时间(ms)
  },

  // 输出配置
  output: {
    preserveMetadata: false, // 是否保留元数据
    suffix: '_compressed',   // 输出文件后缀
    overwrite: false        // 是否覆盖现有文件
  }
};
