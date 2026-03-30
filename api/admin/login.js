import { adminLoginHandler } from "../../server/handlers.js";

export default async function handler(req, res) {
  return adminLoginHandler(req, res);
}
