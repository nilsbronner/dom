import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { fromRow } from "../_lib/mapping.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });

  const sb = getSupabase();
  if (!sb) {
    return res.json({ success: true, dossiers: [], message: "Supabase non configuré — données locales uniquement." });
  }

  try {
    const { data, error } = await sb
      .from("dossiers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, dossiers: (data ?? []).map(fromRow), lastSync: new Date().toISOString() });
  } catch (err: any) {
    console.error("Supabase load error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
