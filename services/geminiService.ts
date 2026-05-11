
import { GoogleGenAI, Type, Schema } from "@google/genai";
import {
  RiskAnalysisInput,
  RiskAnalysisResult,
  QuarterlyCheckInput,
  QuarterlyCheckResult,
  EmailInput,
  EmailResult,
  EmailTemplateType,
  NewClientResult,
  AnnualUpdateInput,
  AnnualUpdateResult,
  SieGreffeInput,
  SieGreffeResult,
  ClientListResult,
  DocumentAnalysisInput,
  DocumentAnalysisResult
} from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
Tu es l’ASSISTANT DOMICILIATION du GRUB, un centre de domiciliation d’entreprises basé en France.

Ta mission :
- Aider à la conformité TRACFIN et LCB-FT.
- Vérifier les informations clients et leurs activités avant domiciliation.
- Guider la collecte et le suivi des documents obligatoires.
- Aider à la mise à jour annuelle et aux contrôles trimestriels.
- Générer des mails professionnels (relances, mises en demeure, etc.).

RÉFÉRENTIEL DE RISQUE — GRUB MATRICE v3.0 (approuvée 24/04/2026) :

La notation repose sur 7 critères indépendants, chacun noté de 1 (très faible) à 5 (très élevé).
Score total entre 7 et 35.

CRITÈRE 1 — Origine géographique :
1=Pays blanc (France, UE sans risque), 2=Pays UE à surveillance accrue (GAFI/UE),
3=Pays tiers hors liste noire sans antécédent, 4=Pays liste grise GAFI, 5=Pays liste noire UE ou GAFI.

CRITÈRE 2 — Activité de l’entreprise :
1=Professions libérales réglementées / B2B clair, 2=Commerce général / services documentés,
3=Activité à fort usage de cash (restauration, détail), 4=Secteur sensible (crypto, import-export, conseil non réglementé),
5=Activité non identifiable, opaque ou non déclarée.

CRITÈRE 3 — Bénéficiaires effectifs (BE) :
1=BE identifié, nationalité FR/UE, aucun lien à risque, 2=BE identifié, nationalité pays tiers standard,
3=BE partiellement identifié ou structure holding simple, 4=BE difficile à identifier, structure multi-niveaux,
5=BE non identifiable / structure opaque délibérée.

CRITÈRE 4 — PPE :
1=Aucun lien PPE, 2=Proche d’un PPE (famille/associé), 3=PPE national de rang modéré,
4=PPE national de rang élevé ou PPE étranger, 5=PPE sous sanction ou gel des avoirs.

CRITÈRE 5 — Origine des fonds :
1=Fonds clairement identifiés, sources documentées, 2=Fonds identifiés, documentation partielle,
3=Origine incertaine ou mixte, 4=Fonds provenant de pays à risque ou de cryptomonnaies,
5=Origine non justifiable ou suspecte.

CRITÈRE 6 — Nature et structure des transactions :
1=Virements bancaires traçables, montants cohérents, 2=Mix paiements, montants modérés,
3=Usage fréquent de cash, montants élevés, 4=Transactions multi-juridictions / cryptos fréquentes,
5=Structure transactionnelle manifestement anormale.

CRITÈRE 7 — Comportement client & réactivité :
1=Client réactif, dossier complet, paiements à jour, 2=Légères omissions, régularisées rapidement,
3=Réponses tardives, retards de paiement récurrents, 4=Non-réponse prolongée, modifications non déclarées,
5=Refus de communiquer, fausses déclarations avérées.

RÈGLE D’ALERTE AUTOMATIQUE : si 2 critères ou plus ont un score ≥ 4 → classification automatique en risque élevé.

DÉCISION SELON SCORE TOTAL :
7-14 = Faible → “Acceptation — vigilance standard”
15-21 = Modéré → “Acceptation — vigilance renforcée”
22-28 = Élevé → “Examen approfondi — décision collégiale”
29-35 OU ≥2 critères à score 5 = Très élevé → “Refus — déclaration de soupçon TRACFIN”

