// src/components/stock/StockHubsModule.tsx
// Module « Stocks & Hubs » organisé comme le classeur « Suivi des stocks & transferts inter-sites » :
// tableau de bord, journal des mouvements, transferts, stock par site, rapport de site, suivi mensuel,
// catalogue, sites et paramètres. Les règles de l'application sont conservées : chaque bon passe
// par le circuit de visa avant de toucher au stock, et les droits suivent le module logistique.
import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard, ListOrdered, ArrowLeftRight, Grid3x3, FileSpreadsheet, CalendarRange, Package, MapPin, Settings2, Building2, Warehouse, ArrowLeft, Network,
} from 'lucide-react';
import type {
  HubOrgUnit, HubStockItem, LogisticsHub, LogisticsItem, Organization, StockMovementItem, StockSettings, User,
} from '../../types';
import { isLogisticsManager } from '../../utils/rbac';
import { hubsOfUser, isLateTransfer, isTransfer, movementIssues, negativeKeys } from '../../../shared/stock.mjs';
import { HubPortalDashboard, HubsSupervisionPanel } from './HubPortalPanels';
import { HubOrgChartPanel } from './HubOrgChartPanel';
import { StockDashboardPanel } from './StockDashboardPanel';
import { MovementsPanel } from './MovementsPanel';
import { TransfersPanel } from './TransfersPanel';
import { StockMatrixPanel } from './StockMatrixPanel';
import { SiteReportPanel } from './SiteReportPanel';
import { MonthlyPanel } from './MonthlyPanel';
import { CatalogPanel } from './CatalogPanel';
import { SitesPanel } from './SitesPanel';
import { StockSettingsPanel } from './StockSettingsPanel';

export type StockTab = 'supervision' | 'orgchart' | 'dashboard' | 'movements' | 'transfers' | 'matrix' | 'report' | 'monthly' | 'catalog' | 'sites' | 'settings';

export interface ReceptionInput {
  receivedAt?: string;
  receivedQuantities?: Record<string, number>;
  receivedByName?: string;
  notes?: string;
}

export interface StockModuleProps {
  currentUser: User;
  organization: Organization;
  users?: User[];
  catalog: LogisticsItem[];
  hubs: LogisticsHub[];
  stocks: HubStockItem[];
  movements: StockMovementItem[];
  settings: StockSettings;
  onAddHub: (hub: LogisticsHub) => void;
  onUpdateHub: (hub: LogisticsHub) => void;
  onAddMovement: (mvt: StockMovementItem) => void;
  onApproveMovement: (mvtId: string) => void;
  onReceiveTransfer: (mvtId: string, reception?: ReceptionInput) => void;
  onCancelTransfer: (mvtId: string, reason: string) => void;
  onUpsertCatalogItem: (item: LogisticsItem) => void;
  onUpdateStockSettings: (settings: StockSettings) => void;
  onPrintDocument: (mvt: StockMovementItem, type: 'bes' | 'bss' | 'otih') => void;
  /** Organigrammes internes des hubs, par identifiant de hub. */
  hubOrgs: Record<string, HubOrgUnit[]>;
  onUpdateHubOrg: (hubId: string, units: HubOrgUnit[], summary: string) => void;
  approvalState?: (refId: string) => { canAct: boolean; waiting?: string } | undefined;
}

/** Contexte partagé par les panneaux : droits, date du jour, contrôles. */
export interface StockContext extends StockModuleProps {
  today: string;
  canManage: boolean;
  /** Anomalies de chaque mouvement (colonne « CONTRÔLE »). */
  issuesOf: (m: StockMovementItem) => string[];
  goTo: (tab: StockTab, filter?: string) => void;
  /** Filtre demandé en arrivant sur un onglet (ex. « late » pour les transferts en retard). */
  initialFilter?: string;
  /** Portail ouvert : toutes les vues sont limitées à ce hub. */
  portalHub?: LogisticsHub;
  /** Sites proposés dans les filtres et les saisies (le hub du portail, ou tous). */
  scopeHubs: LogisticsHub[];
  /** Peut saisir des bons : centrale logistique, ou membre de l'équipe du hub ouvert. */
  canCreate: boolean;
}

