// src/utils/rbac.ts
import type { User, HierarchicalEntity, DocumentItem, UserRole } from '../types';

export function isEntityInUserScope(
  user: User,
  targetEntityId: string,
  entities: HierarchicalEntity[]
): boolean {
  if (user.role === 'dg') return true;

  if (
    user.departementId === targetEntityId ||
    user.directionId === targetEntityId ||
    user.divisionId === targetEntityId ||
    user.serviceId === targetEntityId
  ) {
    return true;
  }

  if (user.role === 'chef_departement' && user.departementId) {
    return isEntityDescendantOf(targetEntityId, user.departementId, entities);
  }
  if (user.role === 'directeur' && user.directionId) {
    return isEntityDescendantOf(targetEntityId, user.directionId, entities);
  }
  if (user.role === 'chef_division' && user.divisionId) {
    return isEntityDescendantOf(targetEntityId, user.divisionId, entities);
  }
  if (user.serviceId === targetEntityId) {
    return true;
  }
  return false;
}

export function isEntityDescendantOf(
  entityId: string,
  ancestorId: string,
  entities: HierarchicalEntity[]
): boolean {
  let current = entities.find(e => e.id === entityId);
  while (current && current.parentId) {
    if (current.parentId === ancestorId) return true;
    current = entities.find(e => e.id === current?.parentId);
  }
  return false;
}

export function canUserViewDocument(
  user: User,
  doc: DocumentItem,
  entities: HierarchicalEntity[]
): { allowed: boolean; reason?: string } {
  if (user.role === 'dg') return { allowed: true };

  if (doc.isConfidentialPayslip && doc.targetUserId) {
    if (user.id === doc.targetUserId) return { allowed: true };
    if (user.role === 'directeur' && user.directionId === 'dir-rh') return { allowed: true };
    return { allowed: false, reason: "Ce bulletin est strictement confidentiel." };
  }

  if (doc.targetEntityId && !isEntityInUserScope(user, doc.targetEntityId, entities)) {
    return {
      allowed: false,
      reason: `Document réservé au service : ${doc.targetEntityName || 'Périmètre restreint'}.`,
    };
  }

  return { allowed: true };
}

export function getRoleBadgeClass(role: UserRole): string {
  switch (role) {
    case 'dg':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'chef_departement':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'directeur':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    case 'chef_service':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    default:
      return 'bg-slate-700/50 text-slate-300 border-slate-600';
  }
}