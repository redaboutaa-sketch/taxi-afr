/**
 * Récapitulatif d'une demande de trajet et brouillon WhatsApp — fonctions
 * PURES (navigateur et tests), sans accès réseau ni stockage.
 *
 * Le lien de conversation (`https://wa.me/<numéro>?text=<texte>`) ouvre
 * WhatsApp avec un message PRÉPARÉ : il n'envoie rien, ne donne aucun accusé
 * de réception et ne vaut ni demande reçue ni course confirmée.
 * Le texte voyage dans l'URL transmise à un tiers : on le MINIMISE
 * (logistique seulement), on le borne, et il n'est construit qu'au clic.
 */

export interface TripInput {
  pickup: string;
  dropoff: string;
  date: string; // AAAA-MM-JJ, déjà validée
  time: string; // HH:MM, déjà validée
  passengers?: string;
  travel_ref?: string;
  details?: string;
  name: string;
  phone: string;
  email?: string;
}

/** Longueur maximale du texte prérempli (avant encodage). */
export const MAX_DRAFT_CHARS = 900;

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** « lundi 1 décembre 2026 » — calcul calendaire pur, indépendant du fuseau du navigateur. */
export function frenchDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[weekday]} ${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`;
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
const clip = (s: string, n: number) => ([...s].length > n ? `${[...s].slice(0, n - 1).join('')}…` : s);

/**
 * Récapitulatif lisible. `forThirdParty` : version transmise à WhatsApp, sans
 * e-mail ni précisions libres (où pourrait figurer une information sensible).
 */
export function tripSummary(t: TripInput, opts: { forThirdParty: boolean }): string {
  const lines = [
    'Demande de trajet (à confirmer par le chauffeur)',
    `Départ : ${clip(oneLine(t.pickup), 160)}`,
    `Destination : ${clip(oneLine(t.dropoff), 160)}`,
    `Le ${frenchDate(t.date)} à ${t.time.replace(':', ' h ')} (heure de Paris)`,
  ];
  if (t.passengers) lines.push(`Voyageurs : ${t.passengers}`);
  if (t.travel_ref) lines.push(`Train ou vol : ${clip(oneLine(t.travel_ref), 40)}`);
  if (!opts.forThirdParty && t.details) lines.push(`Précisions : ${oneLine(t.details)}`);
  lines.push(`Nom : ${clip(oneLine(t.name), 80)}`);
  lines.push(`Téléphone : ${oneLine(t.phone)}`);
  if (!opts.forThirdParty && t.email) lines.push(`E-mail : ${t.email}`);
  return lines.join('\n');
}

/** Lien de conversation WhatsApp, ou null si le numéro n'est pas exploitable. */
export function whatsappLink(digits: string | null, text: string): string | null {
  if (!digits || !/^[1-9][0-9]{7,14}$/.test(digits)) return null;
  const bounded = [...text].length > MAX_DRAFT_CHARS ? `${[...text].slice(0, MAX_DRAFT_CHARS - 1).join('')}…` : text;
  // Encodage strict (RFC 3986) : apostrophes et parenthèses aussi, pour tout contexte d'URL.
  const encoded = encodeURIComponent(bounded).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `https://wa.me/${digits}?text=${encoded}`;
}
