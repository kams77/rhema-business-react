// src/data/initialInvitationData.ts
import type { EntityInvitation, EntityInvitationNotification } from '../types';

export const initialEntityInvitations: EntityInvitation[] = [
  {
    id: 'inv-2026-001',
    invitationCode: 'INV-2026-001',
    authKey10Digits: '8492017365', // Clé Unique 10 chiffres
    hostEntityId: 'dir-log',
    hostEntityName: 'Direction Logistique & Gestion des Stocks (DOP)',
    hostEntityCode: 'DIR-LOG',
    inviterUserId: 'user-dir-log',
    inviterUserName: 'M. Thomas Owona',
    inviterRoleTitle: 'Directeur Logistique & Gestion des Stocks',
    invitedAgentMatricule: 'MAT-012-TECH',
    invitedAgentId: 'user-agent-tech',
    invitedAgentName: 'Ing. Patrick Nzuzi',
    invitedAgentEmail: 'p.nzuzi@rhemabusiness.com',
    invitedAgentHomeEntity: 'Direction Déploiement Réseaux & VSAT Minier (DIR-VSAT)',
    purpose: 'Audit technique d\'urgence des kits paraboles Ku-Band et supervision des stocks de secours.',
    accessScope: 'operant_delegue',
    validityDurationHours: 48,
    expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    status: 'active',
    notes: 'Habilitation temporaire accordée par la Direction Logistique pour inspection conjointe.'
  },
  {
    id: 'inv-2026-002',
    invitationCode: 'INV-2026-002',
    authKey10Digits: '5183920471', // Clé Unique 10 chiffres
    hostEntityId: 'dept-daf',
    hostEntityName: 'Département Administration Générale & Finances (DAF)',
    hostEntityCode: 'DEPT-DAF',
    inviterUserId: 'user-daf',
    inviterUserName: 'M. Ibrahima Sarr',
    inviterRoleTitle: 'Chef de Département (DAF)',
    invitedAgentMatricule: 'MAT-007-OPS',
    invitedAgentId: 'user-ops',
    invitedAgentName: 'M. Alain Boni',
    invitedAgentEmail: 'operations@rhemabusiness.com',
    invitedAgentHomeEntity: 'Département Opérations Télécoms & Supply Chain (DOP)',
    purpose: 'Comité budgétaire inter-départements & validation des bordereaux d\'engagement fret.',
    accessScope: 'lecture',
    validityDurationHours: 72,
    expiresAt: new Date(Date.now() + 70 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    status: 'active',
    notes: 'Session de revue des comptes prévisionnels 2026.'
  }
];

export const initialInvitationNotifications: EntityInvitationNotification[] = [
  {
    id: 'notif-inv-001',
    recipientUserId: 'user-agent-tech',
    recipientMatricule: 'MAT-012-TECH',
    title: 'Invitation Officielle : Connexion à la Direction Logistique (DIR-LOG)',
    message: 'Vous avez été invité par M. Thomas Owona à vous connecter à l\'entité "Direction Logistique & Gestion des Stocks". Utilisez votre clé d\'authentification unique à 10 chiffres.',
    authKey10Digits: '8492017365',
    hostEntityId: 'dir-log',
    hostEntityName: 'Direction Logistique & Gestion des Stocks (DIR-LOG)',
    inviterName: 'M. Thomas Owona',
    inviterRole: 'Directeur Logistique',
    expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    validityHours: 48,
    purpose: 'Audit technique d\'urgence des kits paraboles Ku-Band et supervision des stocks de secours.',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    invitationId: 'inv-2026-001'
  },
  {
    id: 'notif-inv-002',
    recipientUserId: 'user-ops',
    recipientMatricule: 'MAT-007-OPS',
    title: 'Invitation Officielle : Accès au Département Administration & Finances (DAF)',
    message: 'Le Chef de Département DAF M. Ibrahima Sarr vous a habilité à vous connecter au Département DAF avec la clé unique ci-dessous.',
    authKey10Digits: '5183920471',
    hostEntityId: 'dept-daf',
    hostEntityName: 'Département Administration Générale & Finances (DAF)',
    inviterName: 'M. Ibrahima Sarr',
    inviterRole: 'Chef de Département DAF',
    expiresAt: new Date(Date.now() + 70 * 3600 * 1000).toISOString(),
    validityHours: 72,
    purpose: 'Comité budgétaire inter-départements & validation des bordereaux d\'engagement fret.',
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    invitationId: 'inv-2026-002'
  }
];
