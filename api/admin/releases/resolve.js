import { adminResolveReleaseHandler } from "../../../server/handlers.js";

export default async function handler(req, res) {
  return adminResolveReleaseHandler(req, res);
}
