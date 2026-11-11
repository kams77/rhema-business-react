// shared/stock.mjs — moteur de stock multi-sites (règles communes serveur / navigateur).
//
// Logique du classeur « Suivi des stocks & transferts inter-sites » :
//   Stock d'un Site = (entrées − sorties validées)  +  (transferts REÇUS)  −  (transferts ENVOYÉS, hors annulés)
// - Un mouvement (entrée ou sortie) a un type configurable avec un sens (+1 entrée, −1 sortie).
// - Un transfert diminue le stock du Site source dès l'envoi (bon validé → « En transit ») et
//   augmente celui du Site destination à la réception, de la quantité réellement reçue.
// - Rien ne bouge tant que le bon n'est pas validé par le circuit de visa (règle de l'application).
// - Contrôles : stock négatif, source = destination, réception avant envoi, reçu > envoyé,
//   transfert en retard (délai d'alerte), article ou site inconnu, quantité invalide.
// Écrit en JavaScript pur pour être lu par Node sans compilation.

export const TRANSFER_TYPE = 'transfert_inter_hub';

/** Types de mouvement par défaut (modifiables dans les paramètres du module). */
export const DEFAULT_MOVEMENT_TYPES = [
  { id: 'stock_initial', label: 'Stock initial', sign: 1, active: true, builtin: true },
  { id: 'entree_fournisseur', label: 'Entrée – Réception fournisseur', sign: 1, active: true, builtin: true },
  { id: 'entree_retour_client', label: 'Entrée – Retour client', sign: 1, active: true, builtin: true },
  { id: 'ajustement_plus', label: 'Entrée – Ajustement inventaire (+)', sign: 1, active: true, builtin: true },
  { id: 'sortie_vente', label: 'Sortie – Vente client', sign: -1, active: true, builtin: true },
  { id: 'sortie_deploiement', label: 'Sortie – Installation / Déploiement', sign: -1, active: true, builtin: true },
  { id: 'sortie_sav', label: 'Sortie – SAV / Remplacement garantie', sign: -1, active: true, builtin: true },
  { id: 'sortie_perte', label: 'Sortie – Perte / Casse / Vol', sign: -1, active: true, builtin: true },
  { id: 'ajustement_moins', label: 'Sortie – Ajustement inventaire (–)', sign: -1, active: true, builtin: true },
];

/** Catégories d'articles (les 3 familles du catalogue) et leur libellé modifiable. */
export const DEFAULT_CATEGORY_LABELS = {
  vsat: 'VSAT & Télécoms',
  energie_solaire: 'Énergie solaire',
  hybride: 'Hybride & Accessoires',
};

export const LEDGER_VERSION = 2;

export const DEFAULT_STOCK_SETTINGS = {
  movementTypes: DEFAULT_MOVEMENT_TYPES,
  categoryLabels: DEFAULT_CATEGORY_LABELS,
  transitAlertDays: 15,
  currency: 'USD',
  ledgerVersion: LEDGER_VERSION,
};

/** Réglages complétés par les valeurs par défaut. @param {any} s */
export function stockSettings(s) {
  const base = s && typeof s === 'object' ? s : {};
  const types = Array.isArray(base.movementTypes) && base.movementTypes.length ? base.movementTypes : DEFAULT_MOVEMENT_TYPES;
  return {
    ...DEFAULT_STOCK_SETTINGS,
    ...base,
    movementTypes: types,
    categoryLabels: { ...DEFAULT_CATEGORY_LABELS, ...(base.categoryLabels || {}) },
    transitAlertDays: Number.isFinite(base.transitAlertDays) && base.transitAlertDays > 0 ? base.transitAlertDays : 15,
  };
}

/** « solaire » est l'ancien nom de la famille « energie_solaire ». @param {string} c */
export const normalizeCategory = c => (c === 'solaire' ? 'energie_solaire' : c || 'vsat');

