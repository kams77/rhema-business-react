// src/utils/invitationUtils.ts
import type { User, HierarchicalEntity, EntityInvitation, EntityInvitationNotification } from '../types';
import { secureDigits } from '../lib/sequence';

/**
 * Génère une clé d'authentification unique de 10 chiffres (format strict: 10 chiffres décimaux)
 * Exemple: "7492018365"
 */
export function generate10DigitAuthKey(): string {
  // Générateur cryptographique (Math.random est prévisible) ; premier chiffre non nul.
  return secureDigits(10);
}

/**
 * Vérifie si un utilisateur est habilité en tant que responsable d'entité
 * (DG, Chef de Département, Directeur, Chef de Division, Chef de Service ou désigné dans les entités)
 */
export function isEntityManager(user: User, entities: HierarchicalEntity[]): boolean {
  if (!user) return false;
  if (user.role === 'dg') return true;
  if (['chef_departement', 'directeur', 'chef_division', 'chef_service'].includes(user.role)) return true;

  // Vérifier s'il est manager assigné d'au moins une entité
  const isAssignedManager = entities.some(
    e => (e.managerName && e.managerName.toLowerCase().includes(user.name.toLowerCase())) ||
         (e.managerEmail && e.managerEmail.toLowerCase() === user.email.toLowerCase())
  );

  return isAssignedManager;
}

/**
 * Récupère les entités qu'un utilisateur a le droit de diriger / inviter vers
 */
export function getManagedEntities(user: User, entities: HierarchicalEntity[]): HierarchicalEntity[] {
  if (!user) return [];
  if (user.role === 'dg') return entities;

  return entities.filter(e => {
    // Si l'utilisateur est le manager direct
    if (e.managerName && e.managerName.toLowerCase().includes(user.name.toLowerCase())) return true;
    if (e.managerEmail && e.managerEmail.toLowerCase() === user.email.toLowerCase()) return true;

    // Si l'utilisateur appartient à cette entité ou la supervise
    if (user.departementId === e.id) return true;
    if (user.directionId === e.id) return true;
    if (user.divisionId === e.id) return true;
    if (user.serviceId === e.id) return true;

    return false;
  });
}

/**
 * Parse une saisie de matricule(s) (simple ou groupe séparé par virgule, point-virgule ou espace)
 * et résout les agents correspondants dans la base des utilisateurs
 */
export function resolveAgentsByMatricules(
  input: string,
  users: User[]
): { matchedAgents: User[]; notFoundMatricules: string[] } {
  if (!input || !input.trim()) {
    return { matchedAgents: [], notFoundMatricules: [] };
  }

  // Séparation par virgule, point-virgule ou retours à la ligne
  const rawTokens = input
    .split(/[,;\n\r]+/)
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);

  const matchedAgents: User[] = [];
  const notFoundMatricules: string[] = [];

  rawTokens.forEach(token => {
    // Recherche par matricule exact ou matricule sans tiret ou email ou code employé
    const found = users.find(u => {
      const uMat = (u.matricule || '').toUpperCase().trim();
      const uCode = (u.employeeCode || '').toUpperCase().trim();
      const uEmail = (u.email || '').toUpperCase().trim();
      return uMat === token || uCode === token || uEmail === token;
    });

    if (found) {
      if (!matchedAgents.some(a => a.id === found.id)) {
        matchedAgents.push(found);
      }
    } else {
      if (!notFoundMatricules.includes(token)) {
        notFoundMatricules.push(token);
      }
    }
  });

  return { matchedAgents, notFoundMatricules };
}

/**
 * Formate une clé à 10 chiffres avec un espace au milieu pour lisibilité (ex: "84920 18365")
 */
export function format10DigitKey(key: string): string {
  if (!key) return '';
  const clean = key.replace(/\D/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return key;
}

/**
 * Vérifie si une invitation est expirée
 */
export function isInvitationExpired(invitation: EntityInvitation): boolean {
  if (invitation.status === 'expiree' || invitation.status === 'revoquee') return true;
  const expiry = new Date(invitation.expiresAt).getTime();
  const now = Date.now();
  return now > expiry;
}

/**
 * Calcule le temps restant lisible avant expiration
 */
export function formatTimeRemaining(expiresAt: string): { text: string; isExpired: boolean; isUrgent: boolean } {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = expiry - now;

  if (diffMs <= 0) {
    return { text: 'Expirée', isExpired: true, isUrgent: true };
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    return { 
      text: `${diffDays}j ${remainingHours}h restants`, 
      isExpired: false, 
      isUrgent: diffDays < 1 
    };
  }

  if (diffHours > 0) {
    return { 
      text: `${diffHours}h ${diffMinutes}m restants`, 
      isExpired: false, 
      isUrgent: diffHours <= 3 
    };
  }

  return { 
    text: `${diffMinutes} minutes restantes`, 
    isExpired: false, 
    isUrgent: true 
  };
}
