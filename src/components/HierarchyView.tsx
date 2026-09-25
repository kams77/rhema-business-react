// src/components/HierarchyView.tsx
import React, { useState } from 'react';
import type { HierarchicalEntity, Organization, User, EntityLevel, UserRole } from '../types';
import { 
  Building, 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  Plus, 
  Sparkles, 
  SlidersHorizontal, 
  ShieldAlert,
  ChevronRight,
  FolderTree
} from 'lucide-react';
import { isEntityInUserScope } from '../utils/rbac';

interface HierarchyViewProps {
  organization: Organization;
  entities: HierarchicalEntity[];
  currentUser: User;
  users?: User[];
  onAddEntity?: (entity: Omit<HierarchicalEntity, 'id'>) => void;
  onDeleteEntity?: (id: string) => void;
}

export const HierarchyView: React.FC<HierarchyViewProps> = ({
  organization,
  entities = [],
  currentUser,
  onAddEntity = () => {},
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Formulaire d'ajout
  const [newEntity, setNewEntity] = useState({
    name: '',
    code: '',
    level: 'direction' as EntityLevel,
    parentId: 'dept-daf',
    managerName: '',
    managerEmail: '',
    description: '',
  });

  const departements = entities.filter(e => e.level === 'departement');
  const getDirections = (deptId: string) => entities.filter(e => e.level === 'direction' && e.parentId === deptId);
  const getDivisions = (dirId: string) => entities.filter(e => e.level === 'division' && e.parentId === dirId);
  const getServices = (divId: string) => entities.filter(e => e.level === 'service' && e.parentId === divId);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntity.name || !newEntity.code) return;

    onAddEntity({
      name: newEntity.name,
      code: newEntity.code.toUpperCase(),
      level: newEntity.level,
      parentId: newEntity.parentId || undefined,
      organizationId: organization.id,
      managerName: newEntity.managerName || 'Non assigné',
      managerEmail: newEntity.managerEmail || 'contact@rhemabusiness.com',
      managerRole: 'directeur',
      description: newEntity.description || 'Entité rattachée à l’organigramme.',
      agentCount: 5,
    });

    setShowAddModal(false);
    setNewEntity({
      name: '',
      code: '',
      level: 'direction',
      parentId: 'dept-daf',
      managerName: '',
      managerEmail: '',
      description: '',
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. BANNIÈRE SUPÉRIEURE DE L'ORGANISATION (FIDÈLE À LA CAPTURE) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center p-1.5 shadow-md shrink-0">
            <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center font-black text-white text-base">
              RB
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 uppercase tracking-wider border border-blue-500/30">
                🏢 ENTREPRISE
              </span>
              <span className="text-xs text-slate-400 font-mono">
                RCCM/20-A-01120
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mt-1">
              {organization.name}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Identité et logo officiels définis par le Responsable (Junior Monya). Supervision globale par le DG et administration déconcentrée par les chefs d'entités.
            </p>
          </div>
        </div>

        {/* Boutons d'Action Droite */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/30 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Identité & Logo (DG)</span>
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 border border-slate-700 transition"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Politique Structurelle</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Entité</span>
          </button>
        </div>
      </div>

      {/* 2. LES 4 PILULES DE NIVEAU (EXACTES À LA CAPTURE) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Niveau 1 : Départements */}
        <div className="p-3.5 rounded-xl border bg-purple-950/20 border-purple-800/40 text-purple-300">
          <div className="text-[10px] uppercase font-bold tracking-wider">Niveau 1</div>
          <div className="text-sm font-bold flex items-center justify-between mt-1">
            <span>Départements</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-[11px] text-slate-400 mt-1">2 configurés</div>
        </div>

        {/* Niveau 2 : Directions */}
        <div className="p-3.5 rounded-xl border bg-blue-950/20 border-blue-800/40 text-blue-300">
          <div className="text-[10px] uppercase font-bold tracking-wider">Niveau 2</div>
          <div className="text-sm font-bold flex items-center justify-between mt-1">
            <span>Directions</span>
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-[11px] text-slate-400 mt-1">3 configurées</div>
        </div>

        {/* Niveau 3 : Divisions */}
        <div className="p-3.5 rounded-xl border bg-cyan-950/20 border-cyan-800/40 text-cyan-300">
          <div className="text-[10px] uppercase font-bold tracking-wider">Niveau 3</div>
          <div className="text-sm font-bold flex items-center justify-between mt-1">
            <span>Divisions</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-[11px] text-slate-400 mt-1">3 configurées</div>
        </div>

        {/* Niveau 4 : Services & Agents */}
        <div className="p-3.5 rounded-xl border bg-emerald-950/20 border-emerald-800/40 text-emerald-300">
          <div className="text-[10px] uppercase font-bold tracking-wider">Niveau 4</div>
          <div className="text-sm font-bold flex items-center justify-between mt-1">
            <span>Services & Agents</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-[11px] text-slate-400 mt-1">3 configurés</div>
        </div>
      </div>

      {/* 3. CARTE DORÉE DE HAUTE HIÉRARCHIE (DG) */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 p-4.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-base shrink-0">
            DG
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Haute Hiérarchie (Super Utilisateur Global)
              </span>
              <span className="text-xs text-slate-400">Dr. Amadou Diallo & Mme Clarisse Nguema</span>
            </div>
            <h2 className="text-base font-bold text-white mt-0.5">
              Présidence & Direction Générale (PDG / DG / DGA)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Autorité suprême : voit TOUTES les publications du plus bas au plus haut niveau et dispose du pouvoir exclusif de création et révocation de tout agent.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="w-4 h-4" /> Accès universel débloqué
          </span>
        </div>
      </div>

      {/* 4. ARBORESCENCE HIÉRARCHIQUE DES DÉPARTEMENTS */}
      <div className="space-y-6">
        {departements.map((dept) => {
          const hasAccessToDept = isEntityInUserScope(currentUser, dept.id, entities);
          const deptDirections = getDirections(dept.id);

          return (
            <div key={dept.id} className="space-y-3">
              {/* Carte Département */}
              <div className={`p-4 rounded-xl border transition-all ${
                hasAccessToDept 
                  ? 'bg-slate-900/90 border-purple-500/40 shadow-md' 
                  : 'bg-slate-900/40 border-slate-800/80 opacity-90'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold shrink-0 text-sm">
                      DEP
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          DÉPARTEMENT ({dept.code})
                        </span>
                        <span className="text-xs font-semibold text-slate-300">Responsable : {dept.managerName}</span>
                        {hasAccessToDept && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                            ✓ Dans votre périmètre
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white mt-1">{dept.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{dept.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <div className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      {dept.agentCount} Agents
                    </div>
                  </div>
                </div>
              </div>

              {/* Sous-Directions */}
              {deptDirections.length > 0 && (
                <div className="pl-4 sm:pl-8 space-y-3 border-l-2 border-purple-500/20">
                  {deptDirections.map((dir) => {
                    const hasAccessToDir = isEntityInUserScope(currentUser, dir.id, entities);
                    const dirDivisions = getDivisions(dir.id);

                    return (
                      <div key={dir.id} className="space-y-2">
                        {/* Carte Direction */}
                        <div className={`p-3.5 rounded-xl border transition-all ${
                          hasAccessToDir 
                            ? 'bg-slate-900/80 border-blue-500/40' 
                            : 'bg-slate-900/30 border-slate-800 opacity-85'
                        }`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300 text-xs font-bold shrink-0">
                                DIR
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    DIRECTION ({dir.code})
                                  </span>
                                  <span className="text-xs font-medium text-slate-300">Directeur : {dir.managerName}</span>
                                </div>
                                <h4 className="text-xs font-bold text-white mt-0.5">{dir.name}</h4>
                              </div>
                            </div>

                            <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 self-end sm:self-center">
                              {dir.agentCount} collaborateurs
                            </span>
                          </div>
                        </div>

                        {/* Sous-Divisions */}
                        {dirDivisions.length > 0 && (
                          <div className="pl-4 sm:pl-6 space-y-2 border-l-2 border-blue-500/20">
                            {dirDivisions.map((div) => {
                              const hasAccessToDiv = isEntityInUserScope(currentUser, div.id, entities);
                              const divServices = getServices(div.id);

                              return (
                                <div key={div.id} className="space-y-2">
                                  {/* Carte Division */}
                                  <div className="p-3 rounded-lg border bg-slate-900/70 border-cyan-500/40">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                                          DIV
                                        </div>
                                        <div>
                                          <span className="text-[11px] font-semibold text-cyan-300">Division : {div.name}</span>
                                          <span className="text-[11px] text-slate-400 ml-2">Chef : {div.managerName}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Sous-Services */}
                                  {divServices.length > 0 && (
                                    <div className="pl-4 sm:pl-6 space-y-1.5 border-l-2 border-cyan-500/20">
                                      {divServices.map((srv) => (
                                        <div
                                          key={srv.id}
                                          className="p-2.5 rounded-lg border text-xs flex items-center justify-between bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 uppercase">
                                              SRV
                                            </span>
                                            <span className="font-semibold text-slate-200">
                                              Service {srv.name}
                                            </span>
                                            <span className="text-slate-400 text-[11px] ml-1">
                                              Chef de Service : {srv.managerName}
                                            </span>
                                          </div>

                                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                                            Accès sécurisé
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Ajout d'Entité */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> Ajouter une Entité Hiérarchique
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Nom de l'entité *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Direction des Infrastructures Réseaux"
                  value={newEntity.name}
                  onChange={e => setNewEntity({ ...newEntity, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Code Service</label>
                  <input
                    type="text"
                    required
                    placeholder="DIR-INFRA"
                    value={newEntity.code}
                    onChange={e => setNewEntity({ ...newEntity, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Niveau</label>
                  <select
                    value={newEntity.level}
                    onChange={e => setNewEntity({ ...newEntity, level: e.target.value as EntityLevel })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                  >
                    <option value="departement">Département</option>
                    <option value="direction">Direction</option>
                    <option value="division">Division</option>
                    <option value="service">Service</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Responsable désigné</label>
                <input
                  type="text"
                  placeholder="M. Nom du Directeur"
                  value={newEntity.managerName}
                  onChange={e => setNewEntity({ ...newEntity, managerName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow"
                >
                  Enregistrer l'entité
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Politique Structurelle */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" /> Politique Structurelle
            </h3>
            <p className="text-xs text-slate-400">
              L'arborescence à 4 niveaux (Département, Direction, Division, Service) est active et conforme au standard conventionnel OHADA.
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};