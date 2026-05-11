import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { toRow } from "../_lib/mapping.js";

export const config = {
  api: {
    bodyParser: { sizeLimit: "4mb" },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const sb = getSupabase();
  if (!sb) {
    return res.status(400).json({
      success: false,
      error: "Supabase non configuré. Ajoutez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans votre .env",
    });
  }

  const { dossiers } = req.body as { dossiers: any[] };
  if (!Array.isArray(dossiers)) {
    return res.status(400).json({ success: false, error: "Format invalide" });
  }

  try {
    const rows = dossiers.map(toRow);
    const { error } = await sb.from("dossiers").upsert(rows, { onConflict: "id" });
    if (error) throw error;
    res.json({ success: true, message: `${rows.length} dossier(s) synchronisé(s).` });
  } catch (err: any) {
    console.error("Supabase save error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
