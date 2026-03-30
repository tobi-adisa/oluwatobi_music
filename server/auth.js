import crypto from "node:crypto";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

function getPassword() {
  return process.env.ADMIN_PASSWORD || "change-this-password";
}

function getSecret() {
  return crypto
    .createHash("sha256")
    .update(`${getPassword()}::oluwatobi-music-site`)
    .digest("hex");
}

export function isDefaultPassword() {
  return getPassword() === "change-this-password";
}

export function verifyPassword(password) {
  return password === getPassword();
}

export function createToken() {
  const payload = {
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [body, sig] = token.split(".");
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");

  if (sig !== expected) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function requireAdmin(req, res, next) {
  if (!ensureAdmin(req, res)) {
    return;
  }

  next();
}

export function ensureAdmin(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}
