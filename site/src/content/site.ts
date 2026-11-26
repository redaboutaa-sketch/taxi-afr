/**
 * Contenu et navigation du site AFR TAXI (français uniquement en V1).
 *
 * Les coordonnées, horaires, services et éléments juridiques ne sont JAMAIS
 * écrits ici : ils viennent des faits du brief projetés par le moteur
 * (`virtual:factory/config`). Un fait non projeté (inconnu, interne, ou non
 * confirmé en production) n'est simplement pas affiché.
 */
import config from 'virtual:factory/config';

export const routes = {
  home: '/',
  prive: '/taxi-prive/',
  transferts: '/transfert-gare-aeroport/',
  apropos: '/a-propos/',
  contact: '/contact/',
  demande: '/contact/#demande',
  assistance: '/assistance/',
  medical: '/transport-medical/',
  incident: '/assistance-deplacement/',
  mentions: '/mentions-legales/',
  vie: '/vie-privee/',
} as const;

export interface PublicValue {
  text: string;
  provisional: boolean;
}

/** Valeur publiable d'un fait (surface html), ou null. */
export function fact(key: string): PublicValue | null {
  const f = config.facts[key];
  if (!f || !f.surfaces.includes('html') || typeof f.value === 'object') return null;
  return { text: String(f.value), provisional: f.provisional };
}

export const phone = fact('contact.phone');
const e164 = fact('contact.phoneE164');
/** Lien d'appel standard, sans JavaScript ni traceur. */
export const telHref = e164 ? `tel:${e164.text.replace(/[^+0-9]/g, '')}` : null;
export const email = fact('contact.email');
export const whatsapp = fact('contact.whatsapp');
/** Chiffres seuls (format international attendu par le lien de conversation WhatsApp). */
export const whatsappDigits = whatsapp ? whatsapp.text.replace(/[^0-9]/g, '') : null;
export const locality = fact('business.locality');
export const hours = fact('business.hours');

export const nav = [
  { href: routes.prive, label: 'Taxi privé' },
  { href: routes.transferts, label: 'Gares et aéroports' },
  { href: routes.assistance, label: 'Médical et assistance' },
  { href: routes.apropos, label: 'Le chauffeur' },
  { href: routes.contact, label: 'Contact' },
] as const;

export const services = [
  {
    key: 'service.privateAndBusiness',
    href: routes.prive,
    title: 'Taxi privé et professionnel',
    text: 'Trajets du quotidien, rendez-vous, déplacements professionnels, courte ou longue distance.',
    icon: 'car',
    /** Photo de la carte (registre d'actifs) : affichée seulement si publiable. */
    image: 'service-prive',
  },
  {
    key: 'service.transfers',
    href: routes.transferts,
    title: 'Gares et aéroports',
    text: 'Départ ou arrivée en train ou en avion : indiquez l’horaire et la référence, le chauffeur organise la prise en charge.',
    icon: 'plane',
    /** Photo de la carte (registre d'actifs) : affichée seulement si publiable. */
    image: 'service-transferts',
  },
  {
    key: 'service.medicalConventionne',
    href: routes.medical,
    title: 'Transport de patients',
    text: 'Taxi conventionné CPAM, sur prescription médicale : conditions et prise en charge expliquées sans promesse.',
    icon: 'cross',
    /** Photo de la carte (registre d'actifs) : affichée seulement si publiable. */
    image: 'service-medical',
  },
  {
    key: 'service.assistance',
    href: routes.incident,
    title: 'Après une panne ou un accident',
    text: 'Transport des personnes quand le véhicule est immobilisé. Pas de remorquage ni de secours.',
    icon: 'road',
    /** Photo de la carte (registre d'actifs) : affichée seulement si publiable. */
    image: 'service-assistance',
  },
] as const;

/** Mention affichée à côté d'un fait non confirmé (preview uniquement). */
export const PROVISIONAL = 'à confirmer';

