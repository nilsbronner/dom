
import React, { useState } from 'react';
import { ShieldCheck, CheckCircle, Send, Building2, User, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DossierDomiciliation } from '../../types';

const uid = () => Math.random().toString(36).substring(2, 11);

const dossierVide = (): Partial<DossierDomiciliation> => ({
  id: uid(),
  createdAt: new Date().toISOString(),
  statut: 'en_cours',
  raisonSociale: '',
  formeJuridique: 'SAS',
  siret: '',
  rcsVille: '',
  activite: '',
  descriptionActivite: '',
  nomGerant: '',
  prenomGerant: '',
  nationaliteGerant: '',
  paysOrigine: 'France',
  tel: '',
  email: '',
  adresseDomicile: '',
  dateDebut: new Date().toISOString().split('T')[0],
  origineFonds: '',
  beneficiairesDeclares: '',
  utilisationAdresse: 'Siège social',
  estPPE: false,
  appartenancePolitiqueReligieuse: false,
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
  historique: []
});

const ClientOnboardingForm: React.FC = () => {
  const [step, setStep] = useState(1);
  const [dossier, setDossier] = useState<Partial<DossierDomiciliation>>(dossierVide());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (fields: Partial<DossierDomiciliation>) => setDossier(prev => ({ ...prev, ...fields }));

  const handleSubmit = async () => {
    if (!dossier.raisonSociale || !dossier.email || !dossier.nomGerant) {
      setError("Veuillez remplir au moins la raison sociale, le nom du gérant et l'email.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dossier)
      });

      const data = await response.json();
      if (data.success) {
        setIsSubmitted(true);
      } else {
        throw new Error(data.error || "Erreur lors de l'envoi");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl text-center space-y-6 border border-slate-100"
        >
          <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-900">Merci !</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Vos informations ont été transmises avec succès à l'équipe de <strong>Le Grub Dom</strong>.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl text-sm text-slate-600">
            Nous allons étudier votre dossier et vous recontacter très prochainement pour finaliser votre contrat de domiciliation.
          </div>
          <p className="text-xs text-slate-400">Vous pouvez maintenant fermer cette fenêtre.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6 font-sans text-slate-900">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center space-y-4">
          <div className="bg-brand-primary w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-brand-primary/20 rotate-3">
            <ShieldCheck className="w-8 h-8 text-brand-dark" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Le Grub Dom</h1>
            <p className="text-slate-500 font-medium">Formulaire d'ouverture de dossier de domiciliation</p>
          </div>
        </header>

        {/* Stepper */}
        <div className="flex justify-between mb-12 relative px-4">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
          {[
            { id: 1, label: 'Entreprise', icon: Building2 },
            { id: 2, label: 'Gérant', icon: User },
            { id: 3, label: 'TRACFIN', icon: FileText }
          ].map((s) => (
            <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 ${step >= s.id ? 'bg-brand-primary border-brand-primary text-brand-dark shadow-lg shadow-brand-primary/20' : 'bg-white border-slate-200 text-slate-400'}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${step >= s.id ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Informations sur l'entreprise</h3>
                  <p className="text-sm text-slate-500">Dites-nous en plus sur la structure que vous souhaitez domicilier.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Raison Sociale *</label>
                    <input 
                      type="text" 
                      value={dossier.raisonSociale} 
                      onChange={(e) => update({ raisonSociale: e.target.value })}
                      placeholder="Ex: Ma Super Entreprise"
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Forme Juridique</label>
                    <select 
                      value={dossier.formeJuridique} 
                      onChange={(e) => update({ formeJuridique: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    >
                      <option value="SAS">SAS / SASU</option>
                      <option value="SARL">SARL / EURL</option>
                      <option value="SCI">SCI</option>
                      <option value="Association">Association</option>
                      <option value="Auto-entrepreneur">Auto-entrepreneur</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">SIRET (si déjà créée)</label>
                    <input 
                      type="text" 
                      value={dossier.siret} 
                      onChange={(e) => update({ siret: e.target.value })}
                      placeholder="14 chiffres"
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ville du RCS</label>
                    <input 
                      type="text" 
                      value={dossier.rcsVille} 
                      onChange={(e) => update({ rcsVille: e.target.value })}
                      placeholder="Ex: Paris"
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Activité principale</label>
                    <input 
                      type="text" 
                      value={dossier.activite} 
                      onChange={(e) => update({ activite: e.target.value })}
                      placeholder="Ex: Conseil en informatique"
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Informations sur le gérant</h3>
                  <p className="text-sm text-slate-500">Identité et coordonnées du représentant légal.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prénom *</label>
                    <input 
                      type="text" 
                      value={dossier.prenomGerant} 
                      onChange={(e) => update({ prenomGerant: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nom *</label>
                    <input 
                      type="text" 
                      value={dossier.nomGerant} 
                      onChange={(e) => update({ nomGerant: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email de contact *</label>
                    <input 
                      type="email" 
                      value={dossier.email} 
                      onChange={(e) => update({ email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Téléphone</label>
                    <input 
                      type="tel" 
                      value={dossier.tel} 
                      onChange={(e) => update({ tel: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Adresse personnelle</label>
                    <input 
                      type="text" 
                      value={dossier.adresseDomicile} 
                      onChange={(e) => update({ adresseDomicile: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Conformité & TRACFIN</h3>
                  <p className="text-sm text-slate-500">Ces informations sont obligatoires pour la lutte contre le blanchiment.</p>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Origine des fonds</label>
                    <input 
                      type="text" 
                      value={dossier.origineFonds} 
                      onChange={(e) => update({ origineFonds: e.target.value })}
                      placeholder="Ex: Épargne personnelle, Prêt..."
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bénéficiaires Effectifs (Noms + %)</label>
                    <textarea 
                      value={dossier.beneficiairesDeclares} 
                      onChange={(e) => update({ beneficiairesDeclares: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                  
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <label className="flex items-center gap-4 cursor-pointer group">
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${dossier.estPPE ? 'bg-brand-primary border-brand-primary' : 'bg-white border-slate-200'}`}>
                        {dossier.estPPE && <CheckCircle className="w-4 h-4 text-brand-dark" />}
                      </div>
                      <span className="text-sm font-medium text-slate-700">Le gérant ou un bénéficiaire est une PPE (Personne Politiquement Exposée)</span>
                      <input type="checkbox" className="hidden" checked={dossier.estPPE} onChange={(e) => update({ estPPE: e.target.checked })} />
                    </label>
                    
                    <label className="flex items-center gap-4 cursor-pointer group">
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${dossier.appartenancePolitiqueReligieuse ? 'bg-brand-primary border-brand-primary' : 'bg-white border-slate-200'}`}>
                        {dossier.appartenancePolitiqueReligieuse && <CheckCircle className="w-4 h-4 text-brand-dark" />}
                      </div>
                      <span className="text-sm font-medium text-slate-700">Appartenance à un organisme politique ou religieux</span>
                      <input type="checkbox" className="hidden" checked={dossier.appartenancePolitiqueReligieuse} onChange={(e) => update({ appartenancePolitiqueReligieuse: e.target.checked })} />
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="mt-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="mt-12 flex justify-between items-center pt-8 border-t border-slate-100">
            <button 
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1 || isSubmitting}
              className="px-8 py-3 rounded-xl font-bold text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all"
            >
              Précédent
            </button>
            
            {step < 3 ? (
              <button 
                onClick={() => setStep(s => s + 1)}
                className="bg-brand-primary text-brand-dark font-black px-10 py-3 rounded-xl hover:scale-105 transition-all shadow-lg shadow-brand-primary/20"
              >
                Suivant
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-brand-dark text-white font-black px-10 py-3 rounded-xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 flex items-center gap-2 disabled:opacity-70"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {isSubmitting ? "Envoi..." : "Envoyer mon dossier"}
              </button>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          En soumettant ce formulaire, vous acceptez que vos données soient traitées par Le Grub Dom dans le cadre de votre demande de domiciliation.
        </p>
      </div>
    </div>
  );
};

export default ClientOnboardingForm;
