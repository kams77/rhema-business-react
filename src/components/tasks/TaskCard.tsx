// src/components/tasks/TaskCard.tsx — carte de tâche : exécution, validation en chaîne, échanges.
import React, { useState } from 'react';
import {
  AlertTriangle, Ban, Calendar, CheckCircle2, ChevronDown, ChevronUp, Clock, Download, FileText,
  MapPin, MessageSquare, Paperclip, Play, Send, Target, Timer, Truck, UserCheck, X,
} from 'lucide-react';
import type { DocumentItem, HierarchicalEntity, Organization, TaskItem, User } from '../../types';
import {
  PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_TYPE_LABELS,
  canEditTask, canExecuteTask, canTickTaskStep, canValidateTaskNow, currentStep, isTaskLate, taskProgress, taskRoleOf, waitingFor,
} from '../../lib/workflow';
import type { TaskAction } from '../../lib/workflow';
import { ApprovalChips, HistoryList, formatDateTime } from '../workflow/ApprovalTimeline';
import { exportApprovalSlipToPDF } from '../../utils/exportUtils';

const ROLE_BADGE: Record<string, string> = {
  responsable: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  executant: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  contributeur: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  validateur: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};
const ROLE_LABEL: Record<string, string> = { responsable: 'Responsable', executant: 'Exécutant', contributeur: 'Contributeur', validateur: 'Validateur' };

export const STATUS_CLS: Record<TaskItem['status'], string> = {
  a_faire: 'bg-slate-800 text-slate-300 border-slate-700',
  en_cours: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  en_attente_approbation: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  validee_terminee: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  termine: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  bloquee: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  annulee: 'bg-slate-800 text-slate-500 border-slate-700',
};

export const PRIORITY_CLS: Record<TaskItem['priority'], string> = {
  basse: 'bg-slate-800 text-slate-400 border-slate-700',
  normale: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  haute: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  critique: 'bg-red-500/20 text-red-400 border-red-500/30',
};

/** Données du bordereau PDF à partir d'une tâche. */
export function approvalSlipData(t: TaskItem) {
  return {
    id: t.reference || t.id,
    title: t.title,
    description: t.description,
    category: TASK_TYPE_LABELS[t.type] || t.type,
    priority: PRIORITY_LABELS[t.priority],
    dueDate: t.dueDate,
    initiator: t.creatorName,
    assignedEntity: t.assignedEntityName,
    steps: t.steps.map(s => ({ id: s.id, label: s.label, completed: s.completed, validatedBy: s.completedBy })),
    intervenants: t.assignedIntervenants.map(i => ({ name: i.userName, roleTitle: i.userRoleTitle, roleBadge: ROLE_LABEL[i.roleType] || i.roleType })),
    electronicSignature: t.signature ? { signedBy: t.signature.signedBy, signedAt: formatDateTime(t.signature.timestamp), hash: t.signature.hash } : null,
  };
}

interface TaskCardProps {
  task: TaskItem;
  currentUser: User;
  entities: HierarchicalEntity[];
  documents?: DocumentItem[];
  organization: Organization;
  onAction: (taskId: string, action: TaskAction) => void;
  onOpenDocument?: (doc: DocumentItem) => void;
  /** Affichage resserré (espace agent). */
  dense?: boolean;
}

type Mode = null | 'hours' | 'block' | 'validate' | 'reject' | 'submit' | 'cancel';

