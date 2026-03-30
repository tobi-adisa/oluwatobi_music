import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  adminContentHandler,
  adminLoginHandler,
  adminResolveReleaseHandler,
  adminStatusHandler,
  getContentHandler,
} from "./handlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT || 5050);

const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/api/content", getContentHandler);

app.get("/api/admin/status", adminStatusHandler);

app.post("/api/admin/login", adminLoginHandler);

app.get("/api/admin/content", adminContentHandler);
app.put("/api/admin/content", adminContentHandler);
app.post("/api/admin/releases/resolve", adminResolveReleaseHandler);

app.use(express.static(distDir));

app.use((_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
