/**
 * Validation d'une soumission — sans dépendance (utilisable dans le
 * navigateur). Règles identiques à engine/form/php/src/Contract.php.
 */
export interface ServerContract {
  honeypot: string;
  fields: Array<{ name: string; kind: string; required: boolean; maxLength: number; options: string[] | null }>;
}

export type ErrorCode = 'required' | 'too_long' | 'invalid_email' | 'invalid_tel' | 'invalid_option' | 'invalid_chars' | 'unexpected_field' | 'not_a_string';

export interface ValidationResult {
  ok: boolean;
  /** Erreurs triées par nom de champ puis code : comparables entre JS et PHP. */
  errors: Array<{ field: string; code: ErrorCode }>;
  values: Record<string, string>;
}

/** Même motif que le serveur : volontairement simple, sans espace ni caractère d'en-tête. */
export const EMAIL_PATTERN = /^[^ \t\n@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/u;
export const TEL_PATTERN = /^\+?[0-9 ().-]{6,25}$/u;
/** Contrôles interdits partout ; dans un champ d'une ligne, CR/LF aussi (injection d'en-têtes). */
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
/** Seuls espace, tabulation et saut de ligne sont retirés aux extrémités (comme `trim($v, " \t\n")` en PHP). */
const EDGE = /^[ \t\n]+|[ \t\n]+$/gu;

const length = (s: string) => [...s].length;

export function validateSubmission(contract: ServerContract, input: Record<string, unknown>): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const values: Record<string, string> = {};
  const known = new Set([...contract.fields.map((f) => f.name), contract.honeypot, 'locale']);
  for (const key of Object.keys(input)) if (!known.has(key)) errors.push({ field: key, code: 'unexpected_field' });

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
    if (f.kind === 'email' && !EMAIL_PATTERN.test(v)) errors.push({ field: f.name, code: 'invalid_email' });
    else if (f.kind === 'tel' && !TEL_PATTERN.test(v)) errors.push({ field: f.name, code: 'invalid_tel' });
    else if (f.kind === 'select' && !f.options?.includes(v)) errors.push({ field: f.name, code: 'invalid_option' });
    values[f.name] = v;
  }
  errors.sort((a, b) => (a.field === b.field ? (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) : a.field < b.field ? -1 : 1));
  return { ok: errors.length === 0, errors, values };
}
