/**
 * Assemblage d'une release : l'ordre est le contrat.
 *   1. valider le brief et le contrat de formulaire ;
 *   2. construire les pages (astro build, validation et contrôle de fuite inclus) ;
 *   3. ajouter l'endpoint, ses dépendances runtime (Composer, --no-dev),
 *      la configuration NON SECRÈTE et les configurations serveur ;
 *   4. auditer CET assemblage (engine/qa/release.ts) ;
 *   5. calculer les empreintes, nommer la release, produire l'archive.
 * Rien n'est ajouté après l'étape 4.
 *
 * Disposition :
 *   <id>/public/          racine servie (pages + public/api/contact.php)
 *   <id>/app/             runtime PHP hors racine (src, vendor, config/*.json)
 *   <id>/config/          nginx/site.conf, php-fpm/pool.conf (non secrets)
 *   <id>/LICENSES/        licences des polices redistribuées
 *   <id>/release.json     identité : site, cible, commit, versions, empreinte
 *   <id>/SHA256SUMS       empreinte de chaque fichier
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_VERSION } from '../contracts/brief.ts';
import { formatIssues } from '../contracts/issues.ts';
import { loadBrief } from '../config/load.ts';
import { type Target, resolveConfig } from '../config/resolve.ts';
import { loadFormContract, serverContract } from '../form/index.ts';
import { checkFormContract, FORM_ENDPOINT } from '../form/rules.ts';
import { renderFpmPool, renderNginx } from '../generators/nginx.ts';
import { auditRelease, type AuditRow } from '../qa/release.ts';
import { walkFiles } from './files.ts';

export { walkFiles };

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PHP_DIR = join(ROOT, 'engine', 'form', 'php');

export interface ProfileOptions {
  profile: 'vps-nginx';
  /** Répertoire de la release courante sur le serveur (lien basculé). */
  releaseRoot: string;
  varDir: string;
  fastcgiPass: string;
  listen: number;
  tls: { certificate: string; key: string } | null;
  /** Transport de capture (démo uniquement) : où joindre la boîte de capture. */
  capture: { host: string; port: number };
  /** Origine servant une preview sans `network.previewOrigin` dans le brief (recette locale). */
  localPreviewOrigin?: string;
}

export function defaultProfile(siteId: string): ProfileOptions {
  return {
    profile: 'vps-nginx',
    releaseRoot: `/srv/${siteId}/current`,
    varDir: `/srv/${siteId}/var`,
    fastcgiPass: '127.0.0.1:9000',
    listen: 443,
    tls: null,
    capture: { host: '127.0.0.1', port: 2525 },
  };
}

export const MAX_BODY_BYTES = 16_384;

export const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

export function checksums(dir: string, exclude: string[] = []): string {
  return walkFiles(dir)
    .filter((f) => !exclude.includes(f))
    .map((f) => `${sha256(readFileSync(join(dir, f)))}  ${f}`)
    .join('\n')
    .concat('\n');
}

