// Source-of-truth pour les dossiers : Supabase.
// localStorage = cache offline / rendu initial instantané uniquement.
// Tous les composants qui lisent encore localStorage continuent de marcher
// car ce service y écrit après chaque mutation Supabase.

import type { DossierDomiciliation } from "../types";

const CACHE_KEY = "grub-dossiers-v1";
const LAST_SYNC_KEY = "grub-last-sync";

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
  const res = await fetch("/api/drive/load");
  const data = await res.json();
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
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Erreur sauvegarde Supabase");

  // Update cache so other components reading localStorage see fresh data
  const cache = readCache();
  const idx = cache.findIndex((d) => d.id === dossier.id);
  if (idx >= 0) cache[idx] = dossier;
  else cache.unshift(dossier);
  writeCache(cache);
}

export async function deleteDossier(id: string): Promise<void> {
  const res = await fetch(`/api/dossier/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Erreur suppression Supabase");

  writeCache(readCache().filter((d) => d.id !== id));
}

export async function saveBulk(dossiers: DossierDomiciliation[]): Promise<void> {
  const res = await fetch("/api/drive/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dossiers }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Erreur sync bulk");
  writeCache(dossiers);
}

export function getLastSync(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}
