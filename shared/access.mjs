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
