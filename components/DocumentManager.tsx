import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DocumentAnalysisResult, DossierDomiciliation } from '../types';
import { analyzeDocumentCompleteness } from '../services/geminiService';
import {
  uploadFile,
  listFiles,
  getSignedUrl,
  deleteFile,
  CATEGORY_LABEL,
  type Category,
  type DossierFile,
} from '../services/storageService';
import {
  Loader2, FolderOpen, UploadCloud, File as FileIcon, CheckCircle, XCircle,
  AlertTriangle, Search, Eye, Trash2, Download
} from 'lucide-react';
import ClientSelector from './ClientSelector';

type UploadState = { file: File; category: Category; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string };

const CATEGORIES: Category[] = ["kyc", "statuts", "contrat", "comptable", "suivi"];

const DocumentManager: React.FC = () => {
  const [dossiers, setDossiers] = useState<DossierDomiciliation[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [category, setCategory] = useState<Category>("kyc");
  const [queue, setQueue] = useState<UploadState[]>([]);
  const [storedFiles, setStoredFiles] = useState<DossierFile[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DocumentAnalysisResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load clients list (still uses localStorage cache for now — separate concern)
  useEffect(() => {
    const saved = localStorage.getItem('grub-dossiers-v1');
    if (saved) setDossiers(JSON.parse(saved));
  }, []);

  const refreshStoredFiles = useCallback(async (dossierId: string) => {
    setLoadingList(true);
    try {
      const files = await listFiles(dossierId);
      setStoredFiles(files);
    } catch (err: any) {
      console.error("Erreur listing fichiers:", err.message);
      setStoredFiles([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClientId) refreshStoredFiles(selectedClientId);
    else setStoredFiles([]);
  }, [selectedClientId, refreshStoredFiles]);

  const handleSelectClient = (dossier: DossierDomiciliation) => {
    setSelectedClientId(dossier.id);
    setQueue([]);
    setAnalysisResult(null);
  };

  const enqueueFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).map((file) => ({ file, category, status: 'pending' as const }));
    setQueue((prev) => [...prev, ...arr]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) enqueueFiles(e.target.files);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) enqueueFiles(e.dataTransfer.files);
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const removeFromQueue = (idx: number) => setQueue((prev) => prev.filter((_, i) => i !== idx));

  const handleUploadAll = async () => {
    if (!selectedClientId || queue.length === 0) return;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === 'done') continue;
      setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: 'uploading' } : q)));
      try {
        await uploadFile(selectedClientId, queue[i].category, queue[i].file);
        setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: 'done' } : q)));
      } catch (err: any) {
        setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: 'error', error: err.message } : q)));
      }
    }
    await refreshStoredFiles(selectedClientId);
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
      if (selectedClientId) await refreshStoredFiles(selectedClientId);
    } catch (err: any) {
      alert("Erreur suppression : " + err.message);
    }
  };

  const handleAnalyzeCompleteness = async () => {
    if (!selectedClientId || storedFiles.length === 0) return;
    const dossier = dossiers.find((d) => d.id === selectedClientId);
    if (!dossier) return;
    setAnalyzing(true);
    try {
      const data = await analyzeDocumentCompleteness({
        legalForm: dossier.formeJuridique || 'SAS',
        fileNames: storedFiles.map((f) => f.name),
      });
      setAnalysisResult(data);
    } catch {
      alert("Erreur lors de l'analyse Gemini.");
    } finally {
      setAnalyzing(false);
    }
  };

  const filesByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = storedFiles.filter((f) => f.category === cat);
    return acc;
  }, {} as Record<Category, DossierFile[]>);

  const selectedClient = dossiers.find((d) => d.id === selectedClientId);
  const fileTypeIsImage = (name: string) => /\.(jpe?g|png|gif|webp|bmp)$/i.test(name);
  const fileTypeIsPdf = (name: string) => /\.pdf$/i.test(name);
  const formatSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-brand-primary" />
          Gestion documentaire — Supabase Storage
        </h2>

        <ClientSelector dossiers={dossiers} onSelect={handleSelectClient} selectedId={selectedClientId} label="Client" />

        {selectedClient && (
          <p className="text-xs text-slate-400 mt-2">
            Client : <span className="text-white font-medium">{selectedClient.raisonSociale}</span> · {selectedClient.formeJuridique || '—'}
          </p>
        )}
      </div>

      {selectedClientId && (
        <>
          {/* Upload */}
          <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 p-6">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-brand-primary" />
              Déposer des fichiers
            </h3>

            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm focus:border-brand-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-brand-dark transition"
            >
              <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
              <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-200">Glissez-déposez ou cliquez</p>
              <p className="text-xs text-slate-400 mt-1">Max 50 MB par fichier · PDF, JPG, PNG</p>
            </div>

            {queue.length > 0 && (
              <div className="mt-4 space-y-2">
                {queue.map((q, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-brand-dark p-2.5 rounded-lg border border-slate-700 text-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-100 truncate">{q.file.name}</p>
                        <p className="text-xs text-slate-400">
                          {CATEGORY_LABEL[q.category].split(' — ')[1]} · {formatSize(q.file.size)}
                        </p>
                        {q.error && <p className="text-xs text-rose-400 mt-0.5">{q.error}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {q.status === 'uploading' && <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />}
                      {q.status === 'done' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                      {q.status === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                      {q.status === 'pending' && (
                        <button onClick={() => removeFromQueue(idx)} className="text-slate-400 hover:text-rose-400">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleUploadAll}
                  disabled={queue.every((q) => q.status === 'done' || q.status === 'uploading')}
                  className="w-full flex items-center justify-center gap-2 bg-brand-primary text-brand-dark font-bold px-4 py-2 rounded-lg hover:bg-brand-primary/90 transition disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  Lancer l'upload ({queue.filter((q) => q.status !== 'done').length})
                </button>
              </div>
            )}
          </div>

          {/* Stored files */}
          <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white">
                Documents stockés ({storedFiles.length})
              </h3>
              <div className="flex gap-2">
                {storedFiles.length > 0 && (
                  <button
                    onClick={handleAnalyzeCompleteness}
                    disabled={analyzing}
                    className="flex items-center gap-2 bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-slate-600 transition disabled:opacity-50"
                  >
                    {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    Analyser conformité (Gemini)
                  </button>
                )}
              </div>
            </div>

            {loadingList ? (
              <div className="text-center py-8 text-slate-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
              </div>
            ) : storedFiles.length === 0 ? (
              <p className="text-center py-8 text-sm text-slate-400">Aucun document stocké pour ce client.</p>
            ) : (
              <div className="space-y-4">
                {CATEGORIES.map((cat) => filesByCategory[cat].length > 0 && (
                  <div key={cat}>
                    <h4 className="text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">
                      {CATEGORY_LABEL[cat]} ({filesByCategory[cat].length})
                    </h4>
                    <ul className="space-y-1.5">
                      {filesByCategory[cat].map((f) => (
                        <li key={f.path} className="flex justify-between items-center bg-brand-dark p-2.5 rounded-lg border border-slate-700">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <FileIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-slate-100 truncate">{f.name}</p>
                              <p className="text-xs text-slate-400">{formatSize(f.size)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => handlePreview(f.path, f.name)}
                              className="p-1.5 text-slate-400 hover:text-brand-primary transition"
                              title="Aperçu"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(f.path, f.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 transition"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analysis result */}
          {analysisResult && (
            <div className="bg-brand-light rounded-xl shadow-lg border border-slate-700 overflow-hidden">
              <div className={`p-4 border-b ${
                analysisResult.complianceStatus === 'Conforme' ? 'bg-emerald-500/10 border-emerald-500/20'
                : analysisResult.complianceStatus === 'Incomplet' ? 'bg-rose-500/10 border-rose-500/20'
                : 'bg-amber-500/10 border-amber-500/20'
              }`}>
                <h3 className={`text-lg font-bold flex items-center gap-2 ${
                  analysisResult.complianceStatus === 'Conforme' ? 'text-emerald-400'
                  : analysisResult.complianceStatus === 'Incomplet' ? 'text-rose-400' : 'text-amber-400'
                }`}>
                  {analysisResult.complianceStatus === 'Conforme' && <CheckCircle className="w-5 h-5" />}
                  {analysisResult.complianceStatus === 'Incomplet' && <XCircle className="w-5 h-5" />}
                  {analysisResult.complianceStatus === 'A vérifier' && <AlertTriangle className="w-5 h-5" />}
                  Dossier {analysisResult.complianceStatus}
                </h3>
                <p className="text-xs mt-1 text-slate-200">{analysisResult.globalComment}</p>
              </div>
              {analysisResult.missingDocuments.length > 0 && (
                <div className="p-4">
                  <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-3">Manquants</h4>
                  <ul className="space-y-2">
                    {analysisResult.missingDocuments.map((doc, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-rose-300 bg-rose-500/10 p-2 rounded">
                        <XCircle className="w-3 h-3 flex-shrink-0" />
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

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
                  <p>Aperçu non disponible pour ce type de fichier.</p>
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

export default DocumentManager;
