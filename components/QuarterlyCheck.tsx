import React, { useState, useEffect, useMemo } from 'react';
import { QuarterlyCheckInput, QuarterlyCheckResult, DossierDomiciliation } from '../types';
import { checkQuarterlyCompliance } from '../services/geminiService';
import { Loader2, Activity, FileCheck, AlertOctagon, Search, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import ClientSelector from './ClientSelector';

const QuarterlyCheck: React.FC = () => {
  const [dossiers, setDossiers] = useState<DossierDomiciliation[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuarterlyCheckResult | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [view, setView] = useState<'form' | 'schedule'>('schedule');
  const [formData, setFormData] = useState<QuarterlyCheckInput>({
    companyName: '',
    activity: '',
    behaviors: 'RAS',
    changes: 'Aucun',
    sanctions: 'Négatif',
    missingDocs: 'Aucun',
    suspiciousPayments: 'Non'
  });

  useEffect(() => {
    const saved = localStorage.getItem('grub-dossiers-v1');
    if (saved) setDossiers(JSON.parse(saved));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectClient = (dossier: DossierDomiciliation) => {
    setSelectedClientId(dossier.id);
    setFormData({
      companyName: dossier.raisonSociale,
      activity: dossier.activite,
      behaviors: 'RAS',
      changes: 'Aucun',
      sanctions: 'Négatif',
      missingDocs: dossier.docs ? Object.entries(dossier.docs).filter(([_, v]) => !v).map(([k]) => k).join(', ') : 'Aucun',
      suspiciousPayments: 'Non'
    });
    setView('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const data = await checkQuarterlyCompliance(formData);
      setResult(data);

      // Update dossier if selected
      if (selectedClientId) {
        const updatedDossiers = dossiers.map(d => {
          if (d.id === selectedClientId) {
            return {
              ...d,
              dernierControleTrimestriel: new Date().toISOString().split('T')[0],
              statutConformiteTrimestrielle: data.statut_conformite,
              historique: [{
                id: Math.random().toString(36).substring(2, 11),
                date: new Date().toISOString(),
                type: 'autre' as any,
                description: `Contrôle trimestriel effectué. Statut: ${data.statut_conformite}.`
              }, ...(d.historique || [])]
            };
          }
          return d;
        });
        setDossiers(updatedDossiers);
        localStorage.setItem('grub-dossiers-v1', JSON.stringify(updatedDossiers));
      }
    } catch (err) {
      alert("Erreur lors du contrôle trimestriel.");
    } finally {
      setLoading(false);
    }
  };

  const scheduleData = useMemo(() => {
    return dossiers.map(d => {
      const lastCheck = d.dernierControleTrimestriel ? new Date(d.dernierControleTrimestriel) : new Date(d.createdAt);
      const nextCheck = new Date(lastCheck);
      nextCheck.setMonth(nextCheck.getMonth() + 3);
      
      const today = new Date();
      const diffDays = Math.ceil((nextCheck.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        id: d.id,
        name: d.raisonSociale,
        lastCheck: d.dernierControleTrimestriel || d.createdAt.split('T')[0],
        nextCheck: nextCheck.toISOString().split('T')[0],
        daysRemaining: diffDays,
        status: d.statutConformiteTrimestrielle || 'Non contrôlé',
        risk: d.niveauRisqueIA || 'vert'
      };
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [dossiers]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex gap-4 border-b border-slate-700 pb-1">
        <button 
          onClick={() => setView('schedule')}
          className={`px-4 py-2 text-sm font-bold transition-all border-b-2 ${view === 'schedule' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Échéancier de Contrôle
        </button>
        <button 
          onClick={() => setView('form')}
          className={`px-4 py-2 text-sm font-bold transition-all border-b-2 ${view === 'form' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Nouveau Contrôle
        </button>
      </div>

      {view === 'schedule' ? (
        <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-primary" />
                Échéancier des pièces à vérifier
             </h2>
             <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">
               Fréquence : Trimestrielle (90 jours)
             </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-dark/50 text-slate-200 text-[10px] font-bold uppercase tracking-widest border-b border-slate-800">
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Dernier Contrôle</th>
                  <th className="px-6 py-4">Prochaine Échéance</th>
                  <th className="px-6 py-4">Délai</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {scheduleData.map((item) => (
                  <tr key={item.id} className="hover:bg-brand-dark/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{item.name}</div>
                      <div className={`text-[10px] font-bold uppercase ${item.risk === 'rouge' ? 'text-rose-400' : item.risk === 'orange' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        Risque {item.risk}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {new Date(item.lastCheck).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-white">
                      {new Date(item.nextCheck).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${
                        item.daysRemaining < 0 ? 'bg-rose-500/10 text-rose-400' :
                        item.daysRemaining < 15 ? 'bg-amber-500/10 text-amber-400' :
                        'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {item.daysRemaining < 0 ? `Retard de ${Math.abs(item.daysRemaining)}j` : `${item.daysRemaining} jours`}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className={`text-xs font-bold flex items-center gap-1 ${
                         item.status === 'Conforme' ? 'text-emerald-400' :
                         item.status === 'À surveiller' ? 'text-amber-400' :
                         item.status === 'Non conforme' ? 'text-rose-400' : 'text-slate-400'
                       }`}>
                         {item.status === 'Conforme' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                         {item.status}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          const d = dossiers.find(dos => dos.id === item.id);
                          if (d) handleSelectClient(d);
                        }}
                        className="text-xs font-bold text-brand-primary hover:underline"
                      >
                        Contrôler
                      </button>
                    </td>
                  </tr>
                ))}
                {scheduleData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                      Aucun client dans la base.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 p-6 animate-in slide-in-from-right-4 duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-primary" />
              Nouveau Contrôle de Conformité
            </h2>
            <div className="w-64">
              <ClientSelector 
                dossiers={dossiers} 
                onSelect={handleSelectClient} 
                selectedId={selectedClientId}
                label="Client à contrôler"
              />
            </div>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Raison sociale</label>
                  <input required name="companyName" value={formData.companyName} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Activité réelle observée</label>
                  <input required name="activity" value={formData.activity} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" placeholder="Est-elle conforme aux statuts ?" />
                </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Comportements observés</label>
                <textarea name="behaviors" value={formData.behaviors} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" rows={2} placeholder="ex: Passages fréquents, courrier volumineux..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Changements récents</label>
                <input name="changes" value={formData.changes} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" placeholder="ex: Nouveau gérant, changement actionnariat" />
              </div>
                <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Paiements suspects</label>
                <select name="suspiciousPayments" value={formData.suspiciousPayments} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm">
                  <option value="Non">Non</option>
                  <option value="Oui">Oui (Retards, espèces, tiers...)</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Résultats listes Sanctions / PEP</label>
                <select name="sanctions" value={formData.sanctions} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm">
                  <option value="Négatif">Négatif (Rien à signaler)</option>
                  <option value="Positif">Positif (Match trouvé)</option>
                  <option value="Doute">Douteux</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Documents manquants / périmés</label>
                <input name="missingDocs" value={formData.missingDocs} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" placeholder="ex: Kbis > 3 mois" />
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button type="submit" disabled={loading} className="flex items-center gap-2 bg-brand-primary text-brand-dark font-bold px-6 py-2 rounded-lg hover:bg-brand-primary/90 transition disabled:opacity-50">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Vérification en cours..." : "Vérifier la conformité"}
              </button>
            </div>
          </form>

          {result && (
            <div className="mt-8 bg-brand-dark rounded-xl border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 border-b border-slate-700 pb-2">Rapport Trimestriel</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Statut Conformité</span>
                      <div className={`mt-2 inline-flex items-center px-4 py-2 rounded-full text-sm font-bold border ${
                        result.statut_conformite === 'Conforme' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        result.statut_conformite === 'À surveiller' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {result.statut_conformite === 'Conforme' && <FileCheck className="w-4 h-4 mr-2" />}
                        {result.statut_conformite === 'À surveiller' && <Activity className="w-4 h-4 mr-2" />}
                        {result.statut_conformite === 'Non conforme' && <AlertOctagon className="w-4 h-4 mr-2" />}
                        {result.statut_conformite.toUpperCase()}
                      </div>
                    </div>

                    <div>
                      <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Action Recommandée</span>
                      <div className="mt-2 text-lg font-medium text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-brand-primary"></span>
                        {result.action_recommandee}
                      </div>
                    </div>
                  </div>

                  <div className="bg-brand-light p-4 rounded-lg border border-slate-700">
                    <span className="text-xs font-semibold text-brand-primary uppercase tracking-wider block mb-2">Résumé Conformité</span>
                    <p className="text-slate-200 leading-relaxed text-sm">
                      {result.commentaire}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuarterlyCheck;
