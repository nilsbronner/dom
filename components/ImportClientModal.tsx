// Modal : import d'un client depuis un dossier sur disque.
// Folder picker → preview → upload séquentiel vers Supabase Storage.

import React, { useState, useRef, useMemo } from 'react';
import {
  X, FolderOpen, Upload, Loader2, CheckCircle, AlertTriangle, File as FileIcon, XCircle
} from 'lucide-react';
import { CATEGORY_LABEL, type Category } from '../services/storageService';

// Catégorisation automatique d'un fichier d'après son nom
function inferCategory(filename: string): Category {
  const n = filename.toLowerCase();
  if (/(cni|identit|domicile|edf|quittance|facture|justif)/.test(n)) return "kyc";
  if (/(kbis|statut|benefic|b[ée]n[ée]fic|liste.?be)/.test(n)) return "statuts";
  if (/(contrat|domiciliation.?sign)/.test(n)) return "contrat";
  if (/(compta|attestation)/.test(n)) return "comptable";
  return "suivi";
}

const CATEGORIES: Category[] = ["kyc", "statuts", "contrat", "comptable", "suivi"];

interface PickedFile {
  file: File;
  category: Category;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (raisonSociale: string, files: { file: File; category: Category }[]) => Promise<void>;
}

const ImportClientModal: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  const [raisonSociale, setRaisonSociale] = useState('');
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFolderPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Detect parent folder name from webkitRelativePath (e.g. "SAS DUPONT/cni.pdf")
    const first = files[0] as any;
    const relPath = first.webkitRelativePath || '';
    const folderName = relPath.split('/')[0] || '';
    if (folderName && !raisonSociale) setRaisonSociale(folderName);

    // Build picked list — flatten, infer category per file
    const arr: PickedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      arr.push({ file: f, category: inferCategory(f.name), status: 'pending' });
    }
    setPicked(arr);
    setError(null);
  };

  const updateCategory = (idx: number, cat: Category) => {
    setPicked((prev) => prev.map((p, i) => (i === idx ? { ...p, category: cat } : p)));
  };

  const removeFile = (idx: number) => {
    setPicked((prev) => prev.filter((_, i) => i !== idx));
  };

  const summary = useMemo(() => {
    const counts = CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: 0 }), {} as Record<Category, number>);
    picked.forEach((p) => { counts[p.category]++; });
    return counts;
  }, [picked]);

  const reset = () => {
    setRaisonSociale('');
    setPicked([]);
    setError(null);
    setImporting(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!raisonSociale.trim()) {
      setError("Renseigne la raison sociale.");
      return;
    }
    if (picked.length === 0) {
      setError("Pas de fichiers à importer.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      await onConfirm(
        raisonSociale.trim(),
        picked.map((p) => ({ file: p.file, category: p.category }))
      );
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  const handleCancel = () => {
    if (importing) return;
    reset();
    onClose();
  };

  if (!isOpen) return null;

  const totalSize = picked.reduce((s, p) => s + p.file.size, 0);
  const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-dark/90 backdrop-blur-sm">
      <div className="bg-brand-light border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-brand-primary" />
            <h2 className="text-lg font-black text-white">Importer un client depuis un dossier</h2>
          </div>
          <button onClick={handleCancel} disabled={importing} className="p-2 hover:bg-slate-800 rounded-lg transition disabled:opacity-50">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Step 1: folder pick */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">
              1. Sélectionner le dossier du client
            </label>
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={handleFolderPick}
              className="hidden"
              {...({ webkitdirectory: '', directory: '' } as any)}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={importing}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-bold px-4 py-3 rounded-lg border border-slate-700 transition disabled:opacity-50"
            >
              <FolderOpen className="w-4 h-4" />
              {picked.length === 0 ? 'Choisir un dossier' : `Changer de dossier (${picked.length} fichier${picked.length > 1 ? 's' : ''})`}
            </button>
            <p className="text-[10px] text-slate-500 mt-1.5 italic">
              Astuce : nomme le dossier comme la raison sociale du client — il sera pré-rempli automatiquement.
            </p>
          </div>

          {/* Step 2: client info */}
          {picked.length > 0 && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">
                  2. Raison sociale
                </label>
                <input
                  type="text"
                  value={raisonSociale}
                  onChange={(e) => setRaisonSociale(e.target.value)}
                  placeholder="SAS Exemple Consulting"
                  disabled={importing}
                  className="w-full bg-brand-dark border border-slate-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 disabled:opacity-50"
                />
              </div>

              {/* Step 3: file list with categories */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                    3. Fichiers détectés ({picked.length}) · {fmtSize(totalSize)}
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {CATEGORIES.filter((c) => summary[c] > 0).map((c) => `${summary[c]} ${c}`).join(' · ')}
                  </span>
                </div>
                <ul className="space-y-1.5 max-h-72 overflow-y-auto bg-brand-dark border border-slate-700 rounded-lg p-2">
                  {picked.map((p, idx) => (
                    <li key={idx} className="flex items-center gap-2 bg-brand-light p-2 rounded border border-slate-700">
                      <FileIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-100 truncate">{p.file.name}</p>
                        <p className="text-[10px] text-slate-400">{fmtSize(p.file.size)}</p>
                      </div>
                      <select
                        value={p.category}
                        onChange={(e) => updateCategory(idx, e.target.value as Category)}
                        disabled={importing || p.status !== 'pending'}
                        className="bg-brand-dark border border-slate-700 text-white text-[10px] px-2 py-1 rounded disabled:opacity-50"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{CATEGORY_LABEL[c].split(' — ')[1]}</option>
                        ))}
                      </select>
                      <div className="w-5 flex justify-center">
                        {p.status === 'uploading' && <Loader2 className="w-3.5 h-3.5 text-brand-primary animate-spin" />}
                        {p.status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                        {p.status === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                        {p.status === 'pending' && !importing && (
                          <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-rose-400">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={importing}
            className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg text-sm font-bold hover:bg-slate-700 transition disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleImport}
            disabled={importing || picked.length === 0 || !raisonSociale.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-brand-primary text-brand-dark rounded-lg text-sm font-black hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'Import en cours…' : `Lancer l'import (${picked.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportClientModal;
