/**
 * Polices auto-hébergées (SIL OFL 1.1, paquets @fontsource verrouillés dans
 * package-lock.json ; licences copiées dans LICENSES/ de chaque release).
 * Sous-ensemble latin : couvre le français (œ, « », apostrophe typographique).
 *  - Public Sans : texte (lisibilité, chiffres clairs pour un numéro) ;
 *  - IBM Plex Sans Condensed : titres (direction B « Bandeau », retenue le 2026-11-24).
 */
import { fontProviders } from 'astro/config';

const LATIN: [string, ...string[]] = ['U+0000-00FF', 'U+0131', 'U+0152-0153', 'U+02BB-02BC', 'U+02C6', 'U+02DA', 'U+02DC', 'U+0304', 'U+0308', 'U+0329', 'U+2000-206F', 'U+20AC', 'U+2122', 'U+2191', 'U+2193', 'U+2212', 'U+2215', 'U+FEFF', 'U+FFFD'];

export const fonts = [
  {
    provider: fontProviders.local(),
    name: 'Public Sans',
    cssVariable: '--font-public-sans',
    fallbacks: ['Arial', 'sans-serif'],
    options: {
      variants: [{ src: ['@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2'], weight: '100 900', style: 'normal', unicodeRange: [...LATIN] }],
    },
  },
  {
    provider: fontProviders.local(),
    name: 'IBM Plex Sans Condensed',
    cssVariable: '--font-plex-condensed',
    fallbacks: ['Arial Narrow', 'Arial', 'sans-serif'],
    options: {
      variants: [
        { src: ['@fontsource/ibm-plex-sans-condensed/files/ibm-plex-sans-condensed-latin-600-normal.woff2'], weight: 600, style: 'normal', unicodeRange: [...LATIN] },
      ],
    },
  },
];