function git(args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export interface ReleaseResult {
  id: string;
  dir: string;
  archive: string;
  audit: AuditRow[];
}

export async function assembleRelease(opts: {
  siteDir: string;
  target: Target;
  outBase: string;
  profile?: Partial<ProfileOptions>;
  log?: (s: string) => void;
}): Promise<ReleaseResult> {
  const log = opts.log ?? console.log;
  // 1 — entrées
  const mode = opts.target === 'production' ? 'release' : 'preview';
  const loaded = await loadBrief(opts.siteDir, mode);
  const form = loadFormContract(opts.siteDir);
  const issues = loaded.brief ? [...(loaded.ok ? [] : loaded.issues), ...checkFormContract(loaded.brief, form)] : loaded.issues;
  if (!loaded.ok || !loaded.brief || issues.length) throw new Error(`release refusée — entrées invalides :${formatIssues(issues)}`);
  const brief = loaded.brief;
  const profile: ProfileOptions = { ...defaultProfile(brief.site.id), ...opts.profile };
  const config = resolveConfig(brief, { target: opts.target, localPreviewOrigin: profile.localPreviewOrigin });

  mkdirSync(opts.outBase, { recursive: true });
  const staging = join(opts.outBase, `.staging-${process.pid}`);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });

  // 2 — pages
  log('· construction des pages (astro build)');
  const build = spawnSync(process.execPath, [join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FACTORY_SITE_DIR: opts.siteDir, FACTORY_TARGET: opts.target, FACTORY_OUT_DIR: join(staging, 'public'), ASTRO_TELEMETRY_DISABLED: '1', FACTORY_PREVIEW_ORIGIN: profile.localPreviewOrigin ?? '' },
  });
  if (build.status !== 0) throw new Error(`astro build a échoué :\n${build.stdout}\n${build.stderr}`);

  // 3 — runtime du formulaire et configurations
  const secretEnv: string[] = [];
  let vendorSource: 'dist' | 'source-fallback' | null = null;
  if (brief.form.enabled && form) {
    log('· endpoint PHP et dépendances runtime (composer install --no-dev)');
    const app = join(staging, 'app');
    mkdirSync(join(app, 'config'), { recursive: true });
    for (const f of ['src', 'bootstrap.php', 'composer.json', 'composer.lock']) cpSync(join(PHP_DIR, f), join(app, f), { recursive: true });
    const composer = spawnSync('composer', ['install', '--no-dev', '--prefer-dist', '--no-interaction', '--no-progress', '--classmap-authoritative', '--no-plugins', '--no-scripts', `--working-dir=${app}`], { encoding: 'utf8' });
    if (composer.status !== 0) throw new Error(`composer install a échoué :\n${composer.stderr}`);
    // Si l'archive de distribution est inaccessible, Composer se replie sur un clone git :
    // on retire les métadonnées git (non servies, non déterministes) et on le consigne.
    const gitDirs = spawnSync('find', [join(app, 'vendor'), '-name', '.git', '-prune'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
    for (const g of gitDirs) rmSync(g, { recursive: true, force: true });
    vendorSource = gitDirs.length ? 'source-fallback' : 'dist';
    if (gitDirs.length) log(`  ! dépendances installées depuis les sources git (archive dist inaccessible) — ${gitDirs.length} dossier(s) .git retiré(s)`);
    mkdirSync(join(staging, 'public', 'api'), { recursive: true });
    cpSync(join(PHP_DIR, 'public', 'contact.php'), join(staging, 'public', FORM_ENDPOINT));

    const e = brief.email;
    const smtp =
      e.transport === 'smtp' && e.smtp
        ? { host: e.smtp.host, port: e.smtp.port, security: e.smtp.security, usernameEnv: e.smtp.username.slice(4), passwordEnv: e.smtp.password.slice(4), timeout: 10 }
        : { host: profile.capture.host, port: profile.capture.port, security: 'none', usernameEnv: 'FACTORY_CAPTURE_SMTP_USER', passwordEnv: 'FACTORY_CAPTURE_SMTP_PASSWORD', timeout: 10 };
    if (e.transport === 'none') throw new Error('release refusée — formulaire activé sans transport');
    secretEnv.push(smtp.usernameEnv, smtp.passwordEnv);
    const runtime = {
      siteId: brief.site.id,
      defaultLocale: config.defaultLocale,
      allowedOrigins: [config.origin],
      results: Object.fromEntries(config.locales.map((l) => [l, form.results[l]])),
      subject: form.subject,
      recipient: e.recipient,
      from: e.from,
      fromName: brief.identity.brand,
      maxBodyBytes: MAX_BODY_BYTES,
      rateLimit: { max: 5, windowSeconds: 600 },
      varDir: profile.varDir,
      smtp,
      transportKind: e.transport,
    };
    writeFileSync(join(app, 'config', 'runtime.json'), `${JSON.stringify(runtime, null, 2)}\n`);
    writeFileSync(join(app, 'config', 'form-contract.json'), `${JSON.stringify(serverContract(form), null, 2)}\n`);
    mkdirSync(join(staging, 'config', 'php-fpm'), { recursive: true });
    writeFileSync(join(staging, 'config', 'php-fpm', 'pool.conf'), renderFpmPool(brief.site.id, secretEnv, profile.varDir));
  }
  mkdirSync(join(staging, 'config', 'nginx'), { recursive: true });
  writeFileSync(
    join(staging, 'config', 'nginx', 'site.conf'),
    renderNginx(config, {
      releaseRoot: profile.releaseRoot,
      fastcgiPass: profile.fastcgiPass,
      tls: profile.tls,
      listen: profile.listen,
      endpoint: brief.form.enabled ? FORM_ENDPOINT : null,
      maxBodyBytes: MAX_BODY_BYTES,
    }),
  );
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string; devDependencies: Record<string, string> };
  mkdirSync(join(staging, 'LICENSES'), { recursive: true });
  for (const dep of Object.keys(pkg.devDependencies).filter((d) => d.startsWith('@fontsource'))) {
    const lic = join(ROOT, 'node_modules', dep, 'LICENSE');
    if (existsSync(lic)) cpSync(lic, join(staging, 'LICENSES', `${dep.replace('/', '__')}.LICENSE`));
  }

  // 4 — audit de l'assemblage complet
  log('· audit de la release assemblée');
  const audit = await auditRelease(staging, { brief, config, form, target: opts.target });
  const blocking = audit.filter((r) => !r.ok && r.severity === 'block');
  if (blocking.length) {
    throw new Error(`audit de la release en échec (assemblage conservé dans ${staging}) :\n${blocking.map((r) => `  ✗ ${r.id} — ${r.detail}`).join('\n')}`);
  }

  // 5 — identité et empreintes
  const content = checksums(staging);
  const digest = sha256(content);
  const commit = git(['rev-parse', 'HEAD']);
  const dirty = git(['status', '--porcelain']) !== '';
  const id = `${brief.site.id}-${opts.target}-${digest.slice(0, 12)}`;
  const lock = existsSync(join(staging, 'app', 'composer.lock')) ? JSON.parse(readFileSync(join(staging, 'app', 'composer.lock'), 'utf8')) : null;
  const manifest = {
    id,
    siteId: brief.site.id,
    target: opts.target,
    origin: config.origin,
    profile: profile.profile,
    contentSha256: digest,
    source: { commit, dirty },
    factory: { version: pkg.version, schemaVersion: SCHEMA_VERSION },
    tools: {
      node: process.version,
      astro: JSON.parse(readFileSync(join(ROOT, 'node_modules', 'astro', 'package.json'), 'utf8')).version,
      phpPlatform: lock?.platform?.php ?? null,
      phpmailer: lock?.packages?.find((p: { name: string }) => p.name === 'phpmailer/phpmailer')?.version ?? null,
      vendorSource,
    },
    audit: { blocking: 0, warnings: audit.filter((r) => !r.ok && r.severity === 'warn').length, checks: audit.length },
  };
  writeFileSync(join(staging, 'release.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(staging, 'SHA256SUMS'), checksums(staging, ['SHA256SUMS']));

  const dir = join(opts.outBase, id);
  rmSync(dir, { recursive: true, force: true });
  renameSync(staging, dir);
  const archive = `${dir}.tar.gz`;
  // Archive déterministe : ordre, dates, propriétaires et en-tête gzip fixés.
  execFileSync('tar', ['--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', '-C', opts.outBase, '-cf', `${dir}.tar`, id]);
  execFileSync('gzip', ['-n', '-f', `${dir}.tar`]);
  writeFileSync(`${archive}.sha256`, `${sha256(readFileSync(archive))}  ${id}.tar.gz\n`);
  if (!statSync(archive).isFile()) throw new Error('archive absente');
  return { id, dir, archive, audit };
}
