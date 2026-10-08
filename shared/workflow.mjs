// shared/workflow.mjs — circuit de validation des documents et des tâches.
//
// Utilisé par l'application (écrans) ET par le serveur (API) : un visa n'est accepté que s'il
// est donné par la bonne personne, au bon moment, dans le bon ordre.
//
// Principe :
// 1. Chaque TYPE de document définit son circuit (niveaux hiérarchiques et contrôles fonctionnels)
//    et sa règle de montant (aucun / facultatif / obligatoire).
// 2. Le circuit est calculé à partir de la position de l'ÉMETTEUR dans l'organigramme :
//    son chef de service, puis son chef de division, son directeur, etc.
//    Un poste vacant remonte au niveau supérieur. Les niveaux égaux ou inférieurs à l'émetteur
//    sont sautés (on ne se fait pas valider par un pair ou un subordonné).
// 3. Les étapes se valident UNE PAR UNE, dans l'ordre. La dernière est la signature.
// 4. Un rejet arrête le circuit ; l'émetteur corrige puis renvoie (nouveau cycle, historique conservé).
// Écrit en JavaScript pur (sans dépendance) pour être lu par Node sans compilation.

import {
  roleRank,
  isEntityInUserScope,
  isEntityDescendantOf,
  isStepHolder,
  holdsPosition,
  canWriteDocument,
} from './access.mjs';

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------

export const ROLE_LABELS = {
  dg: 'Direction Générale',
  chef_departement: 'Chef de département',
  directeur: 'Directeur',
  chef_division: 'Chef de division',
  chef_service: 'Chef de service',
  agent: 'Agent',
};

export const DOCUMENT_CATEGORIES = {
  administratif_general: 'Administratif & Notes',
  financier_comptable: 'Financier & Comptable',
  chaine_logistique_commerciale: 'Logistique & Commercial',
  ressources_humaines: 'Ressources Humaines',
};

/**
 * Catalogue des types de documents.
 * - amount : 'aucun' (pas de prix), 'facultatif', 'requis'
 * - chain  : niveaux du circuit, dans l'ordre. Niveaux hiérarchiques : service, division, direction,
 *            departement, dg. Contrôles fonctionnels : finance, rh, logistique.
 * - dgAbove : montant (USD) au-delà duquel le visa de la DG est ajouté.
 * - finalKind : 'signature' (signature électronique finale) ou 'visa' (approbation simple).
 * - confidential : réservé aux personnes du circuit, au destinataire et à la Direction.
 */
