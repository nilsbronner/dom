import React, { useState } from 'react';
import { RiskAnalysisInput, RiskAnalysisResult, DossierDomiciliation } from '../types';
import { analyzeRisk } from '../services/geminiService';
import { Loader2, AlertTriangle, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
import ClientSelector from './ClientSelector';

interface RiskAnalysisProps {
  dossiers?: DossierDomiciliation[];
}

const RiskAnalysis: React.FC<RiskAnalysisProps> = ({ dossiers: propsDossiers }) => {
  const [dossiers, setDossiers] = useState<DossierDomiciliation[]>(propsDossiers || []);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!propsDossiers) {
      const saved = localStorage.getItem('grub-dossiers-v1');
      if (saved) setDossiers(JSON.parse(saved));
    }
  }, [propsDossiers]);
  const [result, setResult] = useState<RiskAnalysisResult | null>(null);
  const [formData, setFormData] = useState<RiskAnalysisInput>({
    companyName: '',
    legalForm: '',
    activity: '',
    isPep: 'Non',
    politicalLinks: 'Non',
    kbisDate: '',
    uboDate: '',
    missingDocs: 'Aucun',
    inconsistencies: 'Aucune'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectClient = (dossier: DossierDomiciliation) => {
    setFormData({
      companyName: dossier.raisonSociale,
      legalForm: dossier.formeJuridique,
      activity: dossier.activite,
      isPep: dossier.estPPE ? 'Oui' : 'Non',
      politicalLinks: dossier.appartenancePolitiqueReligieuse ? 'Oui' : 'Non',
      kbisDate: dossier.dateDebut,
      uboDate: '',
      missingDocs: dossier.docs ? Object.entries(dossier.docs).filter(([_, v]) => !v).map(([k]) => k).join(', ') : 'Aucun',
      inconsistencies: 'Aucune'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const data = await analyzeRisk(formData);
      setResult(data);
    } catch (err) {
      alert("Une erreur est survenue lors de l'analyse.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-brand-primary" />
            Analyse Initiale du Risque (KYC)
          </h2>
          {dossiers.length > 0 && (
            <div className="w-64">
              <ClientSelector 
                dossiers={dossiers} 
                onSelect={handleSelectClient} 
                label="Pré-remplir depuis un client"
              />
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Raison sociale</label>
              <input required name="companyName" value={formData.companyName} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" placeholder="ex: SAS Dupont Consulting" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Forme juridique</label>
              <select name="legalForm" value={formData.legalForm} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm">
                 <option value="">Sélectionner...</option>
                 <option value="SAS">SAS / SASU</option>
                 <option value="SARL">SARL / EURL</option>
                 <option value="SCI">SCI</option>
                 <option value="Auto-entrepreneur">Micro-entreprise</option>
                 <option value="Association">Association</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Activité déclarée</label>
              <textarea required name="activity" value={formData.activity} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" rows={2} placeholder="Description précise de l'activité..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Date dernier Kbis (-3 mois)</label>
              <input type="date" name="kbisDate" value={formData.kbisDate} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
            </div>
          </div>

          <div className="space-y-4">
             <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">PPE (Politiquement Exposé)</label>
              <select name="isPep" value={formData.isPep} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm">
                 <option value="Non">Non</option>
                 <option value="Oui">Oui</option>
                 <option value="Doute">Douteux (à vérifier)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Liens politiques / religieux</label>
              <input name="politicalLinks" value={formData.politicalLinks} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" placeholder="ex: Non ou préciser..." />
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Documents manquants</label>
              <input name="missingDocs" value={formData.missingDocs} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" placeholder="ex: CNI gérant, Statuts..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Incohérences détectées</label>
              <textarea name="inconsistencies" value={formData.inconsistencies} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" rows={2} placeholder="ex: Adresse dirigeant à l'étranger mais activité locale..." />
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={loading} className="flex items-center gap-2 bg-brand-primary text-brand-dark font-bold px-6 py-2 rounded-lg hover:bg-brand-primary/90 transition disabled:opacity-50">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Analyse en cours..." : "Lancer l'analyse TRACFIN"}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="bg-brand-light rounded-xl shadow-lg border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 border-b border-slate-700 pb-2">Résultat de l'analyse</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                   <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Niveau de Risque</span>
                   <div className={`mt-2 inline-flex items-center px-4 py-2 rounded-full text-sm font-bold border ${
                     result.niveau_risque === 'Faible' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                     result.niveau_risque === 'Moyen' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                     'bg-rose-500/10 text-rose-400 border-rose-500/20'
                   }`}>
                     {result.niveau_risque === 'Faible' && <CheckCircle className="w-4 h-4 mr-2" />}
                     {result.niveau_risque === 'Moyen' && <AlertTriangle className="w-4 h-4 mr-2" />}
                     {result.niveau_risque === 'Élevé' && <XCircle className="w-4 h-4 mr-2" />}
                     {result.niveau_risque.toUpperCase()}
                   </div>
                </div>

                <div>
                   <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Décision Recommandée</span>
                   <div className="mt-2 text-lg font-medium text-white">
                     {result.decision}
                   </div>
                </div>
              </div>

              <div className="bg-brand-dark p-4 rounded-lg border border-slate-700">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Analyse IA</span>
                <p className="text-slate-200 leading-relaxed text-sm">
                  {result.commentaire}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskAnalysis;