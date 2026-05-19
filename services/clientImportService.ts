// Helpers d'import de clients depuis sources externes (Tally / Google Sheets).

import type { DossierDomiciliation, NewClientResult } from "../types";

function uid(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Convertit un NewClientResult (sortie Gemini analyzeNewClient) en DossierDomiciliation
// prêt à être sauvé dans Supabase.
export function newClientResultToDossier(
  result: NewClientResult,
  source: 'tally' | 'csv' | 'import' = 'tally'
): DossierDomiciliation {
  const now = new Date().toISOString();
  const c = result.clients || ({} as any);

  return {
    id: uid(),
    createdAt: now,
    statut: 'en_cours',
    raisonSociale: c.raison_sociale || '',
    formeJuridique: c.forme_juridique || 'SAS',
    siret: c.siren_siret || c.siret || '',
    rcsVille: c.rcs_ville || c.ville_rcs || '',
    activite: c.activite_principale || c.activite || '',
    descriptionActivite: c.description_activite || '',
    nomGerant: c.nom_gerant || '',
    prenomGerant: c.prenom_gerant || '',
    nationaliteGerant: c.nationalite_gerant || '',
    paysOrigine: c.adresse_perso_pays || c.pays_origine || 'France',
    tel: c.tel_gerant || c.tel || '',
    email: c.email_gerant || c.email || '',
    adresseDomicile: [c.adresse_perso_rue, c.adresse_perso_cp, c.adresse_perso_ville]
      .filter(Boolean).join(', ') || c.adresse_personnelle || '',
    dateDebut: now.split('T')[0],
    origineFonds: c.origine_fonds || '',
    beneficiairesDeclares: c.beneficiaires_effectifs_declarés || c.beneficiaires_effectifs || '',
    utilisationAdresse: c.utilisation_adresse_domiciliation || 'Siège social',
    estPPE: typeof c.pep === 'string' ? /oui|yes|true/i.test(c.pep) : !!c.pep,
    appartenancePolitiqueReligieuse: typeof c.organisme_politique_ou_religieux === 'string'
      ? /oui|yes|true/i.test(c.organisme_politique_ou_religieux)
      : false,
    commentairesControlesInitiaux: c.commentaires_controles_initiaux || '',
    niveauRisqueIA: 'vert',
    decisionRisqueIA: '',
    commentaireRisqueIA: '',
    statutMiseAJourAnnuelle: 'a_jour',
    derniereMajAnnuelle: now,
    dernierControleTrimestriel: now,
    statutConformiteTrimestrielle: 'Conforme',
    tarifChoisi: 'mensuel',
    montantMensuel: 50,
    optionCourrier: 'standard',
    numeroBal: '',
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
    historique: [{
      id: uid(),
      date: now,
      type: 'autre',
      description: source === 'tally'
        ? "Création du dossier depuis Google Sheet (Tally)"
        : source === 'csv'
        ? "Création du dossier depuis CSV"
        : "Création du dossier via import",
    }],
  };
}

// Récupère une valeur "raison sociale plausible" d'une ligne CSV brute pour preview.
export function guessRaisonSociale(row: Record<string, string>): string {
  const keys = Object.keys(row);
  const candidates = ['raison_sociale', 'raisonSociale', 'Raison Sociale', 'company', 'Company',
                      'entreprise', 'Entreprise', 'nom_entreprise', 'denomination'];
  for (const k of candidates) {
    if (row[k]?.trim()) return row[k].trim();
  }
  // Fuzzy match
  for (const k of keys) {
    if (/raison|entreprise|company|denomination/i.test(k) && row[k]?.trim()) {
      return row[k].trim();
    }
  }
  // Fallback : premier champ non vide
  for (const k of keys) {
    if (row[k]?.trim() && row[k].length > 2 && row[k].length < 100) {
      return row[k].trim();
    }
  }
  return '(sans nom)';
}

export function guessEmail(row: Record<string, string>): string {
  const keys = Object.keys(row);
  for (const k of keys) {
    if (/email|mail|contact/i.test(k) && /@/.test(row[k] || '')) return row[k];
  }
  return '';
}
