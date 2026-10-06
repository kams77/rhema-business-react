// src/lib/csv.ts — lecture de fichiers CSV (Excel FR « ; » ou EN « , »), guillemets compris.

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  separator: ',' | ';' | '\t';
}

/** Normalise un intitulé de colonne : minuscules, sans accents ni espaces superflus. */
export function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

/** Choisit le séparateur le plus fréquent sur la première ligne (hors guillemets). */
function detectSeparator(firstLine: string): ',' | ';' | '\t' {
  const counts = { ',': 0, ';': 0, '\t': 0 } as Record<string, number>;
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  if (counts[';'] >= counts[','] && counts[';'] >= counts['\t'] && counts[';'] > 0) return ';';
  if (counts['\t'] > counts[',']) return '\t';
  return ',';
}

/**
 * Découpe un texte CSV selon la RFC 4180 : champs entre guillemets pouvant contenir le séparateur,
 * des retours à la ligne ou des guillemets doublés (""). Les apostrophes sont conservées (N'Sele).
 */
export function parseCsv(text: string): ParsedCsv {
  const src = text.replace(/^\uFEFF/, '');
  const firstLineEnd = src.search(/\r?\n/);
  const separator = detectSeparator(firstLineEnd === -1 ? src : src.slice(0, firstLineEnd));

  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field.trim() === '') { quoted = true; field = ''; }
    else if (ch === separator) { record.push(field.trim()); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      record.push(field.trim()); field = '';
      if (record.some(v => v !== '')) records.push(record);
      record = [];
    } else field += ch;
  }
  record.push(field.trim());
  if (record.some(v => v !== '')) records.push(record);

  const [head = [], ...rows] = records;
  return { headers: head.map(normalizeHeader), rows, separator };
}

/** Accès à une cellule par l'un des noms de colonne possibles ('' si absente). */
export function cellGetter(headers: string[], row: string[]) {
  return (names: string[]): string => {
    for (const n of names) {
      const idx = headers.indexOf(normalizeHeader(n));
      if (idx !== -1 && row[idx] !== undefined) return row[idx].trim();
    }
    return '';
  };
}

/** Échappe une valeur pour un export CSV. */
export function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[";,\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Lit une date « AAAA-MM-JJ » ou « JJ/MM/AAAA » ; renvoie AAAA-MM-JJ ou null. */
export function parseDateCell(v: string): string | null {
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return valid(+m[3], +m[2], +m[1]);
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Lit une période de paie « AAAA-MM » ou « MM/AAAA ». */
export function parseMonthCell(v: string): string | null {
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = /^(\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${m[1].padStart(2, '0')}`;
  return null;
}

/** Télécharge un fichier texte (CSV avec BOM UTF-8 pour qu'Excel affiche bien les accents). */
export function downloadTextFile(fileName: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([mime.startsWith('text/csv') && !content.startsWith('\uFEFF') ? '\uFEFF' + content : content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
