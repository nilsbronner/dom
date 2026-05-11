
import React, { useState, useEffect } from 'react';
import { ClientListResult } from '../types';
import { extractClientList } from '../services/geminiService';
import { fetchSheetData } from '../services/googleSheetsService';
import { Loader2, Users, FileText, Download, RefreshCw, ExternalLink } from 'lucide-react';

const ClientList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [rawData, setRawData] = useState('');
  const [result, setResult] = useState<ClientListResult | null>(null);

  const handleFetchSheet = async () => {
    setFetching(true);
    try {
      const csv = await fetchSheetData();
      setRawData(csv);
      // Optionnel: On lance l'analyse automatiquement après le fetch
      setLoading(true);
      const data = await extractClientList(csv);
      setResult(data);
    } catch (err) {
      alert("Erreur lors de la récupération de la Google Sheet. Vérifiez qu'elle est publique.");
    } finally {
      setFetching(false);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const data = await extractClientList(rawData);
      setResult(data);
    } catch (err) {
      alert("Erreur lors de l'extraction de la liste des clients.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="bg-brand-light rounded-xl shadow-sm border border-slate-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-primary" />
            Extraction Base Clients (Tally & Excel)
          </h2>
          <div className="flex gap-4 items-center">
            <a 
              href="https://docs.google.com/spreadsheets/d/1UJrNyzwE5Haov1cS5Ylxa4ghJuRHKTjqWN_rzO-M9CE/edit" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand-primary hover:underline font-medium"
            >
              <ExternalLink className="w-3 h-3" /> Ouvrir Excel
            </a>
            <button
              onClick={handleFetchSheet}
              disabled={fetching || loading}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 text-sm font-bold"
            >
              {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {fetching ? "Récupération..." : "Récupérer depuis Google Sheets"}
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Données sources (CSV/JSON)
            </label>
            <p className="text-xs text-slate-400 mb-2">Copiez le contenu du fichier d'export ou utilisez le bouton ci-dessus.</p>
            <textarea
              required
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              className="w-full h-48 font-mono text-xs rounded-md border-slate-700 bg-brand-dark text-white shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-2"
              placeholder={`[\n  { "Raison Sociale": "Boite A", "Gérant": "M. A" },\n  { "Raison Sociale": "Boite B", "Gérant": "Mme B" }\n]`}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !rawData.trim()}
              className="flex items-center gap-2 bg-brand-primary text-brand-dark font-bold px-6 py-2 rounded-lg hover:bg-brand-primary/90 transition disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Extraction de la liste..." : "Extraire les Clients"}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="bg-brand-light rounded-xl shadow-lg border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="p-6 border-b border-slate-700 flex justify-between items-start">
             <div>
                <h3 className="text-lg font-semibold text-white">Liste des Clients Identifiés ({result.clients.length})</h3>
                <p className="text-sm text-slate-400 mt-1">{result.analyse_globale}</p>
             </div>
             <button disabled className="flex items-center gap-2 text-xs font-medium text-slate-500 cursor-not-allowed">
               <Download className="w-4 h-4" /> Export CSV (Bientôt)
             </button>
           </div>
           
           <div className="overflow-x-auto">
             <table className="min-w-full text-sm text-left">
               <thead className="bg-brand-dark/50 text-slate-300 font-medium">
                 <tr>
                   <th className="px-6 py-3">Raison Sociale</th>
                   <th className="px-6 py-3">Gérant</th>
                   <th className="px-6 py-3">Contact</th>
                   <th className="px-6 py-3">Activité / Ville</th>
                   <th className="px-6 py-3">Statut Dossier</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-700">
                 {result.clients.map((client, idx) => (
                   <tr key={idx} className="hover:bg-brand-dark/30 transition-colors">
                     <td className="px-6 py-3 font-medium text-white">{client.raison_sociale}</td>
                     <td className="px-6 py-3 text-slate-300">{client.nom_gerant}</td>
                     <td className="px-6 py-3 text-slate-300 font-mono text-xs">{client.email_contact}</td>
                     <td className="px-6 py-3 text-slate-300">
                       <div className="flex flex-col">
                         <span>{client.activite_principale}</span>
                         <span className="text-xs text-slate-500">{client.ville_rcs}</span>
                       </div>
                     </td>
                     <td className="px-6 py-3">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                         client.statut_dossier.toLowerCase().includes('complet') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                         client.statut_dossier.toLowerCase().includes('attente') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                         'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                       }`}>
                         {client.statut_dossier}
                       </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
           
           {result.clients.length === 0 && (
              <div className="p-12 text-center text-slate-500 italic">
                 Aucun client trouvé dans les données fournies.
              </div>
           )}
        </div>
      )}
    </div>
  );
};

export default ClientList;