/** Anciens types (avant le journal) : sens connu. */
const LEGACY_SIGNS = { entree_fournisseur: 1, sortie_deploiement: -1, reception_transfert: 0, ajustement_inventaire: 0 };

export const isTransfer = m => !!m && m.type === TRANSFER_TYPE;

/** Sens d'un mouvement : +1 entrée, −1 sortie, 0 sans effet. @param {any} m @param {any} settings */
export function movementSign(m, settings) {
  if (!m || isTransfer(m)) return 0;
  if (m.sign === 1 || m.sign === -1) return m.sign;
  const t = stockSettings(settings).movementTypes.find(x => x.id === m.type);
  if (t) return t.sign === -1 ? -1 : 1;
  return LEGACY_SIGNS[m.type] ?? 0;
}

/** Site concerné par une entrée (destination) ou une sortie (source). */
export function movementHub(m, settings) {
  const sign = movementSign(m, settings);
  return sign > 0 ? m.destinationHubId : sign < 0 ? m.sourceHubId : undefined;
}

/** Libellé du type. */
export function movementTypeLabel(m, settings) {
  if (isTransfer(m)) return 'Transfert inter-sites';
  if (m.typeLabel) return m.typeLabel;
  const t = stockSettings(settings).movementTypes.find(x => x.id === m.type);
  if (t) return t.label;
  return { reception_transfert: 'Réception de transfert', ajustement_inventaire: 'Ajustement inventaire' }[m.type] || m.type;
}

/** Quantité retenue à la réception (quantité reçue si elle diffère, sinon quantité envoyée). */
export function receivedQty(m, item) {
  const r = m.receivedQuantities?.[item.catalogItemId];
  return Number.isFinite(r) ? r : item.quantity;
}

const day = v => (typeof v === 'string' ? v.slice(0, 10) : '');
/** Date d'envoi d'un transfert (mise en transit), sinon date du bon. */
export const sentDay = m => day(m.sentAt) || day(m.approvedAt) || day(m.date);
/** Date d'effet d'une entrée / sortie. */
export const movementDay = m => day(m.date);

const key = (hubId, itemId) => `${hubId}|${itemId}`;
const add = (map, k, v) => map.set(k, (map.get(k) || 0) + v);

/**
 * Effets d'un mouvement sur les stocks, datés : [{ hubId, itemId, qty, day, kind }].
 * kind : 'entree' | 'sortie' | 'transfert_envoye' | 'transfert_recu' | 'reprise'.
 * Les mouvements déjà compris dans la reprise du stock (openingIncluded) ne comptent pas deux fois.
 */
export function movementEffects(m, settings) {
  const out = [];
  if (!m || !Array.isArray(m.items)) return out;
  const opening = m.openingIncluded; // 'all' | 'source' | undefined
  if (isTransfer(m)) {
    const sent = ['en_transit', 'receptionne'].includes(m.status);
    for (const it of m.items) {
      if (sent && m.sourceHubId && !opening) out.push({ hubId: m.sourceHubId, itemId: it.catalogItemId, qty: -it.quantity, day: sentDay(m), kind: 'transfert_envoye' });
      if (m.status === 'receptionne' && m.destinationHubId && opening !== 'all') {
        out.push({ hubId: m.destinationHubId, itemId: it.catalogItemId, qty: receivedQty(m, it), day: day(m.receivedAt) || sentDay(m), kind: 'transfert_recu' });
      }
      // Transfert repris « en transit » puis annulé : la source récupère sa marchandise.
      if (m.status === 'annule' && opening === 'source' && m.sourceHubId) {
        out.push({ hubId: m.sourceHubId, itemId: it.catalogItemId, qty: it.quantity, day: day(m.cancelledAt) || sentDay(m), kind: 'reprise' });
      }
    }
    return out;
  }
  if (m.status !== 'valide' || opening) return out;
  const sign = movementSign(m, settings);
  const hubId = movementHub(m, settings);
  if (!sign || !hubId) return out;
  for (const it of m.items) out.push({ hubId, itemId: it.catalogItemId, qty: sign * it.quantity, day: movementDay(m), kind: sign > 0 ? 'entree' : 'sortie' });
  return out;
}

