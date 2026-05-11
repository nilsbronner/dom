import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createSignedUploadUrl, CATEGORIES, type Category } from "../_lib/storage.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const { dossierId, category, filename } = req.body as {
    dossierId?: string;
    category?: string;
    filename?: string;
  };

  if (!dossierId || !category || !filename) {
    return res.status(400).json({ success: false, error: "dossierId, category, filename requis" });
  }
  if (!CATEGORIES.includes(category as Category)) {
    return res.status(400).json({ success: false, error: `category doit être l'un de : ${CATEGORIES.join(", ")}` });
  }

  try {
    const { path, token, signedUrl } = await createSignedUploadUrl(dossierId, category as Category, filename);
    res.json({ success: true, path, token, signedUrl });
  } catch (err: any) {
    console.error("sign-upload error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
