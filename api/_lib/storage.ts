import { getSupabase } from "./supabase.js";

export const BUCKET = "client-docs";

export type Category = "kyc" | "statuts" | "contrat" | "comptable" | "suivi";
export const CATEGORIES: Category[] = ["kyc", "statuts", "contrat", "comptable", "suivi"];

function client() {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase non configuré");
  return sb;
}

export function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

export function buildPath(dossierId: string, category: Category, filename: string): string {
  return `${dossierId}/${category}/${safeFilename(filename)}`;
}

export async function createSignedUploadUrl(dossierId: string, category: Category, filename: string) {
  const path = buildPath(dossierId, category, filename);
  const { data, error } = await client().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { path, token: data.token, signedUrl: data.signedUrl };
}

export async function listDossierFiles(dossierId: string) {
  const sb = client();
  const all: { path: string; name: string; category: Category; size: number; updatedAt: string }[] = [];
  for (const category of CATEGORIES) {
    const { data, error } = await sb.storage.from(BUCKET).list(`${dossierId}/${category}`, {
      limit: 100,
      sortBy: { column: "updated_at", order: "desc" },
    });
    if (error) continue;
    for (const f of data ?? []) {
      if (f.name === ".emptyFolderPlaceholder") continue;
      all.push({
        path: `${dossierId}/${category}/${f.name}`,
        name: f.name,
        category,
        size: (f.metadata as any)?.size ?? 0,
        updatedAt: f.updated_at ?? f.created_at ?? "",
      });
    }
  }
  return all;
}

export async function createSignedDownloadUrl(path: string, expiresInSeconds = 3600) {
  const { data, error } = await client().storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteFile(path: string) {
  const { error } = await client().storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
