/**
 * DomiciliationModule.tsx
 * Module complet de gestion des domiciliations — GRUB Pilot
 *
 * Design system : brand-dark #1a1a1a | brand-light #2f2f2f | brand-primary #FFC700
 * Stack : React 19 + TypeScript + Tailwind
 * Données : Supabase = source de vérité, localStorage = cache de rendu instantané
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Shield, ChevronLeft, Search, Users, CreditCard, Mail,
  Clock, FileText, AlertTriangle, CheckCircle, XCircle,
  Bell, BarChart3, RefreshCw, ExternalLink, Eye, EyeOff, Info,
  Building2, Trash2, ChevronRight, Sparkles, X, Filter, Download, FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DossierDomiciliation, StatutDossier, StatutPaiement,
  PaiementDom, HistoriqueEntry, AlerteTracfin, NiveauRisque,
  OptionCourrier, TypeEchange, PeriodiciteTarif
} from './types';
import { GoogleGenAI } from "@google/genai";
import { loadAll, loadCached, saveDossier, deleteDossier as deleteDossierApi, saveBulk, getLastSync } from './services/dossierService';
import { syncDocsChecklist, docsCompleteness, uploadFile, type DocsChecklist, type DossierFile, type Category } from './services/storageService';
import ClientDocumentExplorer from './components/ClientDocumentExplorer';
import ImportClientModal from './components/ImportClientModal';

// --- Helpers ---

const uid = () => Math.random().toString(36).substring(2, 11);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '-';
const fmtMontant = (m: number | null) => m !== null ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(m) : '-';

const dossierVide = (): DossierDomiciliation => ({
  id: uid(),
  createdAt: new Date().toISOString(),
  statut: 'en_cours',
  
  // --- CLIENTS Data ---
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
  
  // --- TRACFIN Data ---
  origineFonds: '',
  beneficiairesDeclares: '',
  utilisationAdresse: 'Siège social',
  estPPE: false,
  appartenancePolitiqueReligieuse: false,
  commentairesControlesInitiaux: '',
  
  // --- AI Risk Analysis ---
  niveauRisqueIA: 'vert',
  decisionRisqueIA: '',
  commentaireRisqueIA: '',
  
  // --- Suivi Périodique ---
  statutMiseAJourAnnuelle: 'a_jour',
  derniereMajAnnuelle: new Date().toISOString(),
  dernierControleTrimestriel: new Date().toISOString(),
  statutConformiteTrimestrielle: 'Conforme',
  
  // --- Domiciliation Details ---
  tarifChoisi: 'mensuel',
  montantMensuel: 50,
  optionCourrier: 'standard',
  numeroBal: '',
  
  // --- DOCUMENTS Checklist ---
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
  
  // --- RELANCES ---
  relances: [],
  
  // --- SIE / GREFFE ---
  aInclureProchaineListe: true,
  
  // --- Logs ---
  paiements: [],
  historique: []
});

// Implémente la Matrice des risques GRUB v3.0 — 7 critères, scores 1-5, total 7-35
const evaluerRisque = (d: DossierDomiciliation): { niveau: NiveauRisque; alertes: AlerteTracfin[]; scoreTotal: number } => {
  const alertes: AlerteTracfin[] = [];
  const scores: number[] = [];

  // Critère 1 — Origine géographique
  const pays = (d.paysOrigine || '').trim();
  const paysListeNoire = ['Iran', 'Corée du Nord', 'Myanmar', 'Syrie', 'Yémen', 'Russie', 'Belarus', 'Cuba', 'Libye', 'Somalie', 'Corée'];
  const paysListeGrise = ['Algérie', 'Angola', 'Burkina Faso', 'Cameroun', 'Haïti', 'Jamaïque', 'Mali', 'Mozambique', 'Nigéria', 'Philippines', 'Sénégal', 'Tanzanie', 'Vietnam', 'Éthiopie', 'Liban', 'Mongolie', 'Syrie', 'Myanmar'];
  const paysUESurveillance = ['Bulgarie', 'Malte', 'Chypre', 'Croatie', 'Roumanie'];
  const paysBlancs = ['France', 'Allemagne', 'Espagne', 'Italie', 'Belgique', 'Pays-Bas', 'Luxembourg', 'Portugal', 'Autriche', 'Suisse', 'Danemark', 'Suède', 'Finlande', 'Irlande', 'Pologne', 'Tchéquie', 'Hongrie', 'Slovaquie', 'Slovénie', 'Estonie', 'Lettonie', 'Lituanie', 'Grèce'];
  let scoreGeo = 3;
  if (!pays) scoreGeo = 3;
  else if (paysListeNoire.some(p => pays.toLowerCase().includes(p.toLowerCase()))) scoreGeo = 5;
  else if (paysListeGrise.some(p => pays.toLowerCase().includes(p.toLowerCase()))) scoreGeo = 4;
  else if (paysUESurveillance.some(p => pays.toLowerCase().includes(p.toLowerCase()))) scoreGeo = 2;
  else if (paysBlancs.some(p => pays.toLowerCase().includes(p.toLowerCase()))) scoreGeo = 1;
  scores.push(scoreGeo);
  if (scoreGeo === 5) alertes.push({ type: 'rouge', msg: 'Pays liste noire', detail: `Pays d'origine (${pays}) classé liste noire UE/GAFI. Refus ou signalement TRACFIN.` });
  else if (scoreGeo === 4) alertes.push({ type: 'rouge', msg: 'Pays liste grise GAFI', detail: `Pays d'origine (${pays}) sous surveillance renforcée GAFI.` });
  else if (scoreGeo === 3) alertes.push({ type: 'orange', msg: 'Pays tiers hors UE', detail: `Pays d'origine (${pays}) — vigilance renforcée requise.` });

  // Critère 2 — Activité
  const act = (d.activite || '').toLowerCase();
  const activitesSensibles4 = ['crypto', 'bitcoin', 'import-export', 'import export', 'forex', 'trading', 'change monnaie', 'immobilier', 'art ', 'diamant', 'casino', 'armement'];
  const activitesCash = ['restauration', 'restaurant', 'bar ', 'café', 'détail', 'coiffure', 'esthétique', 'beauté', 'nettoyage', 'blanchisserie', 'taxi', 'btp', 'travaux'];
  const activitesLiberales = ['avocat', 'notaire', 'médecin', 'comptable', 'expert-comptable', 'architecte', 'ingénieur conseil', 'consultant b2b', 'audit'];
  let scoreActivite = 2;
  if (!act || act.length < 5) scoreActivite = 5;
  else if (activitesSensibles4.some(k => act.includes(k))) scoreActivite = 4;
  else if (activitesCash.some(k => act.includes(k))) scoreActivite = 3;
  else if (activitesLiberales.some(k => act.includes(k))) scoreActivite = 1;
  scores.push(scoreActivite);
  if (scoreActivite === 5) alertes.push({ type: 'rouge', msg: 'Activité non identifiable', detail: 'Activité opaque ou non déclarée — refus ou signalement.' });
  else if (scoreActivite === 4) alertes.push({ type: 'rouge', msg: 'Activité à risque élevé', detail: `Secteur (${d.activite}) nécessite vigilance renforcée et justificatifs.` });
  else if (scoreActivite === 3) alertes.push({ type: 'orange', msg: 'Activité à usage de cash', detail: `L'activité (${d.activite}) présente un risque sectoriel TRACFIN.` });

  // Critère 3 — Bénéficiaires effectifs
  const beDeclaresOk = (d.beneficiairesDeclares || '').trim().length > 3;
  const listePresente = d.docs?.listeBeneficiaires ?? false;
  const cniBePresente = d.docs?.cniBeneficiaires ?? false;
  let scoreBE = 3;
  if (!beDeclaresOk && !listePresente) scoreBE = 5;
  else if (listePresente && !cniBePresente) scoreBE = 3;
  else if (listePresente && cniBePresente && beDeclaresOk) scoreBE = 1;
  else if (listePresente && cniBePresente) scoreBE = 2;
  scores.push(scoreBE);
  if (scoreBE >= 4) alertes.push({ type: 'rouge', msg: 'BE non identifiés', detail: 'Bénéficiaires effectifs non déclarés ou documents KYC manquants.' });
  else if (scoreBE === 3) alertes.push({ type: 'orange', msg: 'Dossier BE incomplet', detail: 'Liste des BE présente mais CNI manquante.' });

  // Critère 4 — PPE
  let scorePPE = 1;
  if (d.estPPE) scorePPE = 4;
  else if (d.appartenancePolitiqueReligieuse) scorePPE = 2;
  scores.push(scorePPE);
  if (scorePPE === 5) alertes.push({ type: 'rouge', msg: 'PPE sous sanction', detail: 'PPE sous sanction ou gel des avoirs — refus + déclaration de soupçon.' });
  else if (scorePPE === 4) alertes.push({ type: 'rouge', msg: 'PPE identifié', detail: 'Gérant ou bénéficiaire PPE national/étranger — vigilance renforcée obligatoire.' });
  else if (scorePPE === 2) alertes.push({ type: 'orange', msg: 'Lien politique/religieux', detail: 'Appartenance déclarée à un organisme politique ou religieux.' });

  // Critère 5 — Origine des fonds
  const fonds = (d.origineFonds || '').toLowerCase();
  let scoreFonds = 3;
  if (!fonds || fonds.length < 5) scoreFonds = 4;
  else if (['crypto', 'bitcoin', 'monnaie virtuelle', 'pays étranger', 'étranger'].some(k => fonds.includes(k))) scoreFonds = 4;
  else if (['non justifi', 'inconnu', 'suspect'].some(k => fonds.includes(k))) scoreFonds = 5;
  else if (['clair', 'identifié', 'salaire', 'épargne', 'apport', 'revenus d\'activité', 'activité professionnelle'].some(k => fonds.includes(k))) scoreFonds = 1;
  else if (['partiel', 'mixte', 'divers'].some(k => fonds.includes(k))) scoreFonds = 3;
  else scoreFonds = 2;
  scores.push(scoreFonds);
  if (scoreFonds >= 5) alertes.push({ type: 'rouge', msg: 'Fonds suspects', detail: 'Origine des fonds non justifiable — déclaration de soupçon requise.' });
  else if (scoreFonds === 4) alertes.push({ type: 'rouge', msg: 'Fonds à risque', detail: 'Origine des fonds non documentée ou provenant de pays à risque / cryptos.' });
  else if (scoreFonds === 3) alertes.push({ type: 'orange', msg: 'Origine des fonds incertaine', detail: 'Documentation de l\'origine des fonds incomplète.' });

  // Critère 6 — Nature des transactions (déduit de l'activité et utilisation adresse)
  const util = (d.utilisationAdresse || '').toLowerCase();
  let scoreTx = 1;
  if (scoreActivite === 5) scoreTx = 5;
  else if (scoreActivite === 4 || util.includes('crypto') || util.includes('multi')) scoreTx = 4;
  else if (scoreActivite === 3 || util.includes('cash') || util.includes('espèces')) scoreTx = 3;
  scores.push(scoreTx);
  if (scoreTx >= 4 && scoreTx > scoreActivite) alertes.push({ type: 'rouge', msg: 'Transactions à risque', detail: 'Structure des transactions nécessite vigilance renforcée.' });

  // Critère 7 — Comportement client
  const retardPaiement = (d.paiements ?? []).some(p => p.statut === 'impaye' || p.statut === 'retard');
  const relancesCount = (d.relances ?? []).filter(r => r.type !== 'Aucune').length;
  const docsObligatoires: (keyof typeof d.docs)[] = ['cniGerant', 'justifDomicileGerant', 'statuts', 'kbis', 'attestationCompta', 'listeBeneficiaires', 'contratSigne'];
  const manquants = docsObligatoires.filter(k => !d.docs?.[k]);
  let scoreComportement = 1;
  if (relancesCount >= 3) scoreComportement = 5;
  else if (relancesCount >= 2 || (retardPaiement && manquants.length >= 2)) scoreComportement = 4;
  else if (retardPaiement || manquants.length >= 2) scoreComportement = 3;
  else if (manquants.length === 1) scoreComportement = 2;
  scores.push(scoreComportement);
  if (scoreComportement === 5) alertes.push({ type: 'rouge', msg: 'Comportement non coopératif', detail: `${relancesCount} relances sans régularisation — résiliation + signalement TRACFIN.` });
  else if (scoreComportement === 4) alertes.push({ type: 'rouge', msg: 'Non-réponse prolongée', detail: 'Mise en demeure LRAR requise.' });
  else if (manquants.length > 0) alertes.push({ type: 'orange', msg: 'Dossier incomplet', detail: `${manquants.length} document(s) obligatoire(s) manquant(s).` });

  // --- Décision finale — Matrice GRUB v3.0 ---
  const scoreTotal = scores.reduce((a, b) => a + b, 0);
  const criteresEleveCount = scores.filter(s => s >= 4).length;
  const criteres5Count = scores.filter(s => s === 5).length;
  const alerte2criteres = criteresEleveCount >= 2;

  let niveau: NiveauRisque = 'vert';
  if (scoreTotal >= 29 || criteres5Count >= 2) {
    niveau = 'rouge';
    alertes.push({ type: 'rouge', msg: '⚠ Risque TRÈS ÉLEVÉ — Signalement TRACFIN', detail: `Score ${scoreTotal}/35. Refus systématique + déclaration de soupçon ERMES/TRACFIN obligatoire.` });
  } else if (scoreTotal >= 22 || alerte2criteres) {
    niveau = 'rouge';
    if (alerte2criteres) alertes.push({ type: 'rouge', msg: '⚠ Alerte automatique — Risque élevé', detail: `${criteresEleveCount} critères avec score ≥ 4 (règle d'alerte GRUB v3.0).` });
  } else if (scoreTotal >= 15) {
    niveau = 'orange';
  }

  return { niveau, alertes, scoreTotal };
};

// --- UI Components ---

const Inp = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">{label}</label>}
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-brand-light border border-slate-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all placeholder:text-slate-400"
    />
  </div>
);

const Sel = ({ label, value, onChange, options }: any) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">{label}</label>}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-brand-light border border-slate-700 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
    >
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Chk = ({ label, checked, onChange }: any) => (
  <label className="flex items-center gap-3 cursor-pointer group">
    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${checked ? 'bg-brand-primary border-brand-primary' : 'border-slate-600 group-hover:border-slate-400'}`}>
      {checked && <CheckCircle className="w-4 h-4 text-brand-dark" />}
    </div>
    <span className="text-sm text-slate-200 group-hover:text-white transition-colors">{label}</span>
    <input type="checkbox" className="hidden" checked={checked} onChange={(e) => onChange(e.target.checked)} />
  </label>
);

const Card = ({ children, className = "" }: any) => (
  <div className={`bg-brand-dark border border-slate-800 rounded-xl overflow-hidden shadow-xl ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ title, icon: Icon, children }: any) => (
  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-brand-light/30">
    <div className="flex items-center gap-3">
      {Icon && <Icon className="w-5 h-5 text-brand-primary" />}
      <h3 className="font-bold text-lg">{title}</h3>
    </div>
    {children}
  </div>
);

const RisqueBadge = ({ niveau }: { niveau: NiveauRisque }) => {
  const styles = {
    vert: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    orange: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    rouge: "bg-rose-500/10 text-rose-500 border-rose-500/20"
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${styles[niveau]}`}>
      Risque {niveau}
    </span>
  );
};

const StatutBadge = ({ statut }: { statut: StatutDossier }) => {
  const styles = {
    en_cours: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    actif: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    resiliation: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    archive: "bg-slate-500/10 text-slate-500 border-slate-500/20"
  };
  const labels = {
    en_cours: "En cours",
    actif: "Actif",
    resiliation: "Résiliation",
    archive: "Archivé"
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${styles[statut]}`}>
      {labels[statut]}
    </span>
  );
};

// --- Main Module ---

export default function DomiciliationModule() {
  const [dossiers, setDossiers] = useState<DossierDomiciliation[]>([]);
  const [view, setView] = useState<'dashboard' | 'nouveau' | 'fiche'>('dashboard');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(getLastSync());

  // 1. Render instantané depuis le cache local
  useEffect(() => {
    const cached = loadCached();
    if (cached.length > 0) setDossiers(cached);
  }, []);

  // 2. Source de vérité : refresh depuis Supabase au mount
  useEffect(() => {
    (async () => {
      setIsSyncing(true);
      setSyncError(null);
      try {
        const { dossiers: fresh, lastSync: ls } = await loadAll();
        setDossiers(fresh);
        if (ls) setLastSync(ls);
      } catch (err: any) {
        console.error("Initial Supabase sync error:", err);
        setSyncError(err.message || "Erreur de synchronisation.");
      } finally {
        setIsSyncing(false);
      }
    })();
  }, []);

  // Bulk resync (bouton manuel — utile en cas de désynchro multi-device)
  const handleSyncBulk = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      await saveBulk(dossiers);
      setLastSync(new Date().toISOString());
    } catch (err: any) {
      console.error("Bulk save error:", err);
      setSyncError(err.message);
      alert(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReloadFromSupabase = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const { dossiers: fresh, lastSync: ls } = await loadAll();
      setDossiers(fresh);
      if (ls) setLastSync(ls);
      alert(`${fresh.length} dossier(s) chargé(s).`);
    } catch (err: any) {
      console.error("Reload error:", err);
      setSyncError(err.message);
      alert(err.message || "Erreur lors du chargement");
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredDossiers = useMemo(() => {
    return dossiers.filter(d => 
      d.raisonSociale.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.nomGerant.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [dossiers, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: dossiers.length,
      actifs: dossiers.filter(d => d.statut === 'actif').length,
      enCours: dossiers.filter(d => d.statut === 'en_cours').length,
      alertes: dossiers.filter(d => evaluerRisque(d).niveau === 'rouge').length
    };
  }, [dossiers]);

  const handleSaveDossier = async (d: DossierDomiciliation) => {
    // Optimistic UI update
    setDossiers(prev => {
      const exists = prev.find(item => item.id === d.id);
      return exists ? prev.map(item => item.id === d.id ? d : item) : [d, ...prev];
    });
    setView('dashboard');

    // Persist to Supabase (cache localStorage is updated by saveDossier)
    try {
      await saveDossier(d);
    } catch (err: any) {
      console.error("Save error:", err);
      setSyncError(err.message);
      alert(`Sauvegarde Supabase échouée : ${err.message}\nLes changements sont en local mais pas encore synchronisés.`);
    }
  };

  const handleSimulateTally = () => {
    const mockTally = {
      raisonSociale: "TECH INNOVATIONS SARL",
      formeJuridique: "SARL",
      nomGerant: "DUPONT",
      prenomGerant: "Jean",
      activite: "Conseil en Informatique",
      descriptionActivite: "Développement de logiciels et conseil en cybersécurité.",
      origineFonds: "Apports personnels et prêt bancaire",
      beneficiairesDeclares: "Jean Dupont (100%)",
      paysOrigine: "France",
      email: "jean.dupont@techinnov.fr",
      tel: "0601020304",
      adresseDomicile: "123 Rue de la Paix, 75002 Paris"
    };

    const nouveau = {
      ...dossierVide(),
      ...mockTally,
      historique: [{
        id: uid(),
        date: new Date().toISOString(),
        type: 'autre' as TypeEchange,
        description: "Dossier importé automatiquement depuis Tally."
      }]
    };

    setDossiers(prev => [nouveau, ...prev]);
    setSelectedId(nouveau.id);
    setView('fiche');
    saveDossier(nouveau).catch(err => console.error("Tally save error:", err));
  };

  useEffect(() => {
    (window as any).simulateTally = handleSimulateTally;
  }, [dossiers]);

  const [importOpen, setImportOpen] = useState(false);

  const handleImportFromFolder = useCallback(async (
    raisonSociale: string,
    files: { file: File; category: Category }[]
  ) => {
    // 1. Création du dossier vide + raison sociale
    const nouveau: DossierDomiciliation = {
      ...dossierVide(),
      raisonSociale,
      historique: [{
        id: uid(),
        date: new Date().toISOString(),
        type: 'autre' as TypeEchange,
        description: `Import depuis dossier disque (${files.length} fichier${files.length > 1 ? 's' : ''}).`,
      }],
    };

    // 2. Optimistic UI : afficher tout de suite
    setDossiers(prev => [nouveau, ...prev]);
    setSelectedId(nouveau.id);
    setView('fiche');

    // 3. Persist dans Supabase
    await saveDossier(nouveau);

    // 4. Upload séquentiel des fichiers vers Storage
    const uploaded: DossierFile[] = [];
    for (const { file, category } of files) {
      try {
        const f = await uploadFile(nouveau.id, category, file);
        uploaded.push(f);
      } catch (err: any) {
        console.error(`Upload échoué pour ${file.name}:`, err.message);
        // On continue avec les autres
      }
    }

    // 5. Auto-sync de la checklist KYC + resave du dossier
    if (uploaded.length > 0) {
      const nextDocs = syncDocsChecklist(uploaded, nouveau.docs as DocsChecklist);
      const enriched = { ...nouveau, docs: { ...nouveau.docs, ...nextDocs } };
      setDossiers(prev => prev.map(d => d.id === nouveau.id ? enriched : d));
      await saveDossier(enriched);
    }
  }, []);

  const handleDeleteDossier = async (id: string) => {
    if (!window.confirm('Supprimer ce dossier ?')) return;
    // Optimistic UI update
    setDossiers(prev => prev.filter(d => d.id !== id));
    setView('dashboard');
    // Persist to Supabase
    try {
      await deleteDossierApi(id);
    } catch (err: any) {
      console.error("Delete error:", err);
      setSyncError(err.message);
      alert(`Suppression Supabase échouée : ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      <AnimatePresence mode="wait">
        {view === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Dashboard 
              stats={stats}
              dossiers={filteredDossiers}
              onNew={() => setView('nouveau')}
              onImport={() => setImportOpen(true)}
              onSelect={(id) => { setSelectedId(id); setView('fiche'); }}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              isSyncing={isSyncing}
              syncError={syncError}
              lastSync={lastSync}
              onSync={handleSyncBulk}
              onPull={handleReloadFromSupabase}
            />
          </motion.div>
        )}

        {view === 'nouveau' && (
          <motion.div
            key="nouveau"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <FormNouveau 
              onSave={handleSaveDossier}
              onCancel={() => setView('dashboard')}
            />
          </motion.div>
        )}

        {view === 'fiche' && selectedId && (
          <motion.div
            key="fiche"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <FicheDossier
              dossier={dossiers.find(d => d.id === selectedId)!}
              onSave={handleSaveDossier}
              onDelete={() => handleDeleteDossier(selectedId)}
              onBack={() => setView('dashboard')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ImportClientModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onConfirm={handleImportFromFolder}
      />
    </div>
  );
}

// --- Config Guide Component ---

// --- Dashboard Component ---

function Dashboard({ stats, dossiers, onNew, onImport, onSelect, searchTerm, setSearchTerm, isSyncing, syncError, lastSync, onSync, onPull }: any) {
  const [viewClientOpen, setViewClientOpen] = useState(false);
  return (
    <div className="space-y-6">
      {/* Supabase Sync Status */}
      <div className="flex flex-col gap-4 bg-brand-light/20 border border-slate-800 p-4 rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isSyncing ? 'bg-brand-primary animate-pulse' : 'bg-slate-700'}`}>
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'text-brand-dark animate-spin' : 'text-white'}`} />
            </div>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-widest">Base Supabase</p>
              <p className="text-[10px] text-slate-300">
                {lastSync
                  ? `Dernière synchro : ${new Date(lastSync).toLocaleString('fr-FR')}`
                  : 'Non synchronisé'}
                {' · '}
                {dossiers.length} dossier{dossiers.length > 1 ? 's' : ''} en base
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <button
                onClick={() => setViewClientOpen((v) => !v)}
                disabled={dossiers.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-brand-dark border border-slate-700 rounded-lg text-xs font-bold text-slate-100 hover:text-brand-primary transition-all disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                Visionner un dossier
                <ChevronRight className={`w-3 h-3 transition-transform ${viewClientOpen ? 'rotate-90' : ''}`} />
              </button>
              {viewClientOpen && dossiers.length > 0 && (
                <div className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto bg-brand-light border border-slate-700 rounded-xl shadow-2xl z-30">
                  <ul className="py-2">
                    {dossiers.map((d: DossierDomiciliation) => (
                      <li key={d.id}>
                        <button
                          onClick={() => {
                            setViewClientOpen(false);
                            onSelect(d.id);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-brand-dark transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{d.raisonSociale}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {d.formeJuridique || '—'} · {d.nomGerant || 'Sans gérant'}
                            </p>
                          </div>
                          <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button
              onClick={onPull}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-brand-light border border-slate-700 rounded-lg text-xs font-bold text-slate-100 hover:text-brand-primary transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Recharger depuis Supabase
            </button>
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-brand-dark rounded-lg text-xs font-bold hover:scale-105 transition-all disabled:opacity-50"
            >
              {isSyncing ? 'Synchronisation…' : 'Sauvegarder vers Supabase'}
            </button>
          </div>
        </div>

        {syncError && (
          <div className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200 flex-1">
              <p className="font-bold mb-1">Erreur de synchronisation Supabase :</p>
              <p>{syncError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Dossiers', val: stats.total, icon: Users, color: 'text-blue-400' },
          { label: 'Clients Actifs', val: stats.actifs, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'En Traitement', val: stats.enCours, icon: Clock, color: 'text-amber-400' },
          { label: 'Alertes Rouges', val: stats.alertes, icon: AlertTriangle, color: 'text-rose-400' },
        ].map((s, i) => (
          <Card key={i} className="p-6 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-brand-light ${s.color}`}>
              <s.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">{s.label}</p>
              <p className="text-2xl font-black text-white">{s.val}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Actions & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-200" />
          <input 
            type="text"
            placeholder="Rechercher une entreprise, un gérant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-brand-light border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all placeholder:text-slate-400"
          />
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button
            onClick={() => (window as any).simulateTally()}
            className="flex-1 md:flex-none bg-brand-light border border-slate-700 text-white font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            Import Tally
          </button>
          <button
            onClick={onImport}
            className="flex-1 md:flex-none bg-brand-light border border-slate-700 text-white font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
          >
            <FolderOpen className="w-5 h-5" />
            Importer dossier
          </button>
          <button
            onClick={onNew}
            className="flex-1 md:flex-none bg-brand-primary text-brand-dark font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-brand-primary/20"
          >
            <Plus className="w-5 h-5" />
            Nouveau Dossier
          </button>
        </div>
      </div>

      {/* Dossiers Table */}
      <Card>
        <CardHeader title="Liste des Domiciliations" icon={Building2} />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-light/50 text-slate-100 text-[10px] font-bold uppercase tracking-widest">
                <th className="px-6 py-4">Entreprise</th>
                <th className="px-6 py-4">Gérant</th>
                <th className="px-6 py-4">Risque</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Date Début</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {dossiers.map((d: DossierDomiciliation) => {
                const { niveau } = evaluerRisque(d);
                return (
                  <tr key={d.id} className="hover:bg-brand-light/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{d.raisonSociale || 'Sans nom'}</div>
                      <div className="text-xs text-slate-200">{d.formeJuridique} • {d.siret || 'SIRET non renseigné'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-100">{d.nomGerant}</div>
                      <div className="text-xs text-slate-200">{d.paysOrigine}</div>
                    </td>
                    <td className="px-6 py-4">
                      <RisqueBadge niveau={niveau} />
                    </td>
                    <td className="px-6 py-4">
                      <StatutBadge statut={d.statut} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-100">
                      {fmtDate(d.dateDebut)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => onSelect(d.id)}
                        className="p-2 rounded-lg bg-brand-light text-slate-100 hover:text-brand-primary transition-colors"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {dossiers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-100 italic">
                    Aucun dossier trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// --- Form Nouveau Component ---

function FormNouveau({ onSave, onCancel }: any) {
  const [step, setStep] = useState(1);
  const [dossier, setDossier] = useState<DossierDomiciliation>(dossierVide());

  const update = (fields: Partial<DossierDomiciliation>) => setDossier({ ...dossier, ...fields });

  const steps = [
    { id: 1, label: 'Entreprise', icon: Building2 },
    { id: 2, label: 'TRACFIN', icon: Shield },
    { id: 3, label: 'Documents', icon: FileText },
    { id: 4, label: 'Résumé', icon: CheckCircle },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
          Retour
        </button>
        <h2 className="text-2xl font-black">Nouveau Dossier Domiciliation</h2>
        <div className="w-24" />
      </div>

      {/* Progress Stepper */}
      <div className="flex justify-between relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
        {steps.map((s) => (
          <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${step >= s.id ? 'bg-brand-primary border-brand-primary text-brand-dark' : 'bg-brand-dark border-slate-700 text-slate-300'}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${step >= s.id ? 'text-brand-primary' : 'text-slate-300'}`}>{s.label}</span>
          </div>
        ))}
      </div>

      <Card className="p-8">
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
            <Inp label="Raison Sociale" value={dossier.raisonSociale} onChange={(v: string) => update({ raisonSociale: v })} />
            <div className="grid grid-cols-2 gap-4">
              <Inp label="Forme Juridique" value={dossier.formeJuridique} onChange={(v: string) => update({ formeJuridique: v })} />
              <Inp label="Ville RCS" value={dossier.rcsVille} onChange={(v: string) => update({ rcsVille: v })} />
            </div>
            <Inp label="SIRET" value={dossier.siret} onChange={(v: string) => update({ siret: v })} />
            <Inp label="Activité (Secteur)" value={dossier.activite} onChange={(v: string) => update({ activite: v })} />
            <div className="md:col-span-2">
              <Inp label="Description d'activité détaillée" value={dossier.descriptionActivite} onChange={(v: string) => update({ descriptionActivite: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Inp label="Prénom Gérant" value={dossier.prenomGerant} onChange={(v: string) => update({ prenomGerant: v })} />
              <Inp label="Nom Gérant" value={dossier.nomGerant} onChange={(v: string) => update({ nomGerant: v })} />
            </div>
            <Inp label="Pays d'Origine" value={dossier.paysOrigine} onChange={(v: string) => update({ paysOrigine: v })} />
            <Inp label="Email" type="email" value={dossier.email} onChange={(v: string) => update({ email: v })} />
            <Inp label="Téléphone" value={dossier.tel} onChange={(v: string) => update({ tel: v })} />
            <Inp label="Adresse Personnelle Gérant" value={dossier.adresseDomicile} onChange={(v: string) => update({ adresseDomicile: v })} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Inp label="Origine des fonds" value={dossier.origineFonds} onChange={(v: string) => update({ origineFonds: v })} />
              <Inp label="Utilisation de l'adresse" value={dossier.utilisationAdresse} onChange={(v: string) => update({ utilisationAdresse: v })} />
              <div className="md:col-span-2">
                <Inp label="Bénéficiaires Effectifs (Noms + %)" value={dossier.beneficiairesDeclares} onChange={(v: string) => update({ beneficiairesDeclares: v })} />
              </div>
            </div>
            <div className="p-6 bg-brand-light/30 rounded-xl border border-slate-700 space-y-4">
              <h4 className="font-bold flex items-center gap-2 text-amber-500">
                <Shield className="w-4 h-4" />
                Vérification TRACFIN (B-A BA)
              </h4>
              <Chk label="Le gérant ou un bénéficiaire est une PPE (Personne Politiquement Exposée)" checked={dossier.estPPE} onChange={(v: boolean) => update({ estPPE: v })} />
              <Chk label="Appartenance à un organisme politique ou religieux" checked={dossier.appartenancePolitiqueReligieuse} onChange={(v: boolean) => update({ appartenancePolitiqueReligieuse: v })} />
              <div className="pt-4">
                <Inp label="Commentaires contrôles initiaux" value={dossier.commentairesControlesInitiaux} onChange={(v: string) => update({ commentairesControlesInitiaux: v })} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-right-4 duration-300">
            <Chk label="Pièce d'identité Gérant" checked={dossier.docs.cniGerant} onChange={(v: boolean) => update({ docs: { ...dossier.docs, cniGerant: v } })} />
            <Chk label="Justificatif Domicile Gérant (< 3 mois)" checked={dossier.docs.justifDomicileGerant} onChange={(v: boolean) => update({ docs: { ...dossier.docs, justifDomicileGerant: v } })} />
            <Chk label="Statuts de l'entreprise" checked={dossier.docs.statuts} onChange={(v: boolean) => update({ docs: { ...dossier.docs, statuts: v } })} />
            <Chk label="KBIS (ou preuve création)" checked={dossier.docs.kbis} onChange={(v: boolean) => update({ docs: { ...dossier.docs, kbis: v } })} />
            <Chk label="Attestation détention docs comptables" checked={dossier.docs.attestationCompta} onChange={(v: boolean) => update({ docs: { ...dossier.docs, attestationCompta: v } })} />
            <Chk label="Liste des Bénéficiaires Effectifs" checked={dossier.docs.listeBeneficiaires} onChange={(v: boolean) => update({ docs: { ...dossier.docs, listeBeneficiaires: v } })} />
            <Chk label="Pièce d'identité Bénéficiaires" checked={dossier.docs.cniBeneficiaires} onChange={(v: boolean) => update({ docs: { ...dossier.docs, cniBeneficiaires: v } })} />
            <Chk label="Contrat de Domiciliation signé" checked={dossier.docs.contratSigne} onChange={(v: boolean) => update({ docs: { ...dossier.docs, contratSigne: v } })} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <h4 className="font-bold text-emerald-500 mb-2">Prêt pour enregistrement</h4>
              <p className="text-sm text-slate-200">Veuillez vérifier les informations avant de valider le dossier.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-300">Entreprise:</span> {dossier.raisonSociale}</div>
              <div><span className="text-slate-300">Gérant:</span> {dossier.nomGerant}</div>
              <div><span className="text-slate-300">Risque estimé:</span> <RisqueBadge niveau={evaluerRisque(dossier).niveau} /></div>
            </div>
          </div>
        )}

        <div className="mt-12 flex justify-between pt-8 border-t border-slate-800">
          <button 
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-6 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30 transition-all"
          >
            Précédent
          </button>
          {step < 4 ? (
            <button 
              onClick={() => setStep(s => s + 1)}
              className="bg-brand-primary text-brand-dark font-bold px-8 py-2.5 rounded-lg hover:scale-105 transition-transform"
            >
              Suivant
            </button>
          ) : (
            <button 
              onClick={() => onSave(dossier)}
              className="bg-emerald-500 text-white font-bold px-10 py-2.5 rounded-lg hover:scale-105 transition-transform shadow-lg shadow-emerald-500/20"
            >
              Enregistrer le Dossier
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

// --- Fiche Dossier Component ---

function FicheDossier({ dossier, onSave, onDelete, onBack }: any) {
  const [tab, setTab] = useState<'info' | 'tracfin' | 'documents' | 'suivi' | 'relances' | 'paiements' | 'courrier' | 'export' | 'historique'>('info');
  const [editDossier, setEditDossier] = useState<DossierDomiciliation>(dossier);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const update = (fields: Partial<DossierDomiciliation>) => setEditDossier({ ...editDossier, ...fields });

  const handleAiAnalysis = async (mode: string = "analyse_risque") => {
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const prompt = `Tu es l'ASSISTANT LE GRUB DOM. 
      Mode: ${mode}
      
      Dossier Client:
      Entreprise: ${editDossier.raisonSociale} (${editDossier.formeJuridique})
      Activité: ${editDossier.activite} - ${editDossier.descriptionActivite}
      Gérant: ${editDossier.prenomGerant} ${editDossier.nomGerant} (Pays: ${editDossier.paysOrigine})
      Origine des fonds: ${editDossier.origineFonds}
      Bénéficiaires: ${editDossier.beneficiairesDeclares}
      PPE: ${editDossier.estPPE ? 'OUI' : 'NON'}
      Appartenance Politique/Religieuse: ${editDossier.appartenancePolitiqueReligieuse ? 'OUI' : 'NON'}
      
      Documents: ${JSON.stringify(editDossier.docs)}
      
      Analyse ce dossier selon les critères TRACFIN (B-A BA).
      Donne un avis structuré (JSON si possible ou texte clair) sur le niveau de risque, la décision (Accepter/Refuser/Vigilance) et les commentaires.`;
      
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      setAiAnalysis(result.text);
    } catch (err) {
      console.error(err);
      setAiAnalysis("Erreur lors de l'analyse IA.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-200 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
          Retour Dashboard
        </button>
        <div className="flex gap-3">
          <button onClick={() => onSave(editDossier)} className="bg-emerald-500 text-white font-bold px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-600 transition-colors">
            <CheckCircle className="w-4 h-4" />
            Enregistrer
          </button>
          <button onClick={onDelete} className="bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold px-4 py-2 rounded-lg hover:bg-rose-500 hover:text-white transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Card>
        <div className="p-8 bg-brand-light/30 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h2 className="text-3xl font-black text-white">{editDossier.raisonSociale}</h2>
              <StatutBadge statut={editDossier.statut} />
            </div>
            <p className="text-slate-200 font-medium">{editDossier.formeJuridique} • SIRET: {editDossier.siret || 'N/A'}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <RisqueBadge niveau={evaluerRisque(editDossier).niveau} />
            {(() => {
              const c = docsCompleteness(editDossier.docs as DocsChecklist);
              const pct = (c.provided / c.total) * 100;
              const color = c.provided === c.total ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                : c.provided >= c.total * 0.5 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                : 'text-rose-400 border-rose-500/30 bg-rose-500/10';
              return (
                <button
                  onClick={() => setTab('documents')}
                  className={`text-[10px] font-bold uppercase tracking-widest border rounded-full px-3 py-1 flex items-center gap-2 ${color} hover:opacity-80 transition`}
                  title={c.missing.length > 0 ? `Manquants : ${c.missing.join(', ')}` : 'Dossier complet'}
                >
                  <FolderOpen className="w-3 h-3" />
                  {c.provided}/{c.total} docs
                </button>
              );
            })()}
            <p className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">Créé le {fmtDate(editDossier.createdAt)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-brand-dark px-4 overflow-x-auto no-scrollbar">
          {[
            { id: 'info', label: 'Infos', icon: Info },
            { id: 'tracfin', label: 'TRACFIN', icon: Shield },
            { id: 'documents', label: 'Documents', icon: FolderOpen },
            { id: 'suivi', label: 'Suivi', icon: RefreshCw },
            { id: 'relances', label: 'Relances', icon: Bell },
            { id: 'paiements', label: 'Finance', icon: CreditCard },
            { id: 'courrier', label: 'Courrier', icon: Mail },
            { id: 'export', label: 'Export', icon: Download },
            { id: 'historique', label: 'Logs', icon: Clock },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-5 py-4 flex items-center gap-2 font-bold text-xs border-b-2 transition-all whitespace-nowrap ${tab === t.id ? 'border-brand-primary text-brand-primary bg-brand-primary/5' : 'border-transparent text-slate-200 hover:text-slate-100'}`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-8 min-h-[400px]">
          {tab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
              <div className="space-y-6">
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-[0.2em]">Identité Entreprise</h4>
                <Inp label="Raison Sociale" value={editDossier.raisonSociale} onChange={(v: string) => update({ raisonSociale: v })} />
                <div className="grid grid-cols-2 gap-4">
                  <Inp label="Forme Juridique" value={editDossier.formeJuridique} onChange={(v: string) => update({ formeJuridique: v })} />
                  <Inp label="Ville RCS" value={editDossier.rcsVille} onChange={(v: string) => update({ rcsVille: v })} />
                </div>
                <Inp label="SIRET" value={editDossier.siret} onChange={(v: string) => update({ siret: v })} />
                <Inp label="Activité" value={editDossier.activite} onChange={(v: string) => update({ activite: v })} />
                <Inp label="Description détaillée" value={editDossier.descriptionActivite} onChange={(v: string) => update({ descriptionActivite: v })} />
                <Sel label="Statut Dossier" value={editDossier.statut} onChange={(v: StatutDossier) => update({ statut: v })} options={[
                  { value: 'en_cours', label: 'En cours' },
                  { value: 'actif', label: 'Actif' },
                  { value: 'resiliation', label: 'Résiliation' },
                  { value: 'archive', label: 'Archivé' },
                ]} />
              </div>
              <div className="space-y-6">
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-[0.2em]">Gérance & Contact</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Inp label="Prénom" value={editDossier.prenomGerant} onChange={(v: string) => update({ prenomGerant: v })} />
                  <Inp label="Nom" value={editDossier.nomGerant} onChange={(v: string) => update({ nomGerant: v })} />
                </div>
                <Inp label="Nationalité" value={editDossier.nationaliteGerant} onChange={(v: string) => update({ nationaliteGerant: v })} />
                <Inp label="Email" value={editDossier.email} onChange={(v: string) => update({ email: v })} />
                <Inp label="Téléphone" value={editDossier.tel} onChange={(v: string) => update({ tel: v })} />
                <Inp label="Adresse Personnelle" value={editDossier.adresseDomicile} onChange={(v: string) => update({ adresseDomicile: v })} />
                
                <div className="pt-4">
                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-[0.2em] mb-3">Documents stockés</h4>
                  <div className="flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                    <div className="bg-slate-700 p-2 rounded-lg">
                      <FolderOpen className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div className="text-left text-[11px] text-slate-300 leading-tight">
                      Les fichiers KYC/Statuts/Contrats sont gérés depuis l'onglet
                      <span className="text-white font-bold"> Documents</span> (Supabase Storage).
                      Sélectionne ce client là-bas pour upload/preview/téléchargement.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'tracfin' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-[0.2em]">Analyse de Risque & Conformité</h4>
                <button 
                  onClick={() => handleAiAnalysis("analyse_risque")}
                  disabled={isAnalyzing}
                  className="bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-primary hover:text-brand-dark transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAnalyzing ? 'Analyse en cours...' : 'Analyse IA Gemini'}
                </button>
              </div>

              {aiAnalysis && (
                <div className="p-6 bg-brand-light/50 border border-brand-primary/20 rounded-xl relative">
                  <button onClick={() => setAiAnalysis(null)} className="absolute top-4 right-4 text-slate-200 hover:text-white"><X className="w-4 h-4" /></button>
                  <h5 className="font-bold text-brand-primary flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4" />
                    Rapport IA Gemini
                  </h5>
                  <div className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">
                    {aiAnalysis}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-6 bg-brand-light/20 rounded-xl border border-slate-800 space-y-4">
                  <h5 className="font-bold text-amber-500 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    B-A BA TRACFIN
                  </h5>
                  <div className="space-y-4">
                    <Chk label="Personne Politiquement Exposée (PPE)" checked={editDossier.estPPE} onChange={(v: boolean) => update({ estPPE: v })} />
                    <Chk label="Appartenance Politique/Religieuse" checked={editDossier.appartenancePolitiqueReligieuse} onChange={(v: boolean) => update({ appartenancePolitiqueReligieuse: v })} />
                    <Inp label="Origine des fonds" value={editDossier.origineFonds} onChange={(v: string) => update({ origineFonds: v })} />
                    <Inp label="Utilisation de l'adresse" value={editDossier.utilisationAdresse} onChange={(v: string) => update({ utilisationAdresse: v })} />
                    <Inp label="Commentaires contrôles initiaux" value={editDossier.commentairesControlesInitiaux} onChange={(v: string) => update({ commentairesControlesInitiaux: v })} />
                  </div>
                </div>
                <div className="p-6 bg-brand-light/20 rounded-xl border border-slate-800 space-y-4">
                  <h5 className="font-bold text-blue-500 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Bénéficiaires Effectifs
                  </h5>
                  <Inp label="Bénéficiaires Déclarés (Noms + %)" value={editDossier.beneficiairesDeclares} onChange={(v: string) => update({ beneficiairesDeclares: v })} />
                  
                  <h5 className="font-bold text-emerald-500 flex items-center gap-2 pt-4">
                    <CheckCircle className="w-4 h-4" />
                    Checklist Documents
                  </h5>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(editDossier.docs).map(([key, val]) => (
                      <Chk 
                        key={key} 
                        label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} 
                        checked={val} 
                        onChange={(v: boolean) => update({ docs: { ...editDossier.docs, [key]: v } })} 
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'documents' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-[0.2em]">Documents du dossier</h4>
                {(() => {
                  const c = docsCompleteness(editDossier.docs as DocsChecklist);
                  return (
                    <span className="text-[10px] text-slate-400">
                      {c.provided}/{c.total} obligatoires
                      {c.missing.length > 0 && ` · Manquant : ${c.missing.slice(0, 3).join(', ')}${c.missing.length > 3 ? '…' : ''}`}
                    </span>
                  );
                })()}
              </div>
              <ClientDocumentExplorer
                dossierId={editDossier.id}
                raisonSociale={editDossier.raisonSociale}
                onFilesChange={(files: DossierFile[]) => {
                  const nextDocs = syncDocsChecklist(files, editDossier.docs as DocsChecklist);
                  // Update only if something changed (additive)
                  const changed = (Object.keys(nextDocs) as (keyof DocsChecklist)[]).some(
                    (k) => nextDocs[k] !== (editDossier.docs as DocsChecklist)[k]
                  );
                  if (changed) {
                    const updated = { ...editDossier, docs: { ...(editDossier.docs as DocsChecklist), ...nextDocs } };
                    setEditDossier(updated);
                    onSave(updated);
                  }
                }}
              />
            </div>
          )}

          {tab === 'suivi' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-[0.2em]">Suivi Périodique Obligatoire</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="p-6 space-y-4">
                  <h5 className="font-bold text-brand-primary flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Mise à jour Annuelle
                  </h5>
                  <Sel label="Statut MAJ" value={editDossier.statutMiseAJourAnnuelle} onChange={(v: any) => update({ statutMiseAJourAnnuelle: v })} options={[
                    { value: 'a_jour', label: 'À jour' },
                    { value: 'en_attente', label: 'En attente' },
                    { value: 'retard', label: 'En retard' },
                  ]} />
                  <Inp label="Date dernière MAJ" type="date" value={editDossier.derniereMajAnnuelle.split('T')[0]} onChange={(v: string) => update({ derniereMajAnnuelle: v })} />
                </Card>
                <Card className="p-6 space-y-4">
                  <h5 className="font-bold text-blue-500 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Contrôle Trimestriel
                  </h5>
                  <Inp label="Date dernier contrôle" type="date" value={editDossier.dernierControleTrimestriel.split('T')[0]} onChange={(v: string) => update({ dernierControleTrimestriel: v })} />
                  <Inp label="Statut Conformité" value={editDossier.statutConformiteTrimestrielle} onChange={(v: string) => update({ statutConformiteTrimestrielle: v })} />
                </Card>
              </div>
            </div>
          )}

          {tab === 'relances' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-[0.2em]">Système de Relances Automatiques</h4>
                <button 
                  onClick={() => handleAiAnalysis("relance")}
                  className="bg-brand-light border border-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-all text-slate-100"
                >
                  Générer Mail Relance (IA)
                </button>
              </div>
              <div className="space-y-4">
                {editDossier.relances.length === 0 ? (
                  <div className="text-center py-12 bg-brand-light/10 rounded-xl border border-dashed border-slate-700 text-slate-200 italic">
                    Aucune relance envoyée pour le moment.
                  </div>
                ) : (
                  editDossier.relances.map((r, i) => (
                    <Card key={i} className="p-6 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-amber-500">{r.type}</span>
                        <span className="text-xs text-slate-200">{fmtDate(r.date)}</span>
                      </div>
                      <div className="p-4 bg-brand-dark rounded-lg text-xs font-mono text-slate-200 whitespace-pre-wrap">
                        {r.mailGenere}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'export' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-[0.2em]">Export SIE & Greffe de Strasbourg</h4>
              <Card className="p-8 space-y-6">
                <div className="flex items-center justify-between p-4 bg-brand-light/30 rounded-xl border border-slate-700">
                  <div>
                    <p className="font-bold text-slate-100">Inclure dans le prochain export</p>
                    <p className="text-xs text-slate-200">Dossier prêt pour la transmission trimestrielle.</p>
                  </div>
                  <Chk checked={editDossier.aInclureProchaineListe} onChange={(v: boolean) => update({ aInclureProchaineListe: v })} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-200 uppercase">Données Exportées</p>
                    <div className="p-4 bg-brand-dark rounded-lg text-xs space-y-2 text-slate-200">
                      <p><span className="text-slate-300">ID:</span> {editDossier.id}</p>
                      <p><span className="text-slate-300">Raison Sociale:</span> {editDossier.raisonSociale}</p>
                      <p><span className="text-slate-300">SIRET:</span> {editDossier.siret}</p>
                      <p><span className="text-slate-300">Date Début:</span> {fmtDate(editDossier.dateDebut)}</p>
                      <p><span className="text-slate-300">Gérant:</span> {editDossier.prenomGerant} {editDossier.nomGerant}</p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-end">
                    <button className="w-full bg-brand-primary text-brand-dark font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:scale-105 transition-transform">
                      <Download className="w-5 h-5" />
                      Exporter CSV (Format Greffe)
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {tab === 'paiements' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Suivi des Règlements</h4>
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span className="text-slate-300">Tarif:</span>
                  <span className="text-brand-primary">{fmtMontant(editDossier.montantMensuel)} / {editDossier.tarifChoisi}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-emerald-500/5 border-emerald-500/10">
                  <p className="text-[10px] font-bold text-slate-300 uppercase mb-1">Total Payé</p>
                  <p className="text-xl font-black text-emerald-500">{fmtMontant(editDossier.paiements.filter(p => p.statut === 'ok').reduce((acc, curr) => acc + curr.montantDu, 0))}</p>
                </Card>
                <Card className="p-4 bg-rose-500/5 border-rose-500/10">
                  <p className="text-[10px] font-bold text-slate-300 uppercase mb-1">Impayés</p>
                  <p className="text-xl font-black text-rose-500">{fmtMontant(editDossier.paiements.filter(p => p.statut === 'impaye').reduce((acc, curr) => acc + curr.montantDu, 0))}</p>
                </Card>
                <Card className="p-4 bg-brand-light/30">
                  <p className="text-[10px] font-bold text-slate-300 uppercase mb-1">Dernière Échéance</p>
                  <p className="text-xl font-black text-slate-200">{editDossier.paiements.length > 0 ? fmtDate(editDossier.paiements[editDossier.paiements.length - 1].dateEcheance) : 'Aucune'}</p>
                </Card>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-brand-light/50 text-[10px] font-bold uppercase text-slate-300">
                    <tr>
                      <th className="px-6 py-3">Période</th>
                      <th className="px-6 py-3">Montant</th>
                      <th className="px-6 py-3">Échéance</th>
                      <th className="px-6 py-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {editDossier.paiements.map((p) => (
                      <tr key={p.id}>
                        <td className="px-6 py-4 text-sm font-bold text-slate-200">{p.periode}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">{fmtMontant(p.montantDu)}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">{fmtDate(p.dateEcheance)}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${p.statut === 'ok' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-rose-500 border-rose-500/20 bg-rose-500/5'}`}>
                            {p.statut}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {editDossier.paiements.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-300 italic">Aucun historique de paiement.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'courrier' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
              <div className="space-y-6">
                <h4 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Options de Courrier</h4>
                <Sel label="Option choisie" value={editDossier.optionCourrier} onChange={(v: OptionCourrier) => update({ optionCourrier: v })} options={[
                  { value: 'standard', label: 'Mise à disposition (Standard)' },
                  { value: 'scan', label: 'Numérisation (Scan)' },
                  { value: 'renvoi', label: 'Réexpédition (Renvoi)' },
                ]} />
                <Inp label="Numéro de Boîte aux Lettres" value={editDossier.numeroBal} onChange={(v: string) => update({ numeroBal: v })} />
              </div>
              <div className="p-6 bg-brand-light/20 rounded-xl border border-slate-800 space-y-4">
                <h5 className="font-bold text-slate-200 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Instructions Spécifiques
                </h5>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {editDossier.optionCourrier === 'standard' && "Le client vient récupérer son courrier sur place. Une notification par mail est envoyée à chaque réception."}
                  {editDossier.optionCourrier === 'scan' && "Le courrier est ouvert, scanné et envoyé par email au client. L'original est archivé ou détruit selon contrat."}
                  {editDossier.optionCourrier === 'renvoi' && "Le courrier est réexpédié à l'adresse personnelle du gérant une fois par semaine."}
                </p>
              </div>
            </div>
          )}

          {tab === 'historique' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h4 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Journal des Échanges</h4>
              <div className="space-y-4">
                {editDossier.historique.map((h) => (
                  <div key={h.id} className="flex gap-4 p-4 bg-brand-light/20 rounded-xl border border-slate-800">
                    <div className="p-2 rounded-lg bg-brand-dark h-fit">
                      {h.type === 'mail' && <Mail className="w-4 h-4 text-blue-500" />}
                      {h.type === 'tel' && <Clock className="w-4 h-4 text-emerald-500" />}
                      {h.type === 'courrier' && <FileText className="w-4 h-4 text-amber-500" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-bold text-slate-300">{fmtDate(h.date)}</span>
                        <span className="text-[10px] font-bold uppercase text-brand-primary tracking-widest">{h.type}</span>
                      </div>
                      <p className="text-sm text-slate-200">{h.description}</p>
                    </div>
                  </div>
                ))}
                {editDossier.historique.length === 0 && (
                  <div className="text-center py-12 text-slate-300 italic">Aucun échange enregistré.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-slate-800 bg-brand-dark/50 flex justify-between items-center">
          <button
            onClick={() => {
              if (confirm("Supprimer définitivement ce dossier ?")) {
                onDelete(editDossier.id);
              }
            }}
            className="flex items-center gap-2 text-rose-500 hover:text-rose-400 font-bold text-sm transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer le dossier
          </button>
          <div className="flex gap-4">
            <button
              onClick={onBack}
              className="px-6 py-3 rounded-xl border border-slate-700 font-bold text-sm text-slate-200 hover:bg-slate-800 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={() => onSave(editDossier)}
              className="px-8 py-3 rounded-xl bg-brand-primary text-brand-dark font-black text-sm hover:scale-105 transition-all shadow-lg shadow-brand-primary/20"
            >
              Enregistrer les modifications
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