/**
 * Soldes par Site et par article, et quantités en transit vers chaque Site.
 * @param {any[]} movements @param {any} settings @param {{ until?: string, before?: string }} [opts]
 * until : effets jusqu'à ce jour inclus ; before : effets strictement avant ce jour.
 */
export function computeBalances(movements, settings, opts = {}) {
  const balances = new Map();
  const transit = new Map();
  for (const m of movements || []) {
    for (const e of movementEffects(m, settings)) {
      if (opts.until && e.day > opts.until) continue;
      if (opts.before && e.day >= opts.before) continue;
      add(balances, key(e.hubId, e.itemId), e.qty);
    }
    if (isTransfer(m) && m.status === 'en_transit' && m.destinationHubId) {
      for (const it of m.items || []) add(transit, key(m.destinationHubId, it.catalogItemId), it.quantity);
    }
  }
  return { balances, transit, get: (hubId, itemId) => balances.get(key(hubId, itemId)) || 0, inTransit: (hubId, itemId) => transit.get(key(hubId, itemId)) || 0 };
}

/** Sorties et transferts encore au visa, par Site et article (stock « réservé »). */
export function pendingOutgoing(movements, settings) {
  const map = new Map();
  for (const m of movements || []) {
    if (m.status !== 'en_attente_visa' || m.openingIncluded) continue;
    const hubId = isTransfer(m) ? m.sourceHubId : movementSign(m, settings) < 0 ? m.sourceHubId : undefined;
    if (!hubId) continue;
    for (const it of m.items || []) add(map, key(hubId, it.catalogItemId), it.quantity);
  }
  return { get: (hubId, itemId) => map.get(key(hubId, itemId)) || 0 };
}

/** Quantité disponible pour une nouvelle sortie / un nouveau transfert (stock − bons en attente). */
export function availableForExit(movements, settings, hubId, itemId) {
  return computeBalances(movements, settings).get(hubId, itemId) - pendingOutgoing(movements, settings).get(hubId, itemId);
}

/** Couples (Site, article) en stock négatif. @returns {{ hubId: string, itemId: string, qty: number }[]} */
export function negativeBalances(movements, settings) {
  const { balances } = computeBalances(movements, settings);
  const out = [];
  for (const [k, qty] of balances) {
    if (qty < 0) {
      const [hubId, itemId] = k.split('|');
      out.push({ hubId, itemId, qty });
    }
  }
  return out;
}

/** Nombre de jours entiers entre deux jours AAAA-MM-JJ. */
export const daysBetween = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** Jours de transit : jusqu'à la réception, sinon jusqu'à aujourd'hui. */
export function transitDays(m, today) {
  if (!isTransfer(m) || !['en_transit', 'receptionne'].includes(m.status)) return null;
  const from = sentDay(m);
  if (!from) return null;
  return daysBetween(from, m.status === 'receptionne' ? day(m.receivedAt) || today : today);
}

/** Transfert en retard : toujours en transit au-delà du délai d'alerte. */
export const isLateTransfer = (m, settings, today) =>
  isTransfer(m) && m.status === 'en_transit' && (transitDays(m, today) ?? 0) > stockSettings(settings).transitAlertDays;

/** Écart d'un transfert reçu (envoyé − reçu), par article. */
export function transferGap(m) {
  if (!isTransfer(m) || m.status !== 'receptionne') return 0;
  return (m.items || []).reduce((sum, it) => sum + (it.quantity - receivedQty(m, it)), 0);
}

/**
 * Contrôle d'un mouvement (colonne « CONTRÔLE » du classeur) : liste des anomalies, vide si OK.
 * @param {any} m @param {{ catalog: any[], hubs: any[], settings: any, negatives?: Set<string> }} ctx
 */
