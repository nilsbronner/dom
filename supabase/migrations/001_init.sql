-- Migration 001 : Initialisation base de données Grub Dom
-- Stratégie : 1 ligne par dossier, champs scalaires indexables + JSONB pour les tableaux

create table if not exists dossiers (
  -- Identité
  id                              text primary key,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  statut                          text not null default 'en_cours',

  -- Entreprise
  raison_sociale                  text not null default '',
  forme_juridique                 text not null default '',
  siret                           text not null default '',
  rcs_ville                       text not null default '',
  activite                        text not null default '',
  description_activite            text not null default '',

  -- Gérant
  nom_gerant                      text not null default '',
  prenom_gerant                   text not null default '',
  nationalite_gerant              text not null default '',
  pays_origine                    text not null default 'France',
  tel                             text not null default '',
  email                           text not null default '',
  adresse_domicile                text not null default '',

  -- Dates contrat
  date_debut                      text not null default '',
  date_fin                        text,
  motif_resiliation               text,

  -- TRACFIN
  origine_fonds                   text not null default '',
  beneficiaires_declares          text not null default '',
  utilisation_adresse             text not null default '',
  est_ppe                         boolean not null default false,
  appartenance_politique          boolean not null default false,
  commentaires_controles          text not null default '',

  -- Analyse IA
  niveau_risque_ia                text not null default 'vert',
  decision_risque_ia              text not null default '',
  commentaire_risque_ia           text not null default '',

  -- Suivi périodique
  statut_maj_annuelle             text not null default 'a_jour',
  derniere_maj_annuelle           text not null default '',
  dernier_controle_trimestriel    text not null default '',
  statut_conformite_trim          text not null default 'Conforme',

  -- Domiciliation
  tarif_choisi                    text not null default 'mensuel',
  montant_mensuel                 numeric,
  option_courrier                 text not null default 'standard',
  numero_bal                      text not null default '',

  -- SIE / Greffe
  a_inclure_prochaine_liste       boolean not null default true,

  -- Cloud
  drive_folder_url                text,
  drive_folder_id                 text,

  -- Source
  source_onboarding               boolean not null default false,

  -- Tableaux imbriqués (JSONB)
  docs                            jsonb not null default '{"cniGerant":false,"justifDomicileGerant":false,"statuts":false,"kbis":false,"attestationCompta":false,"listeBeneficiaires":false,"cniBeneficiaires":false,"contratSigne":false}',
  relances                        jsonb not null default '[]',
  paiements                       jsonb not null default '[]',
  historique                      jsonb not null default '[]'
);

-- Index pour les recherches fréquentes
create index if not exists idx_dossiers_statut          on dossiers (statut);
create index if not exists idx_dossiers_raison_sociale  on dossiers (raison_sociale);
create index if not exists idx_dossiers_created_at      on dossiers (created_at desc);
create index if not exists idx_dossiers_niveau_risque   on dossiers (niveau_risque_ia);

-- Mise à jour automatique de updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger dossiers_updated_at
  before update on dossiers
  for each row execute function set_updated_at();

-- RLS activé (le service_role key du serveur contourne automatiquement)
alter table dossiers enable row level security;
