// src/components/PointageView.tsx — registre de présence (pointage automatique).
// Un responsable voit les agents de son périmètre (mêmes règles que le serveur) :
// arrivée, départ, pauses, temps effectif et heures au-delà de la journée normale.
import React, { useMemo, useState } from 'react';
import { Clock, Download, Users, UserCheck, UserX, Coffee, RefreshCw, Info } from 'lucide-react';
import type { AttendanceDay, HierarchicalEntity, User } from '../types';
import {
  NORMAL_DAY_HOURS,
  breakSeconds,
  clock,
  duration,
  isOnBreak,
  shiftDay,
  useAttendance,
  workedSeconds,
} from '../lib/attendance';
import { canSeeAttendanceOf } from '../../shared/attendance.mjs';
import { csvRow, downloadCsv } from '../utils/exportUtils';

type Period = 'today' | 'week' | 'month' | 'custom';

interface PointageViewProps {
  currentUser: User;
  entities: HierarchicalEntity[];
  users: User[];
}

const entityOf = (u: User, entities: HierarchicalEntity[]) => {
  const id = u.serviceId || u.divisionId || u.directionId || u.departementId;
  return entities.find(e => e.id === id)?.name || u.departmentName || '—';
};

export const PointageView: React.FC<PointageViewProps> = ({ currentUser, entities, users }) => {
  const [period, setPeriod] = useState<Period>('today');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [search, setSearch] = useState('');

  // La date du jour vient du serveur (premier chargement) ; en attendant, celle du poste.
  const localToday = new Date().toLocaleDateString('en-CA');
  const [anchor, setAnchor] = useState(localToday);
  const range = useMemo(() => {
    if (period === 'custom' && custom) return custom;
    if (period === 'week') return { from: shiftDay(anchor, -6), to: anchor };
    if (period === 'month') return { from: shiftDay(anchor, -29), to: anchor };
    return { from: anchor, to: anchor };
  }, [period, custom, anchor]);

  const { snapshot, error, offsetMs, refresh } = useAttendance(currentUser, range.from, range.to, entities, users);
  if (snapshot && snapshot.today !== anchor && period !== 'custom') setAnchor(snapshot.today);
  const today = snapshot?.today ?? anchor;
  const nowMs = Date.now() + offsetMs;

  // Personnes du périmètre (pour repérer celles qui n'ont pas pointé aujourd'hui).
  const team = useMemo(
    () => users.filter(u => u.status !== 'suspendu' && canSeeAttendanceOf(currentUser, u, entities)),
    [users, currentUser, entities],
  );
  const byId = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const q = search.trim().toLowerCase();
  const matches = (name: string, id: string) => {
    if (!q) return true;
    const u = byId.get(id);
    return `${name} ${u?.roleTitle || ''} ${u ? entityOf(u, entities) : ''}`.toLowerCase().includes(q);
  };

  const days: AttendanceDay[] = useMemo(
    () => (snapshot?.days || [])
      .filter(d => matches(d.userName, d.userId))
      .sort((a, b) => b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, q],
  );

  const todayDays = (snapshot?.days || []).filter(d => d.date === today);
  const present = todayDays.filter(d => !d.departureAt && !isOnBreak(d)).length;
  const onBreak = todayDays.filter(d => isOnBreak(d)).length;
  const notArrived = range.to === today
    ? team.filter(u => !todayDays.some(d => d.userId === u.id) && matches(u.name, u.id))
    : [];

  // Totaux par agent sur la période.
  const totals = useMemo(() => {
    const map = new Map<string, { name: string; days: number; worked: number; extra: number }>();
    for (const d of days) {
      const w = workedSeconds(d, nowMs, today);
      const t = map.get(d.userId) || { name: d.userName, days: 0, worked: 0, extra: 0 };
      t.days++;
      t.worked += w;
      t.extra += Math.max(0, w - NORMAL_DAY_HOURS * 3600);
      map.set(d.userId, t);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, today]);

  const exportCsv = () => {
    const lines = [csvRow(['Agent', 'Fonction', 'Entité', 'Date', 'Arrivée', 'Départ', 'Départ automatique', 'Pauses (min)', 'Temps effectif (h)', 'Au-delà de 8 h (h)'])];
    for (const d of days) {
      const u = byId.get(d.userId);
      const w = workedSeconds(d, nowMs, today);
      lines.push(csvRow([
        d.userName, u?.roleTitle || '', u ? entityOf(u, entities) : '', d.date, clock(d.arrivalAt),
        d.departureAt ? clock(d.departureAt) : 'En poste', d.departureAuto ? 'oui' : 'non',
        Math.round(breakSeconds(d, nowMs) / 60), (w / 3600).toFixed(2).replace('.', ','),
        (Math.max(0, w - NORMAL_DAY_HOURS * 3600) / 3600).toFixed(2).replace('.', ','),
      ]));
    }
    downloadCsv(lines, `pointage_${range.from}_${range.to}.csv`);
  };

  const card = 'bg-white rounded-2xl border border-sky-200 p-5 shadow-sm';
  const periodBtn = (p: Period, label: string) => (
    <button
      type="button"
      onClick={() => { setPeriod(p); if (p !== 'custom') setCustom(null); else setCustom(c => c || { from: shiftDay(today, -6), to: today }); }}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${period === p ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className={`${card} flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Clock className="w-5 h-5 text-sky-600" /> Pointage de l'équipe</h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Pointage automatique : l'arrivée est enregistrée à la première connexion du jour, le départ à la déconnexion
            (ou, à défaut, à la dernière activité). Les heures viennent de l'horloge du serveur et ne se modifient pas à la main.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {periodBtn('today', "Aujourd'hui")}
          {periodBtn('week', '7 jours')}
          {periodBtn('month', '30 jours')}
          {periodBtn('custom', 'Période…')}
          <button type="button" onClick={() => void refresh()} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Actualiser">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {period === 'custom' && custom && (
        <div className={`${card} flex flex-wrap items-end gap-3 text-xs`}>
          <label className="font-semibold text-slate-600">Du
            <input type="date" value={custom.from} max={custom.to} onChange={e => setCustom({ ...custom, from: e.target.value })} className="block mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800" />
          </label>
          <label className="font-semibold text-slate-600">Au
            <input type="date" value={custom.to} min={custom.from} max={today} onChange={e => setCustom({ ...custom, to: e.target.value })} className="block mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800" />
          </label>
          <span className="text-slate-500">93 jours au plus.</span>
        </div>
      )}

      {error && <div role="alert" className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Personnes suivies', value: team.length, icon: <Users className="w-4 h-4 text-slate-400" />, cls: 'text-slate-900' },
          { label: 'En poste maintenant', value: present, icon: <UserCheck className="w-4 h-4 text-emerald-500" />, cls: 'text-emerald-700' },
          { label: 'En pause', value: onBreak, icon: <Coffee className="w-4 h-4 text-amber-500" />, cls: 'text-amber-700' },
          { label: "Pas encore pointé aujourd'hui", value: team.filter(u => !todayDays.some(d => d.userId === u.id)).length, icon: <UserX className="w-4 h-4 text-rose-400" />, cls: 'text-rose-700' },
        ].map(k => (
          <div key={k.label} className={card}>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">{k.label}{k.icon}</div>
            <div className={`text-2xl font-black font-mono mt-1 ${k.cls}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className={`${card} space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900">
            Registre {range.from === range.to ? `du ${new Date(`${range.from}T12:00:00`).toLocaleDateString('fr-FR')}` : `du ${new Date(`${range.from}T12:00:00`).toLocaleDateString('fr-FR')} au ${new Date(`${range.to}T12:00:00`).toLocaleDateString('fr-FR')}`}
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un agent, un poste, une entité…"
              aria-label="Rechercher"
              className="w-64 max-w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
            />
            <button type="button" onClick={exportCsv} disabled={!days.length} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        {!snapshot && !error ? (
          <p className="text-xs text-slate-500">Chargement des pointages…</p>
        ) : days.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun pointage sur cette période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 pr-3">Agent</th>
                  <th className="py-2.5 pr-3">Date</th>
                  <th className="py-2.5 pr-3">Arrivée</th>
                  <th className="py-2.5 pr-3">Départ</th>
                  <th className="py-2.5 pr-3">Pauses</th>
                  <th className="py-2.5 pr-3">Temps effectif</th>
                  <th className="py-2.5">Au-delà de {NORMAL_DAY_HOURS} h</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {days.map(d => {
                  const u = byId.get(d.userId);
                  const w = workedSeconds(d, nowMs, today);
                  const extra = Math.max(0, w - NORMAL_DAY_HOURS * 3600);
                  return (
                    <tr key={d.id}>
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-slate-900">{d.userName}</div>
                        <div className="text-[10.5px] text-slate-500">{u ? `${u.roleTitle} — ${entityOf(u, entities)}` : ''}</div>
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{new Date(`${d.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</td>
                      <td className="py-2.5 pr-3 font-mono text-emerald-700 font-bold">{clock(d.arrivalAt)}</td>
                      <td className="py-2.5 pr-3 font-mono">
                        {d.departureAt ? (
                          <span>
                            {clock(d.departureAt)}
                            {d.departureAuto && <span className="ml-1.5 text-[9.5px] font-sans font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600" title="Pas de déconnexion : départ à la dernière activité">auto</span>}
                          </span>
                        ) : isOnBreak(d) ? (
                          <span className="text-amber-700 font-sans font-semibold">En pause</span>
                        ) : (
                          <span className="text-sky-700 font-sans font-semibold">En poste</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{d.breaks.length ? duration(breakSeconds(d, nowMs)) : '—'}</td>
                      <td className="py-2.5 pr-3 font-mono font-bold">{duration(w)}</td>
                      <td className={`py-2.5 font-mono ${extra ? 'text-indigo-700 font-bold' : 'text-slate-400'}`}>{extra ? duration(extra) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {notArrived.length > 0 && (
        <div className={`${card} space-y-2`}>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><UserX className="w-4 h-4 text-rose-500" /> Pas encore pointé aujourd'hui ({notArrived.length})</h3>
          <p className="text-[11px] text-slate-500">Personnes de votre périmètre qui ne se sont pas encore connectées aujourd'hui (absence, congé, mission ou travail hors application).</p>
          <ul className="flex flex-wrap gap-2">
            {notArrived.map(u => (
              <li key={u.id} className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700">
                <span className="font-semibold">{u.name}</span> <span className="text-slate-500">· {u.roleTitle}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {period !== 'today' && totals.length > 0 && (
        <div className={`${card} space-y-3`}>
          <h3 className="text-sm font-bold text-slate-900">Totaux de la période</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-2 pr-3">Agent</th><th className="py-2 pr-3">Jours pointés</th><th className="py-2 pr-3">Temps effectif</th><th className="py-2">Au-delà de {NORMAL_DAY_HOURS} h / jour</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {totals.map(([id, t]) => (
                  <tr key={id}>
                    <td className="py-2 pr-3 font-semibold text-slate-900">{t.name}</td>
                    <td className="py-2 pr-3 font-mono">{t.days}</td>
                    <td className="py-2 pr-3 font-mono font-bold">{duration(t.worked)}</td>
                    <td className="py-2 font-mono">{t.extra ? duration(t.extra) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
        <Info className="w-3.5 h-3.5 shrink-0 mt-px text-sky-500" />
        Vous voyez vos propres pointages et ceux des agents que vous gérez ; un agent ne voit jamais ceux de ses collègues.
        « auto » : l'agent ne s'est pas déconnecté, son départ est fixé à sa dernière activité dans l'application.
      </p>
    </div>
  );
};
