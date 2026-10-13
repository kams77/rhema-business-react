// shared/access.mjs — règles d'accès communes à l'application (écrans) et au serveur (API).
//
// Le même fichier est utilisé des deux côtés, pour que ce que l'écran autorise soit exactement
// ce que le serveur accepte. Écrit en JavaScript pur (sans dépendance) pour être lu par Node
// sans compilation.

/** @typedef {{ id: string, role: string, roleTitle?: string, matricule?: string, employeeCode?: string,
 *   departementId?: string, directionId?: string, divisionId?: string, serviceId?: string,
 *   departmentName?: string, canManagePayroll?: boolean, canApproveServiceDocuments?: boolean }} AccessUser */
/** @typedef {{ id: string, parentId?: string }} AccessEntity */

export const ROLE_RANK = { dg: 6, chef_departement: 5, directeur: 4, chef_division: 3, chef_service: 2, agent: 1 };

/** @param {string | undefined} role */
export const roleRank = role => ROLE_RANK[role] ?? 0;

/** @param {string | undefined} title */
function normalize(title) {
  return (title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Vrai si l'intitulé contient l'un des mots ou expressions (mots entiers : « DG » ≠ « Budget »).
 * @param {string | undefined} title @param {string[]} terms
 */
export function titleHasAny(title, terms) {
  const words = ` ${normalize(title).split(/[^a-z0-9]+/).filter(Boolean).join(' ')} `;
  return terms.some(term => {
    const t = normalize(term).split(/[^a-z0-9]+/).filter(Boolean).join(' ');
    return t.length > 0 && words.includes(` ${t} `);
  });
}

export const HR_TITLE_TERMS = ['rh', 'drh', 'grh', 'paie', 'ressources humaines'];

/**
 * Gestion de la paie et accès aux salaires de tous.
 * - DG : toujours.
 * - Autorisation explicite donnée par le DG (canManagePayroll = true / false) : prioritaire.
 * - Sinon : responsables de la DAF, de la direction RH ou financière, et fonctions RH / paie.
 * @param {AccessUser | undefined} u
 */
export function isPayrollStaff(u) {
  if (!u) return false;
  if (u.role === 'dg') return true;
  if (u.canManagePayroll === true) return true;
  if (u.canManagePayroll === false) return false;
  if (titleHasAny(u.roleTitle, HR_TITLE_TERMS)) return true;
  return u.role !== 'agent' && (u.departementId === 'dept-daf' || u.directionId === 'dir-rh' || u.directionId === 'dir-finance');
}

/** Centre de sécurité et journal d'audit. @param {AccessUser | undefined} u */
export const isSecurityStaff = u => !!u && (u.role === 'dg' || u.role === 'chef_departement' || u.role === 'directeur');

/** Responsable (tout rôle sauf agent). @param {AccessUser | undefined} u */
export const isManager = u => !!u && u.role !== 'agent';

/** Rattachement de l'utilisateur à la logistique (intitulé, direction ou service). @param {AccessUser} u */
function isLogisticsStaff(u) {
  const text = `${u.departmentName || ''} ${u.roleTitle || ''}`.toLowerCase();
  return /logistique|stock|approvisionnement|transit|magasin|hub/.test(text) || u.directionId === 'dir-log';
}

/**
 * Module logistique.
 * - DG : toujours.
 * - Responsables (chef de service → chef de département) de la logistique ou du département Opérations.
 * - Agents EXÉCUTANTS rattachés à la logistique (magasiniers, agents d'approvisionnement…) :
 *   ils préparent les bons, mais ne visent rien (voir le circuit de validation).
 * @param {AccessUser | undefined} u
 */
export function canAccessLogistics(u) {
  if (!u) return false;
  if (u.role === 'dg') return true;
  if (u.role === 'agent') return isLogisticsStaff(u);
  if (!['chef_departement', 'directeur', 'chef_division', 'chef_service'].includes(u.role)) return false;
  return isLogisticsStaff(u) || u.departementId === 'dept-ops';
}

/** Responsable de la logistique (accès au module ET rôle d'encadrement). @param {AccessUser | undefined} u */
export const isLogisticsManager = u => canAccessLogistics(u) && !!u && u.role !== 'agent';

// ---------------------------------------------------------------------------
// Postes et circuit de validation
// ---------------------------------------------------------------------------

/** Champ du profil qui porte l'entité dirigée, pour chaque rôle d'encadrement. */
export const ROLE_ENTITY_FIELD = {
  chef_service: 'serviceId',
  chef_division: 'divisionId',
  directeur: 'directionId',
  chef_departement: 'departementId',
};

/**
 * Vrai si l'utilisateur occupe le poste « rôle à la tête de l'entité ».
 * @param {AccessUser | undefined} u @param {string} role @param {string | undefined} entityId
 */
export function holdsPosition(u, role, entityId) {
  if (!u || u.role !== role) return false;
  if (role === 'dg') return true;
  const field = ROLE_ENTITY_FIELD[role];
  return !!field && !!entityId && u[field] === entityId;
}

/**
 * Vrai si l'utilisateur est la personne attendue pour une étape de validation
 * (titulaire du poste, personne désignée, ou agent ayant reçu la délégation de visa de son service).
 * @param {AccessUser | undefined} u
 * @param {{ approverRole: string, entityId?: string, approverUserId?: string, kind?: string } | undefined} step
 */
export function isStepHolder(u, step) {
  if (!u || !step) return false;
  if (step.approverUserId) return step.approverUserId === u.id;
  if (holdsPosition(u, step.approverRole, step.entityId)) return true;
  // Règle 6 : délégation formelle de visa accordée par le chef de service (visa simple, pas la signature finale).
  return (
    step.kind === 'visa' &&
    step.approverRole === 'chef_service' &&
    u.role === 'agent' &&
    u.canApproveServiceDocuments === true &&
    !!u.serviceId &&
    u.serviceId === step.entityId
  );
}

/**
 * Vrai si targetId est l'entité ancestorId ou l'une de ses subdivisions.
 * @param {string} targetId @param {string} ancestorId @param {AccessEntity[]} entities
 */
export function isEntityDescendantOf(targetId, ancestorId, entities) {
  if (targetId === ancestorId) return true;
  const byId = new Map((entities || []).map(e => [e.id, e]));
  let current = byId.get(targetId);
  const seen = new Set();
  while (current && current.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.parentId === ancestorId) return true;
    current = byId.get(current.parentId);
  }
  return false;
}

/**
 * Périmètre hiérarchique d'un utilisateur.
 * @param {AccessUser} u @param {string | undefined} entityId @param {AccessEntity[]} entities
 */
export function isEntityInUserScope(u, entityId, entities) {
  if (!u) return false;
  if (u.role === 'dg') return true;
  if (!entityId) return false;
  if ([u.departementId, u.directionId, u.divisionId, u.serviceId].includes(entityId)) return true;
  const anchor = {
    chef_departement: u.departementId,
    directeur: u.directionId,
    chef_division: u.divisionId,
  }[u.role];
  return anchor ? isEntityDescendantOf(entityId, anchor, entities) : false;
}

/** Types de documents confidentiels : circuit, destinataire, Direction et fonction RH / Finance seulement. */
export const CONFIDENTIAL_DOCUMENT_SUBTYPES = new Set(['contrat_travail', 'declaration_sociale', 'bilan_comptable']);
/** Types de documents personnels d'un agent : lui, son circuit, sa hiérarchie et la fonction RH. */
export const PERSONAL_DOCUMENT_SUBTYPES = new Set(['demande_conge', 'feuille_de_temps']);

/**
 * Visibilité d'un document : QUI le voit et QUAND.
 * - DG : tout.
 * - Bulletins de paie : leur titulaire et la Direction / RH habilitée.
 * - L'émetteur, le destinataire nommé et chaque valideur du circuit : toujours.
 * - Brouillon : personne d'autre (il n'est pas encore publié).
 * - En circuit ou rejeté : les responsables du périmètre concerné, jamais les autres agents.
 * - Validé / signé : selon l'accréditation (rôles autorisés) et le périmètre de l'entité cible.
 * @param {AccessUser} u @param {any} doc @param {AccessEntity[]} entities
 */
export function canSeeDocument(u, doc, entities) {
  if (!u || !doc) return false;
  if (u.role === 'dg') return true;
  if (doc.isConfidentialPayslip || doc.subtype === 'bulletin_de_paie') {
    return doc.targetUserId === u.id || isPayrollStaff(u);
  }
  if (doc.authorId === u.id || doc.targetUserId === u.id) return true;
  const steps = (doc.workflow && Array.isArray(doc.workflow.steps)) ? doc.workflow.steps : [];
  if (steps.some(s => isStepHolder(u, s))) return true;
  // Documents confidentiels (contrats de travail, déclarations sociales, bilans) : jamais diffusés
  // au-delà du circuit, du destinataire et de la fonction RH / Finance, quel que soit le choix d'audience.
  if (CONFIDENTIAL_DOCUMENT_SUBTYPES.has(doc.subtype)) return doc.status !== 'brouillon' && isPayrollStaff(u);
  // Documents personnels (congés — parfois pour maladie —, évaluations) : en plus, la hiérarchie
  // de l'émetteur ; jamais ses collègues.
  if (PERSONAL_DOCUMENT_SUBTYPES.has(doc.subtype)) {
    if (doc.status === 'brouillon') return false;
    return isPayrollStaff(u) || (isManager(u) && !!doc.originEntityId && isEntityInUserScope(u, doc.originEntityId, entities));
  }
  if (doc.status === 'brouillon') return false;
  const inProgress = doc.status === 'en_revue' || doc.status === 'rejete';
  if (inProgress && u.role === 'agent') return false;
  if (Array.isArray(doc.allowedRoles) && doc.allowedRoles.length > 0 && !doc.allowedRoles.includes(u.role)) return false;
  const scopeEntity = doc.targetEntityId || (inProgress ? doc.originEntityId : undefined);
  if (scopeEntity) return isEntityInUserScope(u, scopeEntity, entities);
  return true;
}

/**
 * Peut créer ou modifier un document (le document doit rester dans son périmètre).
 * @param {AccessUser} u @param {any} doc @param {AccessEntity[]} entities
 */
export function canWriteDocument(u, doc, entities) {
  if (doc && (doc.isConfidentialPayslip || doc.subtype === 'bulletin_de_paie')) return isPayrollStaff(u);
  return canSeeDocument(u, doc, entities);
}

/**
 * Visibilité d'une invitation inter-entités (et de sa clé).
 * @param {AccessUser} u @param {any} inv @param {AccessEntity[]} entities
 */
export function canSeeInvitation(u, inv, entities) {
  if (!u || !inv) return false;
  if (isSecurityStaff(u)) return true;
  const mat = String(u.matricule || u.employeeCode || '').trim().toUpperCase();
  return (
    inv.inviterUserId === u.id ||
    inv.invitedAgentId === u.id ||
    (!!mat && String(inv.invitedAgentMatricule || '').trim().toUpperCase() === mat) ||
    (isManager(u) && isEntityInUserScope(u, inv.hostEntityId, entities))
  );
}

/** @param {AccessUser} u @param {any} n */
export function canSeeInvitationNotification(u, n) {
  if (!u || !n) return false;
  if (u.role === 'dg') return true;
  const mat = String(u.matricule || u.employeeCode || '').trim().toUpperCase();
  return n.recipientUserId === u.id || (!!mat && String(n.recipientMatricule || '').trim().toUpperCase() === mat);
}

/**
 * Un responsable peut gérer un compte de rang inférieur dans son périmètre ; le DG gère tout.
 * @param {AccessUser} manager @param {AccessUser} target @param {AccessEntity[]} entities
 */
export function canManageAccount(manager, target, entities) {
  if (!manager || !target) return false;
  if (manager.role === 'dg') return true;
  if (manager.role === 'agent' || manager.id === target.id) return false;
  if (roleRank(target.role) >= roleRank(manager.role)) return false;
  const targetEntity = target.serviceId || target.divisionId || target.directionId || target.departementId;
  return isEntityInUserScope(manager, targetEntity, entities);
}

// ---------------------------------------------------------------------------
// Contrôles d'écriture (serveur) : invitations, notifications, organigramme
// ---------------------------------------------------------------------------

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Champs modifiés entre deux versions d'un objet. */
export const changedKeys = (before, after) =>
  Object.keys({ ...(before || {}), ...(after || {}) }).filter(k => !sameJson(before ? before[k] : undefined, after ? after[k] : undefined));

/** L'utilisateur est-il la personne invitée ? @param {AccessUser} u @param {any} inv */
export function isInvitee(u, inv) {
  if (!u || !inv) return false;
  const mat = String(u.matricule || u.employeeCode || '').trim().toUpperCase();
  return inv.invitedAgentId === u.id || (!!mat && String(inv.invitedAgentMatricule || '').trim().toUpperCase() === mat);
}

const INVITEE_FIELDS = ['status', 'connectedAt', 'lastAccessAt'];

/**
 * Création / modification d'une invitation inter-entités.
 * - Direction et responsables de sécurité : tout.
 * - Responsable de l'entité d'accueil (dans son périmètre) : création à son nom, prolongation, révocation.
 * - Personne invitée : seulement ouvrir / fermer sa session (statut et horodatages), avant l'expiration.
 * @param {AccessUser} u @param {any} before @param {any} after @param {AccessEntity[]} entities
 * @param {number} [now]
 */
export function canWriteInvitation(u, before, after, entities, now = Date.now()) {
  if (!u || !after) return false;
  if (isSecurityStaff(u)) return true;
  const hosts = inv => isManager(u) && !!inv && isEntityInUserScope(u, inv.hostEntityId, entities);
  if (!before) return hosts(after) && after.inviterUserId === u.id;
  if (hosts(before) && hosts(after) && after.inviterUserId === before.inviterUserId) return true;
  if (isInvitee(u, before)) {
    if (!changedKeys(before, after).every(k => INVITEE_FIELDS.includes(k))) return false;
    if (after.status === before.status) return true;
    if (!['active', 'en_session'].includes(before.status)) return false; // révoquée, expirée ou terminée : rien à rouvrir
    if (after.status === 'terminee') return true;
    return after.status === 'en_session' && new Date(before.expiresAt).getTime() > now;
  }
  return false;
}

/**
 * Notifications d'invitation : créées par un responsable (avec l'invitation), puis seulement
 * marquées « lues » par leur destinataire.
 * @param {AccessUser} u @param {any} before @param {any} after
 */
export function canWriteInvitationNotification(u, before, after) {
  if (!u || !after) return false;
  if (u.role === 'dg') return true;
  if (!before) return isManager(u);
  return canSeeInvitationNotification(u, before) && changedKeys(before, after).every(k => k === 'isRead');
}

/**
 * Organigramme : le DG modifie tout ; un responsable ne crée, modifie ou supprime que des
 * entités situées SOUS sa responsabilité, et ne peut rien rattacher hors de son périmètre
 * (sinon il pourrait s'approprier une autre branche et ses documents).
 * @param {AccessUser} u @param {any} before @param {any} after @param {AccessEntity[]} entities
 */
export function canWriteEntity(u, before, after, entities) {
  if (!u || !after) return false;
  if (u.role === 'dg') return true;
  if (!isManager(u)) return false;
  const inScope = id => !!id && isEntityInUserScope(u, id, entities);
  const own = [u.departementId, u.directionId, u.divisionId, u.serviceId].filter(Boolean);
  if (!before) return inScope(after.parentId);
  if (before.id !== after.id || !inScope(before.id)) return false;
  // Son entité de rattachement : renommer, oui ; la déplacer dans l'organigramme, non.
  if (!sameJson(before.parentId, after.parentId)) {
    return !own.includes(before.id) && inScope(before.parentId) && inScope(after.parentId);
  }
  return true;
}

/** Suppression d'une entité de l'organigramme. @param {AccessUser} u @param {any} before @param {AccessEntity[]} entities */
export function canDeleteEntity(u, before, entities) {
  if (!u || !before) return false;
  if (u.role === 'dg') return true;
  const own = [u.departementId, u.directionId, u.divisionId, u.serviceId].filter(Boolean);
  return isManager(u) && !own.includes(before.id) && isEntityInUserScope(u, before.id, entities);
}

/** Lecture du module logistique (données commerciales, fournisseurs, stocks). @param {AccessUser | undefined} u */
export const canReadLogistics = u => canAccessLogistics(u) || isSecurityStaff(u) || isPayrollStaff(u);

/** Champs d'un compte réservés à son titulaire et à ceux qui le gèrent (vie privée des agents). */
export const PRIVATE_ACCOUNT_FIELDS = ['phone', 'lastLogin', 'failedAccessAttempts', 'mustChangePassword', 'lockedUntil'];

/**
 * Peut voir la fiche complète d'un collègue (téléphone, dernière connexion, échecs de connexion) :
 * le titulaire, la Direction et la sécurité, la fonction RH / paie, et les responsables qui gèrent ce compte.
 * @param {AccessUser} viewer @param {AccessUser} target @param {AccessEntity[]} entities
 */
export function canSeeFullAccount(viewer, target, entities) {
  if (!viewer || !target) return false;
  return viewer.id === target.id || isSecurityStaff(viewer) || isPayrollStaff(viewer) || canManageAccount(viewer, target, entities);
}
