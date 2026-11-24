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

export const FieldKind = z.enum(['text', 'email', 'tel', 'textarea', 'select']);

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
});
export type Field = z.infer<typeof Field>;

export const FormContract = z
  .strictObject({
    $schema: z.string().optional(),
    fields: z.array(Field).min(1).max(20),
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
    }
  });
export type FormContract = z.infer<typeof FormContract>;

/** Forme transmise au serveur : uniquement ce qui sert à valider. */
export function serverContract(c: FormContract): ServerContract {
  return {
    honeypot: c.honeypot,
    fields: c.fields.map((f) => ({
      name: f.name,
      kind: f.kind,
      required: f.required,
      maxLength: f.maxLength,
      options: f.options?.map((o) => o.value) ?? null,
    })),
  };
}

export * from './validate.ts';
