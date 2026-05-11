// Local development server only.
// In production (Vercel), each /api/*.ts file is a serverless function.
// This Express server replays the same routes locally for `npm run dev`.

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { getSupabase, getDriveClient } from "./api/_lib/clients";
import { toRow, fromRow } from "./api/_lib/mapping";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // --- Health ---
  app.get("/api/health", (_req, res) => {
    const sb = getSupabase();
    res.json({ status: "ok", supabase: sb ? "configured" : "not configured" });
  });

  // --- Charger tous les dossiers ---
  app.get("/api/drive/load", async (_req, res) => {
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
  });

  // --- Sauvegarder tous les dossiers (upsert) ---
  app.post("/api/drive/save", async (req, res) => {
    const sb = getSupabase();
    if (!sb) {
      return res.status(400).json({ success: false, error: "Supabase non configuré. Ajoutez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans votre .env" });
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
  });

  // --- Sauvegarder un dossier unique ---
  app.post("/api/dossier/save", async (req, res) => {
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
  });

  // --- Supprimer un dossier ---
  app.delete("/api/dossier/:id", async (req, res) => {
    const sb = getSupabase();
    if (!sb) return res.status(400).json({ success: false, error: "Supabase non configuré." });
    try {
      const { error } = await sb.from("dossiers").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Formulaire client public (onboarding) ---
  app.post("/api/onboarding/submit", async (req, res) => {
    const dossier = req.body;
    if (!dossier?.raisonSociale) return res.status(400).json({ success: false, error: "Données invalides" });
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
  });

  // --- Archive vers Google Drive ---
  app.post("/api/archive-to-drive", async (req, res) => {
    const { clientName, clientData } = req.body;
    const drive = getDriveClient();
    if (!drive) {
      return res.status(400).json({ success: false, error: "Google Drive non configuré." });
    }
    try {
      const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "1KPPA5zcvLFVPdvPFDaHkJgVfAePVLGMj";
      const folder = await drive.files.create({
        requestBody: { name: `CLIENT - ${clientName}`, mimeType: "application/vnd.google-apps.folder", parents: [parentFolderId] },
        fields: "id, webViewLink",
      });
      const folderId = folder.data.id!;
      const folderUrl = folder.data.webViewLink!;
      await drive.files.create({
        requestBody: { name: "RESUME_CLIENT.json", parents: [folderId] },
        media: { mimeType: "application/json", body: JSON.stringify(clientData, null, 2) },
        fields: "id",
      });
      res.json({ success: true, folderId, folderUrl, message: `Dossier Drive créé pour ${clientName}` });
    } catch (error: any) {
      console.error("Drive Archive Error:", error.message);
      const msg = error.message?.includes("insufficientPermissions") || error.message?.includes("403")
        ? `Partagez le dossier Drive avec : ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`
        : error.message;
      res.status(500).json({ success: false, error: msg });
    }
  });

  // --- Vite dev middleware ---
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Local dev server: http://localhost:${PORT}`);
    console.log(`Supabase: ${getSupabase() ? "✓ connecté" : "✗ non configuré"}`);
    console.log(`Drive:    ${getDriveClient() ? "✓ connecté" : "✗ non configuré"}`);
  });
}

startServer();
