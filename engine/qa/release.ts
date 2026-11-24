/**
 * Audit d'une release ASSEMBLÉE (pages + endpoint + vendor + configurations).
 * Lit uniquement le répertoire de release : c'est ce qui sera servi.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Brief } from '../contracts/brief.ts';
import type { ResolvedConfig, Target } from '../config/resolve.ts';
import { findLeaks } from '../astro/leaks.ts';
import type { FormContract } from '../form/contract.ts';
import { FORM_ENDPOINT } from '../form/rules.ts';
import { HEADER_CSP } from '../security/headers.ts';
import { walkFiles } from '../release/files.ts';

export interface AuditRow {
  id: string;
  ok: boolean;
  severity: 'block' | 'warn';
  detail: string;
}

/** Fichiers qui ne doivent jamais être servis. */
const FORBIDDEN_PUBLIC = [
  /(^|\/)\.(git|env|htpasswd|DS_Store)/,
  /(^|\/)(composer\.(json|lock)|package(-lock)?\.json|tsconfig[^/]*\.json)$/,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /\.(map|md|ya?ml|ts|astro|eml|log|sql|bak|orig|swp)$/,
  /(^|\/)(brief|decisions|evidence|captures)\//,
];

export async function auditRelease(
  dir: string,
  ctx: { brief: Brief; config: ResolvedConfig; form: FormContract | null; target: Target },
): Promise<AuditRow[]> {
  const rows: AuditRow[] = [];
  const check = (id: string, ok: boolean, detail = '', severity: AuditRow['severity'] = 'block') => rows.push({ id, ok, severity, detail });
  const pub = join(dir, 'public');
  const files = existsSync(pub) ? walkFiles(pub) : [];
  const read = (rel: string) => readFileSync(join(dir, rel), 'utf8');

  check('structure.public', files.length > 0, 'public/ vide ou absent');
  check('structure.index', files.includes('index.html'), 'index.html');
  check('structure.404', files.includes('404.html'), '404.html');
  const everything = walkFiles(dir);
  const vcs = everything.filter((f) => /(^|\/)\.(git|svn|hg)\//.test(f));
  check('release.no-vcs-metadata', vcs.length === 0, vcs.slice(0, 5).join(', '));
  check('structure.nginx', existsSync(join(dir, 'config', 'nginx', 'site.conf')), 'config/nginx/site.conf');

  // Fichiers servis
  const forbidden = files.filter((f) => FORBIDDEN_PUBLIC.some((r) => r.test(f)));
  check('public.forbidden-files', forbidden.length === 0, forbidden.join(', '));
  const php = files.filter((f) => f.endsWith('.php'));
  const expectedPhp = ctx.brief.form.enabled ? [FORM_ENDPOINT.slice(1)] : [];
  check('public.php-only-endpoint', JSON.stringify(php) === JSON.stringify(expectedPhp), `trouvé : ${php.join(', ') || 'aucun'} · attendu : ${expectedPhp.join(', ') || 'aucun'}`);
  if (ctx.target === 'production') {
    check('public.no-prototypes', !files.some((f) => f.startsWith('prototypes/')), 'prototypes de direction en production');
  }

  // Indexabilité conforme à la cible
  const html = files.filter((f) => f.endsWith('.html'));
  // Indexabilité : en preview, AUCUNE page indexable ; en production, l'accueil
  // l'est, et les pages utilitaires peuvent être noindex (elles sortent du sitemap).
  const robotsOf = (f: string) => /<meta name="robots" content="([^"]*)"/.exec(read(`public/${f}`))?.[1] ?? '';
  const pages = html.filter((f) => !f.startsWith('prototypes/'));
  if (ctx.config.indexable) {
    check('seo.home-indexable', robotsOf('index.html') === 'index, follow', robotsOf('index.html'));
    const sitemap = existsSync(join(pub, 'sitemap.xml')) ? read('public/sitemap.xml') : '';
    check('seo.sitemap', sitemap.includes(`<loc>${ctx.config.origin}/</loc>`), 'sitemap.xml absent ou sans l’accueil');
    const leakedNoindex = pages.filter((f) => /noindex/.test(robotsOf(f))).map((f) => /<link rel="canonical" href="([^"]+)"/.exec(read(`public/${f}`))?.[1]).filter((u): u is string => Boolean(u) && sitemap.includes(`<loc>${u}</loc>`));
    check('seo.sitemap-excludes-noindex', leakedNoindex.length === 0, leakedNoindex.join(', '));
    check('seo.robots-txt', existsSync(join(pub, 'robots.txt')) && /Allow: \//.test(read('public/robots.txt')), 'robots.txt de production attendu');
  } else {
    const indexable = pages.filter((f) => !/noindex/.test(robotsOf(f)));
    check('seo.preview-noindex', indexable.length === 0, `pages indexables en preview : ${indexable.join(', ')}`);
    check('seo.robots-txt', existsSync(join(pub, 'robots.txt')) && /Disallow: \/\s*$/m.test(read('public/robots.txt')) && !existsSync(join(pub, 'sitemap.xml')), 'preview : robots.txt Disallow et aucun sitemap attendus');
  }

  // Données non publiables, recherchées dans la seule partie servie
  const leaks = existsSync(pub) ? await findLeaks(pub, ctx.brief, ctx.config) : [];
  check('public.no-leaks', leaks.length === 0, leaks.join(' · '));

  // Formulaire : endpoint, runtime, pages de résultat
  if (ctx.brief.form.enabled && ctx.form) {
    for (const f of ['app/bootstrap.php', 'app/vendor/autoload.php', 'app/vendor/phpmailer/phpmailer/src/PHPMailer.php', 'app/config/runtime.json', 'app/config/form-contract.json', 'config/php-fpm/pool.conf']) {
      check(`form.runtime:${f}`, existsSync(join(dir, f)), f);
    }
    const devDeps = existsSync(join(dir, 'app/vendor/composer/installed.json'))
      ? (JSON.parse(read('app/vendor/composer/installed.json')) as { dev: boolean }).dev
      : true;
    check('form.no-dev-dependencies', devDeps === false, 'vendor installé avec les dépendances de développement');
    if (existsSync(join(dir, 'app/config/runtime.json'))) {
      const rt = read('app/config/runtime.json');
      check('form.runtime-no-secret-value', !/"(password|pass|secret|token)"\s*:/i.test(rt) && !/env:/.test(rt), 'valeur ou référence brute de secret dans runtime.json');
      const parsed = JSON.parse(rt) as { allowedOrigins: string[]; from: string };
      check('form.allowed-origin', JSON.stringify(parsed.allowedOrigins) === JSON.stringify([ctx.config.origin]), parsed.allowedOrigins.join(', '));
    }
    const pages = Object.values(ctx.form.results).flatMap((r) => [r.accepted, r.invalid, r.unavailable]);
    const missing = pages.filter((p) => !files.includes(`${p.slice(1)}index.html`));
    check('form.result-pages', missing.length === 0, missing.join(', '));
    const formPages = html.filter((f) => read(`public/${f}`).includes(`action="${FORM_ENDPOINT}"`));
    check('form.page-posts-to-endpoint', formPages.length > 0, 'aucune page ne soumet à l’endpoint');
    const lint = [...walkFiles(join(dir, 'app')).filter((f) => f.endsWith('.php') && !f.startsWith('vendor/')).map((f) => `app/${f}`), ...php.map((f) => `public/${f}`)];
    const phpBin = spawnSync('php', ['-v'], { encoding: 'utf8' });
    if (phpBin.status === 0) {
      const bad = lint.filter((f) => spawnSync('php', ['-l', join(dir, f)], { encoding: 'utf8' }).status !== 0);
      check('php.lint', bad.length === 0, bad.join(', '));
    } else check('php.lint', false, 'PHP CLI absent : lint non exécuté', 'warn');
  } else {
    check('form.absent', !existsSync(join(dir, 'app')), 'app/ présent alors que le formulaire est désactivé');
  }

  // Configuration nginx générée
  const nginx = existsSync(join(dir, 'config/nginx/site.conf')) ? read('config/nginx/site.conf') : '';
  check('nginx.no-placeholder', !/\{\{|undefined|null/.test(nginx), 'valeur non substituée');
  check('nginx.header-csp', nginx.includes(HEADER_CSP), 'en-tête CSP attendu absent');
  check('nginx.php-denied', /location ~ \\\.php\$ \{ return 404; \}/.test(nginx), 'les .php autres que l’endpoint doivent répondre 404');
  check('nginx.robots-header', ctx.config.indexable ? !nginx.includes('X-Robots-Tag') : nginx.includes('X-Robots-Tag "noindex, nofollow"'), 'X-Robots-Tag incohérent avec la cible');
  check('nginx.compression', /\n\s*gzip on;/.test(nginx), 'compression gzip absente');
  check('nginx.no-unsafe-csp', !/unsafe-(inline|eval)/.test(nginx + html.map((f) => read(`public/${f}`)).join('')), 'unsafe-inline/unsafe-eval');
  return rows;
}
