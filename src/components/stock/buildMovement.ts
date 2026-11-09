// Construction d'un bon de mouvement ou d'un ordre de transfert à partir du formulaire.
import type { LogisticsHub, LogisticsItem, StockMovementItem, User } from '../../types';
import { contentHashSync } from '../../lib/integrity';
import { TRANSFER_TYPE } from '../../../shared/stock.mjs';
import { parseSerials, type Line } from './LinesEditor';

/** Numéro unique MV-AAAA-##### (ou TR- pour un transfert), croissant dans l'année. */
export function nextNumber(movements: StockMovementItem[], prefix: 'MV' | 'TR', date: string): string {
  const year = date.slice(0, 4);
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const max = movements.reduce((n, m) => {
    const hit = re.exec(m.movementNumber || '');
    return hit ? Math.max(n, Number(hit[1])) : n;
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(5, '0')}`;
}

interface BuildInput {
  movements: StockMovementItem[];
  catalog: LogisticsItem[];
  hubs: LogisticsHub[];
  user: User;
  type: string;
  typeLabel?: string;
  sign?: 1 | -1;
  date: string;
  /** Site source (sortie, transfert) */
  sourceHubId?: string;
  /** Site destination (entrée, transfert) */
  destinationHubId?: string;
  lines: Line[];
  reference: string;
  counterparty?: string;
  notes?: string;
  carrier?: string;
  shippingRef?: string;
}

export function buildMovement(input: BuildInput): StockMovementItem {
  const transfer = input.type === TRANSFER_TYPE;
  const number = nextNumber(input.movements, transfer ? 'TR' : 'MV', input.date);
  const src = input.hubs.find(h => h.id === input.sourceHubId);
  const dst = input.hubs.find(h => h.id === input.destinationHubId);
  const items = input.lines.map(l => {
    const c = input.catalog.find(x => x.id === l.itemId)!;
    const quantity = Number(l.quantity);
    return {
      catalogItemId: c.id,
      sku: c.sku,
      name: c.name,
      quantity,
      unitPriceUSD: c.unitPriceUSD,
      serialNumbers: parseSerials(l.serials),
    };
  });
  const mvt: StockMovementItem = {
    id: `mvt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    movementNumber: number,
    type: input.type,
    sign: transfer ? undefined : input.sign,
    typeLabel: transfer ? 'Transfert inter-sites' : input.typeLabel,
    sourceHubId: transfer || (input.sign ?? 0) < 0 ? src?.id : undefined,
    sourceHubName: transfer || (input.sign ?? 0) < 0 ? src?.name : undefined,
    destinationHubId: transfer || (input.sign ?? 0) > 0 ? dst?.id : undefined,
    destinationHubName: transfer || (input.sign ?? 0) > 0 ? dst?.name : undefined,
    destinationClientSite: !transfer && (input.sign ?? 0) < 0 ? input.counterparty || undefined : undefined,
    counterparty: input.counterparty?.trim() || undefined,
    items,
    totalValueUSD: items.reduce((t, i) => t + i.quantity * i.unitPriceUSD, 0),
    referenceDocumentNumber: input.reference.trim() || number,
    operatorId: input.user.id,
    operatorName: input.user.name,
    operatorRole: input.user.role,
    date: input.date,
    status: 'en_attente_visa',
    electronicSealHash: '',
    notes: (input.notes || '').trim(),
    carrier: input.carrier?.trim() || undefined,
    shippingRef: input.shippingRef?.trim() || undefined,
  };
  // Empreinte SHA-256 du bon (articles, quantités, numéros de série, opérateur).
  mvt.electronicSealHash = contentHashSync({ ...mvt, electronicSealHash: undefined });
  return mvt;
}
