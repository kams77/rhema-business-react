// src/lib/exchangeRateModel.ts — taux de change USD/CDF unique pour toute l'application
// (fonctions pures, sans dépendance au navigateur — voir exchangeRate.ts pour les hooks).
//
// Le taux est saisi (et daté) par la finance/RH dans le Système de Paie. Paie, factures, bons de
// commande, rapports logistiques et tableau de bord lisent tous cette même valeur.
export const DEFAULT_EXCHANGE_RATE_USD_CDF = 2850;

export interface ExchangeRateSetting {
  /** Nombre de CDF pour 1 USD. */
  rate: number;
  /** Date (AAAA-MM-JJ) à laquelle le taux a été saisi ; null = valeur par défaut jamais confirmée. */
  date: string | null;
  /** Nom de la personne qui l'a saisi. */
  updatedBy?: string;
}

export const EXCHANGE_RATE_KEY = 'settings.exchangeRate';
export const DEFAULT_EXCHANGE_RATE: ExchangeRateSetting = { rate: DEFAULT_EXCHANGE_RATE_USD_CDF, date: null };

/** Un taux plus vieux que ce nombre de jours est signalé comme à mettre à jour. */
export const EXCHANGE_RATE_MAX_AGE_DAYS = 7;

export function isValidRate(rate: unknown): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && rate < 1_000_000;
}

export function normalizeRateSetting(v: unknown): ExchangeRateSetting {
  if (isValidRate(v)) return { rate: v, date: null }; // ancien format (nombre seul)
  const o = (v && typeof v === 'object' ? v : {}) as Partial<ExchangeRateSetting>;
  return isValidRate(o.rate) ? { rate: o.rate, date: o.date ?? null, updatedBy: o.updatedBy } : DEFAULT_EXCHANGE_RATE;
}

/** Âge du taux en jours (null si jamais confirmé). */
export function rateAgeDays(setting: ExchangeRateSetting, today = new Date()): number | null {
  if (!setting.date) return null;
  const [y, m, d] = setting.date.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((now.getTime() - then.getTime()) / 86_400_000);
}

export function rateStatusLabel(setting: ExchangeRateSetting): string {
  const age = rateAgeDays(setting);
  if (age === null) return 'taux par défaut, à confirmer';
  const [y, m, d] = setting.date!.split('-');
  return `taux du ${d}/${m}/${y}${age > EXCHANGE_RATE_MAX_AGE_DAYS ? ' — à mettre à jour' : ''}`;
}

