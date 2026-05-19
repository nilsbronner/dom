// Modal : import multi-sélection depuis la Google Sheet Tally.
// Fetch CSV → liste avec checkboxes → import groupé séquentiel.

import React, { useState, useEffect, useMemo } from 'react';
import {
  X, RefreshCw, Loader2, AlertTriangle, ExternalLink, Users, CheckCircle, Upload
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

type RowStatus = 'pending' | 'uploading' | 'done' | 'error';

const TallyImportModal: React.FC<Props> = ({ isOpen, onClose, onImported }) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Sélection : on tracke par index dans le tableau rows
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [statuses, setStatuses] = useState<Map<number, { status: RowStatus; error?: string }>>(new Map());
  const [importing, setImporting] = useState(false);

  const loadSheet = async () => {
    setLoading(true);
    setError(null);
    try {
      const csv = await fetchSheetData();
      const parsed = parseCSV(csv);
      setRows(parsed.reverse()); // Plus récent d'abord
      setSelected(new Set());
      setStatuses(new Map());
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

  const toggleOne = (idx: number) => {
    if (importing) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && selected.size < rows.length;

  const toggleAll = () => {
    if (importing) return;
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((_, idx) => idx)));
    }
  };

  const handleImportSelected = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    setError(null);

    const indices = Array.from(selected).sort((a, b) => a - b);
    for (const idx of indices) {
      // Skip if already done in a previous partial run
      const current = statuses.get(idx);
      if (current?.status === 'done') continue;

      setStatuses((prev) => new Map(prev).set(idx, { status: 'uploading' }));
      try {
        const dossier = tallyRowToDossier(rows[idx]);
        await onImported(dossier);
        setStatuses((prev) => new Map(prev).set(idx, { status: 'done' }));
      } catch (err: any) {
        setStatuses((prev) => new Map(prev).set(idx, { status: 'error', error: err.message }));
      }
    }
    setImporting(false);
  };

  const handleClose = () => {
    if (importing) return;
    setRows([]);
    setSelected(new Set());
    setStatuses(new Map());
    setError(null);
    onClose();
  };

  const stats = useMemo(() => {
    let done = 0, errored = 0;
    statuses.forEach((s) => {
      if (s.status === 'done') done++;
      else if (s.status === 'error') errored++;
    });
    return { done, errored };
  }, [statuses]);

  if (!isOpen) return null;

  const canClose = !importing;
  const canImport = !importing && selected.size > 0;

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
                {rows.length > 0
                  ? `${rows.length} réponse${rows.length > 1 ? 's' : ''} · ${selected.size} sélectionnée${selected.size > 1 ? 's' : ''}`
                  : 'Chargement…'}
                {stats.done > 0 && ` · ${stats.done} importé${stats.done > 1 ? 's' : ''}`}
                {stats.errored > 0 && ` · ${stats.errored} erreur${stats.errored > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={SHEET_EDIT_URL} target="_blank" rel="noopener noreferrer"
               className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition" title="Ouvrir la Google Sheet">
              <ExternalLink className="w-4 h-4" />
            </a>
            <button onClick={loadSheet} disabled={loading || importing}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition disabled:opacity-50" title="Recharger">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleClose} disabled={!canClose}
                    className="p-2 hover:bg-slate-800 rounded-lg transition disabled:opacity-50">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Toolbar : select all + count */}
        {rows.length > 0 && (
          <div className="px-5 py-2.5 border-b border-slate-800 flex items-center justify-between bg-brand-dark/40">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={toggleAll}
                disabled={importing}
                className="w-4 h-4 accent-brand-primary cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">
                {allSelected ? 'Tout désélectionner' : someSelected ? `${selected.size} sélectionné(s)` : 'Tout sélectionner'}
              </span>
            </label>
            <span className="text-[10px] text-slate-500">Plus récents en haut</span>
          </div>
        )}

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
                const formeJuridiqueKey = Object.keys(row).find((k) => /forme\s*juridique/i.test(k));
                const formeVal = formeJuridiqueKey ? row[formeJuridiqueKey] : '';
                const submitted = row['Submitted at'] || '';
                const isChecked = selected.has(idx);
                const rowStatus = statuses.get(idx);
                const isDone = rowStatus?.status === 'done';
                const isError = rowStatus?.status === 'error';
                const isUploading = rowStatus?.status === 'uploading';

                return (
                  <li
                    key={idx}
                    onClick={() => !isDone && toggleOne(idx)}
                    className={`bg-brand-dark border rounded-lg p-3 flex items-center gap-3 cursor-pointer select-none transition ${
                      isDone ? 'border-emerald-500/30 bg-emerald-500/5 cursor-default opacity-60'
                      : isError ? 'border-rose-500/30 bg-rose-500/5'
                      : isChecked ? 'border-brand-primary/50 bg-brand-primary/5'
                      : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(idx)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={importing || isDone}
                      className="w-4 h-4 accent-brand-primary flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{raisonSociale}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {formeVal && <span className="text-brand-primary mr-1">{formeVal}</span>}
                        {email}
                      </p>
                      {submitted && <p className="text-[10px] text-slate-500 mt-0.5">{submitted}</p>}
                      {isError && rowStatus?.error && (
                        <p className="text-[10px] text-rose-400 mt-1">⚠ {rowStatus.error}</p>
                      )}
                    </div>
                    <div className="w-6 flex justify-center flex-shrink-0">
                      {isUploading && <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />}
                      {isDone && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                      {isError && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-500 hidden md:block">
            Sheet ...M9CE — mapping direct (sans IA)
          </span>
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={handleClose}
              disabled={!canClose}
              className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg text-sm font-bold hover:bg-slate-700 transition disabled:opacity-50"
            >
              {importing ? 'Import en cours…' : 'Fermer'}
            </button>
            <button
              onClick={handleImportSelected}
              disabled={!canImport}
              className="flex items-center gap-2 px-5 py-2 bg-brand-primary text-brand-dark rounded-lg text-sm font-black hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing
                ? `Import… (${stats.done}/${selected.size})`
                : `Importer ${selected.size > 0 ? `(${selected.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TallyImportModal;
