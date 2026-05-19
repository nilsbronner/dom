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
  // Priorité : colonne Tally "Nom de société"
  const tallyKey = Object.keys(row).find((k) => /nom\s*de\s*soci[eé]t[eé]/i.test(k));
  if (tallyKey && row[tallyKey]?.trim()) return row[tallyKey].trim();

  // Fallback : autres conventions
  const candidates = ['raison_sociale', 'raisonSociale', 'Raison Sociale', 'company', 'Company',
                      'entreprise', 'Entreprise', 'nom_entreprise', 'denomination'];
  for (const k of candidates) {
    if (row[k]?.trim()) return row[k].trim();
  }
  for (const k of Object.keys(row)) {
    if (/raison|entreprise|company|denomination|soci[eé]t[eé]/i.test(k) && row[k]?.trim()) {
      return row[k].trim();
    }
  }
  return '(sans nom)';
}

export function guessEmail(row: Record<string, string>): string {
  for (const k of Object.keys(row)) {
    if (/email|mail|contact/i.test(k) && /@/.test(row[k] || '')) return row[k];
  }
  return '';
}

// Mapping direct 1:1 d'une ligne Tally vers un DossierDomiciliation.
// Principe : une cellule Tally = une cellule de dossier. Pas de concaténation.
// Les colonnes Tally qui n'ont pas de champ typé dans le dossier sont préservées
// telles quelles dans `tallyAnswers` (JSONB) pour traçabilité totale.
export function tallyRowToDossier(row: Record<string, string>): DossierDomiciliation {
  const now = new Date().toISOString();
  const get = (regex: RegExp): string => {
    const key = Object.keys(row).find((k) => regex.test(k));
    return key ? (row[key] || '').trim() : '';
  };

  // Adresse : concaténation des 4 colonnes Tally (Numéro, Voie, CP, Ville)
  // — exception assumée, c'est une adresse postale standard.
  const numero = get(/^num[eé]ro$/i);
  const voie = get(/^voie$/i);
  const cp = get(/code\s*postal/i);
  const ville = get(/^ville$/i);
  const adresseDomicile = [numero, voie, cp, ville].filter(Boolean).join(' ');

  const courrierReexp = get(/r[eé]exp[eé]dition.*courrier/i);
  const courrierScan = get(/scan.*courrier/i);
  let optionCourrier: 'standard' | 'scan' | 'renvoi' = 'standard';
  if (/oui/i.test(courrierReexp)) optionCourrier = 'renvoi';
  else if (/oui/i.test(courrierScan)) optionCourrier = 'scan';

  return {
    id: uid(),
    createdAt: now,
    statut: 'en_cours',

    // --- Identité entreprise (1 cellule Tally = 1 champ) ---
    raisonSociale:        get(/nom\s*de\s*soci[eé]t[eé]/i),
    formeJuridique:       get(/forme\s*juridique/i) || 'SAS',
    siret:                '',
    rcsVille:             ville,
    activite:             get(/activit[eé]\s*principale/i),
    descriptionActivite:  get(/produits\s*ou\s*services/i),

    // --- Gérance ---
    nomGerant:            get(/^nom$/i).toUpperCase(),
    prenomGerant:         get(/^pr[eé]nom$/i),
    nationaliteGerant:    '',
    paysOrigine:          'France',
    tel:                  get(/num[eé]ro\s*de\s*t[eé]l[eé]phone/i),
    email:                get(/^email$/i),
    adresseDomicile,

    // --- Domiciliation ---
    dateDebut:            get(/date\s*d.?inscription/i) || now.split('T')[0],
    origineFonds:         get(/origine\s*des\s*fonds/i),
    beneficiairesDeclares: get(/qui\s*sont\s*les\s*b[eé]n[eé]ficiaires/i),
    utilisationAdresse:   get(/quelles?\s*fins.*adresse/i) || 'Siège social',
    estPPE:               false,
    appartenancePolitiqueReligieuse: false,
    commentairesControlesInitiaux: '',

    // --- Risque IA (non renseigné à l'import, sera calculé après) ---
    niveauRisqueIA:       'vert',
    decisionRisqueIA:     '',
    commentaireRisqueIA:  '',

    // --- Suivi ---
    statutMiseAJourAnnuelle:        'a_jour',
    derniereMajAnnuelle:            now,
    dernierControleTrimestriel:     now,
    statutConformiteTrimestrielle:  'Conforme',
    tarifChoisi:                    'mensuel',
    montantMensuel:                 50,
    optionCourrier,
    numeroBal:                      '',

    docs: {
      cniGerant: false, justifDomicileGerant: false, statuts: false, kbis: false,
      attestationCompta: false, listeBeneficiaires: false, cniBeneficiaires: false, contratSigne: false,
    },

    relances: [],
    aInclureProchaineListe: true,
    paiements: [],
    historique: [{
      id: uid(),
      date: now,
      type: 'autre',
      description: `Création du dossier depuis Tally (Submission ID: ${row['Submission ID'] || '?'})`,
    }],

    // --- Source brute : TOUTES les colonnes Tally préservées 1:1 ---
    tallyAnswers: { ...row },
  };
}
