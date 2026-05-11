import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/clients";
import { toRow } from "../_lib/mapping";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const dossier = req.body;
  if (!dossier?.raisonSociale) {
    return res.status(400).json({ success: false, error: "Données invalides" });
  }

  const sb = getSupabase();
  if (!sb) {
    console.log("[ONBOARDING] Nouveau dossier reçu (Supabase non configuré):", dossier.raisonSociale);
    return res.json({ success: true, message: "Dossier reçu. Configurez Supabase pour le sauvegarder automatiquement." });
  }

  try {
    const row = toRow({ ...dossier, source_onboarding: true });
    const { error } = await sb.from("dossiers").upsert(row, { onConflict: "id" });
    if (error) throw error;
    res.json({ success: true, message: "Dossier transmis avec succès." });
  } catch (err: any) {
    console.error("Onboarding error:", err.message);
    res.status(500).json({ success: false, error: "Erreur lors de la sauvegarde du dossier." });
  }
}
