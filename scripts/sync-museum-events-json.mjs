import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourceFile = path.join(projectRoot, "backend", "data", "exhibitions_latest.json");
const targetDir = path.join(projectRoot, "public", "museum-events");
const targetFile = path.join(targetDir, "exhibitions_latest.json");

if (!fs.existsSync(sourceFile)) {
  console.warn(`[museum-events] source json not found: ${sourceFile}`);
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(sourceFile, targetFile);
console.log(`[museum-events] synced fallback json -> ${targetFile}`);
