import React, { useState } from 'react';
import { NewClientResult, DossierDomiciliation } from '../types';
import { analyzeNewClient } from '../services/geminiService';
import { fetchSheetData } from '../services/googleSheetsService';
import { Loader2, UserPlus, AlertTriangle, FileText, Database, RefreshCw, ExternalLink, Save, CheckCircle } from 'lucide-react';

const NewClientAnalysis: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [rawData, setRawData] = useState('');
  const [result, setResult] = useState<NewClientResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<{ folderUrl: string; message: string; error?: string } | null>(null);

  React.useEffect(() => {
    const pending = localStorage.getItem('grub-pending-analysis');
    if (pending) {
      setRawData(pending);
      localStorage.removeItem('grub-pending-analysis');
    }
  }, []);

  const handleFetchSheet = async () => {
    setFetching(true);
    try {
      const csv = await fetchSheetData();
      setRawData(csv);
    } catch (err) {
      alert("Erreur lors de la récupération de la Google Sheet.");
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setSaved(false);
    try {
      const data = await analyzeNewClient(rawData);
      setResult(data);
    } catch (err) {
      alert("Erreur lors de l'analyse du nouveau client.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDossiers = () => {
    if (!result) return;

    const existingDossiersRaw = localStorage.getItem('grub-dossiers-v1');
    const existingDossiers: DossierDomiciliation[] = existingDossiersRaw ? JSON.parse(existingDossiersRaw) : [];

    const newDossier: DossierDomiciliation = {
      id: Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString(),
      statut: 'en_cours',
      raisonSociale: result.clients.raison_sociale || '',
      formeJuridique: result.clients.forme_juridique || 'SAS',
      siret: result.clients.siret || '',
      rcsVille: result.clients.ville_rcs || '',
      activite: result.clients.activite_principale || '',
      descriptionActivite: result.clients.description_activite || '',
      nomGerant: result.clients.nom_gerant || '',
      prenomGerant: result.clients.prenom_gerant || '',
      nationaliteGerant: '',
      paysOrigine: 'France',
      tel: result.clients.tel || '',
      email: result.clients.email || '',
      adresseDomicile: result.clients.adresse_personnelle || '',
      dateDebut: new Date().toISOString().split('T')[0],
      origineFonds: result.clients.origine_fonds || '',
      beneficiairesDeclares: result.clients.beneficiaires_effectifs || '',
      utilisationAdresse: 'Siège social',
      estPPE: false,
      appartenancePolitiqueReligieuse: false,
      commentairesControlesInitiaux: '',
      niveauRisqueIA: 'vert',
      decisionRisqueIA: '',
      commentaireRisqueIA: '',
      statutMiseAJourAnnuelle: 'a_jour',
      derniereMajAnnuelle: new Date().toISOString(),
      dernierControleTrimestriel: new Date().toISOString(),
      statutConformiteTrimestrielle: 'Conforme',
      tarifChoisi: 'mensuel',
      montantMensuel: 50,
      optionCourrier: 'standard',
      numeroBal: '',
      docs: {
        cniGerant: false,
        justifDomicileGerant: false,
        statuts: false,
        kbis: false,
        attestationCompta: false,
        listeBeneficiaires: false,
        cniBeneficiaires: false,
        contratSigne: false,
      },
      relances: [],
      aInclureProchaineListe: true,
      paiements: [],
      historique: [{
        id: Math.random().toString(36).substring(2, 11),
        date: new Date().toISOString(),
        type: 'autre',
        description: 'Création du dossier via import Tally/Excel (Système)'
      }]
    };

    localStorage.setItem('grub-dossiers-v1', JSON.stringify([...existingDossiers, newDossier]));
    setSaved(true);
    
    // Auto-archive to Drive if possible
    handleArchiveToDrive(newDossier);
  };

  const handleArchiveToDrive = async (dossier: DossierDomiciliation) => {
    setArchiving(true);
    try {
      const response = await fetch('/api/archive-to-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: dossier.raisonSociale,
          clientId: dossier.id,
          clientData: dossier
        })
      });

      const data = await response.json();
      if (data.success) {
        setArchiveResult({ folderUrl: data.folderUrl, message: data.message });
        
        // Update dossier with Drive info
        const existingDossiersRaw = localStorage.getItem('grub-dossiers-v1');
        if (existingDossiersRaw) {
          const existingDossiers: DossierDomiciliation[] = JSON.parse(existingDossiersRaw);
          const updated = existingDossiers.map(d => d.id === dossier.id ? { 
            ...d, 
            driveFolderId: data.folderId, 
            driveFolderUrl: data.folderUrl 
          } : d);
          localStorage.setItem('grub-dossiers-v1', JSON.stringify(updated));
        }
      } else {
        setArchiveResult({ folderUrl: '', message: data.error || "Erreur d'archivage", error: data.error });
      }
    } catch (err) {
      console.error("Archive error:", err);
      setArchiveResult({ folderUrl: '', message: "Erreur de connexion au serveur d'archivage.", error: String(err) });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-brand-primary" />
            Traitement Nouveau Client (Tally & Excel)
          </h2>
          <div className="flex gap-4 items-center">
            <a 
              href="https://docs.google.com/spreadsheets/d/1UJrNyzwE5Haov1cS5Ylxa4ghJuRHKTjqWN_rzO-M9CE/edit" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand-primary hover:underline font-medium"
            >
              <ExternalLink className="w-3 h-3" /> Ouvrir Excel
            </a>
            <button
              onClick={handleFetchSheet}
              disabled={fetching || loading}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 text-sm font-bold"
            >
              {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {fetching ? "Récupération..." : "Récupérer depuis Google Sheets"}
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Données brutes (JSON ou CSV)
            </label>
            <p className="text-xs text-slate-400 mb-2">Collez les données ou utilisez le bouton ci-dessus pour récupérer les dernières entrées.</p>
            <textarea
              required
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              className="w-full h-48 font-mono text-xs rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2"
              placeholder={`{\n  "Raison Sociale": "Ma Boite SAS",\n  "Gérant": "Jean Dupont",\n  ... \n}`}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !rawData.trim()}
              className="flex items-center gap-2 bg-brand-primary text-brand-dark font-bold px-6 py-2 rounded-lg hover:bg-brand-primary/90 transition disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Structuration des données..." : "Analyser & Structurer"}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center bg-brand-light p-4 rounded-xl shadow-sm border border-slate-700">
            <div>
              <h3 className="text-lg font-bold text-white">Analyse terminée</h3>
              <p className="text-sm text-slate-400">Le dossier est prêt à être intégré au pilotage.</p>
            </div>
            <button
              onClick={handleSaveToDossiers}
              disabled={saved}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition shadow-lg ${
                saved 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default' 
                  : 'bg-brand-primary text-brand-dark hover:bg-brand-primary/90 active:scale-95'
              }`}
            >
              {saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              {saved ? "Dossier Enregistré" : "Créer le Dossier de Domiciliation"}
            </button>
          </div>

          {archiveResult && (
            <div className={`${archiveResult.error ? 'bg-rose-500/10 border-rose-500/20' : 'bg-brand-primary/10 border-brand-primary/20'} border rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300`}>
              <div className="flex items-center gap-3">
                <div className={`${archiveResult.error ? 'bg-rose-500/20' : 'bg-brand-primary/20'} p-2 rounded-lg`}>
                  {archiveResult.error ? <AlertTriangle className="w-5 h-5 text-rose-400" /> : <ExternalLink className="w-5 h-5 text-brand-primary" />}
                </div>
                <div>
                  <p className={`text-sm font-bold ${archiveResult.error ? 'text-rose-200' : 'text-brand-primary'}`}>{archiveResult.error ? 'Erreur d\'Archivage Cloud' : 'Archivage Cloud Réussi'}</p>
                  <p className={`text-xs ${archiveResult.error ? 'text-rose-400' : 'text-slate-300'}`}>{archiveResult.message}</p>
                </div>
              </div>
              {archiveResult.folderUrl && (
                <a 
                  href={archiveResult.folderUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-brand-dark text-brand-primary border border-brand-primary/30 px-4 py-2 rounded-lg text-xs font-bold hover:bg-brand-primary/10 transition"
                >
                  Ouvrir le dossier Drive
                </a>
              )}
              {archiveResult.error?.includes("n'est pas activée") && (
                <a 
                  href="https://console.cloud.google.com/apis/library/drive.googleapis.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-rose-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-rose-700 transition"
                >
                  Activer l'API Drive
                </a>
              )}
            </div>
          )}

          {archiving && (
            <div className="bg-brand-dark/50 border border-slate-700 rounded-xl p-4 flex items-center gap-3 animate-pulse">
              <Loader2 className="w-5 h-5 text-brand-primary animate-spin" />
              <p className="text-sm font-medium text-slate-300">Archivage systématique sur Google Drive en cours...</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alerts Section */}
            {result.alerts && result.alerts.length > 0 && (
              <div className="lg:col-span-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Points d'attention initiaux
                </h3>
                <ul className="list-disc list-inside text-sm text-amber-200 space-y-1">
                  {result.alerts.map((alert, idx) => (
                    <li key={idx}>{alert}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Client Info Card */}
            <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 overflow-hidden">
              <div className="bg-brand-dark/50 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                <Database className="w-4 h-4 text-brand-primary" />
                <h3 className="font-semibold text-white text-sm">Données Client (Onglet CLIENTS)</h3>
              </div>
              <div className="p-4 overflow-auto max-h-96">
                <table className="min-w-full text-xs text-left">
                  <tbody className="divide-y divide-slate-700">
                    {Object.entries(result.clients).map(([key, value]) => (
                      <tr key={key}>
                        <td className="py-2 font-medium text-slate-400 w-1/3 break-all">{key}</td>
                        <td className="py-2 text-slate-200 font-mono break-words">{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Documents Status */}
            <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 overflow-hidden">
               <div className="bg-brand-dark/50 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-primary" />
                <h3 className="font-semibold text-white text-sm">Documents Requis (Onglet DOCUMENTS)</h3>
              </div>
              <div className="p-0">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-brand-dark/50 text-slate-300 font-medium">
                    <tr>
                      <th className="px-4 py-2">Document</th>
                      <th className="px-4 py-2">Statut</th>
                      <th className="px-4 py-2">Commentaire</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {result.documents.map((doc, idx) => (
                      <tr key={idx} className="hover:bg-brand-dark/30">
                        <td className="px-4 py-2 font-medium text-white">{doc.type_document}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            doc.statut_initial.toLowerCase().includes('manquant') 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {doc.statut_initial}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-400">{doc.commentaire}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

             {/* SIE / Greffe Data */}
             <div className="lg:col-span-2 bg-brand-light rounded-xl shadow-sm border border-slate-700 overflow-hidden">
              <div className="bg-brand-dark/50 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-primary" />
                <h3 className="font-semibold text-white text-sm">Préparation SIE / Greffe</h3>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {Object.entries(result.sie_greffe).map(([key, value]) => (
                     <div key={key} className="flex flex-col">
                        <span className="text-xs text-slate-500 uppercase">{key.replace(/_/g, ' ')}</span>
                        <span className="font-medium text-slate-200">{String(value)}</span>
                     </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewClientAnalysis;
