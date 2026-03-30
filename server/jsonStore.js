import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { get, put } from "@vercel/blob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function usesBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

async function ensureLocalFile(filePath, defaultData) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
  }
}

async function loadLocalJson(filePath, defaultData) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      if (isVercelRuntime()) {
        return clone(defaultData);
      }

      await ensureLocalFile(filePath, defaultData);
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw);
    }

    throw error;
  }
}

async function saveLocalJson(filePath, value) {
  if (isVercelRuntime()) {
    throw new Error("Writable storage is not configured. Set BLOB_READ_WRITE_TOKEN on Vercel.");
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

async function loadBlobJson(blobPath, defaultData) {
  try {
    const result = await get(blobPath, { access: "private" });
    if (!result?.stream) {
      throw new Error("Missing blob stream");
    }

    const raw = await new Response(result.stream).text();
    return JSON.parse(raw);
  } catch {
    await put(blobPath, JSON.stringify(defaultData, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return clone(defaultData);
  }
}

async function saveBlobJson(blobPath, value) {
  await put(blobPath, JSON.stringify(value, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function loadJsonStore({ fileName, blobPath, defaultData }) {
  const localPath = path.join(dataDir, fileName);

  if (usesBlobStorage()) {
    return loadBlobJson(blobPath, defaultData);
  }

  return loadLocalJson(localPath, defaultData);
}

export async function saveJsonStore({ fileName, blobPath, value }) {
  const localPath = path.join(dataDir, fileName);

  if (usesBlobStorage()) {
    await saveBlobJson(blobPath, value);
    return;
  }

  await saveLocalJson(localPath, value);
}
