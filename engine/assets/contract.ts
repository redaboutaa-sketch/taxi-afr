/**
 * Registre d'actifs du site (`<site>/assets/registry.yaml`).
 *
 * Quatre volets strictement séparés pour chaque fichier :
 *   1. `declared`  — ce que DIT le fournisseur (source, auteur, déclaration) ;
 *   2. `observed`  — ce que l'on CONSTATE dans le fichier (écrit par
 *                    `factory:assets scan`, jamais à la main) ;
 *   3. `signature` — vérification technique d'une éventuelle signature
 *                    (C2PA) : « non vérifiée » tant qu'aucun outil ne l'a faite ;
 *   4. `rights`    — l'AUTORISATION d'usage, avec une référence de preuve
 *                    PRIVÉE (jamais copiée dans une page ni dans la release).
 * Une métadonnée présente ou absente ne prouve ni la véracité d'une scène, ni
 * l'origine humaine ou générée, ni des droits commerciaux.
 */
import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const Localized = z.record(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/), z.string().max(300));

export const ASSET_SOURCES = ['client-supplied', 'commissioned', 'stock', 'created-by-factory', 'procedural', 'ai-generated', 'benchmark', 'unknown'] as const;
export const DEPICTS = ['none', 'product', 'place', 'person', 'result', 'brand'] as const;
/** Transformations admises : aucune n'est générative (pas d'inpainting, pas d'agrandissement génératif). */
export const TRANSFORMATIONS = ['resize', 'compress', 'crop', 'format-conversion', 'background-removal-non-generative', 'color-correction'] as const;

export const Observed = z.strictObject({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().nonnegative(),
  format: z.enum(['png', 'jpeg', 'webp', 'avif', 'gif', 'svg', 'unknown']),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  alpha: z.boolean().nullable(),
  metadata: z.strictObject({
    exif: z.boolean(),
    xmp: z.boolean(),
    c2paMarker: z.boolean(),
    /** Valeur IPTC `digitalSourceType` lue telle quelle dans les octets (non vérifiée). */
    digitalSourceType: z.string().max(120).nullable(),
  }),
  scannedOn: z.iso.date(),
});
export type Observed = z.infer<typeof Observed>;

export const AssetRecord = z.strictObject({
  /** Chemin relatif à `<site>/assets/`. */
  file: z.string().regex(/^files\/[a-z0-9][a-z0-9._/-]{0,120}$/, 'fichier attendu sous files/ (minuscules, sans ..)').refine((p) => !p.includes('..'), 'chemin remontant interdit'),
  kind: z.enum(['photo', 'illustration', 'diagram', 'logo', 'icon', 'social-image', 'texture']),
  /** Ce que l'image prétend montrer. Sert à refuser une image générée présentée comme réelle. */
  depicts: z.enum(DEPICTS),
  decorative: z.boolean().default(false),
  alt: Localized.default({}),
  declared: z.strictObject({
    source: z.enum(ASSET_SOURCES),
    author: text(160).nullable().default(null),
    statement: text(400).nullable().default(null),
    date: z.iso.date().nullable().default(null),
  }),
  observed: Observed.nullable().default(null),
  signature: z.strictObject({ c2pa: z.enum(['not_checked', 'valid', 'invalid', 'absent']), tool: text(120).nullable().default(null) }).default({ c2pa: 'not_checked', tool: null }),
  rights: z.strictObject({
    status: z.enum(['unknown', 'requested', 'granted', 'denied', 'not_required']),
    scope: text(400).nullable().default(null),
    /** Référence PRIVÉE vers la preuve (dossier, e-mail, contrat). Jamais publiée. */
    evidenceRef: text(200).nullable().default(null),
    restrictions: z.array(text(300)).default([]),
    expires: z.iso.date().nullable().default(null),
  }),
  transformations: z.array(z.strictObject({ op: z.enum(TRANSFORMATIONS), note: text(300).optional() })).default([]),
  status: z.enum(['candidate', 'approved', 'rejected', 'excluded']),
  /** Décision HUMAINE d'approbation ou de rejet. Un agent ne la remplit pas à la place du propriétaire. */
  decision: z.strictObject({ by: text(120), on: z.iso.date(), note: text(400).optional() }).nullable().default(null),
});
export type AssetRecord = z.infer<typeof AssetRecord>;

export const Registry = z.strictObject({
  $schema: z.string().optional(),
  schemaVersion: z.literal(1),
  assets: z.record(z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/), AssetRecord).default({}),
});
export type Registry = z.infer<typeof Registry>;
