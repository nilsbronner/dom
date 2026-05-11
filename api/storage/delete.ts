import type { VercelRequest, VercelResponse } from "@vercel/node";
import { deleteFile } from "../_lib/storage.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const path =
    (typeof req.query.path === "string" && req.query.path) ||
    (req.body && typeof req.body.path === "string" ? req.body.path : undefined);

  if (!path) {
    return res.status(400).json({ success: false, error: "path requis" });
  }

  try {
    await deleteFile(path);
    res.json({ success: true });
  } catch (err: any) {
    console.error("storage/delete error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