export const DOCUMENT_TYPES = {
  // --- Administratif & notes -----------------------------------------------------------
  note_service: {
    label: 'Note de service', category: 'administratif_general', amount: 'aucun',
    chain: ['service', 'division', 'direction'], finalKind: 'signature',
    hint: "Directive interne : validée jusqu'au directeur de l'émetteur.",
  },
  communique: {
    label: "Communiqué / Note d'information", category: 'administratif_general', amount: 'aucun',
    chain: ['direction', 'departement'], finalKind: 'signature',
    hint: 'Information générale : validée par la direction puis le département.',
  },
  rapport_activite: {
    label: "Rapport d'activité / de mission", category: 'administratif_general', amount: 'facultatif',
    chain: ['service', 'division'], finalKind: 'visa',
    hint: 'Compte rendu : visé par la hiérarchie directe.',
  },
  proces_verbal: {
    label: 'Procès-verbal (réception, recette, réunion)', category: 'administratif_general', amount: 'aucun',
    chain: ['service', 'direction'], finalKind: 'signature',
    hint: 'Constat officiel : signé par le directeur concerné.',
  },
  // --- Financier & comptable --------------------------------------------------------------
  demande_achat: {
    label: "Demande d'achat / Engagement de dépense", category: 'financier_comptable', amount: 'requis',
    chain: ['service', 'division', 'direction', 'finance'], dgAbove: 5000, finalKind: 'signature',
    hint: 'Hiérarchie, puis contrôle budgétaire Finance ; DG au-delà de 5 000 USD.',
  },
  note_frais: {
    label: 'Note de frais & mission', category: 'financier_comptable', amount: 'requis',
    chain: ['service', 'finance'], dgAbove: 3000, finalKind: 'signature',
    hint: 'Chef de service puis Finance ; DG au-delà de 3 000 USD.',
  },
  facture_client: {
    label: 'Facture client', category: 'financier_comptable', amount: 'requis',
    chain: ['service', 'finance'], finalKind: 'signature',
    hint: 'Contrôle du service émetteur puis signature Finance.',
  },
  facture_fournisseur: {
    label: 'Facture fournisseur (bon à payer)', category: 'financier_comptable', amount: 'requis',
    chain: ['service', 'direction', 'finance'], dgAbove: 10000, finalKind: 'signature',
    hint: 'Service fait, direction, puis Finance ; DG au-delà de 10 000 USD.',
  },
  avoir: {
    label: 'Avoir / Note de crédit', category: 'financier_comptable', amount: 'requis',
    chain: ['service', 'finance'], finalKind: 'signature',
  },
  bilan_comptable: {
    label: 'Bilan comptable & états financiers', category: 'financier_comptable', amount: 'facultatif',
    chain: ['finance', 'departement', 'dg'], finalKind: 'signature', confidential: true,
  },
  // --- Logistique & commercial ------------------------------------------------------------
  devis: {
    label: 'Devis / Facture proforma', category: 'chaine_logistique_commerciale', amount: 'requis',
    chain: ['service', 'direction'], finalKind: 'signature',
  },
  bon_commande_client: {
    label: 'Bon de commande fournisseur', category: 'chaine_logistique_commerciale', amount: 'requis',
    chain: ['service', 'direction', 'finance'], dgAbove: 10000, finalKind: 'signature',
    hint: 'Logistique, puis contrôle Finance ; DG au-delà de 10 000 USD.',
  },
  bon_livraison: {
    label: 'Bon de livraison / expédition', category: 'chaine_logistique_commerciale', amount: 'facultatif',
    chain: ['service'], finalKind: 'visa',
  },
  bon_reception: {
    label: 'Bon de réception & inventaire physique', category: 'chaine_logistique_commerciale', amount: 'facultatif',
    chain: ['service', 'direction'], finalKind: 'visa',
  },
  bon_entree_stock: {
    label: "Bon d'entrée en stock", category: 'chaine_logistique_commerciale', amount: 'facultatif',
    chain: ['service', 'direction'], finalKind: 'signature',
  },
  bon_sortie_stock: {
    label: 'Bon de sortie de stock / déploiement', category: 'chaine_logistique_commerciale', amount: 'facultatif',
    chain: ['service', 'direction'], finalKind: 'signature',
  },
  ordre_transfert: {
    label: 'Ordre de transfert inter-hubs', category: 'chaine_logistique_commerciale', amount: 'facultatif',
    chain: ['service', 'direction'], finalKind: 'signature',
  },
  contrat_commercial: {
    label: 'Contrat commercial / partenaire', category: 'chaine_logistique_commerciale', amount: 'facultatif',
    chain: ['direction', 'departement', 'dg'], finalKind: 'signature',
  },
  // --- Ressources humaines ----------------------------------------------------------------
  demande_conge: {
    label: "Demande de congé / d'absence", category: 'ressources_humaines', amount: 'aucun',
    chain: ['service', 'division', 'rh'], finalKind: 'visa',
    hint: 'Chef de service, chef de division puis Ressources Humaines.',
  },
  fiche_poste: {
    label: 'Fiche de poste', category: 'ressources_humaines', amount: 'aucun',
    chain: ['service', 'direction', 'rh'], finalKind: 'signature',
  },
  feuille_de_temps: {
    label: "Feuille de temps / fiche d'évaluation", category: 'ressources_humaines', amount: 'aucun',
    chain: ['service', 'division'], finalKind: 'visa',
  },
  contrat_travail: {
    label: 'Contrat de travail (CDI / CDD)', category: 'ressources_humaines', amount: 'facultatif',
    chain: ['rh', 'dg'], finalKind: 'signature', confidential: true,
  },
  declaration_sociale: {
    label: 'Déclaration CNSS & IPR', category: 'ressources_humaines', amount: 'requis',
    chain: ['rh', 'finance', 'dg'], finalKind: 'signature', confidential: true,
  },
  bulletin_de_paie: {
    label: 'Bulletin de paie (confidentiel)', category: 'ressources_humaines', amount: 'requis',
    chain: ['rh'], finalKind: 'signature', confidential: true,
  },
};