export function movementIssues(m, ctx) {
  const issues = [];
  const hubIds = new Set((ctx.hubs || []).map(h => h.id));
  const itemIds = new Set((ctx.catalog || []).map(c => c.id));
  if (!m.date) issues.push('Date manquante');
  if (!Array.isArray(m.items) || m.items.length === 0) issues.push('Article manquant');
  for (const it of m.items || []) {
    if (!it.catalogItemId || (itemIds.size && !itemIds.has(it.catalogItemId))) issues.push(`Article inconnu (${it.sku || it.name || '?'})`);
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) issues.push(`Quantité invalide (${it.sku || it.name || '?'})`);
  }
  if (isTransfer(m)) {
    if (!m.sourceHubId) issues.push('Site source manquant');
    if (!m.destinationHubId) issues.push('Site destination manquant');
    if (m.sourceHubId && m.sourceHubId === m.destinationHubId) issues.push('Source = Destination');
    if (m.sourceHubId && hubIds.size && !hubIds.has(m.sourceHubId)) issues.push('Site source inconnu');
    if (m.destinationHubId && hubIds.size && !hubIds.has(m.destinationHubId)) issues.push('Site destination inconnu');
    if (m.status === 'receptionne') {
      if (!m.receivedAt) issues.push('Date de réception manquante');
      else if (sentDay(m) && day(m.receivedAt) < sentDay(m)) issues.push('Réception avant envoi');
      for (const it of m.items || []) if (receivedQty(m, it) > it.quantity) issues.push(`Reçu > Envoyé (${it.sku || it.name})`);
      for (const it of m.items || []) if (receivedQty(m, it) < 0 || !Number.isInteger(receivedQty(m, it))) issues.push(`Quantité reçue invalide (${it.sku || it.name})`);
    }
  } else {
    const sign = movementSign(m, ctx.settings);
    if (!sign && !LEGACY_SIGNS.hasOwnProperty(m.type)) issues.push('Type inconnu');
    const hubId = movementHub(m, ctx.settings);
    if (sign && !hubId) issues.push('Site manquant');
    if (hubId && hubIds.size && !hubIds.has(hubId)) issues.push('Site inconnu');
  }
  if (ctx.negatives) {
    const hubId = isTransfer(m) ? m.sourceHubId : movementHub(m, ctx.settings);
    if (hubId && (m.items || []).some(it => ctx.negatives.has(key(hubId, it.catalogItemId)))) issues.push(isTransfer(m) ? 'Stock source négatif' : 'Stock négatif');
  }
  return issues;
}

/** Ensemble « hubId|itemId » des soldes négatifs (pour movementIssues). */
export const negativeKeys = (movements, settings) => new Set(negativeBalances(movements, settings).map(n => key(n.hubId, n.itemId)));

/**
 * Nouvelles anomalies introduites par une écriture (contrôle serveur) :
 * soldes devenus négatifs ou plus négatifs, et contrôles structurels des mouvements modifiés.
 */
export function ledgerWriteProblems(before, after, settings, ctx = {}) {
  const problems = [];
  const negBefore = new Map(negativeBalances(before, settings).map(n => [key(n.hubId, n.itemId), n.qty]));
  for (const n of negativeBalances(after, settings)) {
    const prev = negBefore.get(key(n.hubId, n.itemId));
    if (prev === undefined || n.qty < prev) {
      const hub = (ctx.hubs || []).find(h => h.id === n.hubId);
      const item = (ctx.catalog || []).find(c => c.id === n.itemId);
      problems.push(`Stock insuffisant : ${item?.name || n.itemId} au ${hub?.name || n.hubId} (solde ${n.qty}).`);
    }
  }
  const prevById = new Map((before || []).map(m => [m.id, JSON.stringify(m)]));
  for (const m of after || []) {
    if (prevById.get(m.id) === JSON.stringify(m)) continue;
    const issues = movementIssues(m, { catalog: [], hubs: [], settings }).filter(i => !i.startsWith('Article inconnu') && !i.endsWith('inconnu'));
    if (issues.length) problems.push(`${m.movementNumber || m.id} : ${issues.join(', ')}.`);
  }
  return problems;
}

