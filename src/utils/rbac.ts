// src/utils/rbac.ts
import type { User, HierarchicalEntity, DocumentItem, UserRole } from '../types';
import { isPayrollStaff as sharedIsPayrollStaff, isSecurityStaff as sharedIsSecurityStaff } from '../../shared/access.mjs';

/** Accès à la paie (règle commune avec le serveur : shared/access.mjs). */
export const isPayrollStaff = (user: User): boolean => sharedIsPayrollStaff(user as any);
/** Accès au Centre de sécurité et au journal d'audit (règle commune avec le serveur). */
export const isSecurityStaff = (user: User): boolean => sharedIsSecurityStaff(user as any);

/** Normalise un intitulé (minuscules, sans accents) pour des comparaisons fiables. */
function normalizeTitle(title?: string): string {
  return (title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Vérifie si un intitulé de poste contient l'un des mots ou expressions donnés,
 * en comparant des MOTS ENTIERS : « DG » ne correspond pas à « Budget », « RH » pas à « arrhes ».
 */
export function titleHasAny(title: string | undefined, terms: string[]): boolean {
  const normalized = ` ${normalizeTitle(title).split(/[^a-z0-9]+/).filter(Boolean).join(' ')} `;
  return terms.some(term => {
    const t = normalizeTitle(term).split(/[^a-z0-9]+/).filter(Boolean).join(' ');
    return t.length > 0 && normalized.includes(` ${t} `);
  });
}

/** Fonctions RH / paie reconnues dans l'intitulé de poste. */
export const HR_TITLE_TERMS = ['rh', 'drh', 'grh', 'paie', 'ressources humaines'];

/**
 * Retourne la liste de tous les IDs d'entités subordonnées descendant d'un ancêtre
 */
export function getDescendantEntityIds(
  ancestorId: string,
  entities: HierarchicalEntity[]
): string[] {
  const result: string[] = [];
  const queue = [ancestorId];

  while (queue.length > 0) {
    const parent = queue.shift()!;
    const children = entities.filter(e => e.parentId === parent);
    for (const child of children) {
      result.push(child.id);
      queue.push(child.id);
    }
  }

  return result;
}

/**
 * Vérifie si une entité est un descendant direct ou indirect d'un ancêtre
 */
export function isEntityDescendantOf(
  entityId: string,
  ancestorId: string,
  entities: HierarchicalEntity[]
): boolean {
  if (entityId === ancestorId) return true;
  let current: HierarchicalEntity | undefined = entities.find(e => e.id === entityId);
  while (current && current.parentId) {
    const parentId: string = current.parentId;
    if (parentId === ancestorId) return true;
    current = entities.find(e => e.id === parentId);
  }
  return false;
}

/**
 * RÈGLE STRICTE 1 & 2 & 3 & 4 & 5 :
 * Périmètre de visibilité et d'autorité hiérarchique :
 * 1. Le DG voit TOUT et peut TOUT faire.
 * 2. Les Chefs de Département voient tout de leur département + directions, divisions et services affiliés.
 * 3. Les Directeurs voient et agissent de leur direction jusqu'aux services affiliés.
 * 4. Les Chefs de Division voient et agissent de leur division et services affiliés.
 * 5. Les Chefs de Service ne voient et n'agissent qu'au niveau de leur service strict.
 * 6. Les Agents n'agissent que dans leur service assigné.
 */
export function isEntityInUserScope(
  user: User,
  targetEntityId: string,
  entities: HierarchicalEntity[]
): boolean {
  if (user.role === 'dg') return true;

  // Correspondance directe d'affectation
  if (
    user.departementId === targetEntityId ||
    user.directionId === targetEntityId ||
    user.divisionId === targetEntityId ||
    user.serviceId === targetEntityId
  ) {
    return true;
  }

  // 2. Chef de Département : Département + Directions, Divisions, Services affiliés
  if (user.role === 'chef_departement' && user.departementId) {
    return isEntityDescendantOf(targetEntityId, user.departementId, entities);
  }

  // 3. Directeur : Direction + Divisions et Services affiliés
  if (user.role === 'directeur' && user.directionId) {
    return isEntityDescendantOf(targetEntityId, user.directionId, entities);
  }

  // 4. Chef de Division : Division + Services affiliés
  if (user.role === 'chef_division' && user.divisionId) {
    return isEntityDescendantOf(targetEntityId, user.divisionId, entities);
  }

  // 5. Chef de Service : Uniquement son service
  if (user.role === 'chef_service' && user.serviceId) {
    return user.serviceId === targetEntityId;
  }

  // 6. Agent : Uniquement son service assigné
  if (user.role === 'agent' && user.serviceId) {
    return user.serviceId === targetEntityId;
  }

  return false;
}

/**
 * Retourne toutes les entités du périmètre autorisé d'un utilisateur
 */
export function getEntitiesInUserScope(
  user: User,
  entities: HierarchicalEntity[]
): HierarchicalEntity[] {
  if (user.role === 'dg') return entities;
  return entities.filter(e => isEntityInUserScope(user, e.id, entities));
}

/**
 * Vérifie si l'utilisateur a le pouvoir de gérer ou modifier une entité
 */
export function canUserManageEntity(
  user: User,
  targetEntityId: string,
  entities: HierarchicalEntity[]
): boolean {
  if (user.role === 'dg') return true;
  if (user.role === 'agent') return false; // L'agent n'a aucun pouvoir de gestion d'entité
  return isEntityInUserScope(user, targetEntityId, entities);
}

/**
 * RÈGLE STRICTE 6 : APPROBATION DES DOCUMENTS
 * - Le DG approuve tout document de l'entreprise.
 * - Les chefs de département / direction / division / service approuvent dans leur périmètre affilié.
 * - L'Agent ne peut approuver un document de son service QUE SI le chef de service lui a conféré
 *   cette autorisation spécifique (délégation formelle).
 */
export function canUserApproveDocument(
  user: User,
  doc: DocumentItem,
  entities: HierarchicalEntity[]
): { allowed: boolean; reason?: string } {
  // 1. Le DG peut tout faire
  if (user.role === 'dg') return { allowed: true };

  // 6. Règle pour les agents
  if (user.role === 'agent') {
    if (!user.canApproveServiceDocuments) {
      return {
        allowed: false,
        reason: "Accès refusé : En tant qu'Agent, vous devez disposer d'une délégation de visa formelle accordée par votre Chef de Service."
      };
    }
    // L'agent avec délégation ne peut approuver que si le document est lié à son propre service
    if (doc.targetEntityId && doc.targetEntityId !== user.serviceId) {
      return {
        allowed: false,
        reason: `Délégation limitée : Vous ne pouvez viser que les documents de votre service (${user.departmentName || 'Service'}).`
      };
    }
    return { allowed: true };
  }

  // 2, 3, 4, 5. Cadres et Chefs hiérarchiques
  if (doc.targetEntityId && !isEntityInUserScope(user, doc.targetEntityId, entities)) {
    return {
      allowed: false,
      reason: `Pouvoir restreint : Ce document concerne une entité hors de votre périmètre hiérarchique.`
    };
  }

  return { allowed: true };
}

/**
 * Filtrage d'affichage des documents selon la stricte confidentialité
 */
export function canUserViewDocument(
  user: User,
  doc: DocumentItem,
  entities: HierarchicalEntity[]
): { allowed: boolean; reason?: string } {
  // Le DG voit absolument TOUT
  if (user.role === 'dg') return { allowed: true };

  // Confidentialité stricte des bulletins de paie
  if (doc.isConfidentialPayslip || doc.subtype === 'bulletin_de_paie') {
    // L'agent lui-même peut voir son propre bulletin
    if (doc.targetUserId && user.id === doc.targetUserId) {
      return { allowed: true };
    }
    // La Direction / RH habilitée à la paie peut les voir pour gestion
    if (isPayrollStaff(user)) {
      return { allowed: true };
    }
    return { 
      allowed: false, 
      reason: "Ce bulletin de paie est strictement confidentiel et réservé à son titulaire et à la Direction des Ressources Humaines." 
    };
  }

  // Périmètre d'entité
  if (doc.targetEntityId && !isEntityInUserScope(user, doc.targetEntityId, entities)) {
    return {
      allowed: false,
      reason: `Document confidentiel réservé au périmètre : ${doc.targetEntityName || 'Service affilié'}.`,
    };
  }

  return { allowed: true };
}

export function getRoleRank(role: UserRole): number {
  switch (role) {
    case 'dg': return 6;
    case 'chef_departement': return 5;
    case 'directeur': return 4;
    case 'chef_division': return 3;
    case 'chef_service': return 2;
    case 'agent': return 1;
    default: return 0;
  }
}

/**
 * RÈGLE STRICTE 1 à 6 : Visibilité des utilisateurs dans l'annuaire et les équipes
 * 1. Le DG voit TOUT le monde.
 * 2. Le Chef de Département voit son département + directions, divisions et services affiliés.
 * 3. Le Chef de Direction voit sa direction + divisions et services affiliés.
 * 4. Le Chef de Division voit sa division + services affiliés.
 * 5. Le Chef de Service ne voit que les membres de son propre service.
 * 6. L'Agent ne voit que les membres de son service assigné (ou lui-même).
 */
export function isUserVisibleToUser(
  viewer: User,
  target: User,
  entities: HierarchicalEntity[]
): boolean {
  if (viewer.role === 'dg') return true;
  if (viewer.id === target.id) return true;

  const targetEntity = target.serviceId || target.divisionId || target.directionId || target.departementId;
  if (!targetEntity) return false;

  return isEntityInUserScope(viewer, targetEntity, entities);
}

/**
 * Vérifie si l'utilisateur a le droit de gérer un autre agent (ex: créer, modifier, suspendre, révoquer, déléguer visa)
 */
export function canUserManageAgent(
  currentUser: User,
  targetAgent: User,
  entities: HierarchicalEntity[]
): boolean {
  if (currentUser.id === targetAgent.id) return false; // Ne peut pas révoquer ou suspendre son propre compte
  if (currentUser.role === 'dg') return true; // Le DG peut tout faire
  if (currentUser.role === 'agent') return false; // Un agent n'a aucun pouvoir d'administration sur autrui

  // Règle de rang : on ne peut administrer que des collaborateurs de rang inférieur
  const currentRank = getRoleRank(currentUser.role);
  const targetRank = getRoleRank(targetAgent.role);
  if (currentRank <= targetRank) return false;

  // Vérifier si le collaborateur cible est dans le périmètre hiérarchique affilié
  const targetEntity = targetAgent.serviceId || targetAgent.divisionId || targetAgent.directionId || targetAgent.departementId;
  if (!targetEntity) return false;

  return isEntityInUserScope(currentUser, targetEntity, entities);
}

/**
 * Vérifie l'accès aux onglets de l'ERP selon les prérogatives
 */
export function canUserAccessTab(user: User, tabId: string): boolean {
  if (user.role === 'dg') return true; // Le DG voit tout et peut tout faire

  switch (tabId) {
    case 'workspace':
      return true; // Tous les agents ont leur espace personnel
    case 'documents':
      return true; // Accès filtré selon le périmètre
    case 'workflows':
      return true; // Tâches opérationnelles
    case 'hierarchy':
      return true; // Consultation de l'organigramme (avec actions restreintes)
    case 'invitations':
      return true; // Chacun gère ses invitations ; les actions sont filtrées dans le module
    case 'logistics':
      return canAccessLogistics(user);
    case 'bulk_import':
      // Imports massifs : Direction Générale, chefs de département et directeurs
      return user.role === 'chef_departement' || user.role === 'directeur';
    case 'attendance_dispatch':
      return user.role !== 'agent';
    case 'agents':
      // Chefs de service, division, direction, département et DG peuvent administrer leurs agents
      return user.role !== 'agent';
    case 'security':
    case 'audit':
      // Réservé DG, chefs de département et directeurs (règle commune avec le serveur)
      return isSecurityStaff(user);
    case 'laravel':
      return false;
    default:
      return true;
  }
}

export function getRoleBadgeClass(role: UserRole): string {
  switch (role) {
    case 'dg':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'chef_departement':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'directeur':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    case 'chef_division':
      return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
    case 'chef_service':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    default:
      return 'bg-slate-700/50 text-slate-300 border-slate-600';
  }
}

export function getRoleTitleFr(role: UserRole): string {
  switch (role) {
    case 'dg':
      return 'Direction Générale (Plein Pouvoir)';
    case 'chef_departement':
      return 'Chef de Département (Département & Affiliés)';
    case 'directeur':
      return 'Directeur (Direction, Divisions & Services)';
    case 'chef_division':
      return 'Chef de Division (Division & Services)';
    case 'chef_service':
      return 'Chef de Service (Périmètre du Service)';
    case 'agent':
      return 'Agent Opérationnel (Exécution & Délégations)';
    default:
      return 'Collaborateur';
  }
}

/**
 * RÈGLE MÉTIER STRICTE : Le module logistique n'est visible que par le DG 
 * et tous les responsables du département de la Logistique.
 */
export function canAccessLogistics(user: User): boolean {
  if (!user) return false;
  // Le DG et DGA ont plein pouvoir sur toute l'entreprise
  if (user.role === 'dg') return true;

  // Uniquement les postes d'encadrement / responsables (Directeur, Chef Dépt, Chef Division, Chef Service)
  const isResponsibleRole = ['chef_departement', 'directeur', 'chef_division', 'chef_service'].includes(user.role);
  if (!isResponsibleRole) return false;

  const dept = (user.departmentName || '').toLowerCase();
  const roleTitle = (user.roleTitle || '').toLowerCase();

  const isLogistics = 
    dept.includes('logistique') || 
    dept.includes('stock') || 
    dept.includes('approvisionnement') ||
    dept.includes('transit') ||
    roleTitle.includes('logistique') || 
    roleTitle.includes('stock') || 
    roleTitle.includes('approvisionnement') ||
    roleTitle.includes('transit') ||
    (user as any).departementId === 'dept-ops' ||
    (user as any).directionId === 'dir-log';

  return isLogistics;
}

/**
 * RÈGLE D'AFFICHAGE DU TABLEAU DE BORD :
 * Seuls les responsables de la logistique, technique et DG peuvent voir les activités des Hubs.
 */
export function canViewHubActivities(user: User): boolean {
  if (!user) return false;
  if (user.role === 'dg') return true;
  if (canAccessLogistics(user)) return true;

  const isResponsibleRole = ['chef_departement', 'directeur', 'chef_division', 'chef_service'].includes(user.role);
  if (!isResponsibleRole) return false;

  const dept = (user.departmentName || '').toLowerCase();
  const roleTitle = (user.roleTitle || '').toLowerCase();

  return (
    dept.includes('technique') ||
    dept.includes('opération') ||
    dept.includes('operation') ||
    dept.includes('vsat') ||
    roleTitle.includes('technique') ||
    roleTitle.includes('opération') ||
    roleTitle.includes('vsat') ||
    (user as any).departementId === 'dept-ops'
  );
}

/**
 * Seuls le DG et les responsables du département logistique peuvent ajouter de nouveaux Hubs.
 */
export function canManageHubs(user: User): boolean {
  return canAccessLogistics(user);
}
