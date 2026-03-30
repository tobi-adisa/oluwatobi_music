import { loadJsonStore, saveJsonStore } from "./jsonStore.js";

async function loadCache() {
  return loadJsonStore({
    fileName: "release-cache.json",
    blobPath: "cms/release-cache.json",
    defaultData: {},
  });
}

async function saveCache(cache) {
  await saveJsonStore({
    fileName: "release-cache.json",
    blobPath: "cms/release-cache.json",
    value: cache,
  });
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