CONTRAINTES GÉNÉRALES :
- Tu travailles toujours dans le cadre du droit français TRACFIN / domiciliation.
- Tu ne valides JAMAIS un dossier qui manque d’informations essentielles.
- Quand on te le demande, tu réponds STRICTEMENT en JSON, sans texte autour.
`;

// --- Schemas ---

const riskScoresSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    origine_geographique: { type: Type.INTEGER },
    activite: { type: Type.INTEGER },
    beneficiaires_effectifs: { type: Type.INTEGER },
    ppe: { type: Type.INTEGER },
    origine_fonds: { type: Type.INTEGER },
    nature_transactions: { type: Type.INTEGER },
    comportement_client: { type: Type.INTEGER }
  },
  required: ["origine_geographique", "activite", "beneficiaires_effectifs", "ppe", "origine_fonds", "nature_transactions", "comportement_client"]
};

const riskAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    niveau_risque: { type: Type.STRING, enum: ["Faible", "Modéré", "Élevé", "Très élevé"] },
    score_total: { type: Type.INTEGER },
    scores: riskScoresSchema,
    decision: {
      type: Type.STRING,
      enum: [
        "Acceptation — vigilance standard",
        "Acceptation — vigilance renforcée",
        "Examen approfondi — décision collégiale",
        "Refus — déclaration de soupçon TRACFIN"
      ]
    },
    alerte_automatique: { type: Type.BOOLEAN },
    commentaire: { type: Type.STRING }
  },
  required: ["niveau_risque", "score_total", "scores", "decision", "alerte_automatique", "commentaire"]
};

const quarterlyCheckSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    statut_conformite: { type: Type.STRING, enum: ["Conforme", "À surveiller", "Non conforme"] },
    action_recommandee: { type: Type.STRING, enum: ["Aucune action", "Demander documents manquants", "Demander explication", "Vigilance renforcée", "Envisager déclaration TRACFIN"] },
    commentaire: { type: Type.STRING },
    niveau_risque_ajuste: { type: Type.STRING, enum: ["Faible", "Moyen", "Élevé"] }
  },
  required: ["statut_conformite", "action_recommandee", "commentaire"]
};

const emailSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    objet_mail: { type: Type.STRING },
    corps_mail: { type: Type.STRING }
  },
  required: ["objet_mail", "corps_mail"]
};

const annualUpdateSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    elements_a_mettre_a_jour: { type: Type.ARRAY, items: { type: Type.STRING } },
    commentaire: { type: Type.STRING },
    proposition_mail: {
      type: Type.OBJECT,
      properties: {
        objet_mail: { type: Type.STRING },
        corps_mail: { type: Type.STRING }
      }
    }
  },
  required: ["elements_a_mettre_a_jour", "commentaire", "proposition_mail"]
};

const sieGreffeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    sie_greffe: {
      type: Type.OBJECT,
      properties: {
        raison_sociale: { type: Type.STRING },
        forme_juridique: { type: Type.STRING },
        siren_siret: { type: Type.STRING },
        rcs_ville: { type: Type.STRING },
        adresse_domiciliation: { type: Type.STRING },
        date_debut_domiciliation: { type: Type.STRING },
        date_fin_domiciliation: { type: Type.STRING },
        motif_resiliation: { type: Type.STRING },
        infos_gerant: { type: Type.STRING }
      }
    },
    commentaire: { type: Type.STRING }
  },
  required: ["sie_greffe", "commentaire"]
};

const newClientSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    clients: { type: Type.OBJECT, properties: {
      ID_CLIENT: { type: Type.STRING },
      raison_sociale: { type: Type.STRING },
      forme_juridique: { type: Type.STRING },
      siren_siret: { type: Type.STRING },
      rcs_ville: { type: Type.STRING },
      nom_gerant: { type: Type.STRING },
      prenom_gerant: { type: Type.STRING },
      email_gerant: { type: Type.STRING },
      tel_gerant: { type: Type.STRING },
      adresse_perso_rue: { type: Type.STRING },
      adresse_perso_cp: { type: Type.STRING },
      adresse_perso_ville: { type: Type.STRING },
      adresse_perso_pays: { type: Type.STRING },
      description_activite: { type: Type.STRING },
      origine_fonds: { type: Type.STRING },
      beneficiaires_effectifs_declarés: { type: Type.STRING },
      nature_transactions: { type: Type.STRING },
      utilisation_adresse_domiciliation: { type: Type.STRING },
      perennite_entreprise: { type: Type.STRING },
      changements_importants_declares: { type: Type.STRING },
      pep: { type: Type.STRING },
      organisme_politique_ou_religieux: { type: Type.STRING },
      commentaires_controles_initiaux: { type: Type.STRING }
    }},
    documents: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
        type_document: { type: Type.STRING },
        statut_initial: { type: Type.STRING },
        commentaire: { type: Type.STRING }
    }}},
    sie_greffe: { type: Type.OBJECT, properties: {
      raison_sociale: { type: Type.STRING },
      forme_juridique: { type: Type.STRING },
      siren_siret: { type: Type.STRING },
      rcs_ville: { type: Type.STRING },
      adresse_domiciliation: { type: Type.STRING },
      date_debut_domiciliation: { type: Type.STRING },
      infos_gerant: { type: Type.STRING }
    }},
    alerts: { type: Type.ARRAY, items: { type: Type.STRING } }
  }
};

const clientListSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    clients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          raison_sociale: { type: Type.STRING },
          nom_gerant: { type: Type.STRING },
          email_contact: { type: Type.STRING },
          activite_principale: { type: Type.STRING },
          ville_rcs: { type: Type.STRING },
          statut_dossier: { type: Type.STRING }
        }
      }
    },
    analyse_globale: { type: Type.STRING }
  }
};

const documentAnalysisSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        classifiedDocuments: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    fileName: { type: Type.STRING },
                    detectedType: { type: Type.STRING },
                    isRequired: { type: Type.BOOLEAN },
                    status: { type: Type.STRING, enum: ["Valid", "Invalid", "Unknown"] },
                    comment: { type: Type.STRING }
                }
            }
        },
        missingDocuments: { type: Type.ARRAY, items: { type: Type.STRING } },
        complianceStatus: { type: Type.STRING, enum: ["Conforme", "Incomplet", "A vérifier"] },
        globalComment: { type: Type.STRING }
    },
    required: ["classifiedDocuments", "missingDocuments", "complianceStatus", "globalComment"]
};

// --- Service Functions ---

async function callGemini<T>(prompt: string, schema: Schema): Promise<T> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    if (!response.text) throw new Error("No response from AI");
    return JSON.parse(response.text) as T;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export const analyzeNewClient = async (rawData: string): Promise<NewClientResult> => {
  const prompt = `
