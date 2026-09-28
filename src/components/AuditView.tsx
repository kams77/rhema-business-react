// src/components/AuditView.tsx
import React, { useState } from 'react';
import type { AuditLog } from '../types';
import { History, Shield, Hash, Search, Clock, Download, Filter, CheckCircle2, ShieldAlert } from 'lucide-react';

interface AuditViewProps {
  logs: AuditLog[];
}

export const AuditView: React.FC<AuditViewProps> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredLogs = logs.filter(l => {
    const matchesCategory = selectedCategory === 'all' || l.category === selectedCategory;
    const matchesSearch =
      l.userName.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase()) ||
      l.hash.toLowerCase().includes(search.toLowerCase()) ||
      l.userRole.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleExportCSV = () => {
    const headers = ['ID', 'Horodatage', 'Opérateur', 'Rôle', 'Action', 'Catégorie', 'Détails', 'IP', 'Empreinte SHA-256'];
    const rows = filteredLogs.map(l => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.userName}"`,
      `"${l.userRole}"`,
      `"${l.action}"`,
      `"${l.category}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.ip}"`,
      `"${l.hash}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `journal_audit_rhema_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'security':
        return <span className="bg-rose-500/20 text-rose-300 font-semibold text-[10px] px-2 py-0.5 rounded border border-rose-500/30">Sécurité</span>;
      case 'auth':
        return <span className="bg-emerald-500/20 text-emerald-300 font-semibold text-[10px] px-2 py-0.5 rounded border border-emerald-500/30">Auth</span>;
      case 'document':
        return <span className="bg-sky-500/20 text-sky-300 font-semibold text-[10px] px-2 py-0.5 rounded border border-sky-500/30">Document</span>;
      case 'task':
        return <span className="bg-violet-500/20 text-violet-300 font-semibold text-[10px] px-2 py-0.5 rounded border border-violet-500/30">Tâche</span>;
      case 'hierarchy':
        return <span className="bg-amber-500/20 text-amber-300 font-semibold text-[10px] px-2 py-0.5 rounded border border-amber-500/30">Hiérarchie</span>;
      default:
        return <span className="bg-indigo-500/20 text-indigo-300 font-semibold text-[10px] px-2 py-0.5 rounded border border-indigo-500/30">Admin</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <History className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-black text-white">Journal d'Audit Immuable SHA-256</h2>
          </div>
          <p className="text-xs text-slate-400">
            Traçabilité juridique certifiée : horodatage, adresses IP, empreintes cryptographiques et enregistrement conforme des opérations
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-cyan-500/10 text-cyan-400 px-3.5 py-1.5 rounded-xl border border-cyan-500/20 text-xs font-mono font-bold">
            <Hash className="w-4 h-4" />
            Chaîne Cryptographique Intègre
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold transition shadow-sm"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Exporter CSV</span>
          </button>
        </div>
      </div>

      {/* Barre de Recherche et Filtres par Catégorie */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par opérateur, libellé d'action, empreinte hash..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filtrer :
          </span>
          {[
            { id: 'all', label: 'Toutes les actions' },
            { id: 'security', label: 'Sécurité & Accès' },
            { id: 'auth', label: 'Authentification' },
            { id: 'document', label: 'Documents & Fiches' },
            { id: 'task', label: 'Workflows & Tâches' },
            { id: 'hierarchy', label: 'Hiérarchie' },
            { id: 'admin', label: 'Administration' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
          <span className="text-xs text-slate-500 ml-auto font-mono">
            {filteredLogs.length} entrée{filteredLogs.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Tableau d'Audit */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3.5">Horodatage & IP</th>
                <th className="p-3.5">Opérateur & Rôle</th>
                <th className="p-3.5">Catégorie</th>
                <th className="p-3.5">Action Exécutée</th>
                <th className="p-3.5">Détails de l'Événement</th>
                <th className="p-3.5">Empreinte SHA-256</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Aucun événement d'audit ne correspond à vos critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {log.timestamp}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{log.ip}</div>
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-bold text-white">{log.userName}</div>
                      <div className="text-[11px] text-slate-400">{log.userRole}</div>
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      {getCategoryBadge(log.category)}
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      <span className="bg-slate-800 text-slate-200 font-medium text-[11px] px-2 py-0.5 rounded border border-slate-700">
                        {log.action}
                      </span>
                    </td>

                    <td className="p-3.5 max-w-sm text-slate-300">
                      {log.details}
                    </td>

                    <td className="p-3.5 whitespace-nowrap font-mono text-[10px] text-cyan-400">
                      <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800 select-all" title={log.hash}>
                        {log.hash.slice(0, 18)}...
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
