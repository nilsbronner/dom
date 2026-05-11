
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface RiskAnalysisInput {
  companyName: string;
  legalForm: string;
  // Critère 2 — Activité
  activity: string;
  // Critère 1 — Origine géographique
  paysOrigine: string;
  nationaliteGerant: string;
  // Critère 3 — Bénéficiaires effectifs
  beneficiairesDeclares: string;
  // Critère 4 — PPE
  isPep: string;
  // Critère 5 — Origine des fonds
  origineFonds: string;
  // Critère 6 — Nature des transactions
  natureTransactions: string;
  // Critère 7 — Comportement client
  comportementClient: string;
  missingDocs: string;
  inconsistencies: string;
}

export interface RiskScores {
  origine_geographique: number;
  activite: number;
  beneficiaires_effectifs: number;
  ppe: number;
  origine_fonds: number;
  nature_transactions: number;
  comportement_client: number;
}

export interface RiskAnalysisResult {
  niveau_risque: "Faible" | "Modéré" | "Élevé" | "Très élevé";
  score_total: number;
  scores: RiskScores;
  decision: "Acceptation — vigilance standard" | "Acceptation — vigilance renforcée" | "Examen approfondi — décision collégiale" | "Refus — déclaration de soupçon TRACFIN";
  alerte_automatique: boolean;
  commentaire: string;
}

export interface QuarterlyCheckInput {
  companyName: string;
  activity: string;
  behaviors: string;
  changes: string;
  sanctions: string;
  missingDocs: string;
  suspiciousPayments: string;
}

export interface QuarterlyCheckResult {
  statut_conformite: "Conforme" | "À surveiller" | "Non conforme";
  action_recommandee: "Aucune action" | "Demander documents manquants" | "Demander explication" | "Vigilance renforcée" | "Envisager déclaration TRACFIN";
  commentaire: string;
  niveau_risque_ajuste?: string;
}

export interface EmailInput {
  companyName: string;
  missingDocs: string;
  delayDays?: string; // For template 1
  dateRelance1?: string; // For template 2
  history?: string; // For formal notice
}

export interface EmailResult {
  objet_mail: string;
  corps_mail: string;
}

export enum EmailTemplateType {
  REMINDER_1 = 'Relance1',
  REMINDER_2 = 'Relance2',
  FORMAL_NOTICE = 'Mise_en_demeure'
}

// --- New Features Types ---

export interface NewClientResult {
  clients: {
    ID_CLIENT: string;
    raison_sociale: string;
    forme_juridique: string;
    siren_siret: string;
    rcs_ville: string;
    nom_gerant: string;
    prenom_gerant: string;
    email_gerant: string;
    tel_gerant: string;
    description_activite: string;
    pep: string;
    [key: string]: any;
  };
  documents: {
    type_document: string;
    statut_initial: string;
    commentaire: string;
  }[];
  sie_greffe: {
    raison_sociale: string;
    siren_siret: string;
    rcs_ville: string;
    adresse_domiciliation: string;
    infos_gerant: string;
    [key: string]: any;
  };
  alerts: string[];
}

export interface AnnualUpdateInput {
  companyName: string;
  kbisDate: string;
  uboDate: string;
  missingDocs: string;
  lastUpdateDate: string;
}

export interface AnnualUpdateResult {
  elements_a_mettre_a_jour: string[];
  commentaire: string;
  proposition_mail: {
    objet_mail: string;
    corps_mail: string;
  };
}

export interface SieGreffeInput {
  companyName: string;
  legalForm: string;
  siret: string;
  rcs: string;
  address: string;
  startDate: string;
  managerInfo: string;
}

export interface SieGreffeResult {
  sie_greffe: {
    raison_sociale: string;
    forme_juridique: string;
    siren_siret: string;
    rcs_ville: string;
    adresse_domiciliation: string;
    date_debut_domiciliation: string;
    date_fin_domiciliation: string;
    motif_resiliation: string;
    infos_gerant: string;
  };
  commentaire: string;
}

