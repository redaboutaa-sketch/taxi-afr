/**
 * Définition UNIQUE des en-têtes de sécurité HTTP, rendue ensuite par chaque
 * profil d'hébergement (nginx aujourd'hui, Apache ensuite).
 *
 * CSP en deux couches, appliquées simultanément par le navigateur :
 *  - la balise meta générée par Astro porte `script-src`/`style-src` avec les
 *    empreintes des ressources réellement émises ;
 *  - l'en-tête HTTP ci-dessous porte ce qu'une balise meta ne peut pas
 *    exprimer (`frame-ancestors`) et durcit le reste, SANS `default-src` ni
 *    `script-src` : sinon il bloquerait les scripts autorisés par la meta.
 */
import type { ResolvedConfig } from '../config/resolve.ts';

export const HEADER_CSP = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'";

export function securityHeaders(config: Pick<ResolvedConfig, 'indexable'>): Array<[string, string]> {
  const h: Array<[string, string]> = [
    ['Content-Security-Policy', HEADER_CSP],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
  ];
  if (!config.indexable) h.push(['X-Robots-Tag', 'noindex, nofollow']);
  return h;
}
