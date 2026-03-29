import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultContent } from "./defaultContent.js";
import { sanitizeContent } from "./releaseUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const contentPath = path.join(dataDir, "site-content.json");

async function ensureContentFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(contentPath);
  } catch {
    await fs.writeFile(contentPath, JSON.stringify(defaultContent, null, 2));
  }
}

export async function loadContent() {
  await ensureContentFile();
  const raw = await fs.readFile(contentPath, "utf8");
  return sanitizeContent(JSON.parse(raw));
}

export async function saveContent(content) {
  await ensureContentFile();
  const sanitized = sanitizeContent(content);
  await fs.writeFile(contentPath, JSON.stringify(sanitized, null, 2));
  return sanitized;
}

export { contentPath };
