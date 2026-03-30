import { adminContentHandler } from "../../server/handlers.js";

export default async function handler(req, res) {
  return adminContentHandler(req, res);
}
