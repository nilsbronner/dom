
import React, { useState, useRef, useEffect } from 'react';
import { DocumentAnalysisResult, AnalyzedDocument, DossierDomiciliation } from '../types';
import { analyzeDocumentCompleteness } from '../services/geminiService';
import { Loader2, FolderOpen, UploadCloud, File, CheckCircle, XCircle, AlertTriangle, Search, Save, ExternalLink } from 'lucide-react';
import ClientSelector from './ClientSelector';

const DocumentManager: React.FC = () => {
  const [dossiers, setDossiers] = useState<DossierDomiciliation[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [legalForm, setLegalForm] = useState('SAS');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [result, setResult] = useState<DocumentAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('grub-dossiers-v1');
    if (saved) setDossiers(JSON.parse(saved));
  }, []);

  const handleSelectClient = (dossier: DossierDomiciliation) => {
    setSelectedClientId(dossier.id);
    setLegalForm(dossier.formeJuridique || 'SAS');
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      setResult(null); // Reset result on new files
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
      setResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setLoading(true);
    try {
      const fileNames = files.map(f => f.name);
      const data = await analyzeDocumentCompleteness({
        legalForm,
        fileNames
      });
      setResult(data);

      // Update client docs checklist if a client is selected
      if (selectedClientId) {
        const updatedDossiers = dossiers.map(d => {
          if (d.id === selectedClientId) {
            const newDocs = { ...d.docs };
            data.classifiedDocuments.forEach(doc => {
              if (doc.status === 'Valid') {
                const type = doc.detectedType.toLowerCase();
                if (type.includes('cni') || type.includes('identité')) {
                  if (type.includes('gérant')) newDocs.cniGerant = true;
                  else newDocs.cniBeneficiaires = true;
                }
                if (type.includes('kbis')) newDocs.kbis = true;
                if (type.includes('statut')) newDocs.statuts = true;
                if (type.includes('domicile')) newDocs.justifDomicileGerant = true;
                if (type.includes('compta')) newDocs.attestationCompta = true;
                if (type.includes('bénéficiaire')) newDocs.listeBeneficiaires = true;
                if (type.includes('contrat')) newDocs.contratSigne = true;
              }
            });
            
            const historyEntry = {
              id: Math.random().toString(36).substring(2, 11),
              date: new Date().toISOString(),
              type: 'courrier' as any,
              description: `Analyse documentaire effectuée. Statut: ${data.complianceStatus}.`
            };

            return { 
              ...d, 
              docs: newDocs,
              historique: [historyEntry, ...(d.historique || [])]
            };
          }
          return d;
        });
        setDossiers(updatedDossiers);
        localStorage.setItem('grub-dossiers-v1', JSON.stringify(updatedDossiers));
      }
    } catch (err) {
      alert("Erreur lors de l'analyse des documents.");
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveToDrive = async () => {
    if (!selectedClientId || files.length === 0) return;
    setIsArchiving(true);
    try {
      const dossier = dossiers.find(d => d.id === selectedClientId);
      if (!dossier) return;

      const response = await fetch('/api/archive-to-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raisonSociale: dossier.raisonSociale,
          files: files.map(f => ({ name: f.name, type: f.type }))
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const updatedDossiers = dossiers.map(d => {
          if (d.id === selectedClientId) {
            return { 
              ...d, 
              driveFolderId: data.folderId, 
              driveFolderUrl: data.folderUrl,
              historique: [{
                id: Math.random().toString(36).substring(2, 11),
                date: new Date().toISOString(),
                type: 'autre' as any,
                description: "Documents archivés sur Google Drive."
              }, ...(d.historique || [])]
            };
          }
          return d;
        });
        setDossiers(updatedDossiers);
        localStorage.setItem('grub-dossiers-v1', JSON.stringify(updatedDossiers));
        alert("Documents archivés avec succès sur Google Drive !");
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      alert("Erreur lors de l'archivage : " + err.message);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Panel: Upload & List */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                 <FolderOpen className="w-5 h-5 text-brand-primary" />
                 Dépôt des Pièces Justificatives
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <ClientSelector 
                  dossiers={dossiers}
                  onSelect={handleSelectClient}
                  selectedId={selectedClientId}
                  label="Connecter à un dossier client"
                />
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Forme Juridique du Client</label>
                  <select 
                      value={legalForm} 
                      onChange={(e) => setLegalForm(e.target.value)} 
                      className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm"
                  >
                      <option value="SAS">SAS / SASU</option>
                      <option value="SARL">SARL / EURL</option>
                      <option value="SCI">SCI</option>
                      <option value="Association">Association</option>
                      <option value="Auto-entrepreneur">Auto-entrepreneur</option>
                  </select>
                </div>
              </div>

              <div 
                onDrop={handleDrop} 
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-brand-dark transition"
              >
                <input 
                   type="file" 
                   multiple 
                   ref={fileInputRef} 
                   className="hidden" 
                   onChange={handleFileChange} 
                />
                <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
                <p className="text-sm font-medium text-slate-200">Cliquez ou déposez vos fichiers ici</p>
                <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG acceptés (Simulation)</p>
              </div>
           </div>

           {files.length > 0 && (
             <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 p-6">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-semibold text-slate-200">Fichiers en attente ({files.length})</h3>
                   <div className="flex gap-2">
                     {selectedClientId && (
                       <button 
                         onClick={handleArchiveToDrive} 
                         disabled={isArchiving}
                         className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 text-sm"
                       >
                         {isArchiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                         {isArchiving ? "Archivage..." : "Archiver sur Drive"}
                       </button>
                     )}
                     <button 
                       onClick={handleAnalyze} 
                       disabled={loading}
                       className="flex items-center gap-2 bg-brand-primary text-brand-dark font-bold px-4 py-2 rounded-lg hover:bg-brand-primary/90 transition disabled:opacity-50 text-sm"
                     >
                       {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                       {loading ? "Analyse en cours..." : "Analyser la complétude"}
                     </button>
                   </div>
                </div>
                <ul className="space-y-2">
                   {files.map((file, idx) => (
                      <li key={idx} className="flex justify-between items-center bg-brand-dark p-3 rounded-lg border border-slate-700">
                         <div className="flex items-center gap-3">
                            <File className="w-4 h-4 text-slate-400" />
                            <div>
                               <p className="text-sm font-medium text-slate-100">{file.name}</p>
                               <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
                            </div>
                         </div>
                         <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500">
                            <XCircle className="w-4 h-4" />
                         </button>
                      </li>
                   ))}
                </ul>
             </div>
           )}
        </div>

        {/* Right Panel: Analysis Result */}
        <div className="space-y-6">
           {selectedClientId && dossiers.find(d => d.id === selectedClientId)?.driveFolderUrl && (
             <div className="bg-brand-light border border-slate-700 rounded-xl p-4 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="bg-brand-primary p-2 rounded-lg">
                   <ExternalLink className="w-4 h-4 text-brand-dark" />
                 </div>
                 <div>
                   <p className="text-sm font-bold text-white">Dossier Drive Connecté</p>
                   <p className="text-xs text-slate-300 truncate max-w-[150px]">
                     {dossiers.find(d => d.id === selectedClientId)?.raisonSociale}
                   </p>
                 </div>
               </div>
               <a 
                 href={dossiers.find(d => d.id === selectedClientId)?.driveFolderUrl} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="text-xs font-bold text-brand-primary hover:underline"
               >
                 Ouvrir
               </a>
             </div>
           )}
           {result ? (
              <div className="bg-brand-light rounded-xl shadow-lg border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
                 <div className={`p-4 border-b ${
                    result.complianceStatus === 'Conforme' ? 'bg-emerald-500/10 border-emerald-500/20' : 
                    result.complianceStatus === 'Incomplet' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-amber-500/10 border-amber-500/20'
                 }`}>
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${
                       result.complianceStatus === 'Conforme' ? 'text-emerald-400' : 
                       result.complianceStatus === 'Incomplet' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                       {result.complianceStatus === 'Conforme' && <CheckCircle className="w-5 h-5" />}
                       {result.complianceStatus === 'Incomplet' && <XCircle className="w-5 h-5" />}
                       {result.complianceStatus === 'A vérifier' && <AlertTriangle className="w-5 h-5" />}
                       Dossier {result.complianceStatus}
                    </h3>
                    <p className="text-xs mt-1 text-slate-200">{result.globalComment}</p>
                 </div>

                 <div className="p-4 space-y-6">
                    {/* Classified Docs */}
                    <div>
                       <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Documents Identifiés</h4>
                       <ul className="space-y-2">
                          {result.classifiedDocuments.map((doc, idx) => (
                             <li key={idx} className="text-sm border-l-2 border-brand-primary pl-3 py-1">
                                <div className="font-medium text-white">{doc.detectedType}</div>
                                <div className="text-xs text-slate-300">{doc.fileName}</div>
                                <div className="text-xs text-slate-400 italic mt-0.5">{doc.comment}</div>
                             </li>
                          ))}
                       </ul>
                    </div>

                    {/* Missing Docs */}
                    {result.missingDocuments.length > 0 && (
                        <div>
                           <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-3">Manquants</h4>
                           <ul className="space-y-2">
                              {result.missingDocuments.map((doc, idx) => (
                                 <li key={idx} className="flex items-center gap-2 text-sm text-rose-300 bg-rose-500/10 p-2 rounded">
                                    <XCircle className="w-3 h-3 flex-shrink-0" />
                                    {doc}
                                 </li>
                              ))}
                           </ul>
                        </div>
                    )}
                 </div>
              </div>
           ) : (
              <div className="bg-brand-light border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center h-64 text-slate-400">
                 <Search className="w-12 h-12 mb-2 opacity-20" />
                 <p className="text-sm">Le rapport d'analyse apparaîtra ici après traitement.</p>
              </div>
           )}
        </div>

      </div>
    </div>
  );
};

export default DocumentManager;