/** @param {string} subtype */
export const documentType = subtype => DOCUMENT_TYPES[subtype] || {
  label: String(subtype || 'Document').replace(/_/g, ' '), category: 'administratif_general',
  amount: 'facultatif', chain: ['service', 'direction'], finalKind: 'signature',
};

/** Types proposés pour une catégorie. @param {string} category */
export const documentTypesFor = category =>
  Object.entries(DOCUMENT_TYPES).filter(([, t]) => t.category === category).map(([value, t]) => ({ value, ...t }));

// ---------------------------------------------------------------------------
// Organigramme
// ---------------------------------------------------------------------------

const LEVEL_ROLE = { service: 'chef_service', division: 'chef_division', direction: 'directeur', departement: 'chef_departement' };

/** Entité de rattachement la plus fine d'un utilisateur. */
export const userAnchorEntityId = u => (u ? (u.serviceId || u.divisionId || u.directionId || u.departementId) : undefined);

/** L'entité et ses parents, du plus bas au plus haut. */
export function entityAncestry(entityId, entities) {
  const byId = new Map((entities || []).map(e => [e.id, e]));
  const out = [];
  const seen = new Set();
  let cur = entityId ? byId.get(entityId) : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out;
}

const FUNCTION_PATTERNS = {
  finance: /financ|comptab|tr[ée]sorerie/i,
  rh: /ressources humaines|\brh\b|\bdrh\b|personnel/i,
  logistique: /logistique|stock|approvisionnement/i,
};

/** Entité « fonctionnelle » (Finance, RH, Logistique) : une direction de préférence, sinon un département. */
function functionalEntity(fn, entities) {
  const re = FUNCTION_PATTERNS[fn];
  if (!re) return undefined;
  const matches = (entities || []).filter(e => re.test(e.name || '') || re.test(e.code || ''));
  return matches.find(e => e.level === 'direction') || matches.find(e => e.level === 'departement') || matches[0];
}

/** Titulaire d'un poste (premier compte actif trouvé). */
export function findHolder(role, entityId, users) {
  return (users || []).find(u => u.status !== 'suspendu' && holdsPosition(u, role, entityId));
}

// ---------------------------------------------------------------------------
// Construction du circuit
// ---------------------------------------------------------------------------

let stepCounter = 0;
const stepId = () => `etp-${Date.now().toString(36)}-${(stepCounter++).toString(36)}`;

/**
 * Calcule les étapes du circuit d'un document.
 * @param {{ subtype: string, amount?: number, currency?: string }} doc
 * @param {any} author  émetteur (profil complet)
 * @param {any[]} entities organigramme
 * @param {any[]} [users] annuaire (sert à sauter les postes vacants et à nommer les valideurs)
 * @returns {any[]} étapes (status « en_attente »)
 */
export function buildDocumentChain(doc, author, entities, users) {
  const type = documentType(doc.subtype);
  const levels = [...type.chain];
  const amountUSD = typeof doc.amount === 'number' ? (doc.currency === 'CDF' ? doc.amount / 2850 : doc.amount) : 0;
  if (type.dgAbove && amountUSD > type.dgAbove && !levels.includes('dg')) levels.push('dg');
  return resolveChain(levels, author, entities, users, type.finalKind || 'signature');
}

