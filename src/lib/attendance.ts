// src/lib/attendance.ts — pointages (arrivée, pauses, départ) et décompte des heures.
import { addDaysLocal, parseLocalDate } from './dates';

export interface AttendancePunch {
  id: string;
  userId: string;
  userName: string;
  /** Jour local (AAAA-MM-JJ). */
  date: string;
  /** Horodatages ISO (UTC). */
  arrivalAt: string;
  departureAt?: string;
  breaks: { start: string; end?: string }[];
}

export const ATTENDANCE_KEY = 'attendance.punches';
/** Durée normale d'une journée de travail (heures). */
export const NORMAL_DAY_HOURS = 8;

/** Temps de travail effectif (secondes) : de l'arrivée au départ (ou maintenant), pauses déduites. */
export function workedSeconds(p: AttendancePunch, nowMs: number = Date.now()): number {
  const end = p.departureAt ? Date.parse(p.departureAt) : nowMs;
  const pauses = p.breaks.reduce((sum, b) => sum + Math.max(0, (b.end ? Date.parse(b.end) : nowMs) - Date.parse(b.start)), 0);
  return Math.max(0, Math.floor((end - Date.parse(p.arrivalAt) - pauses) / 1000));
}

/** Heures passées entre 22 h et 6 h (heure locale) sur la plage arrivée → départ. */
export function nightHours(p: AttendancePunch): number {
  if (!p.departureAt) return 0;
  const start = Date.parse(p.arrivalAt);
  const end = Date.parse(p.departureAt);
  if (!(end > start)) return 0;
  let ms = 0;
  const day = new Date(start);
  day.setHours(0, 0, 0, 0);
  for (let d = new Date(day); d.getTime() < end; d.setDate(d.getDate() + 1)) {
    const windows: Array<[number, number]> = [
      [new Date(d).setHours(0, 0, 0, 0), new Date(d).setHours(6, 0, 0, 0)],
      [new Date(d).setHours(22, 0, 0, 0), new Date(d).setHours(24, 0, 0, 0)],
    ];
    for (const [a, b] of windows) ms += Math.max(0, Math.min(b, end) - Math.max(a, start));
  }
  return ms / 3_600_000;
}

/** Premier jour d'une période de n jours ouvrables (lundi → samedi) se terminant le jour indiqué. */
export function periodStartForWorkingDays(n: number, endIso: string): string {
  let remaining = Math.max(1, n);
  let cur = endIso;
  for (let guard = 0; guard < 400; guard++) {
    const d = parseLocalDate(cur)!;
    if (d.getDay() !== 0) remaining--;
    if (remaining === 0) return cur;
    cur = addDaysLocal(-1, cur);
  }
  return cur;
}

export interface AttendanceSummary {
  daysWorked: number;
  normalHours: number;
  overtimeDay: number;
  overtimeNight: number;
  overtimeHoliday: number;
  /** Jours pointés sans départ (non comptés). */
  incompleteDays: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Décompte réel des pointages d'un agent entre deux dates incluses :
 * - au-delà de 8 h par jour : heures supplémentaires (de nuit si effectuées entre 22 h et 6 h) ;
 * - le dimanche : toutes les heures sont comptées en heures de repos / férié.
 */
export function summarizeAttendance(punches: AttendancePunch[], userId: string, startIso: string, endIso: string): AttendanceSummary {
  const out: AttendanceSummary = { daysWorked: 0, normalHours: 0, overtimeDay: 0, overtimeNight: 0, overtimeHoliday: 0, incompleteDays: 0 };
  for (const p of punches) {
    if (p.userId !== userId || p.date < startIso || p.date > endIso) continue;
    if (!p.departureAt) { out.incompleteDays++; continue; }
    const hours = workedSeconds(p) / 3600;
    out.daysWorked++;
    const isSunday = parseLocalDate(p.date)?.getDay() === 0;
    if (isSunday) { out.overtimeHoliday += hours; continue; }
    const normal = Math.min(hours, NORMAL_DAY_HOURS);
    const extra = Math.max(0, hours - NORMAL_DAY_HOURS);
    const night = Math.min(extra, nightHours(p));
    out.normalHours += normal;
    out.overtimeNight += night;
    out.overtimeDay += extra - night;
  }
  return {
    ...out,
    normalHours: round1(out.normalHours),
    overtimeDay: round1(out.overtimeDay),
    overtimeNight: round1(out.overtimeNight),
    overtimeHoliday: round1(out.overtimeHoliday),
  };
}