export const TaskCard: React.FC<TaskCardProps> = ({ task: t, currentUser, entities, documents = [], organization, onAction, onOpenDocument, dense }) => {
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState('');
  const [hours, setHours] = useState('1');
  const [showMore, setShowMore] = useState(false);
  const [comment, setComment] = useState('');

  const progress = taskProgress(t);
  const late = isTaskLate(t);
  const myRole = taskRoleOf(currentUser, t);
  const executor = canExecuteTask(currentUser, t);
  const editor = canEditTask(currentUser, t, entities);
  const validateNow = canValidateTaskNow(currentUser, t);
  const closed = ['validee_terminee', 'termine', 'annulee'].includes(t.status);
  const canWork = (executor || editor) && !closed && t.status !== 'en_attente_approbation';
  const allDone = t.steps.every(s => s.completed);
  const linked = (t.linkedDocumentIds || []).map(id => documents.find(d => d.id === id)).filter(Boolean) as DocumentItem[];
  const approvalStep = currentStep(t.approval);
  const canComment = !!myRole || editor || validateNow || t.creatorId === currentUser.id;

  const run = (action: TaskAction) => {
    onAction(t.id, action);
    setMode(null);
    setText('');
  };

  return (
    <article className={`bg-slate-900/90 border rounded-2xl shadow-xl transition ${dense ? 'p-4 space-y-3' : 'p-5 space-y-4'} ${
      validateNow ? 'border-amber-500/50 ring-1 ring-amber-500/20' : late ? 'border-rose-500/40' : 'border-slate-800 hover:border-slate-700'
    }`}>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {t.reference && <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-950/40 border border-sky-500/30 px-1.5 py-0.5 rounded">{t.reference}</span>}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-indigo-500/20 text-indigo-300 border-indigo-500/30">{TASK_TYPE_LABELS[t.type] || t.type}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${PRIORITY_CLS[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</span>
          {t.source?.module === 'logistique' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/30 flex items-center gap-1"><Truck className="w-3 h-3" /> Logistique</span>
          )}
          {late && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-rose-500/20 text-rose-300 border-rose-500/30">En retard</span>}
        </div>
        <span className={`self-start text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${STATUS_CLS[t.status]}`}>
          {TASK_STATUS_LABELS[t.status]}
        </span>
      </div>

      <div>
        <h3 className={`${dense ? 'text-sm' : 'text-base'} font-bold text-white leading-snug`}>{t.title}</h3>
        {t.description && <p className="text-xs text-slate-400 mt-1 leading-relaxed whitespace-pre-line">{t.description}</p>}
      </div>

      {/* Planification */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
          <div className="text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Échéance</div>
          <div className={`font-mono font-semibold ${late ? 'text-rose-400' : 'text-slate-200'}`}>{t.dueDate || '—'}</div>
          {t.startDate && <div className="text-[10px] text-slate-500">Début {t.startDate}</div>}
        </div>
        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
          <div className="text-slate-500 flex items-center gap-1"><Timer className="w-3 h-3" /> Charge</div>
          <div className="font-mono font-semibold text-slate-200">{(t.spentHours || 0).toLocaleString('fr-FR')} h{t.estimatedHours ? ` / ${t.estimatedHours} h` : ''}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 min-w-0">
          <div className="text-slate-500">Entité</div>
          <div className="text-slate-200 truncate" title={t.assignedEntityName}>{t.assignedEntityName || '—'}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 min-w-0">
          <div className="text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Lieu</div>
          <div className="text-slate-200 truncate" title={t.site}>{t.site || '—'}</div>
        </div>
      </div>

      {(t.deliverable || t.acceptanceCriteria) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          {t.deliverable && (
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="text-slate-500 font-bold uppercase text-[10px] flex items-center gap-1"><Target className="w-3 h-3" /> Livrable attendu</div>
              <p className="text-slate-300 mt-0.5">{t.deliverable}</p>
            </div>
          )}
          {t.acceptanceCriteria && (
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="text-slate-500 font-bold uppercase text-[10px] flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Critères de validation</div>
              <p className="text-slate-300 mt-0.5 whitespace-pre-line">{t.acceptanceCriteria}</p>
            </div>
          )}
        </div>
      )}

      {/* Intervenants */}
      <div className="flex flex-wrap gap-1.5">
        {t.assignedIntervenants.map(i => (
          <span key={`${i.userId}-${i.roleType}`} className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border ${i.userId === currentUser.id ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="font-semibold text-slate-200">{i.userName}{i.userId === currentUser.id ? ' (vous)' : ''}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${ROLE_BADGE[i.roleType]}`}>{ROLE_LABEL[i.roleType]}</span>
          </span>
        ))}
      </div>

      {/* Étapes */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>Étapes ({t.steps.filter(s => s.completed).length}/{t.steps.length})</span>
          <span className="font-mono text-indigo-400">{progress}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full transition-all ${t.status === 'validee_terminee' ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }} />
        </div>
        <ul className="space-y-1">
          {t.steps.map(s => {
            const can = canTickTaskStep(currentUser, t, s);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!can}
                  onClick={() => onAction(t.id, { type: 'toggle_step', stepId: s.id })}
                  className={`w-full p-2 rounded-lg border flex items-center justify-between gap-2 text-xs text-left transition ${
                    s.completed ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-950/40 border-slate-800'
                  } ${can ? 'hover:border-slate-600 cursor-pointer' : 'cursor-default opacity-90'}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0 ${s.completed ? 'bg-emerald-600 text-white' : 'border border-slate-600'}`}>{s.completed ? '✓' : ''}</span>
                    <span className={`truncate ${s.completed ? 'line-through text-slate-400' : 'text-slate-200 font-medium'}`}>{s.label}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0 text-right">
                    {s.completed ? `${s.completedBy || 'fait'}` : s.assignedToUserName ? `→ ${s.assignedToUserId === currentUser.id ? 'vous' : s.assignedToUserName}` : ''}
                    {s.dueDate && !s.completed ? ` · ${s.dueDate}` : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {t.status === 'bloquee' && t.blockedReason && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-1.5">
          <Ban className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span><strong>Bloquée :</strong> {t.blockedReason}</span>
        </div>
      )}
      {t.lastRejection && t.status === 'en_cours' && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
          <strong>À corriger</strong> — renvoyée par {t.lastRejection.by} : « {t.lastRejection.reason} »
        </div>
      )}

      {/* Validation */}
      {t.approval && t.approval.steps.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><UserCheck className="w-3 h-3" /> Validation</div>
          <ApprovalChips steps={t.approval.steps} />
          {t.status === 'en_attente_approbation' && approvalStep && (
            <p className={`text-[11px] ${validateNow ? 'text-amber-300 font-semibold' : 'text-slate-400'}`}>
              {validateNow ? 'À vous de valider cette tâche.' : `En attente de ${waitingFor(approvalStep)}.`}
            </p>
          )}
        </div>
      )}
      {t.signature && (
        <p className="text-[11px] text-emerald-300 font-mono truncate">✓ Signée par {t.signature.signedBy} — {t.signature.hash.slice(0, 16)}…</p>
      )}

      {linked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {linked.map(d => (
            <button key={d.id} onClick={() => onOpenDocument?.(d)} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-sky-950/30 border border-sky-500/20 text-sky-300 hover:bg-sky-900/30">
              <Paperclip className="w-3 h-3" /> <span className="max-w-[200px] truncate">{d.referenceNumber} — {d.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Formulaires d'action */}
      {mode && (
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
          {mode === 'hours' ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-slate-300">Temps passé (h)</label>
              <input type="number" min="0.25" max="24" step="0.25" value={hours} onChange={e => setHours(e.target.value)} className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono" />
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Note (facultative)" className="flex-1 min-w-[140px] bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white" />
            </div>
          ) : (
            <textarea
              rows={2}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={{
                block: 'Cause du blocage (matériel manquant, accès au site…) *',
                validate: 'Observation (facultative)',
                reject: 'Ce qui doit être corrigé *',
                submit: 'Message au valideur (facultatif)',
                cancel: "Motif de l'annulation (facultatif)",
              }[mode]}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-500"
            />
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setMode(null); setText(''); }} className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300">Annuler</button>
            <button
              onClick={() => {
                if (mode === 'hours') run({ type: 'log_hours', hours: Number(hours), note: text.trim() || undefined });
                else if (mode === 'block') run({ type: 'block', reason: text });
                else if (mode === 'validate') run({ type: 'approve', comment: text.trim() || undefined });
                else if (mode === 'reject') run({ type: 'reject', comment: text });
                else if (mode === 'submit') run({ type: 'submit', comment: text.trim() || undefined });
                else if (mode === 'cancel') run({ type: 'cancel', reason: text.trim() || undefined });
              }}
              disabled={(mode === 'block' || mode === 'reject') && !text.trim()}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}

      {/* Barre d'actions selon le rôle */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80">
        {validateNow && (
          <>
            <button onClick={() => setMode('validate')} className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> {approvalStep?.kind === 'signature' ? 'Valider et signer' : 'Valider'}
            </button>
            <button onClick={() => setMode('reject')} className="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold">
              Renvoyer en correction
            </button>
          </>
        )}
        {canWork && t.status === 'a_faire' && executor && (
          <button onClick={() => onAction(t.id, { type: 'start' })} className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5" /> Démarrer
          </button>
        )}
        {canWork && t.status !== 'bloquee' && allDone && t.steps.length > 0 && (
          <button onClick={() => setMode('submit')} className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> Soumettre à validation
          </button>
        )}
        {canWork && (executor || myRole) && (
          <button onClick={() => setMode('hours')} className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Saisir du temps
          </button>
        )}
        {canWork && t.status !== 'bloquee' && (
          <button onClick={() => setMode('block')} className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Signaler un blocage
          </button>
        )}
        {t.status === 'bloquee' && (executor || editor) && (
          <button onClick={() => onAction(t.id, { type: 'unblock' })} className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold">
            Lever le blocage
          </button>
        )}
        {editor && !closed && (
          <button onClick={() => setMode('cancel')} className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Annuler la tâche
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => exportApprovalSlipToPDF(approvalSlipData(t), organization)}
            title="Bordereau PDF"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowMore(v => !v)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1"
            aria-expanded={showMore}
          >
            <MessageSquare className="w-3.5 h-3.5" /> {(t.comments || []).length}
            {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {showMore && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Échanges</div>
            <ul className="space-y-1.5 max-h-56 overflow-y-auto">
              {(t.comments || []).length === 0 && <li className="text-[11px] text-slate-500 italic">Aucun échange pour l'instant.</li>}
              {(t.comments || []).map(c => (
                <li key={c.id} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px]">
                  <div className="flex justify-between gap-2 text-slate-500"><span className="font-semibold text-slate-300">{c.authorName}</span><span>{formatDateTime(c.at)}</span></div>
                  <p className="text-slate-300 mt-0.5 whitespace-pre-line">{c.text}</p>
                </li>
              ))}
            </ul>
            {canComment && (
              <div className="flex gap-1.5">
                <input
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && comment.trim()) { onAction(t.id, { type: 'comment', text: comment }); setComment(''); } }}
                  placeholder="Écrire un message…"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                />
                <button
                  onClick={() => { if (comment.trim()) { onAction(t.id, { type: 'comment', text: comment }); setComment(''); } }}
                  className="px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                  aria-label="Envoyer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3" /> Historique</div>
            <HistoryList entries={t.history || []} />
            <p className="text-[10px] text-slate-500">Créée par {t.creatorName} le {t.createdAt}</p>
          </div>
        </div>
      )}
    </article>
  );
};