/**
 * Reprise des anciens stocks (avant le journal) : un « Stock initial » par Site, égal au stock
 * enregistré, et les anciens mouvements marqués comme déjà compris dans ce stock.
 * - mouvements validés / transferts reçus : 'all' (déjà comptés) ;
 * - transferts en transit : 'source' (la source était déjà débitée ; la réception reste à faire) ;
 * - bons encore au visa : comptés normalement le jour de leur validation.
 * @returns {{ movements: any[], thresholds: Record<string, number> }}
 */
export function migrateLegacyStocks(stocks, movements, hubs, today) {
  const opening = [];
  const thresholds = {};
  const byHub = new Map();
  for (const s of stocks || []) {
    if (!s || !s.hubId || !s.catalogItemId) continue;
    thresholds[s.catalogItemId] = Math.max(thresholds[s.catalogItemId] || 0, Number(s.minAlertThreshold) || 0);
    if (!(s.quantityAvailable > 0)) continue;
    if (!byHub.has(s.hubId)) byHub.set(s.hubId, []);
    byHub.get(s.hubId).push(s);
  }
  for (const [hubId, rows] of byHub) {
    const hub = (hubs || []).find(h => h.id === hubId);
    const items = rows.map(s => ({
      catalogItemId: s.catalogItemId, sku: s.sku, name: s.name, quantity: Math.round(s.quantityAvailable),
      unitPriceUSD: Number(s.unitPriceUSD) || 0, serialNumbers: Array.isArray(s.serialNumbers) ? s.serialNumbers : [],
    }));
    opening.push({
      id: `mvt-reprise-${hubId}`,
      movementNumber: `SI-${hub?.code || hubId}-${today}`,
      type: 'stock_initial', sign: 1, typeLabel: 'Stock initial',
      destinationHubId: hubId, destinationHubName: hub?.name || hubId,
      items,
      totalValueUSD: items.reduce((t, i) => t + i.quantity * i.unitPriceUSD, 0),
      referenceDocumentNumber: 'Reprise des stocks existants',
      operatorId: 'system', operatorName: 'Reprise automatique', operatorRole: 'system',
      date: today, status: 'valide', approvedByManagerName: 'Reprise automatique', approvedAt: `${today} 00:00`,
      electronicSealHash: '', notes: 'Stock de départ repris de l\'ancien suivi des stocks (avant le journal des mouvements).',
    });
  }
  const flagged = (movements || []).map(m => {
    if (!m || m.openingIncluded) return m;
    if (isTransfer(m)) {
      if (m.status === 'en_transit') return { ...m, openingIncluded: 'source', sentAt: m.sentAt || m.approvedAt || m.date };
      if (m.status === 'receptionne') return { ...m, openingIncluded: 'all' };
      return m;
    }
    return m.status === 'valide' ? { ...m, openingIncluded: 'all' } : m;
  });
  return { movements: [...opening, ...flagged], thresholds };
}

/**
 * Lignes de stock par Site et article (forme attendue par les écrans existants), calculées
 * à partir du journal : disponible, en transit vers le Site, réservé (bons au visa), seuil, valeur,
 * numéros de série présents.
 */
