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

// Mapping direct d'une ligne Tally vers un DossierDomiciliation.
// Évite l'appel Gemini pour un parsing trivial (les colonnes Tally sont déjà nommées explicitement).
export function tallyRowToDossier(row: Record<string, string>): DossierDomiciliation {
  const now = new Date().toISOString();
  const get = (regex: RegExp): string => {
    const key = Object.keys(row).find((k) => regex.test(k));
    return key ? (row[key] || '').trim() : '';
  };
  const getBool = (regex: RegExp): boolean => {
    const v = get(regex).toLowerCase();
    return /^(oui|yes|true|1)$/i.test(v);
  };

  const prenom = get(/^pr[eé]nom$/i);
  const nom = get(/^nom$/i);
  const numero = get(/^num[eé]ro$/i);
  const voie = get(/^voie$/i);
  const cp = get(/code\s*postal/i);
  const ville = get(/^ville$/i);
  const adresseDomicile = [numero, voie, cp, ville].filter(Boolean).join(' ');

  const raisonSociale = get(/nom\s*de\s*soci[eé]t[eé]/i);
  const formeJuridique = get(/forme\s*juridique/i);
  const dateInscription = get(/date\s*d.?inscription/i);

  const courrierReexp = get(/r[eé]exp[eé]dition.*courrier/i);
  const courrierScan = get(/scan.*courrier/i);
  let optionCourrier: 'standard' | 'scan' | 'renvoi' = 'standard';
  if (/oui/i.test(courrierReexp)) optionCourrier = 'renvoi';
  else if (/oui/i.test(courrierScan)) optionCourrier = 'scan';

  const activite = get(/activit[eé]\s*principale/i);
  const description = [
    get(/produits\s*ou\s*services/i),
    get(/march[eé]s\s*cibles/i),
    get(/structure.*entreprise.*organisation/i),
  ].filter(Boolean).join(' | ');

  const origineFonds = get(/origine\s*des\s*fonds/i);
  const investisseurs = get(/investisseurs.*partenaires/i);
  const beneficiaires = get(/b[eé]n[eé]ficiaires\s*effectifs(?!\s*d)/i)
    || get(/qui\s*sont\s*les\s*b[eé]n[eé]ficiaires/i);
  const beneficiairesDetails = get(/informations.*b[eé]n[eé]ficiaires/i);
  const beneficiairesDeclares = [beneficiaires, beneficiairesDetails, investisseurs]
    .filter(Boolean).join(' — ');

  const utilisationAdresse = get(/quelles?\s*fins.*adresse/i) || 'Siège social';

  return {
    id: uid(),
    createdAt: now,
    statut: 'en_cours',
    raisonSociale,
    formeJuridique: formeJuridique || 'SAS',
    siret: '',
    rcsVille: ville || '',
    activite,
    descriptionActivite: description,
    nomGerant: nom.toUpperCase(),
    prenomGerant: prenom,
    nationaliteGerant: '',
    paysOrigine: 'France',
    tel: get(/num[eé]ro\s*de\s*t[eé]l[eé]phone/i),
    email: get(/^email$/i),
    adresseDomicile,
    dateDebut: dateInscription || now.split('T')[0],
    origineFonds,
    beneficiairesDeclares,
    utilisationAdresse,
    estPPE: false,
    appartenancePolitiqueReligieuse: false,
    commentairesControlesInitiaux: [
      get(/nature.*fr[eé]quence.*transactions/i) && `Transactions : ${get(/nature.*fr[eé]quence.*transactions/i)}`,
      get(/montants\s*moyens.*transactions/i) && `Montants moyens : ${get(/montants\s*moyens.*transactions/i)}`,
      get(/documents.*l[eé]gitimit[eé].*p[eé]rennit[eé]/i) && `Docs légitimité : ${get(/documents.*l[eé]gitimit[eé].*p[eé]rennit[eé]/i)}`,
      get(/mesures\s*internes.*conformit[eé]/i) && `LCB-FT : ${get(/mesures\s*internes.*conformit[eé]/i)}`,
      get(/changements\s*importants/i) && `Changements prévus : ${get(/changements\s*importants/i)}`,
      get(/op[eé]rations\s*financi[eè]res.*avenir/i) && `Opérations futures : ${get(/op[eé]rations\s*financi[eè]res.*avenir/i)}`,
    ].filter(Boolean).join('\n'),
    niveauRisqueIA: 'vert',
    decisionRisqueIA: '',
    commentaireRisqueIA: '',
    statutMiseAJourAnnuelle: 'a_jour',
    derniereMajAnnuelle: now,
    dernierControleTrimestriel: now,
    statutConformiteTrimestrielle: 'Conforme',
    tarifChoisi: 'mensuel',
    montantMensuel: 50,
    optionCourrier,
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
      description: `Création du dossier depuis Tally (Submission ID: ${row['Submission ID'] || '?'})`,
    }],
  };
}
