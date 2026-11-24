/**
 * Validation d'une soumission — sans dépendance (utilisable dans le
 * navigateur). Règles identiques à engine/form/php/src/Contract.php.
 *
 * Depuis la version 0.2.0 de l'usine : types `date` (AAAA-MM-JJ), `time`
 * (HH:MM, 24 h) et `integer` (bornes min/max), et règles entre champs
 * (`datetime-future`) évaluées dans un fuseau IANA EXPLICITE — jamais celui
 * du serveur ni du navigateur. L'instant présent est un paramètre : les
 * tests le fixent, le serveur fait foi.
 */
export interface ServerField {
  name: string;
  kind: string;
  required: boolean;
  maxLength: number;
  options: string[] | null;
  /** Bornes pour `integer` (null = sans borne). Limite de saisie, pas une capacité métier. */
  min?: number | null;
  max?: number | null;
  /** Libellé lisible (langue principale) : sert au message transmis, pas à la validation. */
  label?: string;
}

/**
 * Date + heure locales dans `timeZone`, comparées à l'instant présent.
 *  - `minLeadMinutes` : délai minimal avant le départ (0 = seulement « pas dans le passé ») ;
 *  - `maxDaysAhead`   : horizon maximal.
 * Une heure qui n'existe pas (passage à l'heure d'été) ou qui existe deux fois
 * (retour à l'heure d'hiver) est REFUSÉE avec un code dédié : on demande une
 * précision au lieu d'interpréter silencieusement.
 */
export interface DatetimeFutureRule {
  kind: 'datetime-future';
  date: string;
  time: string;
  timeZone: string;
  minLeadMinutes: number;
  maxDaysAhead: number;
}
export type ServerRule = DatetimeFutureRule;

export interface ServerContract {
  honeypot: string;
  fields: ServerField[];
  rules?: ServerRule[];
}

export type ErrorCode =
  | 'required'
  | 'too_long'
  | 'invalid_email'
  | 'invalid_tel'
  | 'invalid_option'
  | 'invalid_chars'
  | 'unexpected_field'
  | 'not_a_string'
  | 'invalid_date'
  | 'invalid_time'
  | 'invalid_number'
  | 'out_of_range'
  | 'in_the_past'
  | 'too_soon'
  | 'too_far'
  | 'nonexistent_time'
  | 'ambiguous_time';

export interface ValidationResult {
  ok: boolean;
  /** Erreurs triées par nom de champ puis code : comparables entre JS et PHP. */
  errors: Array<{ field: string; code: ErrorCode }>;
  values: Record<string, string>;
}

/** Même motif que le serveur : volontairement simple, sans espace ni caractère d'en-tête. */
export const EMAIL_PATTERN = /^[^ \t\n@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/u;
export const TEL_PATTERN = /^\+?[0-9 ().-]{6,25}$/u;
export const DATE_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/u;
export const TIME_PATTERN = /^([01][0-9]|2[0-3]):([0-5][0-9])$/u;
export const INTEGER_PATTERN = /^[0-9]{1,9}$/u;
/** Contrôles interdits partout ; dans un champ d'une ligne, CR/LF aussi (injection d'en-têtes). */
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
/** Seuls espace, tabulation et saut de ligne sont retirés aux extrémités (comme `trim($v, " \t\n")` en PHP). */
const EDGE = /^[ \t\n]+|[ \t\n]+$/gu;

const length = (s: string) => [...s].length;

/** Date civile réelle (années 1900-9999 ; 29 février seulement les années bissextiles). */
export function isRealDate(v: string): boolean {
  const m = DATE_PATTERN.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1] ?? 0;
  return d <= days;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
/** Décalage (secondes, à ajouter à l'UTC) du fuseau à l'instant `epoch` (secondes). */
export function zoneOffset(timeZone: string, epoch: number): number {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    formatters.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(epoch * 1000)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) / 1000;
  return wall - epoch;
}