export interface ClientSummary {
  raison_sociale: string;
  nom_gerant: string;
  email_contact: string;
  activite_principale: string;
  ville_rcs: string;
  statut_dossier: string;
}

export interface ClientListResult {
  clients: ClientSummary[];
  analyse_globale: string;
}

// --- Document Management Types ---

export interface AnalyzedDocument {
  fileName: string;
  detectedType: string;
  isRequired: boolean;
  status: "Valid" | "Invalid" | "Unknown"; // Simulated for this step based on naming
  comment: string;
}

export interface DocumentAnalysisResult {
  classifiedDocuments: AnalyzedDocument[];
  missingDocuments: string[];
  complianceStatus: "Conforme" | "Incomplet" | "A vérifier";
  globalComment: string;
}

export interface DocumentAnalysisInput {
    legalForm: string;
    fileNames: string[];
}

// --- Domiciliation Module Types ---

export type StatutDossier = 'en_cours' | 'actif' | 'resiliation' | 'archive';
export type StatutPaiement = 'ok' | 'retard' | 'impaye';
export type NiveauRisque = 'vert' | 'orange' | 'rouge';
export type OptionCourrier = 'standard' | 'scan' | 'renvoi';
export type TypeEchange = 'mail' | 'tel' | 'courrier' | 'autre';
export type PeriodiciteTarif = 'mensuel' | 'annuel';
export type TypeRelance = 'Relance1' | 'Relance2' | 'Mise_en_demeure' | 'Aucune';

export interface PaiementDom {
  id: string;
  periode: string;
  montantDu: number;
  dateEcheance: string;
  datePaiement: string;
  statut: StatutPaiement;
}

export interface HistoriqueEntry {
  id: string;
  date: string;
  type: TypeEchange;
  description: string;
}

export interface AlerteTracfin {
  type: NiveauRisque;
  msg: string;
  detail: string;
}

export interface RelanceInfo {
  type: TypeRelance;
  date: string;
  mailGenere: string;
}

export interface DossierDomiciliation {
  id: string;
  createdAt: string;
  statut: StatutDossier;
  
  // --- CLIENTS Data ---
  raisonSociale: string;
  formeJuridique: string;
  siret: string;
  rcsVille: string;
  activite: string;
  descriptionActivite: string;
  nomGerant: string;
  prenomGerant: string;
  nationaliteGerant: string;
  paysOrigine: string;
  tel: string;
  email: string;
  adresseDomicile: string;
  dateDebut: string;
  dateFin?: string;
  motifResiliation?: string;
  
  // --- TRACFIN Data ---
  origineFonds: string;
  beneficiairesDeclares: string;
  utilisationAdresse: string;
  estPPE: boolean;
  appartenancePolitiqueReligieuse: boolean;
  commentairesControlesInitiaux: string;
  
  // --- AI Risk Analysis ---
  niveauRisqueIA: NiveauRisque;
  decisionRisqueIA: string;
  commentaireRisqueIA: string;
  
  // --- Suivi Périodique ---
  statutMiseAJourAnnuelle: 'a_jour' | 'en_attente' | 'retard';
  derniereMajAnnuelle: string;
  dernierControleTrimestriel: string;
  statutConformiteTrimestrielle: string;
  
  // --- Domiciliation Details ---
  tarifChoisi: PeriodiciteTarif;
  montantMensuel: number | null;
  optionCourrier: OptionCourrier;
  numeroBal: string;
  
  // --- DOCUMENTS Checklist ---
  docs: {
    cniGerant: boolean;
    justifDomicileGerant: boolean;
    statuts: boolean;
    kbis: boolean;
    attestationCompta: boolean;
    listeBeneficiaires: boolean;
    cniBeneficiaires: boolean;
    contratSigne: boolean;
  };
  
  // --- RELANCES ---
  relances: RelanceInfo[];
  
  // --- SIE / GREFFE ---
  aInclureProchaineListe: boolean;
  
  // --- ARCHIVAGE CLOUD ---
  driveFolderUrl?: string;
  driveFolderId?: string;
  
  // --- Logs ---
  paiements: PaiementDom[];
  historique: HistoriqueEntry[];
}
