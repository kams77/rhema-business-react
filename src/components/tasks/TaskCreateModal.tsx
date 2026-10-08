// src/components/tasks/TaskCreateModal.tsx — création d'une tâche (champs élargis, affectation par rôle).
import React, { useMemo, useState } from 'react';
import { AlertTriangle, GitBranch, ListChecks, Plus, Search, Trash2, X } from 'lucide-react';
import type { DocumentItem, HierarchicalEntity, TaskIntervenant, TaskItem, User } from '../../types';
import {
  PRIORITY_LABELS, TASK_TYPE_LABELS, buildTaskApprovalChain, createTask, intervenant, anchorEntity,
} from '../../lib/workflow';
import { canUserViewDocument, getEntitiesInUserScope, getRoleRank, isUserVisibleToUser } from '../../utils/rbac';
import { ApprovalTimeline } from '../workflow/ApprovalTimeline';

type RoleType = TaskIntervenant['roleType'];

const STEP_TEMPLATES: Partial<Record<TaskItem['type'], string[]>> = {
  approbation: ['Rassembler les pièces justificatives', 'Vérifier la conformité budgétaire', 'Préparer la note de synthèse'],
  production: ['Préparer le matériel en atelier', 'Contrôles et tests', 'Procès-verbal de recette usine'],
  deploiement: ['Préparer le kit et vérifier les numéros de série', "Installer et aligner l'équipement sur site", 'Mesures et tests de service', 'Faire signer le PV de réception par le client'],
  maintenance: ['Diagnostic', 'Intervention / remplacement', 'Tests de bon fonctionnement', "Rapport d'intervention"],
  logistique: ['Préparer la commande / le colisage', 'Contrôler les numéros de série', 'Expédier ou réceptionner', 'Mettre à jour le stock'],
  audit: ["Collecter les éléments", 'Analyser les écarts', 'Rédiger le rapport', 'Restituer les conclusions'],
  administratif: ['Rédiger le document', 'Faire relire', 'Transmettre au circuit'],
  formation: ['Préparer le support', 'Animer la session', "Évaluer les participants"],
  suivi_client: ['Pointer le compte client', 'Relancer le client', 'Enregistrer la réponse'],
};

interface TaskCreateModalProps {
  currentUser: User;
  entities: HierarchicalEntity[];
  users: User[];
  documents: DocumentItem[];
  tasks: TaskItem[];
  organizationId: string;
  onCreate: (task: TaskItem) => void;
  onClose: () => void;
}