export function deriveHubStocks(movements, catalog, hubs, settings, legacyStocks = [], today = '') {
  const cfg = stockSettings(settings);
  const { balances, transit } = computeBalances(movements, cfg);
  const pending = pendingOutgoing(movements, cfg);
  const items = new Map((catalog || []).map(c => [c.id, c]));
  const legacy = new Map((legacyStocks || []).map(s => [key(s.hubId, s.catalogItemId), s]));
  const hubIds = new Set((hubs || []).map(h => h.id));

  // Numéros de série présents : entrées et réceptions les ajoutent, sorties et envois les retirent.
  const serials = new Map();
  const sorted = [...(movements || [])].sort((a, b) => (isTransfer(a) ? sentDay(a) : movementDay(a)).localeCompare(isTransfer(b) ? sentDay(b) : movementDay(b)));
  for (const m of sorted) {
    const effects = movementEffects(m, cfg);
    for (const it of m.items || []) {
      const sns = Array.isArray(it.serialNumbers) ? it.serialNumbers : [];
      if (!sns.length) continue;
      for (const e of effects.filter(x => x.itemId === it.catalogItemId)) {
        const k = key(e.hubId, e.itemId);
        const set = serials.get(k) || new Set();
        if (e.qty > 0) sns.forEach(sn => set.add(sn));
        else sns.forEach(sn => set.delete(sn));
        serials.set(k, set);
      }
    }
  }
  // Numéros des stocks repris (avant le journal).
  for (const [k, s] of legacy) {
    if (!serials.has(k) && Array.isArray(s.serialNumbers)) serials.set(k, new Set(s.serialNumbers));
  }

  const keys = new Set([...balances.keys(), ...transit.keys()]);
  const rows = [];
  for (const k of keys) {
    const [hubId, itemId] = k.split('|');
    if (hubIds.size && !hubIds.has(hubId)) continue;
    const item = items.get(itemId);
    const old = legacy.get(k);
    const qty = balances.get(k) || 0;
    const threshold = Number(item?.minAlertThreshold ?? old?.minAlertThreshold ?? 0) || 0;
    const price = Number(item?.unitPriceUSD ?? old?.unitPriceUSD ?? 0) || 0;
    rows.push({
      id: `stk-${hubId}-${itemId}`,
      hubId,
      catalogItemId: itemId,
      sku: item?.sku || old?.sku || itemId,
      name: item?.name || old?.name || itemId,
      category: normalizeCategory(item?.category || old?.category),
      quantityAvailable: qty,
      quantityReserved: pending.get(hubId, itemId),
      quantityInTransit: transit.get(k) || 0,
      minAlertThreshold: threshold,
      unitPriceUSD: price,
      totalValueUSD: Math.max(0, qty) * price,
      locationRack: old?.locationRack || '—',
      serialNumbers: [...(serials.get(k) || [])],
      lastAuditDate: old?.lastAuditDate || today,
      status: qty <= 0 ? 'rupture' : threshold > 0 && qty < threshold ? 'alerte_basse' : 'normal',
    });
  }
  return rows.sort((a, b) => a.hubId.localeCompare(b.hubId) || a.sku.localeCompare(b.sku));
}

/** Statut d'un stock (rapport de site) : OK, STOCK BAS (sous le seuil), RUPTURE ou NÉGATIF. */
export function stockStatus(qty, threshold) {
  if (qty < 0) return 'NÉGATIF';
  if (qty === 0) return 'RUPTURE';
  if (threshold > 0 && qty < threshold) return 'STOCK BAS';
  return 'OK';
}

/**
 * Rapport d'un Site sur une période (feuille RAPPORT_SITE) : par article, stock d'ouverture,
 * entrées, sorties, transferts reçus / envoyés, stock de clôture, seuil et statut.
 */
