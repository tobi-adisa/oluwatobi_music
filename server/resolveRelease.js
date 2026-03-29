import { getCachedRelease, setCachedRelease } from "./releaseCacheStore.js";
import { dedupeLinks, normalizeSpotifyUrl } from "./releaseUtils.js";

const platformLabels = {
  spotify: "Spotify",
  appleMusic: "Apple Music",
  youtubeMusic: "YouTube Music",
  youtube: "YouTube",
  tidal: "Tidal",
  deezer: "Deezer",
  amazonMusic: "Amazon Music",
  soundcloud: "SoundCloud",
  bandcamp: "Bandcamp",
  boomplay: "Boomplay",
  pandora: "Pandora",
  amazonStore: "Amazon Store",
};

function normalizePlatforms(linksByPlatform = {}) {
  return dedupeLinks(
    Object.entries(linksByPlatform)
    .map(([platform, value], index) => {
      const url = value?.url;
      if (!url) {
        return null;
      }

      return {
        id: `${platform}-${index}`,
        platform,
        label: platformLabels[platform] || platform,
        url,
      };
    })
    .filter(Boolean)
  );
}

function inferReleaseType(entity = {}) {
  if (entity.type === "album") {
    return "album";
  }

  if (entity.type === "song") {
    return "single";
  }

  return "release";
}

function extractMetaTag(html, propertyName) {
  const regex = new RegExp(
    `<meta[^>]+property="og:${propertyName}"[^>]+content="([^"]+)"`,
    "i"
  );
  return html.match(regex)?.[1] || "";
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"');
}

function cleanSpotifyTitle(title) {
  return decodeHtml(title)
    .replace(/\s+-\s+(album|ep|single)\s+by\s+.+$/i, "")
    .replace(/\s+-\s+song and lyrics by\s+.+$/i, "")
    .trim();
}

function parseSpotifyDescription(description) {
  const pieces = decodeHtml(description)
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    subtitle: pieces[0] || "",
  };
}

function normalizeForMatch(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titlesLookRelated(left, right) {
  const leftValue = normalizeForMatch(left);
  const rightValue = normalizeForMatch(right);
  return leftValue === rightValue || leftValue.includes(rightValue) || rightValue.includes(leftValue);
}

async function fetchSpotifyMetadata(spotifyUrl) {
  const normalizedSpotifyUrl = normalizeSpotifyUrl(spotifyUrl);
  const response = await fetch(normalizedSpotifyUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    throw new Error("Spotify metadata fetch failed.");
  }

  const html = await response.text();
  const title = cleanSpotifyTitle(extractMetaTag(html, "title"));
  const description = extractMetaTag(html, "description");
  const imageUrl = extractMetaTag(html, "image");
  const ogType = extractMetaTag(html, "type");
  const { subtitle } = parseSpotifyDescription(description);

  return {
    title,
    subtitle,
    type: ogType === "music.album" ? "album" : ogType === "music.song" ? "single" : "release",
    imageUrl,
    spotifyUrl: normalizedSpotifyUrl,
    links: [
      {
        id: "spotify-0",
        platform: "spotify",
        label: "Spotify",
        url: normalizedSpotifyUrl,
      },
    ],
  };
}

async function searchAppleMusicRelease(title, artist, type) {
  const entity = type === "single" ? "song" : "album";
  const query = `${title} ${artist}`.trim();
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=${entity}&limit=8`
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const result = (payload.results || []).find((item) => {
    const candidateTitle = type === "single" ? item.trackName : item.collectionName;
    return (
      item.artistName &&
      titlesLookRelated(candidateTitle || "", title) &&
      normalizeForMatch(item.artistName) === normalizeForMatch(artist)
    );
  });

  if (!result) {
    return null;
  }

  return {
    id: "appleMusic-fallback",
    platform: "appleMusic",
    label: "Apple Music",
    url: result.collectionViewUrl || result.trackViewUrl || "",
  };
}

async function searchDeezerRelease(title, artist) {
  const response = await fetch(
    `https://api.deezer.com/search/album?q=${encodeURIComponent(`artist:"${artist}" album:"${title}"`)}`
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const result = (payload.data || []).find(
    (item) =>
      item.artist?.name &&
      titlesLookRelated(item.title || "", title) &&
      normalizeForMatch(item.artist.name) === normalizeForMatch(artist)
  );

  if (!result?.link) {
    return null;
  }

  return {
    id: "deezer-fallback",
    platform: "deezer",
    label: "Deezer",
    url: result.link,
  };
}

async function findFallbackLinks(release) {
  const lookups = await Promise.allSettled([
    searchAppleMusicRelease(release.title, release.subtitle, release.type),
    searchDeezerRelease(release.title, release.subtitle),
  ]);

  return dedupeLinks(
    [release.links[0], ...lookups.map((entry) => (entry.status === "fulfilled" ? entry.value : null))]
      .filter(Boolean)
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSongLinkPayload(spotifyUrl) {
  const response = await fetch(
    `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(spotifyUrl)}`
  );

  if (response.ok) {
    return response.json();
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after") || 0);
    const error = new Error("Smart-link service is rate limited.");
    error.retryAfterMs = retryAfter > 0 ? retryAfter * 1000 : 0;
    throw error;
  }

  throw new Error("Unable to resolve streaming links right now.");
}

export async function resolveReleaseFromSpotifyUrl(spotifyUrl, options = {}) {
  const normalizedSpotifyUrl = normalizeSpotifyUrl(spotifyUrl);
  const { forceRefresh = false } = options;
  const cached = await getCachedRelease(normalizedSpotifyUrl);

  if (cached && !forceRefresh) {
    return { release: cached, message: "Used the saved lookup for this Spotify URL." };
  }

  try {
    let payload = null;
    let attempt = 0;

    while (attempt < 3) {
      try {
        payload = await fetchSongLinkPayload(normalizedSpotifyUrl);
        break;
      } catch (error) {
        attempt += 1;
        const isRateLimit =
          error instanceof Error && error.message === "Smart-link service is rate limited.";

        if (!isRateLimit || attempt >= 3) {
          throw error;
        }

        const delayMs = error.retryAfterMs || attempt * 2000;
        await wait(delayMs);
      }
    }

    const entityId = payload.entityUniqueId;
    const entity = payload.entitiesByUniqueId?.[entityId] || {};
    const release = {
      title: entity.title || "",
      subtitle: entity.artistName || "",
      type: inferReleaseType(entity),
      imageUrl: entity.thumbnailUrl || "",
      spotifyUrl: normalizedSpotifyUrl,
      links: normalizePlatforms(payload.linksByPlatform),
    };

    await setCachedRelease(normalizedSpotifyUrl, release);
    return {
      release,
      message:
        attempt > 0
          ? "Release details filled after retrying the smart-link service."
          : "Release details filled from Spotify and linked platforms.",
    };
  } catch (error) {
    const fallbackRelease = await fetchSpotifyMetadata(normalizedSpotifyUrl);
    const fallbackLinks = await findFallbackLinks(fallbackRelease);

    return {
      release: {
        ...fallbackRelease,
        links: fallbackLinks,
      },
      message:
        error instanceof Error && error.message === "Smart-link service is rate limited."
          ? "The smart-link service is rate limited right now, so I filled Spotify plus any direct Apple Music and Deezer matches I could confirm."
          : "Artwork and Spotify details were filled, along with any direct Apple Music and Deezer matches I could confirm.",
    };
  }
}
