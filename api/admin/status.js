import { adminStatusHandler } from "../../server/handlers.js";

export default async function handler(req, res) {
  return adminStatusHandler(req, res);
}
