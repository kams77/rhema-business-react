// src/lib/exchangeRate.ts — taux de change USD/CDF partagé (hooks React).
import { usePersistentState } from '../hooks/usePersistentState';
import { DEFAULT_EXCHANGE_RATE, EXCHANGE_RATE_KEY, normalizeRateSetting, type ExchangeRateSetting } from './exchangeRateModel';

export * from './exchangeRateModel';

/** Taux partagé (lecture + modification). */
export function useExchangeRate(): [ExchangeRateSetting, (next: ExchangeRateSetting) => void] {
  const [raw, setRaw] = usePersistentState<ExchangeRateSetting>(EXCHANGE_RATE_KEY, DEFAULT_EXCHANGE_RATE, { keepDefaultInApi: true });
  return [normalizeRateSetting(raw), setRaw];
}

/** Taux seul, pour les écrans qui ne font que convertir. */
export function useRate(): number {
  return useExchangeRate()[0].rate;
}
