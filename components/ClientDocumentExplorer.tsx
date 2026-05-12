// Explorateur de documents intégré à la fiche client.
// Compact, props-driven, utilise les mêmes endpoints que DocumentManager.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  uploadFile,
  listFiles,
  getSignedUrl,
  deleteFile,
  CATEGORY_LABEL,
  REQUIRED_DOCS,
  type Category,
  type DossierFile,
} from '../services/storageService';
import {
  Loader2, UploadCloud, File as FileIcon, CheckCircle, XCircle,
  AlertTriangle, Eye, Trash2, Download, FolderOpen
} from 'lucide-react';

const CATEGORIES: Category[] = ["kyc", "statuts", "contrat", "comptable", "suivi"];

interface Props {
  dossierId: string;
  raisonSociale: string;
  onFilesChange?: (files: DossierFile[]) => void;
}

type UploadState = { file: File; category: Category; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string };

const ClientDocumentExplorer: React.FC<Props> = ({ dossierId, raisonSociale, onFilesChange }) => {
  const [category, setCategory] = useState<Category>("kyc");
  const [queue, setQueue] = useState<UploadState[]>([]);
  const [storedFiles, setStoredFiles] = useState<DossierFile[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!dossierId) return;
    setLoadingList(true);
    try {
      const files = await listFiles(dossierId);
      setStoredFiles(files);
      onFilesChange?.(files);
    } catch (err: any) {
      console.error("Erreur listing fichiers:", err.message);
      setStoredFiles([]);
    } finally {
      setLoadingList(false);
    }
  }, [dossierId, onFilesChange]);

  useEffect(() => { refresh(); }, [refresh]);

  const enqueue = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).map((file) => ({ file, category, status: 'pending' as const }));
    setQueue((prev) => [...prev, ...arr]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) enqueue(e.target.files);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) enqueue(e.dataTransfer.files);
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const removeFromQueue = (idx: number) => setQueue((prev) => prev.filter((_, i) => i !== idx));

  const handleUploadAll = async () => {
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === 'done') continue;
      setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: 'uploading' } : q)));
      try {
        await uploadFile(dossierId, queue[i].category, queue[i].file);
        setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: 'done' } : q)));
      } catch (err: any) {
        setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: 'error', error: err.message } : q)));
      }
    }
    await refresh();
  };

  const handlePreview = async (path: string, name: string) => {
    try {
      const url = await getSignedUrl(path, 3600);
      setPreviewUrl(url);
      setPreviewName(name);
    } catch (err: any) {
      alert("Erreur preview : " + err.message);
    }
  };

  const handleDelete = async (path: string, name: string) => {
    if (!confirm(`Supprimer définitivement « ${name} » ?`)) return;
    try {
      await deleteFile(path);
      await refresh();
    } catch (err: any) {
      alert("Erreur suppression : " + err.message);
    }
  };

  const filesByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = storedFiles.filter((f) => f.category === cat);
    return acc;
  }, {} as Record<Category, DossierFile[]>);

  const missingByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = REQUIRED_DOCS.filter((d) => d.category === cat).map((d) => d.label);
    return acc;
  }, {} as Record<Category, string[]>);

  const formatSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
  const fileTypeIsImage = (name: string) => /\.(jpe?g|png|gif|webp|bmp)$/i.test(name);
  const fileTypeIsPdf = (name: string) => /\.pdf$/i.test(name);

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      <div className="bg-brand-dark border border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <UploadCloud className="w-4 h-4 text-brand-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Déposer un fichier</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-stretch">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="rounded-md border-slate-700 bg-brand-light text-white border p-2 text-sm focus:border-brand-primary"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-bold px-4 py-2 rounded-md border border-slate-700"
          >
            <FileIcon className="w-4 h-4" />
            Choisir fichiers
          </button>
        </div>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 border-2 border-dashed border-slate-700 rounded-lg p-4 text-center cursor-pointer hover:bg-slate-800/40 transition text-xs text-slate-400"
        >
          <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
          Ou glissez-déposez ici · Max 50 MB / fichier
        </div>

        {queue.length > 0 && (
          <div className="mt-3 space-y-2">
            {queue.map((q, idx) => (
              <div key={idx} className="flex justify-between items-center bg-brand-light p-2 rounded-md border border-slate-700 text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-100 truncate">{q.file.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {CATEGORY_LABEL[q.category].split(' — ')[1]} · {formatSize(q.file.size)}
                    </p>
                    {q.error && <p className="text-[10px] text-rose-400">{q.error}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {q.status === 'uploading' && <Loader2 className="w-3.5 h-3.5 text-brand-primary animate-spin" />}
                  {q.status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                  {q.status === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                  {q.status === 'pending' && (
                    <button onClick={() => removeFromQueue(idx)} className="text-slate-400 hover:text-rose-400">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={handleUploadAll}
              disabled={queue.every((q) => q.status === 'done' || q.status === 'uploading')}
              className="w-full flex items-center justify-center gap-2 bg-brand-primary text-brand-dark font-bold px-4 py-2 rounded-md text-sm hover:bg-brand-primary/90 transition disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              Uploader ({queue.filter((q) => q.status !== 'done').length})
            </button>
          </div>
        )}
      </div>

      {/* Stored files grouped by category */}
      <div className="bg-brand-dark border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-brand-primary" />
            Documents stockés ({storedFiles.length})
          </span>
          {raisonSociale && <span className="text-[10px] text-slate-500 truncate max-w-[180px]">{raisonSociale}</span>}
        </div>

        {loadingList ? (
          <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </div>
        ) : storedFiles.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-400">Aucun document. Dépose les pièces ci-dessus.</p>
        ) : (
          <div className="space-y-4">
            {CATEGORIES.map((cat) => (
              <div key={cat}>
                <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-1.5">
                  {CATEGORY_LABEL[cat]} ({filesByCategory[cat].length})
                </h4>
                {filesByCategory[cat].length === 0 ? (
                  missingByCategory[cat].length > 0 ? (
                    <div className="text-[10px] text-amber-400/80 italic pl-2 py-1">
                      Attendu : {missingByCategory[cat].join(', ')}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 italic pl-2 py-1">(vide)</div>
                  )
                ) : (
                  <ul className="space-y-1">
                    {filesByCategory[cat].map((f) => (
                      <li key={f.path} className="flex justify-between items-center bg-brand-light p-2 rounded-md border border-slate-700">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-100 truncate">{f.name}</p>
                            <p className="text-[10px] text-slate-400">{formatSize(f.size)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 ml-2">
                          <button
                            onClick={() => handlePreview(f.path, f.name)}
                            className="p-1 text-slate-400 hover:text-brand-primary"
                            title="Aperçu"
                          ><Eye className="w-3.5 h-3.5" /></button>
                          <button
                            onClick={() => handleDelete(f.path, f.name)}
                            className="p-1 text-slate-400 hover:text-rose-400"
                            title="Supprimer"
                          ><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-brand-light rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-slate-700 flex justify-between items-center">
              <p className="text-sm font-medium text-white truncate">{previewName}</p>
              <div className="flex gap-2">
                <a href={previewUrl} download={previewName} className="p-1.5 text-slate-400 hover:text-brand-primary" title="Télécharger">
                  <Download className="w-4 h-4" />
                </a>
                <button onClick={() => setPreviewUrl(null)} className="p-1.5 text-slate-400 hover:text-white">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-brand-dark">
              {fileTypeIsPdf(previewName) ? (
                <iframe src={previewUrl} className="w-full h-[80vh]" title={previewName} />
              ) : fileTypeIsImage(previewName) ? (
                <img src={previewUrl} alt={previewName} className="max-w-full mx-auto" />
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <p>Aperçu non disponible pour ce type.</p>
                  <a href={previewUrl} download={previewName} className="text-brand-primary underline mt-2 inline-block">Télécharger</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDocumentExplorer;
