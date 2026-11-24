/**
 * Contrat canonique du brief (`site/brief/brief.yaml`).
 *
 * Ce schéma décrit la STRUCTURE. Les exigences qui dépendent du mode
 * (draft / preview / release) et des fonctionnalités activées vivent dans
 * `engine/contracts/rules.ts`, pour que le même brief incomplet reste valide
 * en `draft` sans affaiblir le contrôle en `release`.
 *
 * Le JSON Schema destiné aux éditeurs est GÉNÉRÉ depuis ce fichier
 * (`npm run factory:schema`) : il n'existe pas de seconde définition.
 */
import { z } from 'zod';

/** Caractères qui n'ont rien à faire dans une valeur recopiée dans un en-tête ou une config serveur. */
const UNSAFE_CHARS = /[\u0000-\u001f\u007f"'`\\{};<>]/;

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v), {
      message: 'caractères de contrôle interdits',
    });

export const SCHEMA_VERSION = 1 as const;

export const MODES = ['draft', 'preview', 'release'] as const;
export type Mode = (typeof MODES)[number];

export const LocaleCode = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'code de langue BCP 47 simple attendu (ex. fr, en, de, pt-BR)');

export const CountryCode = z.string().regex(/^[A-Z]{2}$/, 'code pays ISO 3166-1 alpha-2 attendu');

/** Libellé localisé : une entrée par langue du site, contrôlée par les règles. */
export const Localized = z.record(LocaleCode, safeText(400));

const Email = z
  .string()
  .trim()
  .max(254)
  .refine((v) => !UNSAFE_CHARS.test(v) && !/\s/.test(v), { message: 'caractère interdit dans une adresse' })
  .pipe(z.email({ message: 'adresse e-mail invalide' }));

/** Référence à un secret fourni à l'exécution. La valeur n'est JAMAIS dans le brief. */
export const SecretRef = z
  .string()
  .regex(/^env:[A-Z][A-Z0-9_]{1,63}$/, 'référence de secret attendue sous la forme env:NOM_VARIABLE');

// ── Faits ──────────────────────────────────────────────────────────────────

export const FACT_STATUSES = ['unknown', 'proposed', 'confirmed', 'not_applicable'] as const;
export const PUBLICATIONS = ['public', 'internal', 'withheld'] as const;
export const SURFACES = ['html', 'jsonld', 'meta', 'sitemap', 'scripts', 'documents'] as const;
export type Surface = (typeof SURFACES)[number];

/**
 * Un fait sensible. Deux dimensions indépendantes :
 *  - `status` : ce que l'on SAIT (vérification) ;
 *  - `publication` : ce que l'on a le DROIT de montrer.
 * Un fait `confirmed` peut être `withheld` : vrai, mais jamais publié.
 */
export const Fact = z.strictObject({
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(z.string(), z.string())]),
  status: z.enum(FACT_STATUSES),
  sourceRefs: z.array(safeText(200)).default([]),
  publication: z.enum(PUBLICATIONS).default('internal'),
  /** Surfaces autorisées pour un fait public. Absent = toutes. */
  surfaces: z.array(z.enum(SURFACES)).min(1).optional(),
  /** Obligatoire pour `not_applicable` (règle de mode). */
  justification: safeText(400).optional(),
});
export type Fact = z.infer<typeof Fact>;

// ── Sections ───────────────────────────────────────────────────────────────

const Identity = z.strictObject({
  brand: safeText(80),
  /** Marque une identité de démonstration : jamais publiable comme vrai client. */
  fictional: z.boolean(),
  establishmentCountry: CountryCode,
});

const Cta = z.strictObject({
  kind: z.enum(['contact-form', 'email', 'phone', 'url']),
  label: Localized,
  /** URL pour `kind: url` uniquement, relative au site ou https. */
  target: z.string().max(400).optional(),
});

const Market = z.strictObject({
  audience: safeText(400),
  targetCountries: z.array(CountryCode).min(1),
  objectives: z.array(safeText(300)).default([]),
  /** Clés de `facts` portant la différenciation affirmée publiquement. */
  differentiationFacts: z.array(z.string()).default([]),
  primaryCta: Cta,
});

const Offer = z.strictObject({
  kind: z.enum(['services', 'catalog']),
  categories: z.array(z.strictObject({ id: z.string().regex(/^[a-z0-9-]+$/), label: Localized })).default([]),
  exclusions: z.array(safeText(300)).default([]),
  /** Prix et disponibilité : uniquement via des faits confirmés. */
  pricingFact: z.string().optional(),
  availabilityFact: z.string().optional(),
});

