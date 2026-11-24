/**
 * Validation et normalisation de l'identité réseau.
 *
 * Toute valeur qui finira dans une configuration serveur (nginx, Apache,
 * en-têtes) passe ici. On refuse plutôt que d'échapper : une origine
 * acceptable n'a besoin d'aucun caractère spécial.
 */

/** Domaines réservés (RFC 2606 / RFC 6761) utilisables pour les exemples. */
const RESERVED = [/^(.+\.)?example\.(com|org|net)$/, /\.(test|example|invalid|localhost)$/, /^localhost$/];

export const isReservedHost = (host: string): boolean => RESERVED.some((r) => r.test(host));

const FORBIDDEN = /[\u0000- \u007f"'`\\{};<>|^]/;
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export type HostResult = { ok: true; host: string } | { ok: false; reason: string };

/** Nom d'hôte nu (sans schéma, port ni chemin), IDN converti en ASCII. */
export function normalizeHost(raw: string): HostResult {
  if (typeof raw !== 'string' || raw.length === 0) return { ok: false, reason: 'nom d’hôte vide' };
  if (FORBIDDEN.test(raw)) return { ok: false, reason: 'caractère interdit (espace, contrôle, guillemet, accolade…)' };
  if (/[/:@?#*%]/.test(raw)) return { ok: false, reason: 'un nom d’hôte seul est attendu (ni schéma, port, chemin ni joker)' };
  let host: string;
  try {
    host = new URL(`https://${raw}`).hostname;
  } catch {
    return { ok: false, reason: 'nom d’hôte invalide' };
  }
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (IPV4.test(host) || host.startsWith('[')) return { ok: false, reason: 'adresse IP refusée : un nom de domaine est attendu' };
  const labels = host.split('.');
  if (host.length > 253 || labels.some((l) => !LABEL.test(l))) return { ok: false, reason: 'étiquette DNS invalide' };
  if (labels.length < 2 && host !== 'localhost') return { ok: false, reason: 'domaine pleinement qualifié attendu' };
  return { ok: true, host };
}

export type OriginResult = { ok: true; origin: string; host: string; port: string } | { ok: false; reason: string };

/**
 * Origine `https://hote[:port]`, sans chemin, requête, fragment ni identifiants.
 * `http` n'est accepté que pour une prévisualisation sur boucle locale ou `.test`.
 */
export function normalizeOrigin(raw: string, opts: { allowPort?: boolean; allowLocalHttp?: boolean } = {}): OriginResult {
  if (typeof raw !== 'string' || raw.length === 0) return { ok: false, reason: 'origine vide' };
  if (FORBIDDEN.test(raw)) return { ok: false, reason: 'caractère interdit dans l’origine' };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'URL invalide' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: `schéma refusé : ${url.protocol}` };
  if (url.username || url.password) return { ok: false, reason: 'identifiants interdits dans une origine' };
  if (url.pathname !== '/' || url.search || url.hash || /\/\/[^/]+\/./.test(raw)) {
    return { ok: false, reason: 'une origine ne comporte ni chemin, ni requête, ni fragment' };
  }
  const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.test');
  if (url.protocol === 'http:' && !(opts.allowLocalHttp && isLoopback)) {
    return { ok: false, reason: 'https obligatoire (http seulement pour une preview locale ou .test)' };
  }
  if (url.port && !opts.allowPort) return { ok: false, reason: 'port explicite refusé pour cette origine' };
  const host = url.hostname === '127.0.0.1' ? { ok: true as const, host: '127.0.0.1' } : normalizeHost(url.hostname);
  if (!host.ok) return host;
  const origin = `${url.protocol}//${host.host}${url.port ? `:${url.port}` : ''}`;
  return { ok: true, origin, host: host.host, port: url.port };
}
