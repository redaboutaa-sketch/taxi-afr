/**
 * brief validé + profil d'environnement non secret → configuration résolue.
 *
 * La configuration résolue est la SEULE donnée exposée aux pages
 * (module virtuel `virtual:factory/config`). Elle ne contient :
 *  - aucun secret ni référence de secret ;
 *  - aucune adresse interne (destinataire, From, SMTP) ;
 *  - que les faits dont la publication est autorisée, par surface.
 */
import { type Brief, type Surface, SURFACES } from '../contracts/brief.ts';
import { normalizeHost, normalizeOrigin } from './network.ts';

export type Target = 'preview' | 'production';

export interface Profile {
  target: Target;
  /** Origine servant la preview locale quand le brief n'en déclare pas. */
  localPreviewOrigin?: string;
}

export interface PublicFact {
  value: string | number | boolean | Record<string, string>;
  surfaces: Surface[];
  /** Vrai en preview pour un fait seulement `proposed` : à signaler visuellement. */
  provisional: boolean;
}

export interface ResolvedConfig {
  siteId: string;
  brand: string;
  fictional: boolean;
  target: Target;
  /** Origine des URL absolues de cet artefact. */
  origin: string;
  canonicalOrigin: string;
  indexable: boolean;
  defaultLocale: string;
  locales: string[];
  redirectHosts: string[];
  primaryCta: Brief['market']['primaryCta'];
  offer: { kind: Brief['offer']['kind']; categories: Brief['offer']['categories'] };
  formEnabled: boolean;
  publicContactFact: string | null;
  facts: Record<string, PublicFact>;
}

export function projectFacts(brief: Brief, target: Target): Record<string, PublicFact> {
  const out: Record<string, PublicFact> = {};
  for (const [key, f] of Object.entries(brief.facts)) {
    if (f.publication !== 'public' || f.value === null) continue;
    const accepted = f.status === 'confirmed' || (target === 'preview' && f.status === 'proposed');
    if (!accepted) continue;
    out[key] = { value: f.value, surfaces: f.surfaces ?? [...SURFACES], provisional: f.status !== 'confirmed' };
  }
  return out;
}

export function resolveConfig(brief: Brief, profile: Profile): ResolvedConfig {
  const canon = normalizeOrigin(brief.network.canonicalOrigin);
  if (!canon.ok) throw new Error(`origine canonique invalide : ${canon.reason}`);
  let origin = canon.origin;
  if (profile.target === 'preview') {
    const raw = brief.network.previewOrigin ?? profile.localPreviewOrigin ?? 'http://localhost:4321';
    const p = normalizeOrigin(raw, { allowPort: true, allowLocalHttp: true });
    if (!p.ok) throw new Error(`origine de preview invalide : ${p.reason}`);
    origin = p.origin;
  }
  return Object.freeze({
    siteId: brief.site.id,
    brand: brief.identity.brand,
    fictional: brief.identity.fictional,
    target: profile.target,
    origin,
    canonicalOrigin: canon.origin,
    indexable: profile.target === 'production',
    defaultLocale: brief.i18n.defaultLocale,
    locales: [...brief.i18n.locales],
    redirectHosts: brief.network.redirectDomains.map((d) => {
      const h = normalizeHost(d);
      if (!h.ok) throw new Error(`domaine de redirection invalide : ${h.reason}`);
      return h.host;
    }),
    primaryCta: brief.market.primaryCta,
    offer: { kind: brief.offer.kind, categories: brief.offer.categories },
    formEnabled: brief.form.enabled,
    publicContactFact: brief.email.publicContactFact ?? null,
    facts: projectFacts(brief, profile.target),
  });
}

/** Valeur d'un fait pour une surface donnée, ou `undefined` si sa publication n'y est pas autorisée. */
export function factFor(config: ResolvedConfig, key: string, surface: Surface): PublicFact['value'] | undefined {
  const f = config.facts[key];
  return f && f.surfaces.includes(surface) ? f.value : undefined;
}
