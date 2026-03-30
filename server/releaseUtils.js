const EXCLUDED_PLATFORMS = new Set(["deezer"]);

export function normalizeSpotifyUrl(url) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url.trim());
    parsed.search = "";
    parsed.hash = "";

    if (parsed.hostname === "spotify.link") {
      return url.trim();
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

export function normalizeLinkUrl(url, platform = "") {
  if (!url) {
    return "";
  }

  if (platform === "spotify" || url.includes("open.spotify.com/")) {
    return normalizeSpotifyUrl(url);
  }

  return url.trim();
}

export function dedupeLinks(links = []) {
  const unique = new Map();

  links.forEach((link, index) => {
    const url = normalizeLinkUrl(link?.url || "", link?.platform || "");
    if (!url) {
      return;
    }

    const platform = (link?.platform || "").trim();
    if (EXCLUDED_PLATFORMS.has(platform)) {
      return;
    }

    const label = (link?.label || platform || "Link").trim();
    const key = `${platform}::${url}`;

    unique.set(key, {
      id: link?.id || `${platform || "link"}-${index}`,
      platform,
      label,
      url,
    });
  });

  return [...unique.values()];
}

export function sanitizeContent(content) {
  return {
    ...content,
    releases: (content?.releases || []).map((release) => ({
      ...release,
      spotifyUrl: normalizeSpotifyUrl(release?.spotifyUrl || ""),
      links: dedupeLinks(release?.links || []),
    })),
  };
}
