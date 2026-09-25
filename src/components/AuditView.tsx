// src/components/AuditView.tsx
import React, { useState } from 'react';
import type { AuditLog } from '../types';
import { History, Shield, Hash, Search, Clock, CheckCircle2 } from 'lucide-react';

interface AuditViewProps {
  logs: AuditLog[];
}

export const AuditView: React.FC<AuditViewProps> = ({ logs }) => {
  const [search, setSearch] = useState('');

  const filteredLogs = logs.filter(
    l =>
      l.userName.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase()) ||
      l.hash.toLowerCase().includes(search.toLowerCase())
  );

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
            Traçabilité juridique complète des signatures, connexions et modifications
          </p>
        </div>

        <div className="flex items-center gap-2 bg-cyan-500/10 text-cyan-400 px-3.5 py-1.5 rounded-xl border border-cyan-500/20 text-xs font-mono font-bold">
          <Hash className="w-4 h-4" />
          Chaîne Cryptographique Intègre
        </div>
      </div>

      {/* Barre de Recherche */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par opérateur, libellé d'action, empreinte hash..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Tableau d'Audit */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="p-3.5">Horodatage & IP</th>
                <th className="p-3.5">Opérateur & Rôle</th>
                <th className="p-3.5">Action Exécutée</th>
                <th className="p-3.5">Détails de l'Événement</th>
                <th className="p-3.5">Empreinte SHA-256</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredLogs.map(log => (
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
                    <span className="bg-blue-500/20 text-blue-300 font-semibold text-[10px] px-2 py-0.5 rounded border border-blue-500/30">
                      {log.action}
                    </span>
                  </td>

                  <td className="p-3.5 max-w-xs text-slate-300">
                    {log.details}
                  </td>

                  <td className="p-3.5 whitespace-nowrap font-mono text-[10px] text-cyan-400">
                    <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      {log.hash.slice(0, 18)}...
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};