
import React, { useState, useEffect } from 'react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
import RiskAnalysis from './components/RiskAnalysis';
import QuarterlyCheck from './components/QuarterlyCheck';
import EmailGenerator from './components/EmailGenerator';
import AnnualUpdate from './components/AnnualUpdate';
import SieGreffe from './components/SieGreffe';
import DocumentManager from './components/DocumentManager';
import DomiciliationModule from './DomiciliationModule';
import ClientOnboardingForm from './src/components/ClientOnboardingForm';
import { LayoutDashboard, ShieldCheck, Mail, FileText, RefreshCw, Building2, FolderOpen, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

enum Tab {
  DOCUMENTS = 'DOCUMENTS',
  RISK = 'RISK',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
  EMAIL = 'EMAIL',
  SIE = 'SIE',
  DOMICILIATION = 'DOMICILIATION'
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DOMICILIATION);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [isClientView, setIsClientView] = useState(false);

  useEffect(() => {
    // Basic routing logic
    if (window.location.pathname === '/onboarding') {
      setIsClientView(true);
    }
  }, []);

  React.useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  React.useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      setActiveTab((e as CustomEvent<Tab>).detail);
    };
    window.addEventListener('switch-tab', handleSwitchTab);
    return () => window.removeEventListener('switch-tab', handleSwitchTab);
  }, []);

  if (isClientView) {
    return <ClientOnboardingForm />;
  }

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl text-center space-y-6">
          <div className="bg-indigo-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Configuration Requise</h2>
            <p className="text-slate-400 text-sm">
              Pour utiliser les fonctionnalités d'analyse IA avancées (Gemini 3), vous devez sélectionner votre propre clé API Google Cloud.
            </p>
          </div>
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left">
            <p className="text-amber-200 text-xs leading-relaxed">
              <strong>Important :</strong> Utilisez une clé provenant d'un projet Google Cloud avec facturation activée. 
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline ml-1">Documentation billing</a>
            </p>
          </div>
          <button
            onClick={handleOpenKeyDialog}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
          >
            Sélectionner ma Clé API
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col md:flex-row font-sans text-white">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-brand-light text-white flex-shrink-0 md:h-screen sticky top-0 flex flex-col overflow-y-auto border-r border-slate-700 shadow-2xl">
        <div className="p-6 border-b border-slate-700 flex items-center gap-3 bg-brand-dark/50">
          <ShieldCheck className="w-8 h-8 text-brand-primary" />
          <div>
            <h1 className="font-bold text-lg tracking-tight uppercase text-white">Le Grub Dom</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pilotage Domiciliation</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase px-4 py-2 tracking-widest">Dossiers</div>
          <button
            onClick={() => setActiveTab(Tab.DOMICILIATION)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === Tab.DOMICILIATION 
                ? 'bg-brand-primary text-brand-dark shadow-lg shadow-brand-primary/20 font-bold' 
                : 'text-slate-300 hover:bg-brand-dark hover:text-white'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-sm">Domiciliation</span>
          </button>

          <button
            onClick={() => setActiveTab(Tab.DOCUMENTS)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === Tab.DOCUMENTS 
                ? 'bg-brand-primary text-brand-dark shadow-lg shadow-brand-primary/20 font-bold' 
                : 'text-slate-300 hover:bg-brand-dark hover:text-white'
            }`}
          >
            <FolderOpen className="w-5 h-5" />
            <span className="text-sm">Gestion Documentaire</span>
          </button>

          <button
            onClick={() => setActiveTab(Tab.RISK)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === Tab.RISK 
                ? 'bg-brand-primary text-brand-dark shadow-lg shadow-brand-primary/20 font-bold' 
                : 'text-slate-300 hover:bg-brand-dark hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-sm">Analyse Risque</span>
          </button>

          <div className="text-[10px] font-bold text-slate-500 uppercase px-4 py-2 mt-4 tracking-widest">Suivi Vie Sociale</div>
          
          <button
            onClick={() => setActiveTab(Tab.QUARTERLY)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === Tab.QUARTERLY 
                ? 'bg-brand-primary text-brand-dark shadow-lg shadow-brand-primary/20 font-bold' 
                : 'text-slate-300 hover:bg-brand-dark hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-sm">Contrôle Trimestriel</span>
          </button>

          <button
            onClick={() => setActiveTab(Tab.ANNUAL)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === Tab.ANNUAL 
                ? 'bg-brand-primary text-brand-dark shadow-lg shadow-brand-primary/20 font-bold' 
                : 'text-slate-300 hover:bg-brand-dark hover:text-white'
            }`}
          >
            <RefreshCw className="w-5 h-5" />
            <span className="text-sm">Mise à Jour Annuelle</span>
          </button>

          <div className="text-[10px] font-bold text-slate-500 uppercase px-4 py-2 mt-4 tracking-widest">Administratif</div>

          <button
            onClick={() => setActiveTab(Tab.EMAIL)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === Tab.EMAIL 
                ? 'bg-brand-primary text-brand-dark shadow-lg shadow-brand-primary/20 font-bold' 
                : 'text-slate-300 hover:bg-brand-dark hover:text-white'
            }`}
          >
            <Mail className="w-5 h-5" />
            <span className="text-sm">Générateur Mails</span>
          </button>

          <button
            onClick={() => setActiveTab(Tab.SIE)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === Tab.SIE 
                ? 'bg-brand-primary text-brand-dark shadow-lg shadow-brand-primary/20 font-bold' 
                : 'text-slate-300 hover:bg-brand-dark hover:text-white'
            }`}
          >
            <Building2 className="w-5 h-5" />
            <span className="text-sm">Export SIE / Greffe</span>
          </button>

        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto bg-brand-dark">
        <div className="max-w-6xl mx-auto">
          <header className="mb-10">
            <h2 className="text-3xl font-bold text-white tracking-tight">
              {activeTab === Tab.DOMICILIATION && "Gestion des Domiciliations"}
              {activeTab === Tab.DOCUMENTS && "Gestion Documentaire & Conformité"}
              {activeTab === Tab.RISK && "Analyse des Risques TRACFIN"}
              {activeTab === Tab.QUARTERLY && "Suivi de Conformité"}
              {activeTab === Tab.ANNUAL && "Mise à Jour Annuelle"}
              {activeTab === Tab.EMAIL && "Communications Client"}
              {activeTab === Tab.SIE && "Export SIE / Greffe"}
            </h2>
            <p className="text-slate-400 mt-2 text-lg">
              {activeTab === Tab.DOMICILIATION && "Pilotage complet des contrats de domiciliation et conformité TRACFIN."}
              {activeTab === Tab.DOCUMENTS && "Analyse de complétude et classification automatique des pièces."}
              {activeTab === Tab.RISK && "Évaluation initiale et classification KYC."}
              {activeTab === Tab.QUARTERLY && "Revue périodique des dossiers et détection des anomalies."}
              {activeTab === Tab.ANNUAL && "Vérification des péremptions de documents."}
              {activeTab === Tab.EMAIL && "Génération automatique de courriers de relance."}
              {activeTab === Tab.SIE && "Préparation des données pour les organismes tiers."}
            </p>
          </header>

          <div className="transition-all duration-300">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === Tab.DOMICILIATION && <DomiciliationModule />}
                {activeTab === Tab.DOCUMENTS && <DocumentManager />}
                {activeTab === Tab.RISK && <RiskAnalysis />}
                {activeTab === Tab.QUARTERLY && <QuarterlyCheck />}
                {activeTab === Tab.ANNUAL && <AnnualUpdate />}
                {activeTab === Tab.EMAIL && <EmailGenerator />}
                {activeTab === Tab.SIE && <SieGreffe />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
