import React, { useState } from 'react';
import { RiskAnalysisInput, RiskAnalysisResult, DossierDomiciliation } from '../types';
import { analyzeRisk } from '../services/geminiService';
import { Loader2, AlertTriangle, CheckCircle, XCircle, ShieldAlert, Info } from 'lucide-react';
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
    paysOrigine: '',
    nationaliteGerant: '',
    beneficiairesDeclares: '',
    isPep: 'Non',
    origineFonds: '',
    natureTransactions: '',
    comportementClient: '',
    missingDocs: 'Aucun',
    inconsistencies: 'Aucune'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectClient = (dossier: DossierDomiciliation) => {
    const retards = dossier.paiements?.filter(p => p.statut === 'retard' || p.statut === 'impaye').length ?? 0;
    const relances = dossier.relances?.filter(r => r.type !== 'Aucune').length ?? 0;
    let comportement = 'Client réactif, dossier complet';
    if (relances >= 3) comportement = 'Refus de réponse ou relances multiples sans régularisation';
    else if (relances >= 2 || retards > 0) comportement = 'Réponses tardives, retards de paiement';
    else if (relances === 1) comportement = 'Légères omissions, relance effectuée';
    setFormData({
      companyName: dossier.raisonSociale,
      legalForm: dossier.formeJuridique,
      activity: dossier.activite,
      paysOrigine: dossier.paysOrigine || '',
      nationaliteGerant: dossier.nationaliteGerant || '',
      beneficiairesDeclares: dossier.beneficiairesDeclares || '',
      isPep: dossier.estPPE ? 'PPE national' : (dossier.appartenancePolitiqueReligieuse ? 'Proche d\'un PPE' : 'Non'),
      origineFonds: dossier.origineFonds || '',
      natureTransactions: dossier.utilisationAdresse || '',
      comportementClient: comportement,
      missingDocs: dossier.docs ? Object.entries(dossier.docs).filter(([_, v]) => !v).map(([k]) => k).join(', ') || 'Aucun' : 'Aucun',
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identité */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Raison sociale</label>
              <input required name="companyName" value={formData.companyName} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm placeholder:text-slate-500 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="SAS Dupont Consulting" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Forme juridique</label>
              <select name="legalForm" value={formData.legalForm} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm focus:border-brand-primary">
                <option value="">Sélectionner...</option>
                <option value="SAS">SAS / SASU</option>
                <option value="SARL">SARL / EURL</option>
                <option value="SCI">SCI</option>
                <option value="Micro-entreprise">Micro-entreprise</option>
                <option value="Association">Association</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Activité déclarée</label>
              <input required name="activity" value={formData.activity} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm placeholder:text-slate-500 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="ex: Conseil en management B2B" />
            </div>
          </div>

          {/* 7 critères */}
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <div className="bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-brand-primary" />
              7 critères de notation — Matrice GRUB v3.0
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {/* C1 */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">C1 — Pays d'origine (siège / gérant)</label>
                <input name="paysOrigine" value={formData.paysOrigine} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm placeholder:text-slate-500 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="ex: France, Maroc, Chine..." />
              </div>
              {/* Nationalité gérant */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Nationalité du gérant</label>
                <input name="nationaliteGerant" value={formData.nationaliteGerant} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm placeholder:text-slate-500 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="ex: Française, Marocaine..." />
              </div>
              {/* C3 */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">C3 — Bénéficiaires effectifs (BE)</label>
                <input name="beneficiairesDeclares" value={formData.beneficiairesDeclares} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm placeholder:text-slate-500 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="ex: BE identifié FR, liste complète" />
              </div>
              {/* C4 */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">C4 — PPE (Personne Politiquement Exposée)</label>
                <select name="isPep" value={formData.isPep} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm focus:border-brand-primary">
                  <option value="Non">Non — aucun lien PPE</option>
                  <option value="Proche d'un PPE">Proche d'un PPE (famille / associé)</option>
                  <option value="PPE national rang modéré">PPE national de rang modéré</option>
                  <option value="PPE national">PPE national de rang élevé ou PPE étranger</option>
                  <option value="PPE sous sanction">PPE sous sanction ou gel des avoirs</option>
                </select>
              </div>
              {/* C5 */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">C5 — Origine des fonds</label>
                <input name="origineFonds" value={formData.origineFonds} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm placeholder:text-slate-500 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="ex: Épargne personnelle documentée" />
              </div>
              {/* C6 */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">C6 — Nature des transactions</label>
                <input name="natureTransactions" value={formData.natureTransactions} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm placeholder:text-slate-500 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="ex: Virements B2B, paiements CB" />
              </div>
              {/* C7 */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">C7 — Comportement client & réactivité</label>
                <select name="comportementClient" value={formData.comportementClient} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm focus:border-brand-primary">
                  <option value="Client réactif, dossier complet, paiements à jour">Réactif — dossier complet, paiements à jour</option>
                  <option value="Légères omissions, régularisées rapidement">Légères omissions, régularisées rapidement</option>
                  <option value="Réponses tardives, retards de paiement récurrents">Réponses tardives / retards de paiement récurrents</option>
                  <option value="Non-réponse prolongée, modifications non déclarées">Non-réponse prolongée / modifications non déclarées</option>
                  <option value="Refus de communiquer, fausses déclarations avérées">Refus de communiquer / fausses déclarations avérées</option>
                </select>
              </div>
            </div>
          </div>

          {/* Compléments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Documents manquants</label>
              <input name="missingDocs" value={formData.missingDocs} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm placeholder:text-slate-500 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="ex: CNI gérant, Statuts..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Incohérences / observations</label>
              <input name="inconsistencies" value={formData.inconsistencies} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white border p-2 text-sm placeholder:text-slate-500 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" placeholder="ex: Adresse dirigeant à l'étranger..." />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="flex items-center gap-2 bg-brand-primary text-brand-dark font-bold px-6 py-2 rounded-lg hover:bg-brand-primary/90 transition disabled:opacity-50">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Analyse en cours..." : "Lancer l'analyse LCB-FT (GRUB v3.0)"}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="bg-brand-light rounded-xl shadow-lg border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">Résultat — Matrice GRUB v3.0</h3>

            {/* Niveau + décision */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-brand-dark rounded-lg p-4 border border-slate-700 flex flex-col items-center justify-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Niveau de risque</span>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${
                  result.niveau_risque === 'Faible'      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                  result.niveau_risque === 'Modéré'      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                  result.niveau_risque === 'Élevé'       ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                  'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {result.niveau_risque === 'Faible'     && <CheckCircle className="w-4 h-4" />}
                  {result.niveau_risque === 'Modéré'     && <AlertTriangle className="w-4 h-4" />}
                  {result.niveau_risque === 'Élevé'      && <XCircle className="w-4 h-4" />}
                  {result.niveau_risque === 'Très élevé' && <XCircle className="w-4 h-4" />}
                  {result.niveau_risque}
                </div>
                <span className="text-2xl font-black text-white">{result.score_total}<span className="text-sm font-normal text-slate-400">/35</span></span>
              </div>

              <div className="md:col-span-2 bg-brand-dark rounded-lg p-4 border border-slate-700">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Décision recommandée</span>
                <p className={`text-base font-semibold ${
                  result.niveau_risque === 'Très élevé' ? 'text-rose-400' :
                  result.niveau_risque === 'Élevé'      ? 'text-orange-400' :
                  result.niveau_risque === 'Modéré'     ? 'text-amber-400' : 'text-emerald-400'
                }`}>{result.decision}</p>
                {result.alerte_automatique && (
                  <p className="mt-2 text-xs text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Alerte automatique déclenchée (≥2 critères avec score élevé)
                  </p>
                )}
              </div>
            </div>

            {/* Scores par critère */}
            {result.scores && (
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">Détail des 7 critères</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {([
                    ['Origine géographique', result.scores.origine_geographique],
                    ['Activité',             result.scores.activite],
                    ['Bénéficiaires effectifs', result.scores.beneficiaires_effectifs],
                    ['PPE',                  result.scores.ppe],
                    ['Origine des fonds',    result.scores.origine_fonds],
                    ['Nature transactions',  result.scores.nature_transactions],
                    ['Comportement client',  result.scores.comportement_client],
                  ] as [string, number][]).map(([label, score]) => (
                    <div key={label} className={`rounded-lg p-3 border text-center ${
                      score >= 5 ? 'bg-rose-500/10 border-rose-500/30' :
                      score >= 4 ? 'bg-orange-500/10 border-orange-500/30' :
                      score >= 3 ? 'bg-amber-500/10 border-amber-500/30' :
                      'bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                      <div className={`text-xl font-black ${
                        score >= 5 ? 'text-rose-400' : score >= 4 ? 'text-orange-400' :
                        score >= 3 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>{score}</div>
                      <div className="text-xs text-slate-400 mt-0.5 leading-tight">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analyse IA */}
            <div className="bg-brand-dark p-4 rounded-lg border border-slate-700">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Analyse IA — Gemini</span>
              <p className="text-slate-200 leading-relaxed text-sm">{result.commentaire}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskAnalysis;