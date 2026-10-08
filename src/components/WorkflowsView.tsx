// src/components/WorkflowsView.tsx — Tâches & Approbations : vraies tâches, validation en chaîne par rôle.
import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, GitBranch, Kanban, List, Plus, Search, Stamp, UserCheck } from 'lucide-react';
import type { DocumentItem, HierarchicalEntity, Organization, TaskItem, User } from '../types';
import { RhemaOfficialDocument } from './RhemaOfficialDocument';
import { TaskCard, STATUS_CLS, PRIORITY_CLS } from './tasks/TaskCard';
import { TaskCreateModal } from './tasks/TaskCreateModal';
import {
  PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_TYPE_LABELS,
  canSeeTask, canValidateTaskNow, isTaskLate, taskProgress, taskRoleOf,
} from '../lib/workflow';
import type { TaskAction } from '../lib/workflow';

type Filter = 'mine' | 'to_validate' | 'created' | 'all' | 'late' | 'done';

interface WorkflowsViewProps {
  tasks: TaskItem[];
  currentUser: User;
  entities: HierarchicalEntity[];
  users: User[];
  documents: DocumentItem[];
  organization: Organization;
  onCreateTask: (task: TaskItem) => void;
  onTaskAction: (taskId: string, action: TaskAction) => void;
}

