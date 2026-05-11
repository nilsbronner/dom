import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createSignedDownloadUrl } from "../_lib/storage.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });

  const path = typeof req.query.path === "string" ? req.query.path : undefined;
  const expiresIn = typeof req.query.expiresIn === "string" ? parseInt(req.query.expiresIn, 10) : 3600;
  if (!path) {
    return res.status(400).json({ success: false, error: "path requis" });
  }

  try {
    const url = await createSignedDownloadUrl(path, Number.isFinite(expiresIn) ? expiresIn : 3600);
    res.json({ success: true, url });
  } catch (err: any) {
    console.error("storage/sign-url error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
