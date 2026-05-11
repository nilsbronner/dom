import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listDossierFiles } from "../_lib/storage.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });

  const dossierId = typeof req.query.dossierId === "string" ? req.query.dossierId : undefined;
  if (!dossierId) {
    return res.status(400).json({ success: false, error: "dossierId requis" });
  }

  try {
    const files = await listDossierFiles(dossierId);
    res.json({ success: true, files });
  } catch (err: any) {
    console.error("storage/list error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
