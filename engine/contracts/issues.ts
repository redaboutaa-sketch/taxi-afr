/**
 * Format unique des erreurs de validation : chemin, valeur (si non sensible),
 * règle, phase, action attendue. Les erreurs sont regroupées par section pour
 * qu'un brief incomplet se corrige en un échange, pas en vingt.
 */
import type { z } from 'zod';

export type Phase = 'structure' | 'draft' | 'preview' | 'release' | 'production';

export interface Issue {
  path: string;
  rule: string;
  phase: Phase;
  message: string;
  action: string;
  /** Valeur refusée, uniquement si elle n'est pas sensible. */
  value?: string;
}

/** Champs dont la valeur ne doit jamais être recopiée dans un rapport. */
const SENSITIVE_PATH = /(recipient|smtp|password|username|secret|facts\.)/i;

export function issue(
  path: Array<string | number> | string,
  rule: string,
  phase: Phase,
  message: string,
  action: string,
  value?: unknown,
): Issue {
  const p = typeof path === 'string' ? path : formatPath(path);
  const out: Issue = { path: p, rule, phase, message, action };
  if (value !== undefined && !SENSITIVE_PATH.test(p)) {
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    out.value = s.length > 120 ? `${s.slice(0, 117)}...` : s;
  }
  return out;
}

export function formatPath(path: ReadonlyArray<PropertyKey>): string {
  return path.reduce<string>((acc, seg) => {
    if (typeof seg === 'number') return `${acc}[${seg}]`;
    return acc ? `${acc}.${String(seg)}` : String(seg);
  }, '');
}

export function fromZod(error: z.ZodError, input: unknown): Issue[] {
  return error.issues.map((i) => {
    let value: unknown;
    try {
      value = i.path.reduce<unknown>((o, k) => (o as Record<PropertyKey, unknown>)?.[k as PropertyKey], input);
    } catch {
      value = undefined;
    }
    const unknownKeys = i.code === 'unrecognized_keys' ? ` (${i.keys.join(', ')})` : '';
    return issue(
      i.path.map((s) => (typeof s === 'symbol' ? String(s) : s)),
      `schema.${i.code}`,
      'structure',
      `${i.message}${unknownKeys}`,
      i.code === 'unrecognized_keys'
        ? 'Retirer ces clés : le brief est strict, et un secret ne doit jamais y figurer.'
        : 'Corriger la valeur selon le schéma (voir engine/contracts/brief.schema.json).',
      i.code === 'unrecognized_keys' ? undefined : value,
    );
  });
}

/** Rendu texte groupé par section de premier niveau. */
export function formatIssues(issues: Issue[]): string {
  const groups = new Map<string, Issue[]>();
  for (const i of issues) {
    const section = i.path.split(/[.[]/)[0] || '(racine)';
    groups.set(section, [...(groups.get(section) ?? []), i]);
  }
  const lines: string[] = [];
  for (const [section, list] of groups) {
    lines.push(`\n  ${section} — ${list.length} point(s)`);
    for (const i of list) {
      lines.push(`    ✗ ${i.path} [${i.rule} · ${i.phase}]`);
      lines.push(`      ${i.message}${i.value !== undefined ? ` — valeur : ${i.value}` : ''}`);
      lines.push(`      → ${i.action}`);
    }
  }
  return lines.join('\n');
}
