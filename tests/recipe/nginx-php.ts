/**
 * RECETTE LOCALE du profil vps-nginx : nginx + PHP-FPM 8.4 en conteneurs,
 * SMTP authentifié vers une boîte de CAPTURE locale (aucun envoi externe).
 *
 * Déploie EXACTEMENT les octets de l'archive de release (empreinte vérifiée),
 * dans une disposition releases/<id> + lien `current`, puis exerce le site
 * et le formulaire par HTTP et dans un navigateur (avec et sans JavaScript).
 *
 *   node tests/recipe/nginx-php.ts --release .generated/releases/<id> [--browsers chromium,firefox,webkit]
 *
 * Prérequis : Docker, images épinglées ci-dessous, release construite avec
 * tests/recipe/profile.json. Rapport : .generated/reports/<id>/recipe.json.
 * Ce que la recette NE prouve PAS : TLS, DNS, réception dans une vraie boîte,
 * comportement d'un serveur de production. Ces points restent pending_external.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, firefox, webkit, type Browser, type BrowserType } from '@playwright/test';
import { startCapture } from '../../engine/qa/smtp-capture.ts';

import { IMAGES } from './images.ts';

const { values } = parseArgs({ options: { release: { type: 'string' }, browsers: { type: 'string', default: 'chromium' } } });
if (!values.release) throw new Error('--release <répertoire> requis');
const releaseDir = resolve(values.release);
const id = basename(releaseDir);
const archive = `${releaseDir}.tar.gz`;
const BASE = 'http://127.0.0.1:8088';
const work = resolve('.generated', 'recipe', id);
const report: Array<{ check: string; ok: boolean; detail: string }> = [];
const check = (name: string, ok: boolean, detail = '') => {
  report.push({ check: name, ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const docker = (args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const cleanup = () => {
  for (const c of ['factory-recipe-php', 'factory-recipe-nginx']) spawnSync('docker', ['rm', '-f', c], { stdio: 'ignore' });
};

// 1 — identité de l'archive puis installation des octets audités
const expected = readFileSync(`${archive}.sha256`, 'utf8').split(' ')[0];
const actual = createHash('sha256').update(readFileSync(archive)).digest('hex');
check('archive.sha256', expected === actual, `${actual.slice(0, 16)}…`);
if (expected !== actual) process.exit(1);
rmSync(work, { recursive: true, force: true });
const siteRoot = join(work, 'site');
mkdirSync(join(siteRoot, 'releases'), { recursive: true });
execFileSync('tar', ['-xzf', archive, '-C', join(siteRoot, 'releases')]);
symlinkSync(`releases/${id}`, join(siteRoot, 'current'));
const varDir = join(siteRoot, 'var');
mkdirSync(varDir, { recursive: true });
chmodSync(varDir, 0o777); // conteneur de recette : www-data doit pouvoir écrire le compteur de débit
const installed = join(siteRoot, 'releases', id);
const sums = readFileSync(join(installed, 'SHA256SUMS'), 'utf8').trim().split('\n');
const bad = sums.filter((l) => {
  const [h, f] = l.split(/\s{2}/);
  return createHash('sha256').update(readFileSync(join(installed, f!))).digest('hex') !== h;
});
check('release.files-match-SHA256SUMS', bad.length === 0, `${sums.length} fichiers`);

// 2 — services
const user = `recette-${randomBytes(3).toString('hex')}`;
const pass = randomBytes(12).toString('hex');
const mailDir = join(work, 'mailbox');
const capture = await startCapture({ port: 2525, dir: mailDir, username: user, password: pass });
const mails = () => (existsSync(mailDir) ? readdirSync(mailDir).filter((f) => f.endsWith('.eml')).sort() : []);
// Les fichiers du compteur appartiennent à www-data (conteneur) : on les efface DEPUIS le conteneur,
// sans dépendre des droits de l'utilisateur qui lance la recette (root en local, runner en CI).
const resetRate = () => docker(['exec', 'factory-recipe-php', 'rm', '-rf', '/srv/site/var/ratelimit']);

cleanup();
let failed = false;
try {
  const conf = join(installed, 'config', 'nginx', 'site.conf');
  const nginxTest = spawnSync('docker', ['run', '--rm', '--network', 'host', '-v', `${conf}:/etc/nginx/conf.d/default.conf:ro`, '-v', `${siteRoot}:/srv/site:ro`, IMAGES.nginx, 'nginx', '-t'], { encoding: 'utf8' });
  check('nginx.config-test (nginx -t)', nginxTest.status === 0, (nginxTest.stderr.trim().split('\n').pop() ?? '').slice(0, 120));
  docker(['run', '-d', '--name', 'factory-recipe-php', '--network', 'host',
    '-e', `FACTORY_CAPTURE_SMTP_USER=${user}`, '-e', `FACTORY_CAPTURE_SMTP_PASSWORD=${pass}`,
    '-v', `${siteRoot}:/srv/site:ro`, '-v', `${varDir}:/srv/site/var`,
    '-v', `${join(installed, 'config', 'php-fpm', 'pool.conf')}:/usr/local/etc/php-fpm.d/zz-factory.conf:ro`,
    IMAGES.php]);
  docker(['run', '-d', '--name', 'factory-recipe-nginx', '--network', 'host', '-v', `${conf}:/etc/nginx/conf.d/default.conf:ro`, '-v', `${siteRoot}:/srv/site:ro`, IMAGES.nginx]);
  const versions = {
    php: docker(['exec', 'factory-recipe-php', 'php', '-r', 'echo PHP_VERSION;']),
    nginx: spawnSync('docker', ['exec', 'factory-recipe-nginx', 'nginx', '-v'], { encoding: 'utf8' }).stderr.trim(),
  };
  console.log(`  versions : PHP ${versions.php} · ${versions.nginx}`);
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${BASE}/`)).ok) break;
    } catch {
      /* démarrage */
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // 3 — HTTP : pages, en-têtes, surfaces interdites
  const home = await fetch(`${BASE}/`);
  const html = await home.text();
  check('http.home-200', home.status === 200);
  check('http.header-csp', (home.headers.get('content-security-policy') ?? '').includes("frame-ancestors 'none'"), home.headers.get('content-security-policy') ?? 'absent');
  check('http.meta-csp-hashes', /http-equiv="content-security-policy"[^>]*script-src 'self'/.test(html));
  check('http.noindex-header', home.headers.get('x-robots-tag') === 'noindex, nofollow');
  check('http.nosniff', home.headers.get('x-content-type-options') === 'nosniff');
  const asset = /\/_astro\/[^"]+\.css/.exec(html)?.[0];
  const assetRes = asset ? await fetch(`${BASE}${asset}`) : null;
  check('http.asset-immutable', Boolean(assetRes?.headers.get('cache-control')?.includes('immutable')), asset ?? 'aucun asset');
  const notFound = await fetch(`${BASE}/nexiste-pas/`);
  check('http.404-page', notFound.status === 404 && (await notFound.text()).includes('Page introuvable'));
  for (const p of ['/app/config/runtime.json', '/../app/config/runtime.json', '/.git/config', '/api/autre.php', '/SHA256SUMS', '/release.json', '/config/nginx/site.conf']) {
    const r = await fetch(`${BASE}${p}`, { redirect: 'manual' });
    check(`http.not-served ${p}`, r.status === 404, String(r.status));
  }
  const getEndpoint = await fetch(`${BASE}/api/contact.php`);
  check('form.get-405', getEndpoint.status === 405);
  const pages = ['/', '/contact/', '/en/', '/en/contact/'];
  const served = (await Promise.all(pages.map(async (p) => (await fetch(`${BASE}${p}`)).text()))).join('');
  check('http.no-internal-address-served', !served.includes('demandes@example.com') && !served.includes('formulaire@mail.example.com'));

  // 4 — endpoint par HTTP (JSON) : rejets
  const valid = { locale: 'fr', name: 'Camille Martin', company: 'Atelier fictif', email: 'camille@example.org', message: 'Bonjour, test de recette.', website: '' };
  const post = (body: Record<string, string>, headers: Record<string, string> = {}) =>
    fetch(`${BASE}/api/contact.php`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', Origin: BASE, ...headers }, body: new URLSearchParams(body) });
  resetRate();
  let before = mails().length;
  let r = await post({ ...valid, name: 'A\r\nBcc: victime@example.com' });
  let j = (await r.json()) as { status: string; errors?: Array<{ field: string; code: string }> };
  check('form.header-injection-rejected', r.status === 422 && Boolean(j.errors?.some((e) => e.field === 'name' && e.code === 'invalid_chars')) && mails().length === before, `${r.status}`);
  r = await post({ ...valid, admin: '1' });
  check('form.unexpected-field-rejected', r.status === 422 && mails().length === before);
  r = await post(valid, { Origin: 'https://attaquant.example' });
  check('form.foreign-origin-403', r.status === 403 && ((await r.json()) as { status: string }).status === 'origin_rejected');
  before = mails().length;
  r = await fetch(`${BASE}/api/contact.php`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(valid) });
  check('form.no-origin-403', r.status === 403 && mails().length === before, String(r.status));
  // Même rejet pour un formulaire HTML : 303 vers la page « indisponible », rien n'est envoyé.
  r = await fetch(`${BASE}/api/contact.php`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(valid) });
  check('form.no-origin-html-303', r.status === 303 && (r.headers.get('location') ?? '').startsWith('/contact/indisponible/') && mails().length === before, `${r.status} ${r.headers.get('location')}`);
  r = await post({ ...valid, message: 'x'.repeat(20_000) });
  check('form.oversize-413', r.status === 413, String(r.status));
  r = await fetch(`${BASE}/api/contact.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE, Accept: 'application/json' }, body: JSON.stringify(valid) });
  check('form.json-body-415', r.status === 415, String(r.status));

  // 5 — acceptation par le transport (capture) et contenu du message
  resetRate();
  before = mails().length;
  r = await post(valid);
  j = (await r.json()) as { status: string };
  const files = mails();
  check('form.accepted-by-smtp-capture', r.status === 200 && j.status === 'accepted' && files.length === before + 1);
  const eml = files.length ? readFileSync(join(mailDir, files.at(-1)!), 'utf8') : '';
  check('mail.envelope-to-recipient', /X-Capture-Envelope-To: <demandes@example\.com>/.test(eml));
  check('mail.from-is-sending-identity', /^From: Ostral Conseil <formulaire@mail\.example\.com>/m.test(eml));
  check('mail.reply-to-is-submitter', /^Reply-To: camille@example\.org/m.test(eml));
  check('mail.plain-text', /^Content-Type: text\/plain; charset=utf-8/im.test(eml) && !/text\/html/i.test(eml));
  check('mail.no-bcc-header', !/^Bcc:/im.test(eml));

  // 6 — erreur de transport
  resetRate();
  capture.setFailMode('data');
  before = mails().length;
  r = await post(valid);
  check('form.transport-error-502', r.status === 502 && ((await r.json()) as { status: string }).status === 'transport_error' && mails().length === before);
  capture.setFailMode('none');

  // 7 — navigateurs : parcours sans et avec JavaScript
  const engines: Record<string, BrowserType> = { chromium, firefox, webkit };
  for (const name of (values.browsers ?? 'chromium').split(',')) {
    const type = engines[name];
    if (!type) throw new Error(`navigateur inconnu : ${name}`);
    let browser: Browser;
    const bundled = existsSync(type.executablePath());
    if (!bundled && name === 'chromium' && process.env.PW_CHROMIUM_PATH) browser = await type.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
    else browser = await type.launch();
    const label = `${name} ${browser.version()}${bundled ? '' : ' (hors révision Playwright)'}`;
    console.log(`  navigateur : ${label}`);

    // sans JavaScript
    resetRate();
    let ctx = await browser.newContext({ javaScriptEnabled: false });
    let page = await ctx.newPage();
    await page.goto(`${BASE}/contact/`);
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    check(`[${name}] nojs.invalid-to-result-page`, new URL(page.url()).pathname === '/contact/a-corriger/', page.url());
    before = mails().length;
    await page.goto(`${BASE}/contact/`);
    await page.fill('#name', 'Dominique Fictif');
    await page.fill('#company', 'Société fictive');
    await page.fill('#email', 'dominique@example.org');
    await page.fill('#message', 'Parcours sans JavaScript.');
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    check(`[${name}] nojs.accepted-to-result-page`, new URL(page.url()).pathname === '/contact/envoye/' && mails().length === before + 1, page.url());
    check(`[${name}] nojs.honest-wording`, (await page.textContent('h1'))?.includes('serveur d’envoi') ?? false);
    capture.setFailMode('data');
    await page.goto(`${BASE}/en/contact/`);
    await page.fill('#name', 'Dominique Fictif');
    await page.fill('#company', 'Fictional Ltd');
    await page.fill('#email', 'dominique@example.org');
    await page.fill('#message', 'No-JS transport failure.');
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    check(`[${name}] nojs.transport-error-to-result-page`, new URL(page.url()).pathname === '/en/contact/unavailable/', page.url());
    capture.setFailMode('none');
    await ctx.close();

    // avec JavaScript
    resetRate();
    ctx = await browser.newContext();
    page = await ctx.newPage();
    const csp: string[] = [];
    page.on('console', (m) => /Content Security Policy|Refused to/i.test(m.text()) && csp.push(m.text()));
    await page.goto(`${BASE}/contact/`);
    await page.click('button[type=submit]');
    const summaryVisible = await page.isVisible('[data-form-summary]');
    const focused = await page.evaluate(() => document.activeElement?.hasAttribute('data-form-summary') ?? false);
    check(`[${name}] js.client-validation-summary-focused`, summaryVisible && focused);
    check(`[${name}] js.aria-invalid`, (await page.getAttribute('#email', 'aria-invalid')) === 'true');
    before = mails().length;
    await page.fill('#name', 'Alex Fictif');
    await page.fill('#company', 'Entreprise fictive');
    await page.fill('#email', 'alex@example.org');
    await page.fill('#message', 'Parcours avec JavaScript.');
    await page.click('button[type=submit]');
    await page.waitForSelector('[data-form-status]:not([hidden])');
    const msg = (await page.textContent('[data-form-status]')) ?? '';
    check(`[${name}] js.accepted-message-honest`, msg.includes('acceptée par notre serveur d’envoi') && msg.includes('ne garantit pas') && mails().length === before + 1, msg.slice(0, 90));
    capture.setFailMode('data');
    await page.goto(`${BASE}/contact/`);
    await page.fill('#name', 'Alex Fictif');
    await page.fill('#company', 'Entreprise fictive');
    await page.fill('#email', 'alex@example.org');
    await page.fill('#message', 'Panne de transport.');
    await page.click('button[type=submit]');
    await page.waitForSelector('[data-form-status]:not([hidden])');
    const err = (await page.textContent('[data-form-status]')) ?? '';
    check(`[${name}] js.transport-error-keeps-input`, err.includes('momentanément impossible') && (await page.inputValue('#message')) === 'Panne de transport.');
    capture.setFailMode('none');
    check(`[${name}] js.no-csp-violation`, csp.length === 0, csp.join(' | ').slice(0, 200));
    await ctx.close();
    await browser.close();
  }

  // 8 — limitation de débit (dernière : elle consomme le quota)
  resetRate();
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) statuses.push((await post({ ...valid, email: 'pas-une-adresse' })).status);
  check('form.rate-limit-429-after-5', JSON.stringify(statuses) === JSON.stringify([422, 422, 422, 422, 422, 429]), statuses.join(','));
  const logs = spawnSync('docker', ['logs', 'factory-recipe-php'], { encoding: 'utf8' });
  const logText = `${logs.stdout}${logs.stderr}`;
  check('logs.no-message-body', logText.includes('[factory-form]') && !logText.includes('Parcours avec JavaScript') && !logText.includes('camille@example.org'));

  const out = resolve('.generated', 'reports', id);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'recipe.json'), `${JSON.stringify({ release: id, archiveSha256: actual, images: IMAGES, versions, browsers: values.browsers, date: new Date().toISOString(), proves: 'acceptation par une boîte SMTP de capture locale', doesNotProve: ['TLS', 'DNS / SPF / DKIM / DMARC', 'réception dans une boîte réelle', 'serveur de production'], checks: report }, null, 2)}\n`);
  console.log(`  rapport : ${join(out, 'recipe.json')}`);
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  cleanup();
  await capture.close();
}
const ko = report.filter((x) => !x.ok);
console.log(`\n  ${report.length - ko.length}/${report.length} contrôles réussis${failed ? ' — RECETTE INTERROMPUE (erreur ci-dessus), contrôles suivants non exécutés' : ''}`);
process.exit(failed || ko.length ? 1 : 0);

