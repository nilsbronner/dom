import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const sb = getSupabase();
  if (!sb) return res.status(400).json({ success: false, error: "Supabase non configuré." });

  const id = req.body?.id;
  if (typeof id !== "string" || !id) {
    return res.status(400).json({ success: false, error: "ID requis dans le body" });
  }

  try {
    const { error } = await sb.from("dossiers").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error("dossier/delete error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
