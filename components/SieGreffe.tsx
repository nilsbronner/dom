import React, { useState } from 'react';
import { SieGreffeInput, SieGreffeResult, DossierDomiciliation } from '../types';
import { generateSieGreffeData } from '../services/geminiService';
import { Loader2, Building2, FileJson, Copy, Check, Search } from 'lucide-react';
import ClientSelector from './ClientSelector';

interface SieGreffeProps {
  dossiers?: DossierDomiciliation[];
  onUpdateDossier?: (dossier: DossierDomiciliation) => void;
}

const SieGreffe: React.FC<SieGreffeProps> = ({ dossiers: propsDossiers, onUpdateDossier }) => {
  const [dossiers, setDossiers] = useState<DossierDomiciliation[]>(propsDossiers || []);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!propsDossiers) {
      const saved = localStorage.getItem('grub-dossiers-v1');
      if (saved) setDossiers(JSON.parse(saved));
    }
  }, [propsDossiers]);

  const handleUpdateLocalDossier = (updated: DossierDomiciliation) => {
    if (onUpdateDossier) {
      onUpdateDossier(updated);
    } else {
      const updatedDossiers = dossiers.map(d => d.id === updated.id ? updated : d);
      setDossiers(updatedDossiers);
      localStorage.setItem('grub-dossiers-v1', JSON.stringify(updatedDossiers));
    }
  };
  const [result, setResult] = useState<SieGreffeResult | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [formData, setFormData] = useState<SieGreffeInput>({
    companyName: '',
    legalForm: '',
    siret: '',
    rcs: 'Strasbourg',
    address: 'GRUB Domiciliation...',
    startDate: '',
    managerInfo: ''
  });
  const [copied, setCopied] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectClient = (dossier: DossierDomiciliation) => {
    setSelectedClientId(dossier.id);
    setFormData({
      companyName: dossier.raisonSociale,
      legalForm: dossier.formeJuridique,
      siret: dossier.siret,
      rcs: dossier.rcsVille,
      address: 'GRUB Domiciliation...',
      startDate: dossier.dateDebut,
      managerInfo: `${dossier.prenomGerant} ${dossier.nomGerant}`
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const data = await generateSieGreffeData(formData);
      setResult(data);

      // Update dossier if selected
      if (selectedClientId && onUpdateDossier) {
        const dossier = dossiers.find(d => d.id === selectedClientId);
        if (dossier) {
          const updatedDossier: DossierDomiciliation = {
            ...dossier,
            aInclureProchaineListe: false // Marked as processed
          };
          onUpdateDossier(updatedDossier);
        }
      }
    } catch (err) {
      alert("Erreur lors de la génération des données.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if(result) {
        navigator.clipboard.writeText(JSON.stringify(result.sie_greffe, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-primary" />
            Export Données SIE / Greffe
          </h2>
          {dossiers.length > 0 && (
            <div className="w-64">
              <ClientSelector 
                dossiers={dossiers} 
                onSelect={handleSelectClient} 
                selectedId={selectedClientId}
                label="Client à exporter"
              />
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Raison sociale</label>
              <input required name="companyName" value={formData.companyName} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Forme juridique</label>
              <input name="legalForm" value={formData.legalForm} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">SIRET</label>
              <input name="siret" value={formData.siret} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">RCS</label>
              <input name="rcs" value={formData.rcs} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Date début domiciliation</label>
              <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Infos Gérant (Nom/Prénom)</label>
              <input name="managerInfo" value={formData.managerInfo} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
            </div>
            
            <div className="md:col-span-2 flex justify-end">
               <button type="submit" disabled={loading} className="flex items-center gap-2 bg-brand-primary text-brand-dark font-bold px-6 py-2 rounded-lg hover:bg-brand-primary/90 transition disabled:opacity-50">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Génération..." : "Générer JSON"}
              </button>
            </div>
        </form>
      </div>

       {result && (
        <div className="bg-brand-light rounded-xl shadow-lg border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                 <h3 className="text-lg font-semibold text-white">Données Structurées</h3>
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-2 text-xs font-bold text-slate-200 bg-brand-dark hover:bg-brand-dark/80 px-3 py-1.5 rounded-md border border-slate-700 transition"
                >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copié JSON" : "Copier JSON"}
                </button>
            </div>
            
            <p className="text-sm text-slate-400 mb-4 italic">{result.commentaire}</p>

            <div className="bg-brand-dark p-4 rounded-lg overflow-x-auto border border-slate-700">
               <pre className="text-xs text-emerald-400 font-mono leading-relaxed">
                  {JSON.stringify(result.sie_greffe, null, 2)}
               </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SieGreffe;
