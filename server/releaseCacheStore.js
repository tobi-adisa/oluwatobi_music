import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const cachePath = path.join(dataDir, "release-cache.json");

async function ensureCacheFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(cachePath);
  } catch {
    await fs.writeFile(cachePath, JSON.stringify({}, null, 2));
  }
}

async function loadCache() {
  await ensureCacheFile();
  const raw = await fs.readFile(cachePath, "utf8");
  return JSON.parse(raw);
}

async function saveCache(cache) {
  await ensureCacheFile();
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
}

export async function getCachedRelease(spotifyUrl) {
  const cache = await loadCache();
  return cache[spotifyUrl] || null;
}

export async function setCachedRelease(spotifyUrl, release) {
  const cache = await loadCache();
  cache[spotifyUrl] = release;
  await saveCache(cache);
}