const TABS: { id: StockTab; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'supervision', label: 'Centrale · Hubs', icon: <Building2 className="w-4 h-4" />, hint: 'Supervision de tous les hubs' },
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="w-4 h-4" />, hint: 'Automatique' },
  { id: 'movements', label: 'Mouvements', icon: <ListOrdered className="w-4 h-4" />, hint: 'À saisir' },
  { id: 'transfers', label: 'Transferts', icon: <ArrowLeftRight className="w-4 h-4" />, hint: 'À saisir' },
  { id: 'matrix', label: 'Stock par site', icon: <Grid3x3 className="w-4 h-4" />, hint: 'Automatique' },
  { id: 'report', label: 'Rapport de site', icon: <FileSpreadsheet className="w-4 h-4" />, hint: 'Site + dates' },
  { id: 'monthly', label: 'Suivi mensuel', icon: <CalendarRange className="w-4 h-4" />, hint: 'Site + année' },
  { id: 'orgchart', label: 'Organigramme du hub', icon: <Network className="w-4 h-4" />, hint: 'Cellules, chefs et membres du hub' },
  { id: 'catalog', label: 'Catalogue', icon: <Package className="w-4 h-4" />, hint: 'Paramétrage' },
  { id: 'sites', label: 'Sites', icon: <MapPin className="w-4 h-4" />, hint: 'Paramétrage' },
  { id: 'settings', label: 'Paramètres', icon: <Settings2 className="w-4 h-4" />, hint: 'Paramétrage' },
];

/** Onglets visibles : la centrale voit tout ; un portail ne montre que les vues de son hub. */
const PORTAL_TABS: StockTab[] = ['dashboard', 'movements', 'transfers', 'matrix', 'report', 'monthly', 'orgchart', 'catalog'];