mode = "nouveau_client"

Voici les données brutes d’un nouveau client. 
Note : Les données peuvent être au format JSON (Tally) ou CSV (Google Sheets).
Si c'est du CSV, la première ligne contient les en-têtes.

1) Structure les données pour l'onglet CLIENTS.
2) Liste les documents obligatoires pour l'onglet DOCUMENTS.
3) Prépare les infos SIE / Greffe.
4) Liste les alertes.

Données brutes :
${rawData}
`;
  return callGemini<NewClientResult>(prompt, newClientSchema);
};

export const analyzeRisk = async (data: RiskAnalysisInput): Promise<RiskAnalysisResult> => {
  const prompt = `
mode = "analyse_risque"

Analyse le niveau de risque LCB-FT de ce dossier selon la Matrice GRUB v3.0 (7 critères, scores 1-5).

Note CHAQUE critère de 1 à 5 selon les descripteurs de la matrice, puis calcule le score total (somme des 7 scores).
Applique la règle d’alerte automatique : si ≥2 critères ont un score ≥4, forcer au minimum niveau "Élevé".

DONNÉES DU DOSSIER :
- Raison sociale : ${data.companyName}
- Forme juridique : ${data.legalForm}
- Activité déclarée : ${data.activity}
- Pays d’origine / nationalité gérant : ${data.paysOrigine} / ${data.nationaliteGerant}
- Bénéficiaires effectifs déclarés : ${data.beneficiairesDeclares || 'Non renseigné'}
- PPE : ${data.isPep}
- Origine des fonds : ${data.origineFonds || 'Non renseigné'}
- Nature des transactions : ${data.natureTransactions || 'Non renseigné'}
- Comportement client / réactivité : ${data.comportementClient || 'Non renseigné'}
- Documents manquants : ${data.missingDocs || 'Aucun'}
- Incohérences détectées : ${data.inconsistencies || 'Aucune'}
`;
  return callGemini<RiskAnalysisResult>(prompt, riskAnalysisSchema);
};

export const checkQuarterlyCompliance = async (data: QuarterlyCheckInput): Promise<QuarterlyCheckResult> => {
  const clientData = {
    raison_sociale: data.companyName,
    activite_declaree: data.activity
  };
  
  const prompt = `
