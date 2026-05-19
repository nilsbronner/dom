// Frontend helper for Supabase Storage operations.
// All calls go through /api/storage/* — no direct Supabase client in the browser.

async function parseJsonResponse<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) throw new Error(`Réponse vide du serveur (HTTP ${res.status}).`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) throw new Error(`Réponse non-JSON (HTTP ${res.status}).`);
  try { return JSON.parse(text) as T; }
  catch { throw new Error(`JSON invalide (HTTP ${res.status}).`); }
}

export type Category = "kyc" | "statuts" | "contrat" | "comptable" | "suivi";

export const CATEGORY_LABEL: Record<Category, string> = {
  kyc: "01 — KYC (identité, justifs)",
  statuts: "02 — Statuts & Kbis",
  contrat: "03 — Contrat domiciliation",
  comptable: "04 — Documents comptables",
  suivi: "05 — Suivi & courriers",
};

export interface DossierFile {
  path: string;
  name: string;
  category: Category;
  size: number;
  updatedAt: string;
}

export async function uploadFile(dossierId: string, category: Category, file: File): Promise<DossierFile> {
  // 1. Request signed upload URL from our API
  const signRes = await fetch("/api/storage/sign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dossierId, category, filename: file.name }),
  });
  const signData = await parseJsonResponse(signRes);
  if (!signData.success) throw new Error(signData.error || "Erreur signature upload");

  // 2. Upload directly to Supabase Storage using the signed URL (bypasses Vercel function size limit)
  const uploadRes = await fetch(signData.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    throw new Error(`Upload Supabase échoué (${uploadRes.status}): ${text}`);
  }

  return {
    path: signData.path,
    name: file.name,
    category,
    size: file.size,
    updatedAt: new Date().toISOString(),
  };
}

export async function listFiles(dossierId: string): Promise<DossierFile[]> {
  const res = await fetch(`/api/storage/list?dossierId=${encodeURIComponent(dossierId)}`);
  const data = await parseJsonResponse(res);
  if (!data.success) throw new Error(data.error || "Erreur liste fichiers");
  return data.files;
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const res = await fetch(`/api/storage/sign-url?path=${encodeURIComponent(path)}&expiresIn=${expiresIn}`);
  const data = await parseJsonResponse(res);
  if (!data.success) throw new Error(data.error || "Erreur URL signée");
  return data.url;
}

export async function deleteFile(path: string): Promise<void> {
  const res = await fetch("/api/storage/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await parseJsonResponse(res);
  if (!data.success) throw new Error(data.error || "Erreur suppression");
}

// --- Auto-sync de la checklist docs en fonction des fichiers présents ---
// Matching simple par nom + catégorie. On ne décoche jamais (additif uniquement).

export type DocsChecklist = {
  cniGerant: boolean;
  justifDomicileGerant: boolean;
  statuts: boolean;
  kbis: boolean;
  attestationCompta: boolean;
  listeBeneficiaires: boolean;
  cniBeneficiaires: boolean;
  contratSigne: boolean;
};

export function syncDocsChecklist(files: DossierFile[], current: DocsChecklist): DocsChecklist {
  const next: DocsChecklist = { ...current };
  for (const f of files) {
    const n = f.name.toLowerCase();
    if (f.category === "kyc") {
      if (/(cni|identit)/.test(n) && /gerant|g[ée]rant/.test(n)) next.cniGerant = true;
      else if (/(cni|identit)/.test(n) && /(benefic|b[ée]n[ée]fic|\bbe\b|uo)/.test(n)) next.cniBeneficiaires = true;
      else if (/(domicile|edf|quittance|facture|justif)/.test(n)) next.justifDomicileGerant = true;
      else if (/(cni|identit)/.test(n)) next.cniGerant = true; // fallback CNI seul → gérant
    } else if (f.category === "statuts") {
      if (/kbis/.test(n)) next.kbis = true;
      else if (/statut/.test(n)) next.statuts = true;
      else if (/(benefic|b[ée]n[ée]fic|liste.?be)/.test(n)) next.listeBeneficiaires = true;
    } else if (f.category === "contrat") {
      if (/(contrat|domiciliation.?sign)/.test(n)) next.contratSigne = true;
    } else if (f.category === "comptable") {
      if (/(compta|attestation)/.test(n)) next.attestationCompta = true;
    }
  }
  return next;
}

export const REQUIRED_DOCS: Array<{ key: keyof DocsChecklist; label: string; category: Category }> = [
  { key: "cniGerant",             label: "CNI gérant",            category: "kyc" },
  { key: "justifDomicileGerant",  label: "Justif. domicile",      category: "kyc" },
  { key: "cniBeneficiaires",      label: "CNI bénéficiaires",     category: "kyc" },
  { key: "kbis",                  label: "Kbis (-3 mois)",        category: "statuts" },
  { key: "statuts",               label: "Statuts",               category: "statuts" },
  { key: "listeBeneficiaires",    label: "Liste BE",              category: "statuts" },
  { key: "contratSigne",          label: "Contrat signé",         category: "contrat" },
  { key: "attestationCompta",     label: "Attestation compta",    category: "comptable" },
];

export function docsCompleteness(docs: DocsChecklist): { provided: number; total: number; missing: string[] } {
  const missing: string[] = [];
  let provided = 0;
  for (const d of REQUIRED_DOCS) {
    if (docs[d.key]) provided++;
    else missing.push(d.label);
  }
  return { provided, total: REQUIRED_DOCS.length, missing };
}