/**
 * Instants UTC (secondes) correspondant à une heure murale locale.
 * 0 résultat = heure inexistante ; 2 = heure ambiguë. Même algorithme en PHP :
 * décalages du fuseau 24 h avant et après, puis vérification de chaque candidat.
 */
export function localToInstants(date: string, time: string, timeZone: string): number[] {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi, 0) / 1000;
  const out = new Set<number>();
  for (const probe of [wall - 86_400, wall + 86_400]) {
    const candidate = wall - zoneOffset(timeZone, probe);
    if (zoneOffset(timeZone, candidate) === wall - candidate) out.add(candidate);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * @param now instant présent en secondes UTC ; défaut : horloge locale.
 *   Le serveur utilise sa propre horloge et fait foi.
 */
export function validateSubmission(contract: ServerContract, input: Record<string, unknown>, now: number = Math.floor(Date.now() / 1000)): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const values: Record<string, string> = {};
  const known = new Set([...contract.fields.map((f) => f.name), contract.honeypot, 'locale']);
  for (const key of Object.keys(input)) if (!known.has(key)) errors.push({ field: key, code: 'unexpected_field' });
  const valid = new Set<string>();

  for (const f of contract.fields) {
    const raw = input[f.name];
    if (raw !== undefined && typeof raw !== 'string') {
      errors.push({ field: f.name, code: 'not_a_string' });
      continue;
    }
    const v = (raw ?? '').replace(/\r\n?/g, '\n').replace(EDGE, '');
    if (f.kind !== 'textarea' && v.includes('\n')) {
      errors.push({ field: f.name, code: 'invalid_chars' });
      continue;
    }
    if (CONTROL.test(v)) {
      errors.push({ field: f.name, code: 'invalid_chars' });
      continue;
    }
    if (v === '') {
      if (f.required) errors.push({ field: f.name, code: 'required' });
      values[f.name] = '';
      continue;
    }
    if (length(v) > f.maxLength) {
      errors.push({ field: f.name, code: 'too_long' });
      continue;
    }
    let value = v;
    let code: ErrorCode | null = null;
    if (f.kind === 'email' && !EMAIL_PATTERN.test(v)) code = 'invalid_email';
    else if (f.kind === 'tel' && !TEL_PATTERN.test(v)) code = 'invalid_tel';
    else if (f.kind === 'select' && !f.options?.includes(v)) code = 'invalid_option';
    else if (f.kind === 'date' && !isRealDate(v)) code = 'invalid_date';
    else if (f.kind === 'time' && !TIME_PATTERN.test(v)) code = 'invalid_time';
    else if (f.kind === 'integer') {
      if (!INTEGER_PATTERN.test(v)) code = 'invalid_number';
      else {
        const n = Number.parseInt(v, 10);
        value = String(n);
        if ((f.min != null && n < f.min) || (f.max != null && n > f.max)) code = 'out_of_range';
      }
    }
    if (code) errors.push({ field: f.name, code });
    else valid.add(f.name);
    values[f.name] = value;
  }

  for (const r of contract.rules ?? []) {
    if (r.kind !== 'datetime-future') continue;
    const date = values[r.date] ?? '';
    const time = values[r.time] ?? '';
    // Règle évaluée seulement si les deux champs sont présents et valides.
    if (!valid.has(r.date) || !valid.has(r.time) || date === '' || time === '') continue;
    const instants = localToInstants(date, time, r.timeZone);
    if (instants.length === 0) {
      errors.push({ field: r.time, code: 'nonexistent_time' });
      continue;
    }
    if (instants.length > 1) {
      errors.push({ field: r.time, code: 'ambiguous_time' });
      continue;
    }
    const at = instants[0] as number;
    if (at <= now) errors.push({ field: r.date, code: 'in_the_past' });
    else if (at < now + r.minLeadMinutes * 60) errors.push({ field: r.date, code: 'too_soon' });
    else if (at > now + r.maxDaysAhead * 86_400) errors.push({ field: r.date, code: 'too_far' });
  }

  errors.sort((a, b) => (a.field === b.field ? (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) : a.field < b.field ? -1 : 1));
  return { ok: errors.length === 0, errors, values };
}
