import { defaultContent } from "./defaultContent.js";
import { loadJsonStore, saveJsonStore } from "./jsonStore.js";
import { sanitizeContent } from "./releaseUtils.js";

export async function loadContent() {
  const content = await loadJsonStore({
    fileName: "site-content.json",
    blobPath: "cms/site-content.json",
    defaultData: defaultContent,
  });
  return sanitizeContent(content);
}

export async function saveContent(content) {
  const sanitized = sanitizeContent(content);
  await saveJsonStore({
    fileName: "site-content.json",
    blobPath: "cms/site-content.json",
    value: sanitized,
  });
  return sanitized;
}
