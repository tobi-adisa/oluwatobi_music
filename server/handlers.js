import { createToken, ensureAdmin, isDefaultPassword, verifyPassword } from "./auth.js";
import { loadContent, saveContent } from "./contentStore.js";
import { resolveReleaseFromSpotifyUrl } from "./resolveRelease.js";

function methodNotAllowed(res, methods) {
  res.setHeader("Allow", methods.join(", "));
  res.status(405).json({ error: "Method not allowed" });
}

export async function getContentHandler(_req, res) {
  const content = await loadContent();
  res.status(200).json(content);
}

export function adminStatusHandler(_req, res) {
  res.status(200).json({
    defaultPassword: isDefaultPassword(),
    blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  });
}

export function adminLoginHandler(req, res) {
  const { password } = req.body || {};

  if (!verifyPassword(password)) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  res.status(200).json({ token: createToken() });
}

export async function adminContentHandler(req, res) {
  if (!ensureAdmin(req, res)) {
    return;
  }

  if (req.method === "GET") {
    const content = await loadContent();
    res.status(200).json(content);
    return;
  }

  if (req.method === "PUT") {
    const saved = await saveContent(req.body || {});
    res.status(200).json({ ok: true, content: saved });
    return;
  }

  methodNotAllowed(res, ["GET", "PUT"]);
}

export async function adminResolveReleaseHandler(req, res) {
  if (!ensureAdmin(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  const { spotifyUrl, forceRefresh } = req.body || {};

  if (!spotifyUrl) {
    res.status(400).json({ error: "Spotify URL is required" });
    return;
  }

  try {
    const payload = await resolveReleaseFromSpotifyUrl(spotifyUrl, {
      forceRefresh: Boolean(forceRefresh),
    });
    res.status(200).json(payload);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Lookup failed",
    });
  }
}