const OPEN: TaskItem['status'][] = ['a_faire', 'en_cours', 'en_attente_approbation', 'bloquee'];
const PRIORITY_ORDER: Record<TaskItem['priority'], number> = { critique: 0, haute: 1, normale: 2, basse: 3 };

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({
  tasks, currentUser, entities, users, documents, organization, onCreateTask, onTaskAction,
}) => {
  const isAgent = currentUser.role === 'agent';
  const [filter, setFilter] = useState<Filter>('mine');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [typeFilter, setTypeFilter] = useState<'all' | TaskItem['type']>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskItem['priority']>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [openDoc, setOpenDoc] = useState<DocumentItem | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Qui voit quoi : un agent ne voit que ses tâches ; un responsable voit celles de son périmètre.
  const visible = useMemo(() => tasks.filter(t => canSeeTask(currentUser, t, entities)), [tasks, currentUser, entities]);
  const mine = visible.filter(t => !!taskRoleOf(currentUser, t));
  const toValidate = visible.filter(t => canValidateTaskNow(currentUser, t));
  const counts: Record<Filter, number> = {
    mine: mine.filter(t => OPEN.includes(t.status)).length,
    to_validate: toValidate.length,
    created: visible.filter(t => t.creatorId === currentUser.id).length,
    all: visible.length,
    late: visible.filter(t => isTaskLate(t)).length,
    done: visible.filter(t => t.status === 'validee_terminee' || t.status === 'termine').length,
  };

  const q = search.trim().toLowerCase();
  const filtered = visible
    .filter(t => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (q && ![t.title, t.description, t.reference || '', t.assignedEntityName, t.site || '', t.creatorName, ...t.assignedIntervenants.map(i => i.userName), ...(t.tags || [])]
        .some(v => v.toLowerCase().includes(q))) return false;
      switch (filter) {
        case 'mine': return !!taskRoleOf(currentUser, t) && OPEN.includes(t.status);
        case 'to_validate': return canValidateTaskNow(currentUser, t);
        case 'created': return t.creatorId === currentUser.id;
        case 'late': return isTaskLate(t);
        case 'done': return t.status === 'validee_terminee' || t.status === 'termine';
        default: return true;
      }
    })
    .sort((a, b) => Number(canValidateTaskNow(currentUser, b)) - Number(canValidateTaskNow(currentUser, a))
      || Number(isTaskLate(b)) - Number(isTaskLate(a))
      || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      || (a.dueDate || '').localeCompare(b.dueDate || ''));

  const filters: { id: Filter; label: string; accent: string; icon?: React.ReactNode; hidden?: boolean }[] = [
    { id: 'mine', label: 'Mes tâches en cours', accent: 'bg-indigo-600', icon: <UserCheck className="w-3.5 h-3.5" /> },
    { id: 'to_validate', label: 'À valider par moi', accent: 'bg-rose-600', icon: <Stamp className="w-3.5 h-3.5" />, hidden: isAgent && counts.to_validate === 0 },
    { id: 'created', label: 'Créées par moi', accent: 'bg-indigo-600' },
    { id: 'all', label: isAgent ? 'Toutes mes tâches' : 'Tout mon périmètre', accent: 'bg-indigo-600' },
    { id: 'late', label: 'En retard', accent: 'bg-rose-600', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { id: 'done', label: 'Terminées', accent: 'bg-emerald-600', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ];

  const kanbanCols: { id: TaskItem['status'][]; label: string }[] = [
    { id: ['a_faire'], label: 'À faire' },
    { id: ['en_cours'], label: 'En cours' },
    { id: ['bloquee'], label: 'Bloquées' },
    { id: ['en_attente_approbation'], label: 'En validation' },
    { id: ['validee_terminee', 'termine'], label: 'Validées' },
  ];

  const focused = focusId ? visible.find(t => t.id === focusId) : undefined;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* BANNIÈRE */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase tracking-wider border border-indigo-500/30 flex items-center gap-1.5">
              <Stamp className="w-3.5 h-3.5 text-indigo-400" /> Exécution & validation en chaîne
            </span>
            {counts.to_validate > 0 && (
              <button onClick={() => setFilter('to_validate')} className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {counts.to_validate} tâche(s) à valider
              </button>
            )}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Tâches & Approbations</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {isAgent
              ? "Vos tâches assignées : émargez vos étapes, saisissez votre temps, signalez un blocage, puis soumettez à validation."
              : "Assignez des tâches dans votre périmètre, suivez leur avancement et validez-les à votre tour dans le circuit des valideurs."}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button onClick={() => setView('list')} className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              <List className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Liste</span>
            </button>
            <button onClick={() => setView('kanban')} className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${view === 'kanban' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              <Kanban className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Tableau</span>
            </button>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 active:scale-95">
            <Plus className="w-4 h-4" /> {isAgent ? 'Nouvelle tâche personnelle' : 'Créer une tâche'}
          </button>
        </div>
      </div>

      {/* INDICATEURS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Mes tâches ouvertes', value: counts.mine, cls: 'text-indigo-400' },
          { label: 'À valider par moi', value: counts.to_validate, cls: 'text-amber-400' },
          { label: 'En retard', value: counts.late, cls: 'text-rose-400' },
          { label: 'Terminées', value: counts.done, cls: 'text-emerald-400' },
        ].map(k => (
          <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] text-slate-400">{k.label}</div>
            <div className={`text-2xl font-black font-mono ${k.cls}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* FILTRES */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {filters.filter(f => !f.hidden).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${
                filter === f.id ? `${f.accent} text-white shadow-md` : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {f.icon}<span>{f.label} ({counts[f.id]})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Référence, titre, site, intervenant, étiquette…" className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
            <option value="all">Tous les types</option>
            {(Object.keys(TASK_TYPE_LABELS) as TaskItem['type'][]).map(t => <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as typeof priorityFilter)} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
            <option value="all">Toutes priorités</option>
            {(Object.keys(PRIORITY_LABELS) as TaskItem['priority'][]).map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </div>
      </div>

      {/* LISTE */}
      {view === 'list' && (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 space-y-2">
              <GitBranch className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-bold text-sm text-slate-300">Aucune tâche dans cette vue</p>
              <p className="text-xs text-slate-500">{filter === 'to_validate' ? "Rien n'attend votre validation." : 'Changez de filtre ou créez une tâche.'}</p>
            </div>
          ) : filtered.map(t => (
            <TaskCard key={t.id} task={t} currentUser={currentUser} entities={entities} documents={documents} organization={organization} onAction={onTaskAction} onOpenDocument={setOpenDoc} />
          ))}
        </div>
      )}

      {/* TABLEAU (lecture : les changements d'état passent par les actions de la tâche) */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 items-start">
          {kanbanCols.map(col => {
            const items = filtered.filter(t => col.id.includes(t.status));
            return (
              <div key={col.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3 space-y-2 min-h-[200px]">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300">{col.label}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">{items.length}</span>
                </div>
                {items.map(t => (
                  <button key={t.id} onClick={() => setFocusId(t.id)} className={`w-full text-left bg-slate-900 border rounded-xl p-3 space-y-1.5 hover:border-slate-600 ${canValidateTaskNow(currentUser, t) ? 'border-amber-500/50' : 'border-slate-800'}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_CLS[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</span>
                      <span className={`text-[10px] font-mono ${isTaskLate(t) ? 'text-rose-400' : 'text-slate-400'}`}>{t.dueDate}</span>
                    </div>
                    <div className="text-xs font-bold text-white leading-snug line-clamp-2">{t.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{t.assignedIntervenants.filter(i => i.roleType === 'executant').map(i => i.userName).join(', ') || '—'}</div>
                    <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${taskProgress(t)}%` }} /></div>
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border ${STATUS_CLS[t.status]}`}>{TASK_STATUS_LABELS[t.status]}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {focused && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto" onClick={() => setFocusId(null)}>
          <div className="max-w-3xl w-full my-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setFocusId(null)} className="px-3 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Fermer</button>
            </div>
            <TaskCard task={focused} currentUser={currentUser} entities={entities} documents={documents} organization={organization} onAction={onTaskAction} onOpenDocument={setOpenDoc} />
          </div>
        </div>
      )}

      {showCreate && (
        <TaskCreateModal
          currentUser={currentUser}
          entities={entities}
          users={users}
          documents={documents}
          tasks={tasks}
          organizationId={organization.id}
          onCreate={onCreateTask}
          onClose={() => setShowCreate(false)}
        />
      )}

      {openDoc && (
        <RhemaOfficialDocument document={openDoc} organization={organization} currentUser={currentUser} entities={entities} onClose={() => setOpenDoc(null)} />
      )}
    </div>
  );
};