export function siteReport(movements, catalog, settings, hubId, from, to) {
  const cfg = stockSettings(settings);
  const rows = new Map();
  const row = itemId => {
    if (!rows.has(itemId)) rows.set(itemId, { itemId, opening: 0, entries: 0, exits: 0, received: 0, sent: 0, closing: 0 });
    return rows.get(itemId);
  };
  for (const m of movements || []) {
    for (const e of movementEffects(m, cfg)) {
      if (e.hubId !== hubId) continue;
      const r = row(e.itemId);
      if (e.day < from) { r.opening += e.qty; continue; }
      if (e.day > to) continue;
      if (e.kind === 'entree' || e.kind === 'reprise') r.entries += e.qty;
      else if (e.kind === 'sortie') r.exits += -e.qty;
      else if (e.kind === 'transfert_recu') r.received += e.qty;
      else if (e.kind === 'transfert_envoye') r.sent += -e.qty;
    }
  }
  const transitNow = computeBalances(movements, cfg);
  const items = new Map((catalog || []).map(c => [c.id, c]));
  for (const c of catalog || []) row(c.id);
  return [...rows.values()].map(r => {
    const item = items.get(r.itemId);
    const closing = r.opening + r.entries - r.exits + r.received - r.sent;
    const threshold = Number(item?.minAlertThreshold) || 0;
    return {
      ...r,
      closing,
      sku: item?.sku || r.itemId,
      name: item?.name || r.itemId,
      category: normalizeCategory(item?.category),
      threshold,
      inTransit: transitNow.inTransit(hubId, r.itemId),
      status: stockStatus(closing, threshold),
    };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.sku.localeCompare(b.sku));
}

/**
 * Suivi mensuel (feuille SUIVI_MENSUEL) : pour chaque mois de l'année, entrées et sorties par
 * catégorie (hors « Stock initial »), transferts envoyés et reçus, pour un Site ou tout le réseau.
 */
export function monthlyTracking(movements, catalog, settings, year, hubId) {
  const cfg = stockSettings(settings);
  const items = new Map((catalog || []).map(c => [c.id, c]));
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, byCategory: {}, entries: 0, exits: 0, sent: 0, received: 0 }));
  for (const m of movements || []) {
    if (!isTransfer(m) && m.type === 'stock_initial') continue;
    for (const e of movementEffects(m, cfg)) {
      if (hubId && e.hubId !== hubId) continue;
      if (!e.day.startsWith(`${year}-`)) continue;
      const mo = months[Number(e.day.slice(5, 7)) - 1];
      if (!mo) continue;
      const cat = normalizeCategory(items.get(e.itemId)?.category);
      mo.byCategory[cat] = mo.byCategory[cat] || { entries: 0, exits: 0 };
      if (e.kind === 'entree') { mo.byCategory[cat].entries += e.qty; mo.entries += e.qty; }
      else if (e.kind === 'sortie') { mo.byCategory[cat].exits += -e.qty; mo.exits += -e.qty; }
      // Réseau entier : un transfert ne change pas le stock total (envoyé puis reçu).
      else if (e.kind === 'transfert_envoye') mo.sent += -e.qty;
      else if (e.kind === 'transfert_recu') mo.received += e.qty;
    }
  }
  return months;
}

// ---------------------------------------------------------------------------
// Portails des hubs : chaque site a son équipe ; la centrale (responsables logistique) gère tout.
// ---------------------------------------------------------------------------

/** Membre de l'équipe d'un site : son responsable ou un agent affecté par la centrale. */
export const isHubMember = (u, hub) =>
  !!u && !!hub && (hub.managerId === u.id || (Array.isArray(hub.staffIds) && hub.staffIds.includes(u.id)));

/** Sites dont l'utilisateur fait partie de l'équipe. */
export const hubsOfUser = (u, hubs) => (hubs || []).filter(h => isHubMember(u, h));

/** Site qui émet un mouvement : source pour une sortie ou un transfert, destination pour une entrée. */
export const movementOwnerHub = (m, settings) => (isTransfer(m) ? m.sourceHubId : movementHub(m, settings));

/** Le mouvement concerne-t-il ce site (émis, reçu ou envoyé) ? */
export const movementTouchesHub = (m, hubId, settings) =>
  !!hubId && (isTransfer(m) ? m.sourceHubId === hubId || m.destinationHubId === hubId : movementHub(m, settings) === hubId);

