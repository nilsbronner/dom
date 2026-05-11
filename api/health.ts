import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "./_lib/clients";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const sb = getSupabase();
  res.json({ status: "ok", supabase: sb ? "configured" : "not configured" });
}
