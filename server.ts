// Local development server only.
// In production (Vercel), each /api/*.ts file is a serverless function.
// This Express server replays the same routes locally for `npm run dev`.

import express from "express";
import { createServer as createViteServer } from "vite";
import { getSupabase } from "./api/_lib/supabase.js";
import { toRow, fromRow } from "./api/_lib/mapping.js";
import {
  createSignedUploadUrl,
  listDossierFiles,
  createSignedDownloadUrl,
  deleteFile,
  CATEGORIES,
  type Category,
} from "./api/_lib/storage.js";

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
    if (!sb) return res.json({ success: true, dossiers: [], message: "Supabase non configuré." });
    try {
      const { data, error } = await sb.from("dossiers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      res.json({ success: true, dossiers: (data ?? []).map(fromRow), lastSync: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Sauvegarder tous les dossiers (upsert) ---
  app.post("/api/drive/save", async (req, res) => {
    const sb = getSupabase();
    if (!sb) return res.status(400).json({ success: false, error: "Supabase non configuré." });
    const { dossiers } = req.body as { dossiers: any[] };
    if (!Array.isArray(dossiers)) return res.status(400).json({ success: false, error: "Format invalide" });
    try {
      const { error } = await sb.from("dossiers").upsert(dossiers.map(toRow), { onConflict: "id" });
      if (error) throw error;
      res.json({ success: true, message: `${dossiers.length} dossier(s) synchronisé(s).` });
    } catch (err: any) {
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

  // --- Onboarding public ---
  app.post("/api/onboarding/submit", async (req, res) => {
    const dossier = req.body;
    if (!dossier?.raisonSociale) return res.status(400).json({ success: false, error: "Données invalides" });
    const sb = getSupabase();
    if (!sb) return res.json({ success: true, message: "Dossier reçu (Supabase non configuré)." });
    try {
      const { error } = await sb.from("dossiers").upsert(toRow({ ...dossier, source_onboarding: true }), { onConflict: "id" });
      if (error) throw error;
      res.json({ success: true, message: "Dossier transmis avec succès." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: "Erreur lors de la sauvegarde du dossier." });
    }
  });

  // --- Storage : signed upload URL ---
  app.post("/api/storage/sign-upload", async (req, res) => {
    const { dossierId, category, filename } = req.body as { dossierId?: string; category?: string; filename?: string };
    if (!dossierId || !category || !filename) return res.status(400).json({ success: false, error: "dossierId, category, filename requis" });
    if (!CATEGORIES.includes(category as Category)) return res.status(400).json({ success: false, error: `category invalide` });
    try {
      const out = await createSignedUploadUrl(dossierId, category as Category, filename);
      res.json({ success: true, ...out });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Storage : list ---
  app.get("/api/storage/list", async (req, res) => {
    const dossierId = typeof req.query.dossierId === "string" ? req.query.dossierId : undefined;
    if (!dossierId) return res.status(400).json({ success: false, error: "dossierId requis" });
    try {
      const files = await listDossierFiles(dossierId);
      res.json({ success: true, files });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Storage : signed download URL ---
  app.get("/api/storage/sign-url", async (req, res) => {
    const path = typeof req.query.path === "string" ? req.query.path : undefined;
    const expiresIn = typeof req.query.expiresIn === "string" ? parseInt(req.query.expiresIn, 10) : 3600;
    if (!path) return res.status(400).json({ success: false, error: "path requis" });
    try {
      const url = await createSignedDownloadUrl(path, Number.isFinite(expiresIn) ? expiresIn : 3600);
      res.json({ success: true, url });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Storage : delete ---
  app.post("/api/storage/delete", async (req, res) => {
    const path = req.body?.path;
    if (!path) return res.status(400).json({ success: false, error: "path requis" });
    try {
      await deleteFile(path);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Vite dev middleware ---
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Local dev server: http://localhost:${PORT}`);
    console.log(`Supabase: ${getSupabase() ? "✓" : "✗"}`);
  });
}

startServer();
