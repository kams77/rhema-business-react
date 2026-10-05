// src/components/OrganizationOnboardingWizard.tsx
import React, { useState } from 'react';
import type { Organization, HierarchicalEntity, User, UserRole } from '../types';
import { DEMO_MODE, DEMO_PASSWORD } from '../config';
import { generateTemporaryPassword, validatePasswordStrength } from '../lib/auth';

/** Mot de passe initial d'un compte : celui de la démo, ou un mot de passe provisoire aléatoire. */
const initialPassword = () => (DEMO_MODE ? DEMO_PASSWORD : generateTemporaryPassword());
import { 
  Building2, 
  CheckCircle2, 
  Users, 
  Key, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  Copy, 
  Download, 
  Sparkles, 
  AlertCircle, 
  CreditCard, 
  Briefcase,
  Layers,
  X,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { getRoleBadgeClass, getRoleTitleFr } from '../utils/rbac';

interface OrganizationOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteOnboarding: (data: {
    organization: Organization;
    entities: HierarchicalEntity[];
    users: User[];
  }) => void;
}

export const OrganizationOnboardingWizard: React.FC<OrganizationOnboardingWizardProps> = ({
  isOpen,
  onClose,
  onCompleteOnboarding,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [copiedLogins, setCopiedLogins] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Étape 1 : Formulaire Organisation
  const [orgForm, setOrgForm] = useState({
    name: 'RHEMA BUSINESS RDC',
    code: 'RB-RDC',
    type: 'entreprise' as const,
    rccm: 'CD/KNG/RCCM/20-A-01120',
    idNat: '01-83-N45201L',
    numImpot: 'A1934892Z',
    headquarters: 'N°1B, Av. Bangala, Q/Salongo, C/Kintambo, Kinshasa - RD CONGO',
    email: 'direction@rhemabusiness.cd',
    phone: '+243 81 279 1228',
    bankName: 'Rawbank Kinshasa',
    bankAccount: '01002-39201928019-88',
    description: 'Télécoms, VSAT, Réseaux et Intégration Technologique en RD Congo.',
    dgName: 'Junior Monya',
    dgEmail: 'dg@rhemabusiness.com',
    dgMatricule: 'MAT-2026-001',
    dgPassword: initialPassword(),
  });

  // Étape 2 : Préconfiguration de l'Arborescence Hiérarchique
  const [departments, setDepartments] = useState([
    {
      id: 'dept-daf',
      name: 'Département Administration & Finances (DAF)',
      code: 'DEPT-DAF',
      level: 'departement' as const,
      managerName: 'M. Ibrahima Sarr',
      managerEmail: 'daf@rhemabusiness.com',
      managerRole: 'chef_departement' as const,
    },
    {
      id: 'dept-ops',
      name: 'Département Opérations Télécoms & VSAT (DOP)',
      code: 'DEPT-OPS',
      level: 'departement' as const,
      managerName: 'M. Alain Boni',
      managerEmail: 'operations@rhemabusiness.com',
      managerRole: 'chef_departement' as const,
    }
  ]);

  // Étape 3 : Liste des Agents à connecter obligatoirement
  const [agentsList, setAgentsList] = useState<Array<{
    id: string;
    name: string;
    matricule: string;
    email: string;
    password: string;
    role: UserRole;
    roleTitle: string;
    entityName: string;
    departementId?: string;
    directionId?: string;
    divisionId?: string;
    serviceId?: string;
    canApproveServiceDocuments?: boolean;
    connectedStatus: 'pret' | 'actif';
  }>>([
    {
      id: 'usr-dg',
      name: 'Junior Monya',
      matricule: 'MAT-2026-001',
      email: 'dg@rhemabusiness.com',
      password: initialPassword(),
      role: 'dg',
      roleTitle: 'Directeur Général (DG)',
      entityName: 'Direction Générale',
      connectedStatus: 'pret',
    },
    {
      id: 'usr-daf',
      name: 'M. Ibrahima Sarr',
      matricule: 'MAT-2026-002',
      email: 'daf@rhemabusiness.com',
      password: initialPassword(),
      role: 'chef_departement',
      roleTitle: 'Chef de Département DAF',
      departementId: 'dept-daf',
      entityName: 'Département DAF',
      connectedStatus: 'pret',
    },
    {
      id: 'usr-dop',
      name: 'M. Alain Boni',
      matricule: 'MAT-2026-003',
      email: 'operations@rhemabusiness.com',
      password: initialPassword(),
      role: 'chef_departement',
      roleTitle: 'Chef de Département DOP',
      departementId: 'dept-ops',
      entityName: 'Département Opérations',
      connectedStatus: 'pret',
    },
    {
      id: 'usr-drh',
      name: 'M. Jean-Paul Kouassi',
      matricule: 'MAT-2026-004',
      email: 'drh@rhemabusiness.com',
      password: initialPassword(),
      role: 'directeur',
      roleTitle: 'Directeur des Ressources Humaines (DRH)',
      departementId: 'dept-daf',
      directionId: 'dir-rh',
      entityName: 'Direction des Ressources Humaines',
      connectedStatus: 'pret',
    },
    {
      id: 'usr-compta',
      name: 'Mme Sophie Traoré',
      matricule: 'MAT-2026-005',
      email: 'compta@rhemabusiness.com',
      password: initialPassword(),
      role: 'chef_service',
      roleTitle: 'Chef de Service Comptabilité & Trésorerie',
      departementId: 'dept-daf',
      serviceId: 'serv-compta',
      entityName: 'Service Comptabilité',
      connectedStatus: 'pret',
    },
    {
      id: 'usr-vsat-field',
      name: 'M. Eric Ndong',
      matricule: 'MAT-2026-006',
      email: 'vsat@rhemabusiness.com',
      password: initialPassword(),
      role: 'agent',
      roleTitle: 'Ingénieur Terrain VSAT & Faisceaux',
      departementId: 'dept-ops',
      serviceId: 'serv-vsat',
      entityName: 'Service Déploiement VSAT',
      canApproveServiceDocuments: true, // Avec délégation pour visa de bons d'intervention
      connectedStatus: 'pret',
    },
    {
      id: 'usr-agent-support',
      name: 'Mlle Claire Mwamba',
      matricule: 'MAT-2026-007',
      email: 'support@rhemabusiness.com',
      password: initialPassword(),
      role: 'agent',
      roleTitle: 'Agent Support Opérationnel',
      departementId: 'dept-ops',
      serviceId: 'serv-support',
      entityName: 'Service Support & Supervision',
      canApproveServiceDocuments: false, // Pas de délégation
      connectedStatus: 'pret',
    }
  ]);

  if (!isOpen) return null;

  const copyAllCredentials = () => {
    const text = agentsList.map(a => 
      `• ${a.name} (${getRoleTitleFr(a.role)})\n  Matricule : ${a.matricule} | Email / Login : ${a.email} | Mot de passe : ${a.role === 'dg' ? orgForm.dgPassword : a.password} | Périmètre : ${a.entityName}`
    ).join('\n\n');

    navigator.clipboard.writeText(
      `ANNUAIRE OFFICIEL DE CONNECTIVITÉ ERP - ${orgForm.name}\n` +
      `Généré le ${new Date().toLocaleDateString('fr-FR')}\n\n` +
      text
    );
    setCopiedLogins(true);
    setTimeout(() => setCopiedLogins(false), 3000);
  };

  const handleFinish = () => {
    const orgId = `org-${Date.now()}`;
    const newOrg: Organization = {
      id: orgId,
      name: orgForm.name,
      code: orgForm.code,
      type: orgForm.type,
      registrationNumber: orgForm.rccm,
      rccm: orgForm.rccm,
      idNat: orgForm.idNat,
      numImpot: orgForm.numImpot,
      headquarters: orgForm.headquarters,
      email: orgForm.email,
      phone: orgForm.phone,
      managerName: orgForm.dgName,
      managerRole: 'Directeur Général (DG)',
      directorGeneral: orgForm.dgName,
      hasDepartements: true,
      hasDirections: true,
      hasDivisions: true,
      hasServices: true,
      description: orgForm.description,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const finalEntities: HierarchicalEntity[] = [
      ...departments.map(d => ({
        ...d,
        organizationId: orgId,
        agentCount: 15
      })),
      {
        id: 'dir-rh',
        name: 'Direction des Ressources Humaines (DRH)',
        code: 'DIR-RH',
        level: 'direction' as const,
        parentId: 'dept-daf',
        organizationId: orgId,
        managerName: 'M. Jean-Paul Kouassi',
        managerRole: 'directeur' as const,
        agentCount: 5
      },
      {
        id: 'serv-compta',
        name: 'Service Comptabilité & Trésorerie',
        code: 'SERV-COMPTA',
        level: 'service' as const,
        parentId: 'dept-daf',
        organizationId: orgId,
        managerName: 'Mme Sophie Traoré',
        managerRole: 'chef_service' as const,
        agentCount: 4
      },
      {
        id: 'serv-vsat',
        name: 'Service Déploiement VSAT & Chantiers Miniers',
        code: 'SERV-VSAT',
        level: 'service' as const,
        parentId: 'dept-ops',
        organizationId: orgId,
        agentCount: 8
      },
      {
        id: 'serv-support',
        name: 'Service Support & Supervision NOC 24/7',
        code: 'SERV-NOC',
        level: 'service' as const,
        parentId: 'dept-ops',
        organizationId: orgId,
        agentCount: 6
      }
    ];

    // Le compte DG reprend l'identité saisie à l'étape 1 (nom, email, matricule, mot de passe).
    const finalUsers: User[] = agentsList.map(a => ({
      id: a.id,
      name: a.role === 'dg' ? orgForm.dgName.trim() || a.name : a.name,
      email: a.role === 'dg' ? orgForm.dgEmail.trim() || a.email : a.email,
      matricule: a.role === 'dg' ? orgForm.dgMatricule.trim() || a.matricule : a.matricule,
      employeeCode: a.role === 'dg' ? orgForm.dgMatricule.trim() || a.matricule : a.matricule,
      // Le compte DG reçoit le mot de passe saisi à l'étape 1.
      password: a.role === 'dg' ? orgForm.dgPassword : a.password,
      // En production, tout mot de passe provisoire ou faible doit être changé à la 1re connexion.
      mustChangePassword: !DEMO_MODE && (a.role !== 'dg' || validatePasswordStrength(orgForm.dgPassword) !== null),
      role: a.role,
      roleTitle: a.roleTitle,
      organizationId: orgId,
      departmentName: a.entityName,
      departementId: a.departementId,
      directionId: a.directionId,
      divisionId: a.divisionId,
      serviceId: a.serviceId,
      canApproveServiceDocuments: a.canApproveServiceDocuments || false,
      status: 'actif',
      failedAccessAttempts: 0,
      canCreateSubAgents: a.role === 'dg' || a.role === 'chef_departement',
    }));

    onCompleteOnboarding({
      organization: newOrg,
      entities: finalEntities,
      users: finalUsers,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* En-tête Wizard */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-lg font-black text-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Assistant Déploiement & Première Utilisation</h2>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-500/30">
                  Étape {step} / 4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Création de l'Organisation & Connectivité Obligatoire de Tous les Agents
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barre de progression des 4 étapes */}
        <div className="grid grid-cols-4 border-b border-slate-800 text-xs font-semibold text-center bg-slate-950/40">
          <div className={`p-3 border-r border-slate-800 transition ${step === 1 ? 'bg-indigo-600/20 text-indigo-300 font-bold border-b-2 border-b-indigo-500' : 'text-slate-500'}`}>
            1. Organisation & Légal
          </div>
          <div className={`p-3 border-r border-slate-800 transition ${step === 2 ? 'bg-indigo-600/20 text-indigo-300 font-bold border-b-2 border-b-indigo-500' : 'text-slate-500'}`}>
            2. Arborescence & Postes
          </div>
          <div className={`p-3 border-r border-slate-800 transition ${step === 3 ? 'bg-indigo-600/20 text-indigo-300 font-bold border-b-2 border-b-indigo-500' : 'text-slate-500'}`}>
            3. Logins Obligatoires Agents
          </div>
          <div className={`p-3 transition ${step === 4 ? 'bg-indigo-600/20 text-indigo-300 font-bold border-b-2 border-b-indigo-500' : 'text-slate-500'}`}>
            4. Déploiement & Connexion
          </div>
        </div>

        {/* CONTENU SELON L'ÉTAPE */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ÉTAPE 1 : IDENTITÉ & ENREGISTREMENT LÉGAL */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 text-xs text-indigo-200 flex items-start gap-3">
                <Building2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-sm">Déclaration de l'Organisation Principale</h4>
                  <p className="mt-1 leading-relaxed text-indigo-200/90">
                    Renseignez les éléments officiels d'immatriculation en RD Congo. Ces données seront intégrées obligatoirement dans les en-têtes et filigranes certifiés de tous les documents émis par l'ERP.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Dénomination Sociale de l'Entreprise</label>
                  <input
                    type="text"
                    value={orgForm.name}
                    onChange={e => setOrgForm({ ...orgForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-bold"
                    placeholder="Ex: RHEMA BUSINESS RDC"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Code / Sigle Abrégé</label>
                  <input
                    type="text"
                    value={orgForm.code}
                    onChange={e => setOrgForm({ ...orgForm, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono uppercase"
                    placeholder="RB-RDC"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Numéro RCCM (Greffe Commercial)</label>
                  <input
                    type="text"
                    value={orgForm.rccm}
                    onChange={e => setOrgForm({ ...orgForm, rccm: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono"
                    placeholder="CD/KNG/RCCM/20-A-01120"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Identification Nationale (Id. Nat)</label>
                  <input
                    type="text"
                    value={orgForm.idNat}
                    onChange={e => setOrgForm({ ...orgForm, idNat: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono"
                    placeholder="01-83-N45201L"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Numéro Impôt (DGI)</label>
                  <input
                    type="text"
                    value={orgForm.numImpot}
                    onChange={e => setOrgForm({ ...orgForm, numImpot: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono"
                    placeholder="A1934892Z"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Banque Principale & N° Compte (Virements Paie)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={orgForm.bankName}
                      onChange={e => setOrgForm({ ...orgForm, bankName: e.target.value })}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      placeholder="Rawbank"
                    />
                    <input
                      type="text"
                      value={orgForm.bankAccount}
                      onChange={e => setOrgForm({ ...orgForm, bankAccount: e.target.value })}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      placeholder="01002-3920..."
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Siège Social & Adresse d'Exploitation</label>
                  <input
                    type="text"
                    value={orgForm.headquarters}
                    onChange={e => setOrgForm({ ...orgForm, headquarters: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white"
                    placeholder="Avenue Bangala, Kinshasa - RD CONGO"
                  />
                </div>
              </div>

              {/* Compte Directeur Général */}
              <div className="border-t border-slate-800 pt-4 mt-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Compte Administrateur / Directeur Général (DG - Plein Pouvoir)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-slate-300 block mb-1">Nom du Directeur Général</label>
                    <input
                      type="text"
                      value={orgForm.dgName}
                      onChange={e => setOrgForm({ ...orgForm, dgName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">Email / Identifiant DG</label>
                    <input
                      type="email"
                      value={orgForm.dgEmail}
                      onChange={e => setOrgForm({ ...orgForm, dgEmail: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">Mot de passe Administrateur</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={orgForm.dgPassword}
                        onChange={e => setOrgForm({ ...orgForm, dgPassword: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 : ARBORESCENCE & DÉPARTEMENTS */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-sky-950/40 border border-sky-500/30 rounded-2xl p-4 text-xs text-sky-200 flex items-start gap-3">
                <Layers className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-sm">Hiérarchie des 4 Niveaux Organisationnels</h4>
                  <p className="mt-1 leading-relaxed text-sky-200/90">
                    L'architecture RHEMA garantit la stricte étanchéité des responsabilités : Département ➔ Direction ➔ Division ➔ Service.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {departments.map((dept, idx) => (
                  <div key={dept.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-white text-sm">{dept.name}</h4>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-bold">
                        {dept.code}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-900">
                      <div>
                        <span className="text-slate-500 block">Chef de Département :</span>
                        <span className="text-slate-200 font-semibold">{dept.managerName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Email de notification :</span>
                        <span className="text-slate-300 font-mono">{dept.managerEmail}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-2">
                <h5 className="font-bold text-white">Sous-entités créées automatiquement sous chaque département :</h5>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                  <li><strong>Sous DAF</strong> : Direction des Ressources Humaines (DRH) & Service Comptabilité / Trésorerie</li>
                  <li><strong>Sous DOP</strong> : Service Déploiement VSAT & Chantiers Miniers + Service Support NOC 24/7</li>
                </ul>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 : OBLIGATION DE CONNECTIVITÉ DE TOUS LES AGENTS */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-200 flex items-start gap-3">
                <Key className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-sm">Génération Obligatoire des Accès Logins de TOUS les Agents</h4>
                  <p className="mt-1 leading-relaxed text-emerald-200/90">
                    Conformément aux règles strictes, chaque agent de l'organisation reçoit obligatoirement son Matricule et ses identifiants pour se connecter à son espace personnel via le portail de Login.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>{agentsList.length} Comptes Agents Déployés avec Connectivité Active</span>
                </div>

                <button
                  onClick={copyAllCredentials}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLogins ? 'Tous les accès copiés !' : 'Copier Tous les Logins'}</span>
                </button>
              </div>

              {/* Tableau de bord des Logins des Agents */}
              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Matricule</th>
                      <th className="p-3">Collaborateur</th>
                      <th className="p-3">Identifiant / Login</th>
                      <th className="p-3">Mot de Passe</th>
                      <th className="p-3">Rôle Hiérarchique Strict</th>
                      <th className="p-3">Délégation Visa</th>
                      <th className="p-3 text-center">Connectivité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {agentsList.map(a => (
                      <tr key={a.id} className="hover:bg-slate-900/40 transition">
                        <td className="p-3 text-indigo-400 font-bold">{a.matricule}</td>
                        <td className="p-3 font-sans text-white font-semibold">
                          <div>{a.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono font-normal">{a.roleTitle}</div>
                        </td>
                        <td className="p-3 text-slate-200">{a.email}</td>
                        <td className="p-3 text-amber-300 font-bold bg-slate-900/40 px-2 rounded">
                          {a.role === 'dg' ? orgForm.dgPassword : a.password}
                        </td>
                        <td className="p-3 font-sans">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${getRoleBadgeClass(a.role)}`}>
                            {getRoleTitleFr(a.role)}
                          </span>
                        </td>
                        <td className="p-3 font-sans text-[11px]">
                          {a.role === 'agent' ? (
                            a.canApproveServiceDocuments ? (
                              <span className="text-emerald-400 font-bold">✓ Délégation Accordée</span>
                            ) : (
                              <span className="text-slate-500">Exécution pure</span>
                            )
                          ) : (
                            <span className="text-sky-400 font-medium">Titulaire Pouvoir</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>Prêt Login</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ÉTAPE 4 : DÉPLOIEMENT & VALIDATION FINALE */}
          {step === 4 && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border-2 border-emerald-500/40 shadow-xl">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">Organisation & Connectivité Prêtes pour Déploiement</h3>
                <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1 leading-relaxed">
                  L'organisation <strong>{orgForm.name}</strong> a été enregistrée avec ses matricules légaux (RCCM: {orgForm.rccm}) et tous les comptes collaborateurs sont configurés avec leurs identifiants de connexion.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left text-xs">
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Plein Pouvoir DG</span>
                  <span className="font-bold text-white text-sm mt-0.5 block">{orgForm.dgName}</span>
                  <span className="text-[11px] text-purple-300 font-mono">{orgForm.dgEmail}</span>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Agents Enrôlés</span>
                  <span className="font-bold text-emerald-400 text-sm mt-0.5 block">{agentsList.length} Comptes Prêts</span>
                  <span className="text-[11px] text-slate-400 font-mono">Accès individuels créés</span>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Banque Principale</span>
                  <span className="font-bold text-indigo-400 text-sm mt-0.5 block">{orgForm.bankName}</span>
                  <span className="text-[11px] text-slate-400 font-mono truncate block">{orgForm.bankAccount}</span>
                </div>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 max-w-2xl mx-auto text-left text-xs space-y-1">
                <h5 className="font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Règles de Confidentialité Activées Immédiatement :</span>
                </h5>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Chaque agent qui se connectera via son Login ne verra que son périmètre strict. Le DG bénéficie du contrôle absolu sur tous les départements, documents et flux financiers.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* PIED DE MODALE (NAVIGATION WIZARD) */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((step - 1) as any)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Précédent</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
            >
              Annuler
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as any)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg active:scale-95"
              >
                <span>Continuer vers Étape {step + 1}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Déployer l'Organisation & Connecter les Agents</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