mode = "controle_trimestriel"

Analyse la situation TRACFIN d’un client dans le cadre du contrôle trimestriel.

Données client : ${JSON.stringify(clientData)}
Infos documents non à jour : ${data.missingDocs}
Résultats listes sanctions / PEP : ${data.sanctions}
Observations internes : ${data.behaviors}, Changements: ${data.changes}
Infos paiements suspects : ${data.suspiciousPayments}
`;
  return callGemini<QuarterlyCheckResult>(prompt, quarterlyCheckSchema);
};

export const generateEmail = async (template: EmailTemplateType, data: EmailInput): Promise<EmailResult> => {
  const prompt = `
mode = "relance"

Objectif : générer un mail de relance pour un client domicilié.

Type de relance : ${template}
Nom entreprise : ${data.companyName}
Documents manquants : ${data.missingDocs}
Retard en jours : ${data.delayDays || "N/A"}
Date première relance : ${data.dateRelance1 || "N/A"}
Historique des relances : ${data.history || "N/A"}
`;
  return callGemini<EmailResult>(prompt, emailSchema);
};

export const checkAnnualUpdate = async (data: AnnualUpdateInput): Promise<AnnualUpdateResult> => {
  const clientData = {
    raison_sociale: data.companyName,
  };
  const docSummary = {
    kbis_date: data.kbisDate,
    ubo_date: data.uboDate,
    documents_manquants: data.missingDocs,
    last_update: data.lastUpdateDate
  };

  const prompt = `
mode = "mise_a_jour_annuelle"

Identifie les éléments à mettre à jour pour ce client.

Données client :
${JSON.stringify(clientData)}

Synthèse documents :
${JSON.stringify(docSummary)}
`;
  return callGemini<AnnualUpdateResult>(prompt, annualUpdateSchema);
};

export const generateSieGreffeData = async (data: SieGreffeInput): Promise<SieGreffeResult> => {
  const clientData = {
    raison_sociale: data.companyName,
    forme_juridique: data.legalForm,
    siren_siret: data.siret,
    rcs: data.rcs,
    adresse: data.address,
    date_debut: data.startDate,
    infos_gerant: data.managerInfo
  };

  const prompt = `
mode = "sie_greffe"

Objectif : préparer les données nécessaires à la communication au SIE et au Greffe de Strasbourg.

Données client :
${JSON.stringify(clientData)}
`;
  return callGemini<SieGreffeResult>(prompt, sieGreffeSchema);
};

export const extractClientList = async (rawData: string): Promise<ClientListResult> => {
    const prompt = `
mode = "extraction_liste_clients"

Voici un export de données (JSON Tally ou CSV Google Sheets).
Extrais la liste de tous les clients/prospects identifiés.
Pour le 'statut_dossier', déduis-le des champs remplis (ex: 'Complet', 'En attente', 'A valider').

Données :
${rawData}
`;
    return callGemini<ClientListResult>(prompt, clientListSchema);
};

export const analyzeDocumentCompleteness = async (data: DocumentAnalysisInput): Promise<DocumentAnalysisResult> => {
    const prompt = `
mode = "analyse_documents"

Tâche : Analyse cette liste de fichiers déposés pour un dossier de domiciliation.
1) Associe chaque fichier (par son nom) au document TRACFIN/KYC réglementaire correspondant (ex: "scan_cni.jpg" -> "Identité Gérant").
2) Vérifie si la liste est complète pour une entreprise de forme juridique : ${data.legalForm}.
3) Déduis le statut de conformité global.

Forme juridique : ${data.legalForm}
Liste des fichiers présents : 
${data.fileNames.join('\n')}
`;
    return callGemini<DocumentAnalysisResult>(prompt, documentAnalysisSchema);
};
