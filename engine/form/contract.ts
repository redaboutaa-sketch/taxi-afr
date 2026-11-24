/**
 * Contrat de formulaire : UNE définition (`<site>/content/form.yaml`),
 * deux validateurs — celui-ci (navigateur, build) et `php/src/Contract.php`
 * (serveur). Les deux implémentent les mêmes règles, et leur parité est
 * prouvée par des vecteurs de test communs exécutés des deux côtés
 * (`engine/tests/form-parity.test.ts`). Le serveur fait foi.
 */
import { z } from 'zod';
import type { ServerContract } from './validate.ts';

const Name = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/);
const Localized = z.record(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/), z.string().min(1).max(300));

/**
 * `date` (AAAA-MM-JJ), `time` (HH:MM) et `integer` depuis l'usine 0.2.0.
 * Le navigateur peut proposer un sélecteur ; la validation reste celle du serveur.
 */
export const FieldKind = z.enum(['text', 'email', 'tel', 'textarea', 'select', 'date', 'time', 'integer']);

export const Field = z.strictObject({
  name: Name,
  kind: FieldKind,
  required: z.boolean(),
  maxLength: z.number().int().min(1).max(10_000),
  autocomplete: z.string().regex(/^[a-z -]{1,40}$/).optional(),
  label: Localized,
  hint: Localized.optional(),
  /** Pour `select` : valeurs autorisées (libellés localisés). */
  options: z.array(z.strictObject({ value: Name, label: Localized })).min(1).optional(),
  /** Pour `integer` : bornes de SAISIE (pas une capacité ni une promesse métier). */
  min: z.number().int().min(0).max(999_999_999).optional(),
  max: z.number().int().min(0).max(999_999_999).optional(),
});
export type Field = z.infer<typeof Field>;

/** Fuseau IANA explicite (ex. Europe/Paris) : jamais celui du serveur. */
const TimeZone = z.string().regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/).refine((tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'fuseau IANA inconnu');

/** Règles entre champs. Point d'extension : un nouveau `kind` s'ajoute ici, dans validate.ts et Contract.php, avec ses vecteurs de parité. */
export const FormRule = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('datetime-future'),
    date: Name,
    time: Name,
    timeZone: TimeZone,
    minLeadMinutes: z.number().int().min(0).max(60 * 24 * 30).default(0),
    maxDaysAhead: z.number().int().min(1).max(3660).default(365),
  }),
]);
export type FormRule = z.infer<typeof FormRule>;

export const FormContract = z
  .strictObject({
    $schema: z.string().optional(),
    fields: z.array(Field).min(1).max(20),
    rules: z.array(FormRule).max(10).default([]),
    /** Champ invisible pour les humains ; rempli = soumission automatisée. */
    honeypot: Name,
    /** Pages de résultat par langue (chemins du site). */
    results: z.record(
      z.string(),
      z.strictObject({ accepted: z.string().regex(/^\/[a-z0-9/_-]*\/$/), invalid: z.string().regex(/^\/[a-z0-9/_-]*\/$/), unavailable: z.string().regex(/^\/[a-z0-9/_-]*\/$/) }),
    ),
    subject: Localized,
  })
  .superRefine((c, ctx) => {
    const names = c.fields.map((f) => f.name);
    if (new Set(names).size !== names.length) ctx.addIssue({ code: 'custom', message: 'nom de champ en double', path: ['fields'] });
    if (names.includes(c.honeypot) || ['locale', 'ref'].includes(c.honeypot)) {
      ctx.addIssue({ code: 'custom', message: 'le piège porte le nom d’un champ réel ou réservé', path: ['honeypot'] });
    }
    for (const [i, f] of c.fields.entries()) {
      if ((f.kind === 'select') !== Boolean(f.options)) {
        ctx.addIssue({ code: 'custom', message: 'options requises pour select, et seulement pour select', path: ['fields', i, 'options'] });
      }
      if (['locale', 'ref'].includes(f.name)) ctx.addIssue({ code: 'custom', message: 'nom réservé', path: ['fields', i, 'name'] });
      if ((f.min !== undefined || f.max !== undefined) && f.kind !== 'integer') {
        ctx.addIssue({ code: 'custom', message: 'min/max réservés au type integer', path: ['fields', i] });
      }
      if (f.min !== undefined && f.max !== undefined && f.min > f.max) ctx.addIssue({ code: 'custom', message: 'min > max', path: ['fields', i] });
    }
    for (const [i, r] of c.rules.entries()) {
      const kindOf = (n: string) => c.fields.find((f) => f.name === n)?.kind;
      if (kindOf(r.date) !== 'date') ctx.addIssue({ code: 'custom', message: `« ${r.date} » n’est pas un champ date`, path: ['rules', i, 'date'] });
      if (kindOf(r.time) !== 'time') ctx.addIssue({ code: 'custom', message: `« ${r.time} » n’est pas un champ time`, path: ['rules', i, 'time'] });
    }
  });
export type FormContract = z.infer<typeof FormContract>;

/**
 * Forme transmise au serveur : ce qui sert à valider, plus le libellé de la
 * langue principale (rédaction du message transmis). Aucune adresse.
 */
export function serverContract(c: FormContract, locale?: string): ServerContract {
  return {
    honeypot: c.honeypot,
    fields: c.fields.map((f) => ({
      name: f.name,
      kind: f.kind,
      required: f.required,
      maxLength: f.maxLength,
      options: f.options?.map((o) => o.value) ?? null,
      ...(f.kind === 'integer' ? { min: f.min ?? null, max: f.max ?? null } : {}),
      ...(locale && f.label[locale] ? { label: f.label[locale] } : {}),
    })),
    ...(c.rules.length ? { rules: c.rules } : {}),
  };
}

export * from './validate.ts';
