/**
 * RECETTE DE BASCULE ET DE RETOUR ARRIÈRE (profil vps-nginx, conteneurs).
 *
 * Le « serveur » est un répertoire /srv/site monté dans nginx (lecture-écriture,
 * c'est là que tourne engine/deploy/factory-deploy.sh, comme un opérateur) et
 * dans PHP-FPM 8.4 (lecture seule, sauf var/). La configuration nginx active est
 * celle de la release courante (lien vers current/config/nginx/site.conf).
 *
 * Scénario : v1 → v2 sous trafic (aucune erreur attendue) → rollback → v2 →
 * archive altérée refusée → empreinte erronée refusée → v3 défaillante
 * (contrôle de santé) → retour automatique → prune.
 *
 *   node tests/recipe/deploy.ts
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assembleRelease } from '../../engine/release/index.ts';
import { IMAGES } from './images.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const WORK = join(ROOT, '.generated', 'deploy-recipe');
const BASE = 'http://127.0.0.1:8088';
const report: Array<{ check: string; ok: boolean; detail: string }> = [];
const check = (name: string, ok: boolean, detail = '') => {
  report.push({ check: name, ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const docker = (args: string[]) => spawnSync('docker', args, { encoding: 'utf8' });
const containers = ['factory-deploy-nginx', 'factory-deploy-php'];
const cleanup = () => containers.forEach((c) => docker(['rm', '-f', c]));

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

// 1 — trois releases réelles, issues de variantes de la fixture A
const variant = (name: string, edit: (dir: string) => void) => {
  const dir = join(WORK, 'sites', name);
  cpSync(join(ROOT, 'examples', 'fixture-a-services'), dir, { recursive: true, filter: (s) => !s.includes('/design/captures') });
  edit(dir);
  return dir;
};
const v1 = variant('v1', () => undefined);
const v2 = variant('v2', (d) => {
  const pages = join(d, 'src', 'content', 'pages.ts');
  writeFileSync(pages, readFileSync(pages, 'utf8').replace("kicker: 'Conseil achats · PME industrielles'", "kicker: 'Conseil achats · PME industrielles · version 2'"));
  const form = join(d, 'content', 'form.yaml');
  writeFileSync(form, readFileSync(form, 'utf8').replace('maxLength: 120', 'maxLength: 60'));
});
const v3 = variant('v3', (d) => rmSync(join(d, 'src', 'pages', 'prestations'), { recursive: true }));
const profile = { releaseRoot: '/srv/site/current', varDir: '/srv/site/var', fastcgiPass: '127.0.0.1:9000', listen: 8088, tls: null, localPreviewOrigin: BASE };
const quiet = () => undefined;
const inbox = join(WORK, 'inbox');
mkdirSync(inbox);
const rel: Record<string, { id: string; sha: string }> = {};
for (const [name, dir] of [['v1', v1], ['v2', v2], ['v3', v3]] as const) {
  const r = await assembleRelease({ siteDir: dir, target: 'preview', outBase: join(WORK, 'releases'), profile, log: quiet });
  copyFileSync(r.archive, join(inbox, `${name}.tar.gz`));
  rel[name] = { id: r.id, sha: readFileSync(`${r.archive}.sha256`, 'utf8').split(' ')[0]! };
  console.log(`  release ${name} : ${r.id}`);
}
// Archive altérée : un octet changé à la fin du flux gzip.
const tampered = readFileSync(join(inbox, 'v3.tar.gz'));
tampered[tampered.length - 20] = (tampered[tampered.length - 20] ?? 0) ^ 0xff;
writeFileSync(join(inbox, 'v3-tampered.tar.gz'), tampered);

// 2 — « serveur »
const srv = join(WORK, 'srv-site');
mkdirSync(join(srv, 'var'), { recursive: true });
execFileSync('chmod', ['0777', join(srv, 'var')]);
cleanup();
const deployScript = join(ROOT, 'engine', 'deploy', 'factory-deploy.sh');
docker(['run', '-d', '--name', 'factory-deploy-nginx', '--network', 'host',
  '-v', `${srv}:/srv/site`, '-v', `${inbox}:/inbox:ro`, '-v', `${deployScript}:/usr/local/bin/factory-deploy:ro`,
  '--entrypoint', 'sh', IMAGES.nginx, '-c',
  'until [ -e /srv/site/current/config/nginx/site.conf ]; do sleep 0.2; done; ln -sf /srv/site/current/config/nginx/site.conf /etc/nginx/conf.d/default.conf; exec nginx -g "daemon off;"']);
const deploy = (args: string[]) => docker(['exec', '-e', 'FACTORY_ROOT=/srv/site', 'factory-deploy-nginx', 'sh', '/usr/local/bin/factory-deploy', ...args]);
const RELOAD = 'nginx -t 2>/dev/null && nginx -s reload';
/**
 * Après `nginx -s reload`, les anciens workers ferment leurs connexions
 * keep-alive inactives : un client réutilisant une telle connexion reçoit
 * « other side closed ». Les navigateurs rejouent alors la requête ; on fait
 * de même UNE fois, et on compte ces relances dans le rapport.
 */
