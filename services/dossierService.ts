// Source-of-truth pour les dossiers : Supabase.
// localStorage = cache offline / rendu initial instantané uniquement.
// Tous les composants qui lisent encore localStorage continuent de marcher
// car ce service y écrit après chaque mutation Supabase.

import type { DossierDomiciliation } from "../types";

const CACHE_KEY = "grub-dossiers-v1";
const LAST_SYNC_KEY = "grub-last-sync";

// Parse JSON safely — handles empty body, HTML error pages, deploy-time race conditions.
async function parseJsonResponse<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Réponse vide du serveur (HTTP ${res.status}). Réessaie dans quelques secondes.`);
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) {
    throw new Error(`Le serveur a renvoyé du non-JSON (HTTP ${res.status}). Probablement un redéploiement en cours.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`JSON invalide reçu du serveur (HTTP ${res.status}).`);
  }
}

function readCache(): DossierDomiciliation[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as DossierDomiciliation[]) : [];
  } catch {
    return [];
  }
}

function writeCache(dossiers: DossierDomiciliation[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(dossiers));
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {
    // Ignore quota errors — cache is best-effort
  }
}

export function loadCached(): DossierDomiciliation[] {
  return readCache();
}

export async function loadAll(): Promise<{ dossiers: DossierDomiciliation[]; lastSync?: string }> {
  const res = await fetch("/api/dossiers/list");
  const data = await parseJsonResponse(res);
  if (!data.success) throw new Error(data.error || "Erreur chargement Supabase");
  const dossiers: DossierDomiciliation[] = data.dossiers ?? [];
  writeCache(dossiers);
  return { dossiers, lastSync: data.lastSync };
}

export async function saveDossier(dossier: DossierDomiciliation): Promise<void> {
  const res = await fetch("/api/dossier/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dossier),
  });
  const data = await parseJsonResponse(res);
  if (!data.success) throw new Error(data.error || "Erreur sauvegarde Supabase");

  // Update cache so other components reading localStorage see fresh data
  const cache = readCache();
  const idx = cache.findIndex((d) => d.id === dossier.id);
  if (idx >= 0) cache[idx] = dossier;
  else cache.unshift(dossier);
  writeCache(cache);
}

export async function deleteDossier(id: string): Promise<void> {
  const res = await fetch("/api/dossiers/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const data = await parseJsonResponse(res);
  if (!data.success) throw new Error(data.error || "Erreur suppression Supabase");

  writeCache(readCache().filter((d) => d.id !== id));
}

export async function saveBulk(dossiers: DossierDomiciliation[]): Promise<void> {
  const res = await fetch("/api/dossiers/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dossiers }),
  });
  const data = await parseJsonResponse(res);
  if (!data.success) throw new Error(data.error || "Erreur sync bulk");
  writeCache(dossiers);
}

export function getLastSync(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}
