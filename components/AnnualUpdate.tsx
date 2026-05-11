import React, { useState, useEffect, useMemo } from 'react';
import { AnnualUpdateInput, AnnualUpdateResult, DossierDomiciliation } from '../types';
import { checkAnnualUpdate } from '../services/geminiService';
import { Loader2, CalendarClock, RefreshCw, Mail, Search, AlertTriangle, CheckCircle2, FileText, Sparkles, Send } from 'lucide-react';
import ClientSelector from './ClientSelector';

const AnnualUpdate: React.FC = () => {
  const [dossiers, setDossiers] = useState<DossierDomiciliation[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnnualUpdateResult | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [view, setView] = useState<'form' | 'tracking'>('tracking');
  const [formData, setFormData] = useState<AnnualUpdateInput>({
    companyName: '',
    kbisDate: '',
    uboDate: '',
    missingDocs: 'Aucun',
    lastUpdateDate: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem('grub-dossiers-v1');
    if (saved) setDossiers(JSON.parse(saved));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectClient = (dossier: DossierDomiciliation) => {
    setSelectedClientId(dossier.id);
    setFormData({
      companyName: dossier.raisonSociale,
      kbisDate: dossier.dateDebut, // Fallback
      uboDate: '',
      missingDocs: dossier.docs ? Object.entries(dossier.docs).filter(([_, v]) => !v).map(([k]) => k).join(', ') : 'Aucun',
      lastUpdateDate: dossier.derniereMajAnnuelle || ''
    });
    setView('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const data = await checkAnnualUpdate(formData);
      setResult(data);

      // Update dossier if selected
      if (selectedClientId) {
        const updatedDossiers = dossiers.map(d => {
          if (d.id === selectedClientId) {
            return {
              ...d,
              derniereMajAnnuelle: new Date().toISOString().split('T')[0],
              statutMiseAJourAnnuelle: (data.elements_a_mettre_a_jour.length === 0 ? 'a_jour' : 'en_attente') as 'a_jour' | 'en_attente' | 'retard',
              historique: [{
                id: Math.random().toString(36).substring(2, 11),
                date: new Date().toISOString(),
                type: 'autre' as 'mail' | 'tel' | 'courrier' | 'autre',
                description: `Mise à jour annuelle effectuée. Éléments à revoir: ${data.elements_a_mettre_a_jour.length}.`
              }, ...(d.historique || [])]
            };
          }
          return d;
        });
        setDossiers(updatedDossiers);
        localStorage.setItem('grub-dossiers-v1', JSON.stringify(updatedDossiers));
      }
    } catch (err) {
      alert("Erreur lors de l'analyse annuelle.");
    } finally {
      setLoading(false);
    }
  };

  const trackingData = useMemo(() => {
    return dossiers.map(d => {
      const lastUpdate = d.derniereMajAnnuelle ? new Date(d.derniereMajAnnuelle) : new Date(d.createdAt);
      const nextUpdate = new Date(lastUpdate);
      nextUpdate.setFullYear(nextUpdate.getFullYear() + 1);
      
      const today = new Date();
      const diffDays = Math.ceil((nextUpdate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        id: d.id,
        name: d.raisonSociale,
        lastUpdate: d.derniereMajAnnuelle || d.createdAt.split('T')[0],
        nextUpdate: nextUpdate.toISOString().split('T')[0],
        daysRemaining: diffDays,
        status: d.statutMiseAJourAnnuelle || 'en_attente',
        risk: d.niveauRisqueIA || 'vert'
      };
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [dossiers]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex gap-4 border-b border-slate-700 pb-1">
        <button 
          onClick={() => setView('tracking')}
          className={`px-4 py-2 text-sm font-bold transition-all border-b-2 ${view === 'tracking' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Tableau de Suivi Annuel
        </button>
        <button 
          onClick={() => setView('form')}
          className={`px-4 py-2 text-sm font-bold transition-all border-b-2 ${view === 'form' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Nouvelle Analyse Annuelle
        </button>
      </div>

      {view === 'tracking' ? (
        <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-brand-primary" />
                Suivi des Mises à Jour Annuelles
             </h2>
             <div className="flex gap-2">
               <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-rose-500/20">
                 <AlertTriangle className="w-3 h-3" />
                 Clients Inquiétants
               </div>
             </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-dark/50 text-slate-200 text-[10px] font-bold uppercase tracking-widest border-b border-slate-800">
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Dernière MAJ</th>
                  <th className="px-6 py-4">Prochaine MAJ</th>
                  <th className="px-6 py-4">Délai</th>
                  <th className="px-6 py-4">État</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {trackingData.map((item) => (
                  <tr key={item.id} className={`hover:bg-brand-dark/30 transition-colors ${item.risk === 'rouge' ? 'bg-rose-500/5' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{item.name}</div>
                      <div className={`text-[10px] font-bold uppercase flex items-center gap-1 ${item.risk === 'rouge' ? 'text-rose-400' : item.risk === 'orange' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {item.risk === 'rouge' && <AlertTriangle className="w-3 h-3" />}
                        Risque {item.risk}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {new Date(item.lastUpdate).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-white">
                      {new Date(item.nextUpdate).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${
                        item.daysRemaining < 0 ? 'bg-rose-500/10 text-rose-400' :
                        item.daysRemaining < 30 ? 'bg-amber-500/10 text-amber-400' :
                        'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {item.daysRemaining < 0 ? `Retard de ${Math.abs(item.daysRemaining)}j` : `${item.daysRemaining} jours`}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className={`text-xs font-bold flex items-center gap-1 ${
                         item.status === 'a_jour' ? 'text-emerald-400' : 'text-amber-400'
                       }`}>
                         {item.status === 'a_jour' ? <CheckCircle2 className="w-3 h-3" /> : <RefreshCw className="w-3 h-3 animate-spin-slow" />}
                         {item.status === 'a_jour' ? 'À jour' : 'En attente'}
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
                        Analyser
                      </button>
                    </td>
                  </tr>
                ))}
                {trackingData.length === 0 && (
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
              <CalendarClock className="w-5 h-5 text-brand-primary" />
              Analyse de Mise à Jour Annuelle
            </h2>
            <div className="w-64">
              <ClientSelector 
                dossiers={dossiers} 
                onSelect={handleSelectClient} 
                selectedId={selectedClientId}
                label="Client à analyser"
              />
            </div>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Raison sociale</label>
                <input required name="companyName" value={formData.companyName} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Date dernier contrôle</label>
                <input type="date" name="lastUpdateDate" value={formData.lastUpdateDate} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
              </div>
               <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Documents manquants actuels</label>
                <input name="missingDocs" value={formData.missingDocs} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Date Kbis actuel</label>
                <input type="date" name="kbisDate" value={formData.kbisDate} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Date liste Bénéficiaires Effectifs</label>
                <input type="date" name="uboDate" value={formData.uboDate} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button type="submit" disabled={loading} className="flex items-center gap-2 bg-brand-primary text-brand-dark font-bold px-6 py-2 rounded-lg hover:bg-brand-primary/90 transition disabled:opacity-50">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Vérification..." : "Vérifier la mise à jour"}
              </button>
            </div>
          </form>

          {result && (
            <div className="mt-8 grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-brand-dark rounded-xl border border-slate-700 p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-brand-light rounded-lg border border-slate-700">
                      <RefreshCw className="w-6 h-6 text-brand-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold text-white">Éléments à mettre à jour</h3>
                          <p className="text-slate-400 text-sm mt-1">{result.commentaire}</p>
                        </div>
                        <div className="flex gap-2">
                          <button className="flex items-center gap-2 bg-brand-light border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-dark transition">
                            <FileText className="w-3.5 h-3.5" />
                            Générer Récap
                          </button>
                          <button className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-primary/20 transition">
                            <Sparkles className="w-3.5 h-3.5" />
                            Générer Prompt
                          </button>
                        </div>
                      </div>
                    </div>
                </div>
                
                <div className="mb-6">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Liste des actions</h4>
                    <ul className="grid gap-2">
                      {result.elements_a_mettre_a_jour.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm text-slate-200 bg-brand-light p-2 rounded border border-slate-700">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            {item}
                          </li>
                      ))}
                    </ul>
                </div>

                <div className="border-t border-slate-700 pt-6">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Mail className="w-3 h-3" /> Proposition de Mail
                      </h4>
                      <button className="flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline">
                        <Send className="w-3 h-3" />
                        Envoyer au client
                      </button>
                    </div>
                    <div className="bg-brand-light rounded-lg border border-slate-700 p-4">
                      <div className="mb-2 pb-2 border-b border-slate-700 text-sm font-medium text-white">
                          Objet: {result.proposition_mail.objet_mail}
                      </div>
                      <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                          {result.proposition_mail.corps_mail}
                      </div>
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

export default AnnualUpdate;
