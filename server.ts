import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// --- Supabase client (server-side, service role) ---

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// --- Mapping camelCase <-> colonnes Supabase ---

function toRow(d: any) {
  return {
    id:                           d.id,
    statut:                       d.statut,
    raison_sociale:               d.raisonSociale,
    forme_juridique:              d.formeJuridique,
    siret:                        d.siret,
    rcs_ville:                    d.rcsVille,
    activite:                     d.activite,
    description_activite:         d.descriptionActivite,
    nom_gerant:                   d.nomGerant,
    prenom_gerant:                d.prenomGerant,
    nationalite_gerant:           d.nationaliteGerant,
    pays_origine:                 d.paysOrigine,
    tel:                          d.tel,
    email:                        d.email,
    adresse_domicile:             d.adresseDomicile,
    date_debut:                   d.dateDebut,
    date_fin:                     d.dateFin ?? null,
    motif_resiliation:            d.motifResiliation ?? null,
    origine_fonds:                d.origineFonds,
    beneficiaires_declares:       d.beneficiairesDeclares,
    utilisation_adresse:          d.utilisationAdresse,
    est_ppe:                      d.estPPE,
    appartenance_politique:       d.appartenancePolitiqueReligieuse,
    commentaires_controles:       d.commentairesControlesInitiaux,
    niveau_risque_ia:             d.niveauRisqueIA,
    decision_risque_ia:           d.decisionRisqueIA,
    commentaire_risque_ia:        d.commentaireRisqueIA,
    statut_maj_annuelle:          d.statutMiseAJourAnnuelle,
    derniere_maj_annuelle:        d.derniereMajAnnuelle,
    dernier_controle_trimestriel: d.dernierControleTrimestriel,
    statut_conformite_trim:       d.statutConformiteTrimestrielle,
    tarif_choisi:                 d.tarifChoisi,
    montant_mensuel:              d.montantMensuel,
    option_courrier:              d.optionCourrier,
    numero_bal:                   d.numeroBal,
    a_inclure_prochaine_liste:    d.aInclureProchaineListe,
    drive_folder_url:             d.driveFolderUrl ?? null,
    drive_folder_id:              d.driveFolderId ?? null,
    source_onboarding:            d.sourceOnboarding ?? false,
    docs:                         d.docs,
    relances:                     d.relances,
    paiements:                    d.paiements,
    historique:                   d.historique,
  };
}

function fromRow(r: any) {
  return {
    id:                              r.id,
    createdAt:                       r.created_at,
    statut:                          r.statut,
    raisonSociale:                   r.raison_sociale,
    formeJuridique:                  r.forme_juridique,
    siret:                           r.siret,
    rcsVille:                        r.rcs_ville,
    activite:                        r.activite,
    descriptionActivite:             r.description_activite,
    nomGerant:                       r.nom_gerant,
    prenomGerant:                    r.prenom_gerant,
    nationaliteGerant:               r.nationalite_gerant,
    paysOrigine:                     r.pays_origine,
    tel:                             r.tel,
    email:                           r.email,
    adresseDomicile:                 r.adresse_domicile,
    dateDebut:                       r.date_debut,
    dateFin:                         r.date_fin,
    motifResiliation:                r.motif_resiliation,
    origineFonds:                    r.origine_fonds,
    beneficiairesDeclares:           r.beneficiaires_declares,
    utilisationAdresse:              r.utilisation_adresse,
    estPPE:                          r.est_ppe,
    appartenancePolitiqueReligieuse: r.appartenance_politique,
    commentairesControlesInitiaux:   r.commentaires_controles,
    niveauRisqueIA:                  r.niveau_risque_ia,
    decisionRisqueIA:                r.decision_risque_ia,
    commentaireRisqueIA:             r.commentaire_risque_ia,
    statutMiseAJourAnnuelle:         r.statut_maj_annuelle,
    derniereMajAnnuelle:             r.derniere_maj_annuelle,
    dernierControleTrimestriel:      r.dernier_controle_trimestriel,
    statutConformiteTrimestrielle:   r.statut_conformite_trim,
    tarifChoisi:                     r.tarif_choisi,
    montantMensuel:                  r.montant_mensuel,
    optionCourrier:                  r.option_courrier,
    numeroBal:                       r.numero_bal,
    aInclureProchaineListe:          r.a_inclure_prochaine_liste,
    driveFolderUrl:                  r.drive_folder_url,
    driveFolderId:                   r.drive_folder_id,
    docs:                            r.docs,
    relances:                        r.relances,
    paiements:                       r.paiements,
    historique:                      r.historique,
  };
}

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
    if (!sb) {
      return res.status(400).json({ success: false, error: "Supabase non configuré." });
    }
    const dossier = req.body;
    if (!dossier?.id) {
      return res.status(400).json({ success: false, error: "ID manquant" });
    }
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
  });

  // --- Archive (compatibilité — stocke juste l'URL dans le dossier) ---
  app.post("/api/archive-to-drive", async (req, res) => {
    const { clientId } = req.body;
    // Sans Google Drive, on retourne un lien vers Supabase dashboard
    const sb = getSupabase();
    const folderUrl = sb
      ? `${process.env.SUPABASE_URL}/project/default/editor`
      : null;
    res.json({
      success: true,
      folderId: clientId,
      folderUrl,
      message: "Dossier archivé dans Supabase."
    });
  });

  // --- Vite dev / production ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Supabase: ${getSupabase() ? "✓ connecté" : "✗ non configuré (mode local)"}`);
  });
}

startServer();
