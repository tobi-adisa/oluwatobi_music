import { loadJsonStore, saveJsonStore } from "./jsonStore.js";
import { dedupeLinks, normalizeSpotifyUrl } from "./releaseUtils.js";

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
  const release = cache[spotifyUrl] || null;
  if (!release) {
    return null;
  }

  return {
    ...release,
    spotifyUrl: normalizeSpotifyUrl(release.spotifyUrl || spotifyUrl),
    links: dedupeLinks(release.links || []),
  };
}

export async function setCachedRelease(spotifyUrl, release) {
  const cache = await loadCache();
  cache[spotifyUrl] = {
    ...release,
    spotifyUrl: normalizeSpotifyUrl(release.spotifyUrl || spotifyUrl),
    links: dedupeLinks(release.links || []),
  };
  await saveCache(cache);
}
