// Frontend helper for Supabase Storage operations.
// All calls go through /api/storage/* — no direct Supabase client in the browser.

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
  const signData = await signRes.json();
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
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Erreur liste fichiers");
  return data.files;
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const res = await fetch(`/api/storage/sign-url?path=${encodeURIComponent(path)}&expiresIn=${expiresIn}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Erreur URL signée");
  return data.url;
}

export async function deleteFile(path: string): Promise<void> {
  const res = await fetch("/api/storage/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Erreur suppression");
}
