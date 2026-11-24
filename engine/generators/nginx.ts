/**
 * Générateur nginx du profil `vps-nginx` (et base du profil derrière proxy).
 * Fonction pure : même configuration résolue + mêmes options → mêmes octets.
 *
 * Pièges couverts :
 *  - `add_header` n'est hérité par une `location` que si elle n'en déclare
 *    aucun : les en-têtes sont donc répétés via un bloc commun ;
 *  - seul l'endpoint déclaré exécute du PHP ; tout autre `.php` répond 404 ;
 *  - fichiers cachés refusés ; aucun listage de répertoire.
 */
import type { ResolvedConfig } from '../config/resolve.ts';
import { securityHeaders } from '../security/headers.ts';

export interface NginxOptions {
  /** Répertoire de la release courante (lien symbolique basculé atomiquement). */
  releaseRoot: string;
  /** `adresse:port` ou `unix:/chemin` du pool PHP-FPM. */
  fastcgiPass: string;
  /** `null` : écoute HTTP seule (recette locale ou TLS terminé par un proxy existant). */
  tls: { certificate: string; key: string } | null;
  listen: number;
  /** Chemin public de l'endpoint de formulaire, ou `null` si le site n'en a pas. */
  endpoint: string | null;
  maxBodyBytes: number;
}

const SAFE = /^[A-Za-z0-9._:/-]+$/;

function assertSafe(label: string, value: string): string {
  if (!SAFE.test(value)) throw new Error(`valeur refusée dans la configuration nginx (${label}) : ${value}`);
  return value;
}

export function renderNginx(config: ResolvedConfig, o: NginxOptions): string {
  const host = assertSafe('hôte', new URL(config.origin).hostname);
  const root = `${assertSafe('racine', o.releaseRoot)}/public`;
  const fpm = assertSafe('fastcgi', o.fastcgiPass);
  const redirects = config.target === 'production' ? config.redirectHosts.map((h) => assertSafe('redirection', h)) : [];
  const directives = securityHeaders(config).map(([k, v]) => `add_header ${k} "${v}" always;`);
  /** En-têtes communs + spécifiques, indentés pour le niveau voulu. */
  const headers = (indent: string, extra: string[] = []) => [...directives, ...extra].map((d) => `${indent}${d}`).join('\n');
  const headerLines = headers('    ');
  const listen = o.tls ? `listen ${o.listen} ssl;\n    http2 on;` : `listen ${o.listen};`;
  const tls = o.tls
    ? `\n    ssl_certificate     ${assertSafe('certificat', o.tls.certificate)};\n    ssl_certificate_key ${assertSafe('clé', o.tls.key)};\n    ssl_protocols TLSv1.2 TLSv1.3;`
    : '';
  const php = o.endpoint
    ? `
    location = ${assertSafe('endpoint', o.endpoint)} {
        limit_except POST GET { deny all; }
        client_max_body_size ${Math.ceil(o.maxBodyBytes / 1024)}k;
        include fastcgi_params;
        # Chemin RÉEL résolu par nginx à chaque requête : après bascule du lien
        # « current », PHP exécute la nouvelle release malgré son cache de chemins.
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT $realpath_root;
        fastcgi_param HTTP_PROXY "";
        fastcgi_pass ${fpm};
${headers('        ', ['add_header Cache-Control "no-store" always;'])}
    }
`
    : '';

  const redirectServers = redirects.length
    ? `
# Domaines secondaires : une seule redirection permanente vers l'origine canonique.
server {
    ${listen}
    server_name ${redirects.join(' ')};${tls}
    return 301 https://${host}$request_uri;
}
`
    : '';

  return `# FICHIER GÉNÉRÉ par engine/generators/nginx.ts — ne pas éditer.
# Site : ${config.siteId} · cible : ${config.target}
server {
    ${listen}
    server_name ${host};${tls}
    root ${root};
    index index.html;
    charset utf-8;
    server_tokens off;
    autoindex off;
    error_page 404 /404.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 256;
    gzip_types text/css application/javascript application/json image/svg+xml text/plain application/xml;

${headerLines}

    location ~ /\\. { return 404; }
${php}
    location ~ \\.php$ { return 404; }

    location /_astro/ {
${headers('        ', ['add_header Cache-Control "public, max-age=31536000, immutable" always;'])}
        try_files $uri =404;
    }

    location / {
${headers('        ', ['add_header Cache-Control "no-cache" always;'])}
        try_files $uri $uri/index.html =404;
    }
}
${redirectServers}`;
}

/** Pool PHP-FPM : transmet au PHP les variables de secrets NOMMÉES, sans valeur. */
export function renderFpmPool(siteId: string, secretEnvNames: string[], varDir: string): string {
  const names = [...new Set(secretEnvNames)].sort();
  for (const n of names) if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(n)) throw new Error(`nom de variable refusé : ${n}`);
  return `; FICHIER GÉNÉRÉ par engine/generators/nginx.ts — ne pas éditer.
; Les VALEURS des variables ci-dessous sont fournies par l'environnement du
; service PHP-FPM (unité systemd, conteneur), jamais par la release.
[www]
clear_env = yes
${names.map((n) => `env[${n}] = $${n}`).join('\n')}
env[FACTORY_VAR_DIR] = ${assertSafe('varDir', varDir)}
php_admin_flag[expose_php] = off
php_admin_value[upload_max_filesize] = 0
php_admin_flag[file_uploads] = off
php_admin_value[post_max_size] = 64K
; ${siteId}
`;
}
