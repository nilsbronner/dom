import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/clients";
import { toRow } from "../_lib/mapping";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const sb = getSupabase();
  if (!sb) return res.status(400).json({ success: false, error: "Supabase non configuré." });

  const dossier = req.body;
  if (!dossier?.id) return res.status(400).json({ success: false, error: "ID manquant" });

  try {
    const { error } = await sb.from("dossiers").upsert(toRow(dossier), { onConflict: "id" });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error("Supabase dossier/save error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
