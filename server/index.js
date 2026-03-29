import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createToken, isDefaultPassword, requireAdmin, verifyPassword } from "./auth.js";
import { loadContent, saveContent } from "./contentStore.js";
import { resolveReleaseFromSpotifyUrl } from "./resolveRelease.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT || 5050);

const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/api/content", async (_req, res) => {
  const content = await loadContent();
  res.json(content);
});

app.get("/api/admin/status", (_req, res) => {
  res.json({
    defaultPassword: isDefaultPassword(),
  });
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};

  if (!verifyPassword(password)) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  res.json({ token: createToken() });
});

app.get("/api/admin/content", requireAdmin, async (_req, res) => {
  const content = await loadContent();
  res.json(content);
});

app.put("/api/admin/content", requireAdmin, async (req, res) => {
  const content = req.body;
  await saveContent(content);
  res.json({ ok: true, content });
});

app.post("/api/admin/releases/resolve", requireAdmin, async (req, res) => {
  const { spotifyUrl, forceRefresh } = req.body || {};

  if (!spotifyUrl) {
    res.status(400).json({ error: "Spotify URL is required" });
    return;
  }

  try {
    const payload = await resolveReleaseFromSpotifyUrl(spotifyUrl, {
      forceRefresh: Boolean(forceRefresh),
    });
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Lookup failed",
    });
  }
});

app.use(express.static(distDir));

app.use((_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
