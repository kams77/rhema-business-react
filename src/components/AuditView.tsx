// src/components/AuditView.tsx
import React, { useState } from 'react';
import type { AuditLog } from '../types';
import { History, Shield, Hash, Search, Clock, Download, Filter, CheckCircle2, ShieldAlert, FileText } from 'lucide-react';
import { exportAuditLogsToCSV, exportAuditLogsToPDF } from '../utils/exportUtils';
import { API_MODE } from '../config';
import { api } from '../lib/api';
import { shortHash, verifyAuditChain } from '../lib/integrity';

interface AuditViewProps {
  logs: AuditLog[];
  organizationName?: string;
}

type VerifyState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'ok'; count: number; source: 'serveur' | 'local' }
  | { status: 'broken'; count: number; source: 'serveur' | 'local'; detail: string }
  | { status: 'error'; message: string };

export const AuditView: React.FC<AuditViewProps> = ({ logs, organizationName }) => {
  const [verify, setVerify] = useState<VerifyState>({ status: 'idle' });

  const handleVerify = async () => {
    setVerify({ status: 'running' });
    try {
      if (API_MODE) {
        const r = await api.verifyAudit();
        setVerify(r.ok
          ? { status: 'ok', count: r.count, source: 'serveur' }
          : { status: 'broken', count: r.count, source: 'serveur', detail: r.entry ? `entrée n°${(r.brokenAt ?? 0) + 1} — ${r.entry.timestamp} — ${r.entry.action}` : `entrée n°${(r.brokenAt ?? 0) + 1}` });
      } else {
        const asc = [...logs].reverse() as unknown as Array<Record<string, any>>;
        const r = verifyAuditChain(asc);
        const e = r.brokenAt !== undefined ? asc[r.brokenAt] : undefined;
        setVerify(r.ok
          ? { status: 'ok', count: r.count, source: 'local' }
          : { status: 'broken', count: r.count, source: 'local', detail: e ? `${e.timestamp} — ${e.action}` : '' });
      }
    } catch (err) {
      setVerify({ status: 'error', message: err instanceof Error ? err.message : 'Vérification impossible.' });
    }
  };
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);

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
    exportAuditLogsToCSV(filteredLogs);
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      exportAuditLogsToPDF(filteredLogs, organizationName || 'Organisation');
    } finally {
      setIsExporting(false);
    }
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
            <h2 className="text-xl font-black text-white">Journal d'audit chaîné (SHA-256)</h2>
          </div>
          <p className="text-xs text-slate-400">
            {API_MODE
              ? "Horodatage, auteur et adresse IP fixés par le serveur. Chaque entrée contient l'empreinte de la précédente : toute modification ou suppression en base est détectée par la vérification."
              : "Mode local : le journal est conservé dans ce navigateur. La chaîne d'empreintes détecte les modifications, mais n'a pas de valeur probante sans serveur."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleVerify}
            disabled={verify.status === 'running'}
            title="Recalculer toutes les empreintes et vérifier que la chaîne est intacte"
            className="flex items-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 px-3.5 py-1.5 rounded-xl border border-cyan-500/20 text-xs font-bold transition disabled:opacity-50"
          >
            <Hash className="w-4 h-4" />
            {verify.status === 'running' ? 'Vérification…' : "Vérifier l'intégrité"}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              title="Exporter les journaux d'audit au format CSV (tableur Excel / LibreOffice)"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold transition shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Exporter CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              title="Générer un rapport PDF du journal filtré (archivage)"
              className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-md shadow-cyan-900/30 active:scale-95 disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-white" />
              <span>{isExporting ? 'Génération...' : 'Exporter PDF'}</span>
            </button>
          </div>
        </div>
      </div>

      {verify.status === 'ok' && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Chaîne intacte : {verify.count} entrée(s) vérifiée(s) {verify.source === 'serveur' ? 'par le serveur' : 'dans ce navigateur'}.
        </div>
      )}
      {verify.status === 'broken' && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl px-4 py-3">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Chaîne rompue ({verify.source}) : le journal a été modifié à partir de {verify.detail || 'une entrée'}. Conservez une sauvegarde et alertez la Direction.
        </div>
      )}
      {verify.status === 'error' && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl px-4 py-3">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {verify.message}
        </div>
      )}

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
                        {log.prevHash ? shortHash(log.hash) : `${log.hash.slice(0, 18)}… (non chaînée)`}
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
