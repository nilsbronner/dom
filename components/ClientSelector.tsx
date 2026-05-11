import React, { useState } from 'react';
import { DossierDomiciliation } from '../types';
import { Search, User, Building2, Check } from 'lucide-react';

interface ClientSelectorProps {
  dossiers: DossierDomiciliation[];
  onSelect: (dossier: DossierDomiciliation) => void;
  selectedId?: string;
  label?: string;
}

const ClientSelector: React.FC<ClientSelectorProps> = ({ dossiers, onSelect, selectedId, label = "Sélectionner un client" }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredDossiers = dossiers.filter(d => 
    d.raisonSociale.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.nomGerant.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.prenomGerant.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedDossier = dossiers.find(d => d.id === selectedId);

  return (
    <div className="relative w-full">
      <label className="block text-sm font-medium text-slate-200 mb-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-md border border-slate-700 shadow-sm bg-brand-dark px-3 py-2 cursor-pointer hover:border-brand-primary transition"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {selectedDossier ? (
            <>
              <Building2 className="w-4 h-4 text-brand-primary flex-shrink-0" />
              <span className="text-sm font-medium text-white truncate">{selectedDossier.raisonSociale}</span>
              <span className="text-xs text-slate-400 truncate">({selectedDossier.nomGerant})</span>
            </>
          ) : (
            <span className="text-sm text-slate-500 italic">Choisir un client existant...</span>
          )}
        </div>
        <Search className="w-4 h-4 text-slate-400" />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-brand-light rounded-md shadow-xl border border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-700 bg-brand-dark">
            <input
              autoFocus
              type="text"
              placeholder="Rechercher par nom ou gérant..."
              className="w-full text-sm border-none focus:ring-0 p-1 bg-transparent text-white placeholder:text-slate-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredDossiers.length > 0 ? (
              filteredDossiers.map((d) => (
                <div
                  key={d.id}
                  onClick={() => {
                    onSelect(d);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-brand-dark transition ${selectedId === d.id ? 'bg-brand-dark' : ''}`}
                >
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium text-white truncate">{d.raisonSociale}</span>
                    <span className="text-xs text-slate-400 truncate">{d.prenomGerant} {d.nomGerant}</span>
                  </div>
                  {selectedId === d.id && <Check className="w-4 h-4 text-brand-primary" />}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-slate-500 text-center italic">
                Aucun client trouvé
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSelector;