let keepAliveRetries = 0;
const fetchRetry: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (e) {
    if ((e as { cause?: { code?: string } }).cause?.code !== 'UND_ERR_SOCKET') throw e;
    keepAliveRetries++;
    return fetch(input, init);
  }
};
const marker = async () => ((await (await fetchRetry(`${BASE}/`)).text()).includes('version 2') ? 'v2' : 'v1');
const phpErrors = async () => {
  docker(['exec', 'factory-deploy-php', 'rm', '-rf', '/srv/site/var/ratelimit']);
  const r = await fetchRetry(`${BASE}/api/contact.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', Origin: BASE },
    body: new URLSearchParams({ name: 'n'.repeat(100), company: 'x', email: 'pas-une-adresse', message: 'x', website: '' }),
  });
  const j = (await r.json()) as { errors?: Array<{ field: string; code: string }> };
  return (j.errors ?? []).some((e) => e.field === 'name' && e.code === 'too_long') ? 'contrat-v2' : 'contrat-v1';
};
const waitHttp = async () => {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${BASE}/`)).ok) return; } catch { /* démarrage */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('nginx ne répond pas');
};

let failed = false;
try {
  // v1 : première installation
  let r = deploy(['install', '--archive', '/inbox/v1.tar.gz', '--sha256', rel.v1!.sha, '--activate']);
  check('install v1 + activation', r.status === 0, r.stderr.trim());
  docker(['run', '-d', '--name', 'factory-deploy-php', '--network', 'host', '-v', `${srv}:/srv/site:ro`, '-v', `${join(srv, 'var')}:/srv/site/var`,
    '--entrypoint', 'sh', IMAGES.php, '-c', 'ln -sf /srv/site/current/config/php-fpm/pool.conf /usr/local/etc/php-fpm.d/zz-factory.conf && exec php-fpm']);
  await waitHttp();
  await new Promise((res) => setTimeout(res, 800));
  check('v1 servie (pages)', (await marker()) === 'v1');
  check('v1 servie (PHP)', (await phpErrors()) === 'contrat-v1');

  // v2 sous trafic continu : aucune réponse en erreur pendant la bascule
  let stop = false;
  let requests = 0;
  const errors: string[] = [];
  const load = (async () => {
    while (!stop) {
      for (const p of ['/', '/prestations/diagnostic-achats/']) {
        try {
          const res = await fetch(`${BASE}${p}`);
          requests++;
          if (res.status !== 200) errors.push(`${p} ${res.status}`);
          await res.arrayBuffer();
        } catch (e) {
          errors.push(`${p} ${String(e)}`);
        }
      }
    }
  })();
  await new Promise((res) => setTimeout(res, 300));
  r = deploy(['install', '--archive', '/inbox/v2.tar.gz', '--sha256', rel.v2!.sha, '--activate', '--health', `${BASE}/`, '--reload', RELOAD]);
  await new Promise((res) => setTimeout(res, 500));
  stop = true;
  await load;
  check('install v2 + bascule sous trafic', r.status === 0, r.stderr.trim());
  check('aucune erreur HTTP pendant la bascule', errors.length === 0 && requests > 20, `${requests} requêtes, ${errors.length} erreur(s) ${errors.slice(0, 3).join(' ')}`);
  check('v2 servie (pages)', (await marker()) === 'v2');
  check('v2 servie (PHP, sans redémarrage PHP-FPM)', (await phpErrors()) === 'contrat-v2');

  // retour arrière
  r = deploy(['rollback', '--health', `${BASE}/`, '--reload', RELOAD]);
  check('rollback', r.status === 0, (r.stdout + r.stderr).trim().split('\n').pop());
  check('v1 de nouveau servie (pages)', (await marker()) === 'v1');
  check('v1 de nouveau servie (PHP)', (await phpErrors()) === 'contrat-v1');
  r = deploy(['activate', '--id', rel.v2!.id, '--health', `${BASE}/`, '--reload', RELOAD]);
  check('réactivation v2', r.status === 0 && (await marker()) === 'v2');

  // refus d'intégrité
  r = deploy(['install', '--archive', '/inbox/v3-tampered.tar.gz', '--sha256', rel.v3!.sha, '--activate']);
  check('archive altérée refusée', r.status !== 0 && /empreinte/.test(r.stderr) && (await marker()) === 'v2', r.stderr.trim());
  r = deploy(['install', '--archive', '/inbox/v3.tar.gz', '--sha256', 'a'.repeat(64), '--activate']);
  check('empreinte attendue erronée refusée', r.status !== 0 && (await marker()) === 'v2', r.stderr.trim());
  r = deploy(['install', '--archive', '/inbox/v3.tar.gz', '--activate']);
  check('installation sans empreinte refusée', r.status !== 0, r.stderr.trim());

  // v3 défaillante : contrôle de santé en échec → retour automatique à v2
  r = deploy(['install', '--archive', '/inbox/v3.tar.gz', '--sha256', rel.v3!.sha, '--activate', '--health', `${BASE}/prestations/diagnostic-achats/`, '--reload', RELOAD]);
  const page = await fetchRetry(`${BASE}/prestations/diagnostic-achats/`);
  check('v3 défaillante : retour automatique', r.status !== 0 && /retour automatique/.test(r.stderr) && (await marker()) === 'v2' && page.status === 200, r.stderr.trim());

  // inventaire et purge
  r = deploy(['list']);
  check('liste : 3 releases, v2 courante', r.stdout.split('\n').filter(Boolean).length === 3 && r.stdout.includes(`* ${rel.v2!.id}`), r.stdout.trim().replace(/\n/g, ' | '));
  r = deploy(['prune', '--keep', '2']);
  const after = deploy(['list']).stdout;
  check('prune --keep 2 : courante conservée, plus ancienne supprimée', r.status === 0 && !after.includes(rel.v1!.id) && after.includes(`* ${rel.v2!.id}`), after.trim().replace(/\n/g, ' | '));
  const log = readFileSync(join(srv, 'deploy.log'), 'utf8');
  check('journal de déploiement', /\tactivate\t.*\tfailed-rolled-back/.test(log) && /\trollback\t/.test(log) && /sha-mismatch/.test(log), `${log.trim().split('\n').length} lignes`);
  writeFileSync(join(WORK, 'deploy.log.copy'), log);
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  cleanup();
}
const out = join(ROOT, '.generated', 'reports', 'deploy-recipe.json');
mkdirSync(join(ROOT, '.generated', 'reports'), { recursive: true });
writeFileSync(out, `${JSON.stringify({ date: new Date().toISOString(), images: IMAGES, releases: rel, keepAliveRetriesOutsideLoadTest: keepAliveRetries, checks: report }, null, 2)}\n`);
console.log(`  relances keep-alive (hors test de charge, qui n'en fait aucune) : ${keepAliveRetries}`);
const ko = report.filter((x) => !x.ok).length;
console.log(`\n  ${report.length - ko}/${report.length} contrôles réussis${failed ? ' — RECETTE INTERROMPUE' : ''} · rapport : ${out}`);
process.exit(failed || ko ? 1 : 0);