const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500';
const today = () => new Date().toISOString().split('T')[0];
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().split('T')[0];

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({ currentUser, entities, users, documents, tasks, organizationId, onCreate, onClose }) => {
  const isAgent = currentUser.role === 'agent';
  const scope = useMemo(() => getEntitiesInUserScope(currentUser, entities), [currentUser, entities]);
  const myEntity = anchorEntity(currentUser, entities);

  const [type, setType] = useState<TaskItem['type']>(isAgent ? 'administratif' : 'deploiement');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [entityId, setEntityId] = useState(isAgent ? (myEntity?.id || '') : (myEntity?.id || scope[0]?.id || ''));
  const [priority, setPriority] = useState<TaskItem['priority']>('normale');
  const [startDate, setStartDate] = useState(today());
  const [dueDate, setDueDate] = useState(inDays(7));
  const [estimatedHours, setEstimatedHours] = useState('');
  const [site, setSite] = useState('');
  const [deliverable, setDeliverable] = useState('');
  const [criteria, setCriteria] = useState('');
  const [tags, setTags] = useState('');
  const [signatureRequired, setSignatureRequired] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState<string[]>([]);
  const [steps, setSteps] = useState<{ label: string; assignee: string; dueDate: string }[]>(
    (STEP_TEMPLATES[isAgent ? 'administratif' : 'deploiement'] || []).map(label => ({ label, assignee: '', dueDate: '' })),
  );
  const [people, setPeople] = useState<{ userId: string; role: RoleType }[]>(isAgent ? [{ userId: currentUser.id, role: 'executant' }] : []);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const candidates = useMemo(() => users.filter(u =>
    u.status === 'actif' &&
    isUserVisibleToUser(currentUser, u, entities) &&
    (!search.trim() || `${u.name} ${u.roleTitle}`.toLowerCase().includes(search.trim().toLowerCase())),
  ), [users, currentUser, entities, search]);

  const visibleDocs = useMemo(() => documents.filter(d => d.status !== 'brouillon' && canUserViewDocument(currentUser, d, entities).allowed).slice(0, 60), [documents, currentUser, entities]);
  const doers = people.filter(p => p.role !== 'validateur').map(p => users.find(u => u.id === p.userId)).filter(Boolean) as User[];

  /** On ne confie pas l'exécution à un supérieur : il ne peut être que valideur. */
  const isSuperior = (u: User) => currentUser.role !== 'dg' && getRoleRank(u.role) > getRoleRank(currentUser.role);

  const togglePerson = (u: User) => {
    if (isAgent) return;
    setPeople(prev => prev.some(p => p.userId === u.id)
      ? prev.filter(p => p.userId !== u.id)
      : [...prev, { userId: u.id, role: isSuperior(u) ? 'validateur' : prev.some(p => p.role === 'executant') ? 'contributeur' : 'executant' }]);
  };

  const changeType = (t: TaskItem['type']) => {
    setType(t);
    const tpl = STEP_TEMPLATES[t];
    if (tpl && steps.every(s => !s.label.trim() || Object.values(STEP_TEMPLATES).some(list => list?.includes(s.label)))) {
      setSteps(tpl.map(label => ({ label, assignee: '', dueDate: '' })));
    }
  };

  const draftIntervenants = (): TaskIntervenant[] => people
    .map(p => { const u = users.find(x => x.id === p.userId); return u ? intervenant(u, p.role, entities) : undefined; })
    .filter(Boolean) as TaskIntervenant[];

  const previewApproval = useMemo(() => buildTaskApprovalChain({
    id: 'apercu', title, type, description, organizationId, creatorId: currentUser.id, creatorName: currentUser.name, creatorRole: currentUser.role,
    assignedEntityId: entityId, assignedEntityName: '', assignedIntervenants: draftIntervenants(), priority, status: 'a_faire',
    dueDate, createdAt: today(), steps: [], signatureRequired,
  } as TaskItem, entities, users), // eslint-disable-next-line react-hooks/exhaustive-deps
  [people, entityId, signatureRequired, entities, users]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError("L'intitulé de la tâche est requis.");
    if (!entityId) return setError("Choisissez l'entité qui exécute la tâche.");
    if (!people.some(p => p.role === 'executant')) return setError('Désignez au moins un exécutant.');
    if (dueDate < startDate) return setError("L'échéance doit être postérieure à la date de début.");
    const cleanSteps = steps.filter(s => s.label.trim());
    if (cleanSteps.length === 0) return setError('Ajoutez au moins une étape à réaliser.');
    const hours = estimatedHours.trim() ? Number(estimatedHours.replace(',', '.')) : undefined;
    if (hours !== undefined && !(hours > 0)) return setError('La charge estimée doit être un nombre d\'heures positif.');
    const entity = entities.find(x => x.id === entityId);
    const task = createTask({
      title,
      type,
      description,
      creator: currentUser,
      organizationId,
      entity,
      intervenants: draftIntervenants(),
      steps: cleanSteps.map(s => ({ label: s.label, assignedTo: users.find(u => u.id === s.assignee), dueDate: s.dueDate || undefined })),
      priority,
      startDate,
      dueDate,
      estimatedHours: hours,
      site: site.trim() || undefined,
      deliverable: deliverable.trim() || undefined,
      acceptanceCriteria: criteria.trim() || undefined,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      linkedDocumentIds: linkedDocs,
      signatureRequired,
      existingTasks: tasks,
    });
    onCreate(task);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <form onSubmit={submit} className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 sm:p-6 max-w-5xl w-full shadow-2xl space-y-5 my-6 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <GitBranch className="w-4 h-4 text-indigo-400" />
            <span>{isAgent ? 'Nouvelle tâche personnelle' : 'Créer et assigner une tâche'}</span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Fermer"><X className="w-4 h-4" /></button>
        </div>

        {isAgent && (
          <p className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px]">
            En tant qu'agent, vous créez une tâche pour vous-même ; elle sera validée par votre responsable hiérarchique.
          </p>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* --- Colonne 1 : identification & planification --- */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">1. Identification</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block text-slate-300 font-medium sm:col-span-1">Type
                <select value={type} onChange={e => changeType(e.target.value as TaskItem['type'])} className={`${inputCls} mt-1`}>
                  {(Object.keys(TASK_TYPE_LABELS) as TaskItem['type'][]).map(t => <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>)}
                </select>
              </label>
              <label className="block text-slate-300 font-medium sm:col-span-2">Intitulé *
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ex. Installer la station VSAT de Kolwezi" className={`${inputCls} mt-1`} />
              </label>
            </div>
            <label className="block text-slate-300 font-medium">Description et consignes
              <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Contexte, consignes de sécurité, contacts sur place…" className={`${inputCls} mt-1`} />
            </label>

            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-1">2. Planification</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="block text-slate-300 font-medium">Priorité
                <select value={priority} onChange={e => setPriority(e.target.value as TaskItem['priority'])} className={`${inputCls} mt-1`}>
                  {(Object.keys(PRIORITY_LABELS) as TaskItem['priority'][]).map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                </select>
              </label>
              <label className="block text-slate-300 font-medium">Début
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${inputCls} mt-1`} />
              </label>
              <label className="block text-slate-300 font-medium">Échéance *
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={`${inputCls} mt-1`} />
              </label>
              <label className="block text-slate-300 font-medium">Charge (h)
                <input inputMode="decimal" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} placeholder="ex. 16" className={`${inputCls} mt-1 font-mono`} />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-slate-300 font-medium">Entité exécutante *
                <select value={entityId} onChange={e => setEntityId(e.target.value)} disabled={isAgent} className={`${inputCls} mt-1 disabled:opacity-70`}>
                  <option value="">— Choisir —</option>
                  {(isAgent && myEntity ? [myEntity] : scope).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <label className="block text-slate-300 font-medium">Lieu / site
                <input value={site} onChange={e => setSite(e.target.value)} placeholder="ex. Site minier Tenke, Hub N'sele…" className={`${inputCls} mt-1`} />
              </label>
            </div>

            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-1">3. Résultat attendu</h4>
            <label className="block text-slate-300 font-medium">Livrable attendu
              <input value={deliverable} onChange={e => setDeliverable(e.target.value)} placeholder="ex. Station opérationnelle + PV de réception signé" className={`${inputCls} mt-1`} />
            </label>
            <label className="block text-slate-300 font-medium">Critères de validation
              <textarea rows={2} value={criteria} onChange={e => setCriteria(e.target.value)} placeholder="ex. C/N ≥ 13,5 dB ; photos de l'installation ; numéros de série relevés" className={`${inputCls} mt-1`} />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-slate-300 font-medium">Étiquettes (séparées par des virgules)
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="VSAT, Kolwezi, urgent" className={`${inputCls} mt-1`} />
              </label>
              <label className="flex items-center gap-2 text-slate-300 font-medium mt-5 select-none cursor-pointer">
                <input type="checkbox" checked={signatureRequired} onChange={e => setSignatureRequired(e.target.checked)} className="rounded border-slate-700 bg-slate-900" />
                Validation finale avec signature électronique
              </label>
            </div>
          </section>

          {/* --- Colonne 2 : intervenants, étapes, documents --- */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">4. Intervenants</h4>
            {!isAgent && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un collaborateur de votre périmètre…" className={`${inputCls} pl-8`} />
              </div>
            )}
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {(isAgent ? users.filter(u => u.id === currentUser.id) : candidates).map(u => {
                const sel = people.find(p => p.userId === u.id);
                return (
                  <div key={u.id} className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${sel ? 'bg-indigo-950/30 border-indigo-500/40' : 'bg-slate-950/40 border-slate-800'}`}>
                    <button type="button" onClick={() => togglePerson(u)} className="flex items-center gap-2 min-w-0 text-left flex-1">
                      <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] shrink-0 ${sel ? 'bg-indigo-600 text-white' : 'border border-slate-600'}`}>{sel ? '✓' : ''}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-200 truncate">{u.name}</span>
                        <span className="block text-[10px] text-slate-500 truncate">{u.roleTitle}</span>
                      </span>
                    </button>
                    {sel && !isAgent && (
                      <select
                        value={sel.role}
                        onChange={e => setPeople(prev => prev.map(p => (p.userId === u.id ? { ...p, role: e.target.value as RoleType } : p)))}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] text-white"
                      >
                        {!isSuperior(u) && <option value="executant">Exécutant</option>}
                        {!isSuperior(u) && <option value="contributeur">Contributeur</option>}
                        {!isSuperior(u) && <option value="responsable">Responsable</option>}
                        <option value="validateur">Validateur</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <ApprovalTimeline steps={previewApproval} title="Validation de la tâche (dans l'ordre)" />
              <p className="text-[10px] text-slate-500 mt-2">
                Les valideurs interviennent dans l'ordre où vous les avez sélectionnés ; sans valideur, c'est le responsable hiérarchique de l'entité.
              </p>
            </div>

            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-1 flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5" /> 5. Étapes à réaliser</h4>
            <div className="space-y-1.5">
              {steps.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                  <input value={s.label} onChange={e => setSteps(prev => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder={`Étape ${i + 1}`} className={`${inputCls} col-span-6`} />
                  <select value={s.assignee} onChange={e => setSteps(prev => prev.map((x, j) => (j === i ? { ...x, assignee: e.target.value } : x)))} className={`${inputCls} col-span-3 px-1.5`} title="Attribuée à">
                    <option value="">Tous</option>
                    {doers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <input type="date" value={s.dueDate} onChange={e => setSteps(prev => prev.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} className={`${inputCls} col-span-2 px-1`} title="Échéance de l'étape" />
                  <button type="button" onClick={() => setSteps(prev => prev.filter((_, j) => j !== i))} className="col-span-1 p-1.5 text-slate-500 hover:text-rose-300" aria-label="Retirer l'étape"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setSteps(prev => [...prev, { label: '', assignee: '', dueDate: '' }])} className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Ajouter une étape
              </button>
            </div>

            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-1">6. Documents liés</h4>
            <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
              {visibleDocs.length === 0 && <p className="text-[11px] text-slate-500 italic">Aucun document disponible.</p>}
              {visibleDocs.map(d => (
                <label key={d.id} className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={linkedDocs.includes(d.id)} onChange={e => setLinkedDocs(prev => (e.target.checked ? [...prev, d.id] : prev.filter(x => x !== d.id)))} className="rounded border-slate-700 bg-slate-900" />
                  <span className="truncate">{d.referenceNumber} — {d.title}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-400 hover:text-white">Annuler</button>
          <button type="submit" className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg">
            {isAgent ? 'Créer ma tâche' : 'Créer et assigner'}
          </button>
        </div>
      </form>
    </div>
  );
};