const Network = z.strictObject({
  /** Origine canonique de production (https, sans chemin). */
  canonicalOrigin: z.string().max(300),
  /** Domaines qui redirigent intégralement vers l'origine canonique. Liste explicite, éventuellement vide. */
  redirectDomains: z.array(z.string().max(253)).default([]),
  /** Origine de prévisualisation, explicite. `null` = pas d'environnement de preview hébergé. */
  previewOrigin: z.string().max(300).nullable().default(null),
});

const EmailSection = z.strictObject({
  /** Clé de `facts` portant l'adresse de contact publique. */
  publicContactFact: z.string().optional(),
  /** Boîte qui reçoit les demandes du formulaire. Interne : jamais projetée publiquement. */
  recipient: Email.optional(),
  /** Identité d'expédition autorisée chez le fournisseur. Jamais dérivée du domaine web. */
  from: Email.optional(),
  /** Domaine dont SPF/DKIM couvrent l'envoi ; le `from` doit lui appartenir. */
  sendingDomain: z.string().max(253).optional(),
  replyTo: z.literal('submitter').default('submitter'),
  transport: z.enum(['smtp', 'capture', 'none']).default('none'),
  smtp: z
    .strictObject({
      host: z.string().max(253),
      port: z.number().int().min(1).max(65535),
      security: z.enum(['starttls', 'tls']),
      username: SecretRef,
      password: SecretRef,
    })
    .optional(),
});

const Form = z.strictObject({
  enabled: z.boolean(),
});

const I18n = z.strictObject({
  defaultLocale: LocaleCode,
  locales: z.array(LocaleCode).min(1),
  /** Politique quand une page n'existe pas dans une langue : on l'omet, jamais de faux contenu. */
  missingTranslation: z.literal('omit').default('omit'),
});

const Design = z.strictObject({
  references: z.array(z.strictObject({ url: z.url(), note: safeText(400) })).default([]),
  antiReferences: z.array(safeText(400)).default([]),
  brandConstraints: z.array(safeText(400)).default([]),
  availableResources: z.array(safeText(400)).default([]),
  /** Le propriétaire autorise-t-il des illustrations d'ambiance GÉNÉRÉES (jamais présentées comme réelles) ? */
  allowGeneratedIllustrations: z.boolean().default(false),
  /**
   * Porte G2 en DEUX décisions humaines distinctes :
   *  - `selectedDirection` : choix d'une piste (orientation) ;
   *  - `renderApproval` : approbation du rendu final de cette piste.
   * Choisir une piste ne vaut pas approbation du rendu.
   */
  selectedDirection: z
    .strictObject({ id: z.string(), decidedBy: safeText(120), decidedOn: z.iso.date(), note: safeText(400).optional() })
    .nullable()
    .default(null),
  renderApproval: z
    .strictObject({ approvedBy: safeText(120), approvedOn: z.iso.date(), scope: safeText(400) })
    .nullable()
    .default(null),
});

const Hosting = z.strictObject({
  profile: z.enum(['vps-nginx', 'apache-shared', 'vps-proxy']),
  phpVersion: z.string().regex(/^8\.\d+$/).optional(),
  notes: z.array(safeText(400)).default([]),
});

const Privacy = z.strictObject({
  processing: z
    .array(
      z.strictObject({
        purpose: safeText(300),
        recipients: z.array(safeText(200)).min(1),
        retentionFact: z.string(),
      }),
    )
    .default([]),
  thirdPartyTools: z.array(safeText(200)).default([]),
  analytics: z.enum(['none', 'self-hosted-cookieless']).default('none'),
});

const Delivery = z.strictObject({
  scope: z.array(safeText(300)).default([]),
  reviewer: safeText(120).nullable().default(null),
  publicationAuthorization: z
    .strictObject({ grantedBy: safeText(120), grantedOn: z.iso.date(), scopeDigest: z.string().regex(/^[a-f0-9]{64}$/) })
    .nullable()
    .default(null),
});

export const Brief = z.strictObject({
  $schema: z.string().optional(),
  schemaVersion: z.literal(SCHEMA_VERSION),
  mode: z.enum(MODES),
  site: z.strictObject({ id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/, 'identifiant en minuscules, chiffres et tirets') }),
  identity: Identity,
  market: Market,
  offer: Offer,
  network: Network,
  email: EmailSection,
  form: Form,
  i18n: I18n,
  design: Design,
  hosting: Hosting,
  privacy: Privacy,
  delivery: Delivery,
  facts: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9.]{0,63}$/), Fact).default({}),
});

export type Brief = z.infer<typeof Brief>;
export type BriefInput = z.input<typeof Brief>;
