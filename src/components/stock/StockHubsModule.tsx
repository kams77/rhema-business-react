// src/components/stock/StockHubsModule.tsx
// Module « Stocks & Hubs » organisé comme le classeur « Suivi des stocks & transferts inter-sites » :
// tableau de bord, journal des mouvements, transferts, stock par site, rapport de site, suivi mensuel,
// catalogue, sites et paramètres. Les règles de l'application sont conservées : chaque bon passe
// par le circuit de visa avant de toucher au stock, et les droits suivent le module logistique.
import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard, ListOrdered, ArrowLeftRight, Grid3x3, FileSpreadsheet, CalendarRange, Package, MapPin, Settings2,
} from 'lucide-react';
import type {
  HubStockItem, LogisticsHub, LogisticsItem, Organization, StockMovementItem, StockSettings, User,
} from '../../types';
import { isLogisticsManager } from '../../utils/rbac';
import { isLateTransfer, isTransfer, movementIssues, negativeKeys } from '../../../shared/stock.mjs';
import { StockDashboardPanel } from './StockDashboardPanel';
import { MovementsPanel } from './MovementsPanel';
import { TransfersPanel } from './TransfersPanel';
import { StockMatrixPanel } from './StockMatrixPanel';
import { SiteReportPanel } from './SiteReportPanel';
import { MonthlyPanel } from './MonthlyPanel';
import { CatalogPanel } from './CatalogPanel';
import { SitesPanel } from './SitesPanel';
import { StockSettingsPanel } from './StockSettingsPanel';

export type StockTab = 'dashboard' | 'movements' | 'transfers' | 'matrix' | 'report' | 'monthly' | 'catalog' | 'sites' | 'settings';

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
}

const TABS: { id: StockTab; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="w-4 h-4" />, hint: 'Automatique' },
  { id: 'movements', label: 'Mouvements', icon: <ListOrdered className="w-4 h-4" />, hint: 'À saisir' },
  { id: 'transfers', label: 'Transferts', icon: <ArrowLeftRight className="w-4 h-4" />, hint: 'À saisir' },
  { id: 'matrix', label: 'Stock par site', icon: <Grid3x3 className="w-4 h-4" />, hint: 'Automatique' },
  { id: 'report', label: 'Rapport de site', icon: <FileSpreadsheet className="w-4 h-4" />, hint: 'Site + dates' },
  { id: 'monthly', label: 'Suivi mensuel', icon: <CalendarRange className="w-4 h-4" />, hint: 'Site + année' },
  { id: 'catalog', label: 'Catalogue', icon: <Package className="w-4 h-4" />, hint: 'Paramétrage' },
  { id: 'sites', label: 'Sites', icon: <MapPin className="w-4 h-4" />, hint: 'Paramétrage' },
  { id: 'settings', label: 'Paramètres', icon: <Settings2 className="w-4 h-4" />, hint: 'Paramétrage' },
];

export const StockHubsModule: React.FC<StockModuleProps> = props => {
  const [tab, setTab] = useState<StockTab>('dashboard');
  const [filter, setFilter] = useState<string | undefined>();
  const today = new Date().toLocaleDateString('en-CA');
  const canManage = isLogisticsManager(props.currentUser);

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

  const ctx: StockContext = {
    ...props,
    today,
    canManage,
    issuesOf: m => issuesMap.get(m.id) || [],
    goTo: (t, f) => { setTab(t); setFilter(f); },
    initialFilter: filter,
  };

  const counts: Partial<Record<StockTab, number>> = {
    movements: props.movements.filter(m => !isTransfer(m) && (issuesMap.get(m.id) || []).length).length,
    transfers: props.movements.filter(m => isTransfer(m) && m.status === 'en_transit').length,
  };

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 overflow-x-auto select-none pb-1" aria-label="Stocks & Hubs">
        {TABS.map(t => (
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
            <span>{t.label}</span>
            {!!counts[t.id] && (
              <span className={`px-1.5 rounded-full text-[10px] font-mono ${t.id === 'movements' ? 'bg-rose-600 text-white' : 'bg-sky-600 text-white'}`}>{counts[t.id]}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && <StockDashboardPanel {...ctx} />}
      {tab === 'movements' && <MovementsPanel key={`m-${filter}`} {...ctx} />}
      {tab === 'transfers' && <TransfersPanel key={`t-${filter}`} {...ctx} />}
      {tab === 'matrix' && <StockMatrixPanel {...ctx} />}
      {tab === 'report' && <SiteReportPanel key={`r-${filter}`} {...ctx} />}
      {tab === 'monthly' && <MonthlyPanel {...ctx} />}
      {tab === 'catalog' && <CatalogPanel {...ctx} />}
      {tab === 'sites' && <SitesPanel {...ctx} />}
      {tab === 'settings' && <StockSettingsPanel {...ctx} />}
    </div>
  );
};
