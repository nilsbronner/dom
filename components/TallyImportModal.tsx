// Modal : import d'un client depuis la Google Sheet Tally.
// Fetch CSV → parse → liste des lignes → Gemini analyse une ligne → crée le dossier.

import React, { useState, useEffect } from 'react';
import {
  X, RefreshCw, Loader2, AlertTriangle, ExternalLink, Users, ChevronRight, CheckCircle
} from 'lucide-react';
import { fetchSheetData, parseCSV } from '../services/googleSheetsService';
import {
  tallyRowToDossier,
  guessRaisonSociale,
  guessEmail,
} from '../services/clientImportService';
import type { DossierDomiciliation } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: (dossier: DossierDomiciliation) => Promise<void>;
}

const SHEET_EDIT_URL = "https://docs.google.com/spreadsheets/d/1UJrNyzwE5Haov1cS5Ylxa4ghJuRHKTjqWN_rzO-M9CE/edit";

const TallyImportModal: React.FC<Props> = ({ isOpen, onClose, onImported }) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importingIdx, setImportingIdx] = useState<number | null>(null);

  const loadSheet = async () => {
    setLoading(true);
    setError(null);
    try {
      const csv = await fetchSheetData();
      const parsed = parseCSV(csv);
      setRows(parsed.reverse()); // Plus récent d'abord
    } catch (err: any) {
      setError(err.message || "Erreur récupération Google Sheet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && rows.length === 0 && !loading && !error) {
      loadSheet();
    }
  }, [isOpen]);

  const handleImportRow = async (row: Record<string, string>, idx: number) => {
    setImportingIdx(idx);
    setError(null);
    try {
      // Mapping direct CSV Tally → DossierDomiciliation (pas besoin de Gemini, colonnes nommées)
      const dossier = tallyRowToDossier(row);
      await onImported(dossier);
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'import du client");
    } finally {
      setImportingIdx(null);
    }
  };

  const handleClose = () => {
    if (importingIdx !== null) return;
    setRows([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-dark/90 backdrop-blur-sm">
      <div className="bg-brand-light border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-brand-primary" />
            <div>
              <h2 className="text-lg font-black text-white">Import depuis Tally / Google Sheet</h2>
              <p className="text-[10px] text-slate-400">
                {rows.length > 0 ? `${rows.length} réponse${rows.length > 1 ? 's' : ''} disponible${rows.length > 1 ? 's' : ''}` : 'Chargement…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={SHEET_EDIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition"
              title="Ouvrir la Google Sheet"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={loadSheet}
              disabled={loading}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition disabled:opacity-50"
              title="Recharger"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleClose} disabled={importingIdx !== null} className="p-2 hover:bg-slate-800 rounded-lg transition disabled:opacity-50">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && rows.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              <p className="text-sm">Récupération de la Google Sheet…</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Erreur</p>
                <p>{error}</p>
                <p className="mt-1 text-rose-400/70 italic">
                  Vérifie que la Sheet est partagée en lecture publique (anyone with the link).
                </p>
              </div>
            </div>
          )}

          {!loading && rows.length === 0 && !error && (
            <p className="text-center py-8 text-sm text-slate-400">Aucune réponse dans la Sheet.</p>
          )}

          {rows.length > 0 && (
            <ul className="space-y-2">
              {rows.map((row, idx) => {
                const raisonSociale = guessRaisonSociale(row);
                const email = guessEmail(row);
                const formeJuridique = Object.keys(row).find((k) => /forme\s*juridique/i.test(k));
                const formeVal = formeJuridique ? row[formeJuridique] : '';
                const submitted = row['Submitted at'] || '';
                const isImporting = importingIdx === idx;
                const isDisabled = importingIdx !== null && !isImporting;
                return (
                  <li key={idx} className="bg-brand-dark border border-slate-700 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{raisonSociale}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {formeVal && <span className="text-brand-primary mr-1">{formeVal}</span>}
                        {email}
                      </p>
                      {submitted && <p className="text-[10px] text-slate-500 mt-0.5">{submitted}</p>}
                    </div>
                    <button
                      onClick={() => handleImportRow(row, idx)}
                      disabled={isImporting || isDisabled}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-brand-dark text-xs font-black rounded-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Import…
                        </>
                      ) : (
                        <>
                          Importer
                          <ChevronRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
          <span>Sheet : ...M9CE — Tally → Sheet → Supabase</span>
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Mapping direct (sans IA)
          </span>
        </div>
      </div>
    </div>
  );
};

export default TallyImportModal;
