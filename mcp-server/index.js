#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 你的本地应用地址
const APP_URL = "http://localhost:5173";

const server = new Server(
  {
    name: "watermark-app-automator",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "watermark_via_app",
        description: "使用本地运行的前端应用(localhost:5173)来给图片添加水印。这会启动浏览器自动化操作。",
        inputSchema: {
          type: "object",
          properties: {
            inputPath: {
              type: "string",
              description: "输入图片的绝对路径",
            },
            outputPath: {
              type: "string",
              description: "输出图片的绝对路径",
            },
          },
          required: ["inputPath", "outputPath"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "watermark_via_app") {
    const { inputPath, outputPath } = request.params.arguments;
    let browser = null;

    try {
      if (!fs.existsSync(inputPath)) {
        throw new Error(`输入文件不存在: ${inputPath}`);
      }

      // 1. 启动浏览器
      browser = await puppeteer.launch({
        headless: false, // 设置为 false 可以看到浏览器操作过程，调试完成后可改为 "new"
        defaultViewport: { width: 1920, height: 1080 }, // 确保使用桌面版布局
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();

      // 2. 设置下载路径
      const downloadPath = path.resolve(__dirname, "downloads");
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath);
      }

      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath,
      });

      // 3. 打开应用
      console.error(`正在打开 ${APP_URL}...`);
      await page.goto(APP_URL, { waitUntil: 'networkidle0' });

      // 4. 上传图片
      console.error("正在上传图片...");
      // 等待 input[type="file"] 出现 (React Dropzone 即使隐藏也会有这个 input)
      const fileInput = await page.waitForSelector('input[type="file"]');
      await fileInput.uploadFile(inputPath);

      // 5. 等待编辑器加载
      // 我们可以等待 Konva 的 canvas 出现，或者等待"水印生成"按钮出现
      console.error("等待编辑器加载...");
      await page.waitForSelector('canvas', { timeout: 10000 });

      // 等待片刻确保图片渲染完成
      await new Promise(r => setTimeout(r, 2000));

      // 6. 点击"水印生成"按钮
      console.error("点击生成按钮...");
      // 查找包含"水印生成"文字的按钮
      const buttonClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const generateBtn = buttons.find(b => b.textContent.includes('水印生成'));
        if (generateBtn) {
          generateBtn.click();
          return true;
        }
        return false;
      });

      if (!buttonClicked) {
        throw new Error("未找到'水印生成'按钮，请检查页面是否加载正确或处于桌面模式");
      }

      // 7. 等待文件下载
      console.error("等待下载...");
      // 轮询下载目录看是否有新文件
      const waitForFile = async () => {
        const start = Date.now();
        while (Date.now() - start < 30000) { // 30秒超时
          const files = fs.readdirSync(downloadPath);
          // 过滤掉 .DS_Store 和未下载完的 .crdownload 文件
          const newFiles = files.filter(f => !f.startsWith('.') && !f.endsWith('.crdownload'));
          if (newFiles.length > 0) {
            // 获取最新的文件
            const latestFile = newFiles.map(f => ({
                name: f,
                time: fs.statSync(path.join(downloadPath, f)).mtime.getTime()
            })).sort((a, b) => b.time - a.time)[0];

            return path.join(downloadPath, latestFile.name);
          }
          await new Promise(r => setTimeout(r, 500));
        }
        throw new Error("下载超时");
      };

      const downloadedFilePath = await waitForFile();

      // 8. 移动文件到目标路径
      fs.copyFileSync(downloadedFilePath, outputPath);

      // 清理下载的临时文件
      fs.unlinkSync(downloadedFilePath);

      return {
        content: [
          {
            type: "text",
            text: `成功调用前端应用生成水印！\n原图: ${inputPath}\n结果: ${outputPath}`,
          },
        ],
      };

    } catch (error) {
      console.error("Automation error:", error);
      return {
        content: [
          {
            type: "text",
            text: `自动化操作失败: ${error.message}`,
          },
        ],
        isError: true,
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  throw new Error(`Tool ${request.params.name} not found`);
});

const transport = new StdioServerTransport();
server.connect(transport);
