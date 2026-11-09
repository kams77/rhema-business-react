// shared/attendance.mjs — pointage automatique des agents (règles communes serveur / navigateur).
//
// - Arrivée : à la première activité du jour dans l'application (connexion ou retour).
// - Départ  : à la déconnexion ; sans déconnexion, à la dernière activité constatée (départ « automatique »).
// - Pauses  : déclarées par l'agent (« Pause » / « Reprise ») ; une sortie suivie d'un retour le même
//             jour compte comme une pause.
// - Les heures sont posées par le serveur (horloge du serveur) : l'agent ne peut pas les modifier.
// Écrit en JavaScript pur (sans dépendance) pour être lu par Node sans compilation.

import { canManageAccount } from './access.mjs';

/** Types d'événement : automatiques (activite, depart) ou déclarés par l'agent (pause, reprise). */
export const ATTENDANCE_EVENTS = ['activite', 'pause', 'reprise', 'depart'];

/** Fuseau horaire par défaut des journées de travail. */
export const DEFAULT_TIME_ZONE = 'Africa/Kinshasa';

/** Durée normale d'une journée de travail (heures) : au-delà, heures supplémentaires. */
export const NORMAL_DAY_HOURS = 8;

/** Jour local AAAA-MM-JJ d'un instant, dans un fuseau donné. @param {Date} date @param {string} [timeZone] */
export function localDay(date, timeZone = DEFAULT_TIME_ZONE) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
}

/** Clé de stockage d'un mois de pointages (« pointage.2026-11 »). @param {string} day */
export const attendanceKey = day => `pointage.${day.slice(0, 7)}`;
/** Mois précédent d'un jour AAAA-MM-JJ (« 2026-10 »). @param {string} day */
export function previousMonth(day) {
  const [y, m] = day.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

const closeOpenBreak = (rec, at) => {
  const open = rec.breaks.find(b => !b.end);
  if (open) open.end = at < open.start ? open.start : at;
};

/**
 * Applique un événement de pointage à la liste des journées (copie), pour un agent.
 * @param {any[]} days journées enregistrées (un mois)
 * @param {{ id: string, name: string }} user
 * @param {'activite'|'pause'|'reprise'|'depart'} type
 * @param {string} nowIso instant de l'événement (horloge du serveur)
 * @param {string} today jour local de l'événement
 * @returns {{ days: any[], changed: boolean, record: any | null }}
 */
export function applyAttendanceEvent(days, user, type, nowIso, today) {
  const list = (Array.isArray(days) ? days : []).map(d => ({ ...d, breaks: (d.breaks || []).map(b => ({ ...b })) }));
  let changed = false;

  // Journées précédentes restées ouvertes : départ à la dernière activité constatée.
  for (const d of list) {
    if (d.userId === user.id && !d.departureAt && d.date < today) {
      closeOpenBreak(d, d.lastSeenAt);
      d.departureAt = d.lastSeenAt;
      d.departureAuto = true;
      changed = true;
    }
  }

  let rec = list.find(d => d.userId === user.id && d.date === today) || null;
  if (!rec) {
    if (type === 'depart') return { days: list, changed, record: null };
    rec = { id: `pt-${user.id}-${today}`, userId: user.id, userName: user.name, date: today, arrivalAt: nowIso, breaks: [], lastSeenAt: nowIso };
    list.push(rec);
    changed = true;
  } else if (rec.departureAt && type !== 'depart') {
    // Retour après une sortie le même jour : l'absence compte comme une pause.
    rec.breaks.push({ start: rec.departureAt, end: nowIso });
    delete rec.departureAt;
    delete rec.departureAuto;
    changed = true;
  }

  if (type === 'pause' && !rec.breaks.some(b => !b.end)) {
    rec.breaks.push({ start: nowIso });
    changed = true;
  }
  if (type === 'reprise' && rec.breaks.some(b => !b.end)) {
    closeOpenBreak(rec, nowIso);
    changed = true;
  }
  if (type === 'depart') {
    closeOpenBreak(rec, nowIso);
    rec.departureAt = nowIso;
    rec.departureAuto = false;
    changed = true;
  }
  if (rec.lastSeenAt !== nowIso) {
    rec.lastSeenAt = nowIso;
    changed = true;
  }
  if (rec.userName !== user.name) rec.userName = user.name;
  return { days: list, changed, record: rec };
}

/** En pause en ce moment ? @param {any} day */
export const isOnBreak = day => !!day && !day.departureAt && (day.breaks || []).some(b => !b.end);

/**
 * Temps de travail effectif (secondes), pauses déduites.
 * Journée en cours : jusqu'à maintenant ; journée passée non close : jusqu'à la dernière activité.
 * @param {any} day @param {number} nowMs @param {string} today
 */
export function workedSeconds(day, nowMs, today) {
  const start = Date.parse(day.arrivalAt);
  const end = day.departureAt ? Date.parse(day.departureAt) : day.date === today ? nowMs : Date.parse(day.lastSeenAt);
  const pauses = (day.breaks || []).reduce((sum, b) => {
    const bEnd = b.end ? Date.parse(b.end) : Math.min(end, nowMs);
    return sum + Math.max(0, bEnd - Date.parse(b.start));
  }, 0);
  return Math.max(0, Math.floor((end - start - pauses) / 1000));
}

/** Temps de pause (secondes). @param {any} day @param {number} nowMs */
export function breakSeconds(day, nowMs) {
  return (day.breaks || []).reduce((sum, b) => sum + Math.max(0, (b.end ? Date.parse(b.end) : nowMs) - Date.parse(b.start)), 0) / 1000 | 0;
}

/**
 * Qui voit les pointages d'un agent : lui-même, la Direction Générale et les responsables
 * qui gèrent son compte (même périmètre que la gestion des agents). Jamais ses collègues.
 * @param {any} viewer @param {any} target @param {any[]} entities
 */
export function canSeeAttendanceOf(viewer, target, entities) {
  if (!viewer || !target) return false;
  return viewer.id === target.id || viewer.role === 'dg' || canManageAccount(viewer, target, entities);
}

/** Jours AAAA-MM-JJ valides et plage limitée (93 jours au plus). @param {string} from @param {string} to */
export function validRange(from, to) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from) || !re.test(to) || from > to) return false;
  return (Date.parse(to) - Date.parse(from)) / 86_400_000 <= 93;
}

/** Clés mensuelles couvrant une plage de jours. @param {string} from @param {string} to */
export function monthKeys(from, to) {
  const keys = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const [ty, tm] = to.slice(0, 7).split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    keys.push(`pointage.${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return keys;
}