/**
 * Transforme une liste de niveaux en étapes concrètes (poste + entité).
 * @param {string[]} levels @param {any} author @param {any[]} entities @param {any[]} [users]
 * @param {'signature' | 'visa'} [finalKind]
 */
export function resolveChain(levels, author, entities, users, finalKind = 'signature') {
  const ancestry = entityAncestry(userAnchorEntityId(author), entities);
  const authorRank = roleRank(author && author.role);
  const knowUsers = Array.isArray(users) && users.length > 0;
  const steps = [];
  const pushStep = (role, entity, functional) => {
    if (!role) return;
    if (authorRank >= roleRank('dg')) return; // la Direction Générale signe seule

    if (role !== 'dg' && !entity) return;
    // Pas de validation par soi-même, ni (dans la hiérarchie) par un pair ou un subordonné.
    if (author && holdsPosition(author, role, entity && entity.id)) return;
    if (!functional && roleRank(role) <= authorRank) return;
    if (steps.some(s => s.approverRole === role && s.entityId === (entity && entity.id))) return;
    const holder = knowUsers ? findHolder(role, entity && entity.id, users) : undefined;
    steps.push({
      id: stepId(),
      kind: 'visa',
      approverRole: role,
      entityId: entity ? entity.id : undefined,
      entityName: entity ? entity.name : undefined,
      expectedHolderName: holder ? holder.name : undefined,
      label: role === 'dg' ? 'Direction Générale' : `${ROLE_LABELS[role]} — ${entity.name}`,
      status: 'en_attente',
    });
  };

  for (const level of levels) {
    if (level === 'dg') { pushStep('dg'); continue; }
    if (FUNCTION_PATTERNS[level]) {
      const ent = functionalEntity(level, entities);
      const role = ent ? LEVEL_ROLE[ent.level] : undefined;
      if (ent && role && (!knowUsers || findHolder(role, ent.id, users))) pushStep(role, ent, true);
      continue;
    }
    // Niveau hiérarchique : on cherche l'entité de ce niveau au-dessus de l'émetteur.
    const index = ancestry.findIndex(e => e.level === level);
    if (index < 0) continue; // niveau absent de la branche de l'émetteur
    // Poste vacant : on remonte jusqu'au premier responsable en poste.
    let placed = false;
    for (let i = index; i < ancestry.length; i++) {
      const ent = ancestry[i];
      const role = LEVEL_ROLE[ent.level];
      if (!role) continue;
      if (roleRank(role) <= authorRank && !(author && holdsPosition(author, role, ent.id))) { placed = true; break; }
      if (author && holdsPosition(author, role, ent.id)) { placed = true; break; }
      if (!knowUsers || findHolder(role, ent.id, users)) { pushStep(role, ent, false); placed = true; break; }
    }
    if (!placed && authorRank < roleRank('dg')) pushStep('dg');
  }

  if (steps.length === 0) {
    // L'émetteur est au sommet du circuit : il signe lui-même son document.
    steps.push({
      id: stepId(),
      kind: 'signature',
      approverRole: author ? author.role : 'dg',
      approverUserId: author ? author.id : undefined,
      expectedHolderName: author ? author.name : undefined,
      label: `Signature de l'émetteur — ${author ? author.name : ''}`.trim(),
      status: 'en_attente',
    });
  } else {
    steps[steps.length - 1].kind = finalKind;
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Avancement du circuit (fonctions pures : elles renvoient un nouvel objet)
// ---------------------------------------------------------------------------

/** Étape en attente (la première non validée), ou undefined. */
export function currentStep(workflow) {
  const steps = workflow && Array.isArray(workflow.steps) ? workflow.steps : [];
  if (steps.some(s => s.status === 'rejete')) return undefined;
  return steps.find(s => s.status === 'en_attente');
}

const historyEntry = (actor, action, label, comment, at) => ({
  id: `hist-${Date.now().toString(36)}-${(stepCounter++).toString(36)}`,
  at,
  actorId: actor ? actor.id : undefined,
  actorName: actor ? actor.name : 'Système',
  action,
  label,
  ...(comment ? { comment } : {}),
});

/**
 * L'utilisateur peut-il agir MAINTENANT sur ce document (viser, signer ou rejeter l'étape en cours) ?
 * Le DG peut agir sur l'étape en cours ; personne ne valide son propre document,
 * sauf l'étape « signature de l'émetteur » qui lui est explicitement destinée.
 */
export function canActOnDocument(u, doc) {
  if (!u || !doc || doc.status !== 'en_revue') return false;
  const step = currentStep(doc.workflow);
  if (!step) return false;
  if (step.approverUserId) return step.approverUserId === u.id;
  if (u.id === doc.authorId) return false;
  return u.role === 'dg' || isStepHolder(u, step);
}

/** Soumet (ou resoumet après rejet) un document dans son circuit. */
export function submitDocument(doc, steps, actor, at = new Date().toISOString()) {
  const previous = doc.workflow;
  const cycle = previous ? (previous.cycle || 1) + (previous.submittedAt ? 1 : 0) : 1;
  const history = [...((previous && previous.history) || [])];
  history.push(historyEntry(actor, previous && previous.submittedAt ? 'resoumission' : 'soumission',
    previous && previous.submittedAt ? `Corrigé et renvoyé dans le circuit (cycle ${cycle})` : 'Soumis au circuit de validation', undefined, at));
  return {
    ...doc,
    status: 'en_revue',
    workflow: { cycle, submittedAt: at, steps: steps.map(s => ({ ...s, status: 'en_attente' })), history },
  };
}

/** Enregistre un brouillon (circuit prévu mais non lancé). */
export function draftDocument(doc, steps, actor, at = new Date().toISOString()) {
  return {
    ...doc,
    status: 'brouillon',
    workflow: { cycle: 1, steps, history: [historyEntry(actor, 'brouillon', 'Brouillon enregistré', undefined, at)] },
  };
}

/**
 * Visa / signature / rejet de l'étape en cours.
 * @param {any} doc
 * @param {any} actor
 * @param {{ decision: 'approve' | 'reject', comment?: string, signature?: any, signatureHash?: string, at?: string }} opts
 */
export function decideDocument(doc, actor, opts) {
  const at = opts.at || new Date().toISOString();
  const step = currentStep(doc.workflow);
  if (!step) throw new Error("Ce document n'attend aucune validation.");
  if (!canActOnDocument(actor, doc)) throw new Error("Cette étape du circuit ne vous revient pas.");
  if (opts.decision === 'reject' && !(opts.comment && opts.comment.trim())) throw new Error('Le motif du rejet est obligatoire.');
  const steps = doc.workflow.steps.map(s => s.id !== step.id ? s : {
    ...s,
    status: opts.decision === 'approve' ? 'approuve' : 'rejete',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    at,
    ...(opts.comment ? { comment: opts.comment.trim() } : {}),
    ...(opts.signatureHash ? { signatureHash: opts.signatureHash } : {}),
  });
  const history = [...(doc.workflow.history || [])];
  if (opts.decision === 'reject') {
    history.push(historyEntry(actor, 'rejet', `Rejeté à l'étape « ${step.label} »`, opts.comment, at));
    return {
      ...doc,
      status: 'rejete',
      workflow: { ...doc.workflow, steps, history, rejection: { reason: opts.comment.trim(), by: actor.name, byId: actor.id, at, stepLabel: step.label } },
    };
  }
  const done = steps.every(s => s.status === 'approuve');
  const isSignature = step.kind === 'signature';
  history.push(historyEntry(actor, isSignature ? 'signature' : 'visa', `${isSignature ? 'Signé' : 'Visé'} — ${step.label}`, opts.comment, at));
  const next = { ...doc, workflow: { ...doc.workflow, steps, history } };
  if (done) {
    next.status = isSignature ? 'signe' : 'approuve';
    if (opts.signature) next.electronicSignature = opts.signature;
  }
  return next;
}

/** Résumé lisible du circuit (pour les écrans). */
export function workflowSummary(doc) {
  const steps = (doc.workflow && doc.workflow.steps) || [];
  const done = steps.filter(s => s.status === 'approuve').length;
  const step = currentStep(doc.workflow);
  return { total: steps.length, done, current: step, rejected: steps.find(s => s.status === 'rejete') };
}

// ---------------------------------------------------------------------------
// Contrôle des modifications de documents (serveur)
// ---------------------------------------------------------------------------

const CONTENT_FIELDS = ['title', 'description', 'subtype', 'category', 'amount', 'currency', 'targetEntityId', 'authorId'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Le serveur n'accepte une modification de document que si elle respecte le circuit :
 * - contenu modifiable seulement par l'émetteur, en brouillon ou après rejet (ou par le DG) ;
 * - chaque étape qui change d'état doit être celle EN COURS, validée par son titulaire (identifiant de la session) ;
 * - un document n'est « signé » / « approuvé » que si toutes ses étapes le sont.
 * @param {any} u @param {any} before @param {any} after @param {any[]} entities
 */
export function canWriteDocumentChange(u, before, after, entities) {
  if (!u || !after) return false;
  if (!canWriteDocument(u, after, entities) && !(before && canActOnDocument(u, before))) return false;
  const stepsAfter = (after.workflow && after.workflow.steps) || [];
  const finalOk = !['signe', 'approuve'].includes(after.status) || !after.workflow || (stepsAfter.length > 0 && stepsAfter.every(s => s.status === 'approuve'));
  if (!finalOk) return false;

  if (!before) {
    // Création : rien ne peut arriver déjà validé par quelqu'un d'autre.
    return u.role === 'dg' || stepsAfter.every(s => s.status === 'en_attente' || s.actorId === u.id);
  }
  if (u.role === 'dg') return true;
  if (!before.workflow) return true; // ancien document, sans circuit : règle de périmètre ci-dessus

  const isAuthor = before.authorId === u.id;
  const editable = before.status === 'brouillon' || before.status === 'rejete';
  const contentChanged = CONTENT_FIELDS.some(f => !same(before[f], after[f]));
  if (contentChanged && !(isAuthor && editable)) return false;

  const bw = before.workflow;
  const aw = after.workflow;
  if (!aw) return false;
  // Nouveau cycle (soumission / renvoi après correction) : seulement l'émetteur.
  if ((aw.cycle || 1) !== (bw.cycle || 1) || (!bw.submittedAt && aw.submittedAt)) {
    return isAuthor && editable && after.status === 'en_revue' && stepsAfter.every(s => s.status === 'en_attente');
  }
  // Même cycle : au plus UNE étape change, celle en cours, par son titulaire.
  const stepsBefore = bw.steps || [];
  if (stepsBefore.length !== stepsAfter.length) return false;
  const changed = stepsAfter.filter((s, i) => !same(s, stepsBefore[i]));
  if (changed.length === 0) return same(before.status, after.status) || (isAuthor && before.status === 'brouillon' && after.status === 'brouillon');
  if (changed.length > 1) return false;
  const cur = currentStep(bw);
  const s = changed[0];
  if (!cur || s.id !== cur.id || s.actorId !== u.id) return false;
  if (!canActOnDocument(u, before)) return false;
  if (s.status === 'rejete') return after.status === 'rejete';
  if (s.status !== 'approuve') return false;
  const allDone = stepsAfter.every(x => x.status === 'approuve');
  return allDone ? ['signe', 'approuve'].includes(after.status) : after.status === 'en_revue';
}

/** Suppression : brouillon de l'émetteur, ou DG. */
export const canDeleteDocument = (u, doc) => !!u && !!doc && (u.role === 'dg' || (doc.authorId === u.id && doc.status === 'brouillon'));

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------

/** Intervenant de la tâche (tout rôle). */
export const taskRoleOf = (u, t) => {
  const i = u && t && Array.isArray(t.assignedIntervenants) ? t.assignedIntervenants.find(x => x.userId === u.id) : undefined;
  return i ? i.roleType : undefined;
};

/**
 * Qui voit une tâche : DG ; créateur ; intervenants ; valideurs du circuit ;
 * responsables (pas les agents) dont le périmètre couvre l'entité affectée.
 */
export function canSeeTask(u, t, entities) {
  if (!u || !t) return false;
  if (u.role === 'dg') return true;
  if (t.creatorId === u.id || taskRoleOf(u, t)) return true;
  const steps = (t.approval && t.approval.steps) || [];
  if (steps.some(s => isStepHolder(u, s))) return true;
  if (u.role === 'agent') return false;
  return !!t.assignedEntityId && isEntityInUserScope(u, t.assignedEntityId, entities);
}

/** Modification complète (contenu, affectation, annulation) : DG, créateur, responsable de la tâche, hiérarchie du périmètre. */
export function canEditTask(u, t, entities) {
  if (!u || !t) return false;
  if (u.role === 'dg' || t.creatorId === u.id || taskRoleOf(u, t) === 'responsable') return true;
  return u.role !== 'agent' && !!t.assignedEntityId && isEntityInUserScope(u, t.assignedEntityId, entities);
}

/** Exécution (émarger ses étapes, saisir ses heures, commenter, soumettre) : intervenants. */
export const canExecuteTask = (u, t) => ['executant', 'contributeur', 'responsable'].includes(taskRoleOf(u, t) || '');

/** Validation de la tâche à l'étape en cours. */
export function canValidateTaskNow(u, t) {
  if (!u || !t || t.status !== 'en_attente_approbation') return false;
  const step = currentStep(t.approval);
  if (!step) return false;
  if (step.approverUserId) return step.approverUserId === u.id || u.role === 'dg';
  return u.role === 'dg' || isStepHolder(u, step);
}

/** Étape (case à cocher) que l'utilisateur peut émarger. */
export function canTickTaskStep(u, t, step) {
  if (!u || !t || !step) return false;
  if (['validee_terminee', 'termine', 'annulee', 'en_attente_approbation'].includes(t.status)) return false;
  if (taskRoleOf(u, t) === 'responsable' || u.role === 'dg') return true;
  if (!canExecuteTask(u, t)) return false;
  return !step.assignedToUserId || step.assignedToUserId === u.id;
}

/**
 * Circuit de validation d'une tâche : les intervenants « valideurs » dans l'ordre ;
 * à défaut, le responsable hiérarchique de l'entité affectée (en remontant si le poste est vacant).
 */
export function buildTaskApprovalChain(t, entities, users) {
  const validators = (t.assignedIntervenants || []).filter(i => i.roleType === 'validateur');
  // Ceux qui exécutent ne valident pas leur propre travail (le responsable, lui, peut valider).
  const executorIds = new Set((t.assignedIntervenants || []).filter(i => i.roleType === 'executant' || i.roleType === 'contributeur').map(i => i.userId));
  const steps = validators
    .filter(v => !executorIds.has(v.userId))
    .map(v => ({
      id: stepId(),
      kind: 'visa',
      approverRole: v.userRole,
      approverUserId: v.userId,
      expectedHolderName: v.userName,
      label: `${v.userName} — ${v.userRoleTitle || ROLE_LABELS[v.userRole] || ''}`.trim(),
      status: 'en_attente',
    }));
  if (steps.length === 0) {
    // Responsable hiérarchique de l'entité affectée.
    const ancestry = entityAncestry(t.assignedEntityId, entities);
    for (const ent of ancestry) {
      const role = LEVEL_ROLE[ent.level];
      const holder = role ? findHolder(role, ent.id, users) : undefined;
      if (holder && !executorIds.has(holder.id)) {
        steps.push({
          id: stepId(), kind: 'visa', approverRole: role, entityId: ent.id, entityName: ent.name,
          expectedHolderName: holder.name, label: `${ROLE_LABELS[role]} — ${ent.name}`, status: 'en_attente',
        });
        break;
      }
    }
    if (steps.length === 0) {
      steps.push({ id: stepId(), kind: 'visa', approverRole: 'dg', label: 'Direction Générale', status: 'en_attente' });
    }
  }
  if (t.signatureRequired) steps[steps.length - 1].kind = 'signature';
  return steps;
}

const TASK_EXECUTION_FIELDS = new Set(['steps', 'comments', 'spentHours', 'status', 'history', 'updatedAt', 'approval', 'blockedReason', 'progress']);
const TASK_VALIDATION_FIELDS = new Set(['approval', 'status', 'history', 'comments', 'updatedAt', 'signature', 'completedAt', 'lastRejection']);

/**
 * Contrôle serveur d'une modification de tâche.
 * @param {any} u @param {any} before @param {any} after @param {any[]} entities
 */
export function canWriteTaskChange(u, before, after, entities) {
  if (!u || !after) return false;
  if (!before) {
    // Création : un responsable dans son périmètre ; un agent seulement pour lui-même, dans son service.
    if (u.role === 'dg') return true;
    if (after.creatorId !== u.id) return false;
    if (u.role === 'agent') {
      // Un agent ne charge personne d'autre d'exécuter : il peut seulement nommer qui suit / valide.
      const others = (after.assignedIntervenants || []).filter(i => i.userId !== u.id && (i.roleType === 'executant' || i.roleType === 'contributeur'));
      return others.length === 0 && (!after.assignedEntityId || after.assignedEntityId === u.serviceId || isEntityInUserScope(u, after.assignedEntityId, entities));
    }
    return !after.assignedEntityId || isEntityInUserScope(u, after.assignedEntityId, entities) || !!after.source;
  }
  if (canEditTask(u, before, entities)) return true;
  const changedKeys = Object.keys({ ...before, ...after }).filter(k => !same(before[k], after[k]));
  if (changedKeys.length === 0) return true;
  // Valideur à son tour.
  if (canValidateTaskNow(u, before) && changedKeys.every(k => TASK_VALIDATION_FIELDS.has(k))) {
    const bs = (before.approval && before.approval.steps) || [];
    const as = (after.approval && after.approval.steps) || [];
    const changed = as.filter((s, i) => !same(s, bs[i]));
    const cur = currentStep(before.approval);
    return changed.length === 1 && !!cur && changed[0].id === cur.id && changed[0].actorId === u.id;
  }
  // Exécutant : avancement, heures, commentaires, soumission.
  if (canExecuteTask(u, before) && changedKeys.every(k => TASK_EXECUTION_FIELDS.has(k))) {
    if (after.status !== before.status && !['a_faire', 'en_cours', 'en_attente_approbation', 'bloquee'].includes(after.status)) return false;
    if (after.approval && !same(after.approval, before.approval)) {
      // Soumission : nouveau circuit entièrement « en attente ».
      return after.status === 'en_attente_approbation' && (after.approval.steps || []).every(s => s.status === 'en_attente');
    }
    return true;
  }
  return false;
}

/** Suppression d'une tâche : DG ou créateur. */
export const canDeleteTask = (u, t) => !!u && !!t && (u.role === 'dg' || t.creatorId === u.id);

/** Vrai si l'entité appartient à la branche de l'autre (utilitaire d'écran). */
export const isInBranch = (entityId, ancestorId, entities) => isEntityDescendantOf(entityId, ancestorId, entities);
