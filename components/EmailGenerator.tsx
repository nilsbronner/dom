import React, { useState } from 'react';
import { EmailInput, EmailTemplateType, DossierDomiciliation } from '../types';
import { generateEmail } from '../services/geminiService';
import { Loader2, Mail, Copy, Check, Search } from 'lucide-react';
import ClientSelector from './ClientSelector';

interface EmailGeneratorProps {
  dossiers?: DossierDomiciliation[];
  onUpdateDossier?: (dossier: DossierDomiciliation) => void;
}

const EmailGenerator: React.FC<EmailGeneratorProps> = ({ dossiers: propsDossiers, onUpdateDossier }) => {
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
  const [generatedEmail, setGeneratedEmail] = useState<{subject: string, body: string} | null>(null);
  const [copied, setCopied] = useState(false);
  const [template, setTemplate] = useState<EmailTemplateType>(EmailTemplateType.REMINDER_1);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [formData, setFormData] = useState<EmailInput>({
    companyName: '',
    missingDocs: '',
    delayDays: '',
    dateRelance1: '',
    history: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectClient = (dossier: DossierDomiciliation) => {
    setSelectedClientId(dossier.id);
    setFormData({
      companyName: dossier.raisonSociale,
      missingDocs: dossier.docs ? Object.entries(dossier.docs).filter(([_, v]) => !v).map(([k]) => k).join(', ') : 'Aucun',
      delayDays: '15',
      dateRelance1: '',
      history: dossier.relances && dossier.relances.length > 0 
        ? dossier.relances.map(r => `${r.type} le ${r.date}`).join(', ') 
        : ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGeneratedEmail(null);
    try {
      const result = await generateEmail(template, formData);
      setGeneratedEmail({
        subject: result.objet_mail,
        body: result.corps_mail
      });

      // Update dossier if selected
      if (selectedClientId && onUpdateDossier) {
        const dossier = dossiers.find(d => d.id === selectedClientId);
        if (dossier) {
          const updatedDossier: DossierDomiciliation = {
            ...dossier,
            relances: [
              ...(dossier.relances || []),
              {
                type: template as any,
                date: new Date().toISOString().split('T')[0],
                mailGenere: result.corps_mail
              }
            ],
            historique: [
              ...(dossier.historique || []),
              {
                id: Math.random().toString(36).substr(2, 9),
                date: new Date().toISOString().split('T')[0],
                type: 'mail',
                description: `Relance générée: ${template}`
              }
            ]
          };
          onUpdateDossier(updatedDossier);
        }
      }
    } catch (err) {
      alert("Erreur lors de la génération du mail.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedEmail) {
        const fullText = `Objet: ${generatedEmail.subject}\n\n${generatedEmail.body}`;
        navigator.clipboard.writeText(fullText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-brand-primary" />
            Générateur de Relances
          </h2>
          {dossiers.length > 0 && (
            <div className="w-64">
              <ClientSelector 
                dossiers={dossiers} 
                onSelect={handleSelectClient} 
                selectedId={selectedClientId}
                label="Client à relancer"
              />
            </div>
          )}
        </div>
        
        <div className="flex gap-4 mb-6 border-b border-slate-800 pb-6 overflow-x-auto">
          <button 
            onClick={() => setTemplate(EmailTemplateType.REMINDER_1)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${template === EmailTemplateType.REMINDER_1 ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'bg-brand-dark text-slate-400 border border-slate-700 hover:bg-brand-dark/80'}`}
          >
            Relance Simple
          </button>
          <button 
            onClick={() => setTemplate(EmailTemplateType.REMINDER_2)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${template === EmailTemplateType.REMINDER_2 ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'bg-brand-dark text-slate-400 border border-slate-700 hover:bg-brand-dark/80'}`}
          >
            Rappel Légal (Ferme)
          </button>
          <button 
            onClick={() => setTemplate(EmailTemplateType.FORMAL_NOTICE)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${template === EmailTemplateType.FORMAL_NOTICE ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-brand-dark text-slate-400 border border-slate-700 hover:bg-brand-dark/80'}`}
          >
            Mise en Demeure
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Raison sociale</label>
              <input required name="companyName" value={formData.companyName} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
           </div>
           
           <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Documents manquants</label>
              <input required name="missingDocs" value={formData.missingDocs} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" placeholder="Liste des documents..." />
           </div>

           {template === EmailTemplateType.REMINDER_1 && (
             <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Retard (jours)</label>
                <input name="delayDays" value={formData.delayDays} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" placeholder="ex: 15" />
             </div>
           )}

           {template === EmailTemplateType.REMINDER_2 && (
             <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Date première relance</label>
                <input type="date" name="dateRelance1" value={formData.dateRelance1} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm" />
             </div>
           )}

           {template === EmailTemplateType.FORMAL_NOTICE && (
             <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Historique des relances</label>
                <input name="history" value={formData.history} onChange={handleChange} className="w-full rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2 text-sm placeholder:text-slate-500" placeholder="ex: Relances le 10/01 et 24/01" />
             </div>
           )}

          <div className="md:col-span-2 flex justify-end mt-4">
            <button type="submit" disabled={loading} className="flex items-center gap-2 bg-brand-primary text-brand-dark font-bold px-6 py-2 rounded-lg hover:bg-brand-primary/90 transition disabled:opacity-50">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Génération..." : "Générer l'email"}
            </button>
          </div>
        </form>
      </div>

      {generatedEmail && (
        <div className="bg-brand-light rounded-xl shadow-lg border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 relative group">
           <div className="absolute top-4 right-4">
              <button 
                onClick={handleCopy}
                className="flex items-center gap-2 text-xs font-bold text-slate-200 bg-brand-dark hover:bg-brand-dark/80 px-3 py-1.5 rounded-md border border-slate-700 transition"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copié !" : "Copier"}
              </button>
           </div>
           <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Aperçu du Mail</h3>
              <div className="bg-brand-dark p-6 rounded-lg border border-slate-700 text-sm text-slate-200 space-y-4">
                <div className="font-bold border-b border-slate-700 pb-2">
                    Objet : <span className="font-normal">{generatedEmail.subject}</span>
                </div>
                <div className="whitespace-pre-wrap font-mono leading-relaxed">
                    {generatedEmail.body}
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default EmailGenerator;