/**
 * Contrôle « portail » d'une écriture du journal par un membre d'équipe (pas un responsable logistique) :
 * il ne crée des bons que pour son site et ne réceptionne que les transferts destinés à son site.
 * Les changements de statut du circuit de visa restent possibles (ils viennent des valideurs).
 * @returns {string | null} motif du refus
 */
export function hubPortalWriteProblem(user, before, after, hubs, settings) {
  const prevById = new Map((before || []).map(m => [m.id, m]));
  const byId = new Map((hubs || []).map(h => [h.id, h]));
  const name = id => (byId.get(id) || {}).name || id || 'inconnu';
  for (const m of after || []) {
    const prev = prevById.get(m.id);
    if (!prev) {
      const owner = movementOwnerHub(m, settings);
      if (!isHubMember(user, byId.get(owner))) {
        return `Vous ne faites pas partie de l'équipe du site « ${name(owner)} » : seuls son équipe et la centrale logistique y saisissent des bons.`;
      }
    } else if (isTransfer(m) && prev.status === 'en_transit' && m.status === 'receptionne') {
      if (!isHubMember(user, byId.get(m.destinationHubId))) {
        return `La réception au site « ${name(m.destinationHubId)} » est faite par son équipe ou par la centrale logistique.`;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Organigramme interne d'un hub (cellules, chefs, membres). Sans effet sur les circuits de visa.
// Données : clé « logistics.hubOrgs » = { [hubId]: HubOrgUnit[] }.
// ---------------------------------------------------------------------------

/** Peut modifier l'organigramme d'un hub : son responsable, ou la centrale logistique. */
export const canEditHubOrg = (u, hub, isCentral) => !!isCentral || (!!u && !!hub && hub.managerId === u.id);

/** Anomalies d'un organigramme de hub (nom, doublon, parent inconnu, boucle). */
export function hubOrgIssues(units) {
  if (!Array.isArray(units)) return ['Organigramme invalide.'];
  const issues = [];
  const byId = new Map(units.map(u => [u.id, u]));
  const names = new Set();
  for (const u of units) {
    const name = String(u?.name || '').trim();
    if (!u?.id || !name) { issues.push('Chaque cellule doit avoir un nom.'); continue; }
    const k = name.toLowerCase();
    if (names.has(k)) issues.push(`La cellule « ${name} » existe déjà dans ce hub.`);
    names.add(k);
    if (u.parentId && !byId.has(u.parentId)) issues.push(`La cellule « ${name} » est rattachée à une cellule inconnue.`);
    // Boucle : remonter les parents sans repasser par la cellule.
    const seen = new Set([u.id]);
    let p = u.parentId ? byId.get(u.parentId) : undefined;
    while (p) {
      if (seen.has(p.id)) { issues.push(`La cellule « ${name} » ne peut pas être rattachée à elle-même ou à une de ses sous-cellules.`); break; }
      seen.add(p.id);
      p = p.parentId ? byId.get(p.parentId) : undefined;
    }
    if (u.members !== undefined && !Array.isArray(u.members)) issues.push(`Membres invalides pour « ${name} ».`);
  }
  return [...new Set(issues)];
}

/**
 * Écriture des organigrammes de hubs par quelqu'un qui n'est pas de la centrale :
 * il ne modifie que l'organigramme des hubs dont il est le responsable.
 * @returns {string | null}
 */
export function hubOrgWriteProblem(user, before, after, hubs) {
  if (!after || typeof after !== 'object' || Array.isArray(after)) return 'Format invalide.';
  const prev = before && typeof before === 'object' ? before : {};
  for (const id of new Set([...Object.keys(prev), ...Object.keys(after)])) {
    if (JSON.stringify(prev[id] ?? null) === JSON.stringify(after[id] ?? null)) continue;
    const hub = (hubs || []).find(h => h.id === id);
    if (!canEditHubOrg(user, hub, false)) {
      return `Seuls le responsable du site « ${hub ? hub.name : id} » et la centrale logistique modifient son organigramme.`;
    }
  }
  return null;
}