export const StockHubsModule: React.FC<StockModuleProps> = props => {
  const today = new Date().toLocaleDateString('en-CA');
  const canManage = isLogisticsManager(props.currentUser);
  const myHubs = useMemo(() => hubsOfUser(props.currentUser, props.hubs), [props.currentUser, props.hubs]);
  // Équipe d'un hub : arrive directement sur le portail de son hub. Centrale : arrive sur la supervision.
  const [portalId, setPortalId] = useState<string | undefined>(() => (!canManage && myHubs[0] ? myHubs[0].id : undefined));
  const portalHub = props.hubs.find(h => h.id === portalId);
  const [tab, setTab] = useState<StockTab>(canManage ? 'supervision' : 'dashboard');
  const [filter, setFilter] = useState<string | undefined>();

  const issuesMap = useMemo(() => {
    const negatives = negativeKeys(props.movements, props.settings);
    const ctx = { catalog: props.catalog, hubs: props.hubs, settings: props.settings, negatives };
    const map = new Map<string, string[]>();
    for (const m of props.movements) {
      const issues = movementIssues(m, ctx);
      if (isLateTransfer(m, props.settings, today)) issues.push(`En retard (> ${props.settings.transitAlertDays} j)`);
      map.set(m.id, issues);
    }
    return map;
  }, [props.movements, props.catalog, props.hubs, props.settings, today]);

  const scopeHubs = portalHub ? [portalHub] : canManage ? props.hubs : myHubs;
  const ctx: StockContext = {
    ...props,
    today,
    canManage,
    issuesOf: m => issuesMap.get(m.id) || [],
    goTo: (t, f) => { setTab(t); setFilter(f); },
    initialFilter: filter,
    portalHub,
    scopeHubs,
    canCreate: canManage || (!!portalHub && myHubs.some(h => h.id === portalHub.id)),
  };

  const openPortal = (hubId?: string) => { setPortalId(hubId); setTab(hubId ? 'dashboard' : canManage ? 'supervision' : 'dashboard'); setFilter(undefined); };
  const visible = TABS.filter(t => (portalHub ? PORTAL_TABS.includes(t.id) : t.id !== 'orgchart' && (canManage || t.id !== 'supervision')));
  const inScope = (m: (typeof props.movements)[number]) => !portalHub || m.sourceHubId === portalHub.id || m.destinationHubId === portalHub.id;
  const counts: Partial<Record<StockTab, number>> = {
    movements: props.movements.filter(m => !isTransfer(m) && inScope(m) && (issuesMap.get(m.id) || []).length).length,
    transfers: props.movements.filter(m => isTransfer(m) && m.status === 'en_transit' && (!portalHub || m.destinationHubId === portalHub.id)).length,
  };

  return (
    <div className="space-y-4">
      {portalHub ? (
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-slate-900/80 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center"><Warehouse className="w-6 h-6" /></div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-300">Portail du hub · {portalHub.code}</div>
              <div className="text-lg font-black text-white leading-tight">{portalHub.name}</div>
              <div className="text-[11px] text-slate-300">
                {[portalHub.city, portalHub.province].filter(Boolean).join(' · ')} · Responsable : {portalHub.managerName || '—'} · Équipe : {[portalHub.managerId, ...(portalHub.staffIds || [])].filter((x, i, a) => x && a.indexOf(x) === i).length} personne(s)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(canManage ? props.hubs.length : myHubs.length) > 1 && (
              <select value={portalHub.id} onChange={e => openPortal(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" aria-label="Changer de hub">
                {(canManage ? props.hubs : myHubs).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            )}
            {canManage && (
              <button type="button" onClick={() => openPortal(undefined)} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Retour à la centrale
              </button>
            )}
          </div>
        </div>
      ) : !canManage && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-300">
          Vous n'êtes affecté à l'équipe d'aucun hub : consultation seulement. Demandez à la centrale logistique (onglet Sites) de vous ajouter à l'équipe de votre hub.
        </div>
      )}

      <nav className="flex items-center gap-1.5 overflow-x-auto select-none pb-1" aria-label="Stocks & Hubs">
        {visible.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setFilter(undefined); }}
            title={t.hint}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 border ${
              tab === t.id ? 'bg-amber-500 text-slate-950 border-amber-400 shadow' : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            {t.icon}
            <span>{portalHub && t.id === 'matrix' ? 'Stock du hub' : portalHub && t.id === 'report' ? 'Rapport du hub' : t.label}</span>
            {!!counts[t.id] && (
              <span className={`px-1.5 rounded-full text-[10px] font-mono ${t.id === 'movements' ? 'bg-rose-600 text-white' : 'bg-sky-600 text-white'}`}>{counts[t.id]}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'supervision' && !portalHub && canManage && <HubsSupervisionPanel {...ctx} onOpenPortal={id => openPortal(id)} />}
      {tab === 'dashboard' && (portalHub ? <HubPortalDashboard key={portalHub.id} {...ctx} /> : <StockDashboardPanel {...ctx} />)}
      {tab === 'movements' && <MovementsPanel key={`m-${filter}-${portalId}`} {...ctx} />}
      {tab === 'transfers' && <TransfersPanel key={`t-${filter}-${portalId}`} {...ctx} />}
      {tab === 'matrix' && <StockMatrixPanel key={`x-${portalId}`} {...ctx} />}
      {tab === 'report' && <SiteReportPanel key={`r-${filter}-${portalId}`} {...ctx} />}
      {tab === 'monthly' && <MonthlyPanel key={`y-${portalId}`} {...ctx} />}
      {tab === 'orgchart' && portalHub && <HubOrgChartPanel key={portalHub.id} {...ctx} />}
      {tab === 'catalog' && <CatalogPanel {...ctx} />}
      {tab === 'sites' && !portalHub && <SitesPanel {...ctx} />}
      {tab === 'settings' && !portalHub && <StockSettingsPanel {...ctx} />}
    </div>
  );
};
