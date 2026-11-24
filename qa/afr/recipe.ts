/**
 * RECETTE LOCALE AFR TAXI (adaptée de tests/recipe/nginx-php.ts) du profil vps-nginx : nginx + PHP-FPM 8.4 en conteneurs,
 * SMTP authentifié vers une boîte de CAPTURE locale (aucun envoi externe).
 *
 * Déploie EXACTEMENT les octets de l'archive de release (empreinte vérifiée),
 * dans une disposition releases/<id> + lien `current`, puis exerce le site
 * et le formulaire par HTTP et dans un navigateur (avec et sans JavaScript).
 *
 *   node qa/afr/recipe.ts --release .generated/releases/<id> [--browsers chromium,firefox,webkit]
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

import { IMAGES } from '../../tests/recipe/images.ts';

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


  // 3 — HTTP : pages, en-têtes, anciennes URL, surfaces interdites
  const home = await fetch(`${BASE}/`);
  const html = await home.text();
  check('http.home-200', home.status === 200);
  check('http.header-csp', (home.headers.get('content-security-policy') ?? '').includes("frame-ancestors 'none'"));
  check('http.meta-csp-no-unsafe', /http-equiv="content-security-policy"/.test(html) && !/unsafe-inline|unsafe-eval/.test(html));
  check('http.noindex-header', home.headers.get('x-robots-tag') === 'noindex, nofollow');
  check('call.tel-link-without-js', /href="tel:\+33614339341"/.test(html));
  check('http.no-third-party-request-in-html', !/(src|href)="https?:\/\/(?!www\.afr-taxi\.fr)[^"]+\.(js|css|woff2?)"/.test(html) && !/wa\.me\/[0-9]+\?text=/.test(html));
  for (const p of ['/taxi-prive/', '/transfert-gare-aeroport/', '/a-propos/', '/contact/', '/assistance/', '/transport-medical/', '/assistance-deplacement/', '/mentions-legales/', '/vie-privee/', '/privacy/', '/taxi-prive', '/contact', '/assistance']) {
    const r = await fetch(`${BASE}${p}`, { redirect: 'manual' });
    const body = await r.text();
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(body)?.[1] ?? '';
    check(`route ${p}`, r.status === 200 && canonical.endsWith(p.endsWith('/') ? p : `${p}/`), `${r.status} ${canonical}`);
  }
  const notFound = await fetch(`${BASE}/nexiste-pas/`);
  check('http.404-page', notFound.status === 404 && (await notFound.text()).includes('Page introuvable'));
  for (const p of ['/app/config/runtime.json', '/.git/config', '/api/autre.php', '/SHA256SUMS', '/release.json', '/config/nginx/site.conf']) {
    const r = await fetch(`${BASE}${p}`, { redirect: 'manual' });
    check(`http.not-served ${p}`, r.status === 404, String(r.status));
  }
  const served = (await Promise.all(['/', '/contact/', '/mentions-legales/'].map(async (p) => (await fetch(`${BASE}${p}`)).text()))).join('');
  check('http.no-internal-data-served', !served.includes('recette.afr-taxi.test') && !served.includes('FIGMIR'));
  const contactHtml = await (await fetch(`${BASE}/contact/`)).text();
  check('form.no-medical-field', !/diagnostic"|ordonnance"|securite|s[ée]curit[ée]_sociale|name="motif"/i.test(contactHtml.replace(/<p[^>]*>[^<]*<\/p>/g, '')));
  check('form.not-a-booking-notice', contactHtml.includes('ne vaut pas confirmation de réservation'));

  // 4 — endpoint : rejets
  const paris = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const inDays = (n: number) => paris(new Date(Date.now() + n * 86_400_000));
  const valid = { locale: 'fr', pickup: 'Gare de Saint-Rambert-d’Albon', dropoff: 'Aéroport (recette)', date: inDays(3), time: '10:15', passengers: '2', travel_ref: 'TGV 0000', details: 'Deux valises.', name: 'Camille Recette', phone: '+33 6 00 00 00 00', email: 'camille@example.org', website: '' };
  const post = (body: Record<string, string>, headers: Record<string, string> = {}) =>
    fetch(`${BASE}/api/contact.php`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', Origin: BASE, ...headers }, body: new URLSearchParams(body) });
  const errs = async (r: Response) => ((await r.json()) as { errors?: Array<{ field: string; code: string }> }).errors ?? [];
  resetRate();
  let before = mails().length;
  let r = await post({ ...valid, date: inDays(-1) });
  check('form.past-date-rejected', r.status === 422 && (await errs(r)).some((e) => e.field === 'date' && e.code === 'in_the_past') && mails().length === before);
  r = await post({ ...valid, date: '2027-02-29' });
  check('form.impossible-date-rejected', r.status === 422 && (await errs(r)).some((e) => e.code === 'invalid_date'));
  r = await post({ ...valid, date: '2027-10-31', time: '02:30' });
  const amb = await errs(r);
  check('form.ambiguous-dst-time-rejected', r.status === 422 && amb.some((e) => e.code === 'ambiguous_time' || e.code === 'too_far'), JSON.stringify(amb));
  r = await post({ ...valid, name: 'A\r\nBcc: victime@example.com' });
  check('form.header-injection-rejected', r.status === 422 && (await errs(r)).some((e) => e.field === 'name' && e.code === 'invalid_chars') && mails().length === before);
  resetRate();
  r = await post(valid, { Origin: 'https://attaquant.example' });
  check('form.foreign-origin-403', r.status === 403);
  r = await post({ ...valid, details: 'x'.repeat(20_000) });
  check('form.oversize-413', r.status === 413, String(r.status));
  r = await post({ ...valid, diagnostic: 'x' });
  check('form.unexpected-field-rejected', r.status === 422 && mails().length === before);

  // 5 — acceptation par la capture et contenu du message
  resetRate();
  before = mails().length;
  r = await post(valid);
  const j = (await r.json()) as { status: string };
  const files = mails();
  check('form.accepted-by-smtp-capture', r.status === 200 && j.status === 'accepted' && files.length === before + 1);
  const eml = files.length ? readFileSync(join(mailDir, files.at(-1)!), 'utf8') : '';
  const decoded = eml.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h: string) => `%${h}`);
  let body = decoded;
  try { body = decodeURIComponent(decoded.replace(/%(?![0-9A-F]{2})/g, '%25')); } catch { /* garde la forme brute */ }
  check('mail.envelope-to-capture-recipient', /X-Capture-Envelope-To: <chauffeur@recette\.afr-taxi\.test>/.test(eml));
  check('mail.from-is-sending-identity', /^From: AFR TAXI <demandes@recette\.afr-taxi\.test>/m.test(eml));
  check('mail.reply-to-is-submitter', /^Reply-To: camille@example\.org/m.test(eml));
  check('mail.readable-trip', body.includes('Adresse de départ : Gare de Saint-Rambert') && body.includes(`Date du départ : ${valid.date}`) && body.includes('Heure du départ : 10:15') && body.includes('Horaire interprété :') && body.includes('Europe/Paris'), body.slice(0, 0));
  resetRate();
  before = mails().length;
  r = await post({ ...valid, email: '' });
  const mailNoEmail = mails().at(-1);
  check('form.email-optional-phone-suffices', r.status === 200 && mails().length === before + 1 && !/^Reply-To: camille/m.test(readFileSync(join(mailDir, mailNoEmail!), 'utf8')));

  // 6 — erreur de transport
  resetRate();
  capture.setFailMode('data');
  before = mails().length;
  r = await post(valid);
  check('form.transport-error-502', r.status === 502 && mails().length === before);
  capture.setFailMode('none');

  // 7 — navigateurs
  const engines: Record<string, BrowserType> = { chromium, firefox, webkit };
  const fill = async (page: import('@playwright/test').Page, v: Record<string, string>) => {
    for (const [k, x] of Object.entries(v)) if (!['locale', 'website'].includes(k)) await page.fill(`#${k}`, x);
  };
  for (const name of (values.browsers ?? 'chromium').split(',')) {
    const type = engines[name];
    if (!type) throw new Error(`navigateur inconnu : ${name}`);
    let browser: Browser;
    const bundled = existsSync(type.executablePath());
    if (!bundled && name === 'chromium' && process.env.PW_CHROMIUM_PATH) browser = await type.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
    else browser = await type.launch();
    console.log(`  navigateur : ${name} ${browser.version()}${bundled ? '' : ' (hors révision Playwright)'}`);

    // sans JavaScript
    resetRate();
    let ctx = await browser.newContext({ javaScriptEnabled: false });
    let page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    check(`[${name}] nojs.call-link`, (await page.getAttribute('.masthead-call, .action-bar .btn-call', 'href')) === 'tel:+33614339341');
    await page.goto(`${BASE}/contact/`);
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    check(`[${name}] nojs.invalid-to-result-page`, new URL(page.url()).pathname === '/contact/a-corriger/', page.url());
    before = mails().length;
    await page.goto(`${BASE}/contact/`);
    await fill(page, valid);
    await page.click('button[type=submit]');
    await page.waitForLoadState();
    check(`[${name}] nojs.accepted-to-result-page`, new URL(page.url()).pathname === '/contact/envoyee/' && mails().length === before + 1, page.url());
    const h1 = (await page.textContent('h1')) ?? '';
    const txt = (await page.textContent('main')) ?? '';
    check(`[${name}] nojs.honest-wording`, h1.includes('serveur d’envoi') && txt.includes('pas une confirmation de course') && !/course (réservée|confirmée)/i.test(txt));
    check(`[${name}] nojs.no-form-data-in-url`, !page.url().includes('pickup') && !page.url().includes('Camille'));
    await ctx.close();

    // avec JavaScript
    resetRate();
    ctx = await browser.newContext();
    page = await ctx.newPage();
    const csp: string[] = [];
    const external: string[] = [];
    page.on('console', (m) => /Content Security Policy|Refused to/i.test(m.text()) && csp.push(m.text()));
    page.on('request', (q) => !q.url().startsWith(BASE) && external.push(q.url()));
    await page.goto(`${BASE}/contact/`);
    await page.click('button[type=submit]');
    check(`[${name}] js.summary-focused`, await page.evaluate(() => document.activeElement?.hasAttribute('data-form-summary') ?? false));
    await fill(page, { ...valid, date: inDays(-1) });
    await page.click('button[type=submit]');
    check(`[${name}] js.past-date-message`, ((await page.textContent('#date-error')) ?? '').includes('déjà passées'));
    check(`[${name}] js.whatsapp-unavailable-explained`, (await page.isVisible('[data-whatsapp-unavailable]')) && !(await page.isVisible('[data-whatsapp]')));
    before = mails().length;
    await page.fill('#date', valid.date);
    await page.click('button[type=submit]');
    await page.waitForSelector('[data-form-status]:not([hidden])');
    const msg = (await page.textContent('[data-form-status]')) ?? '';
    check(`[${name}] js.accepted-message-honest`, msg.includes('acceptée par notre serveur d’envoi') && msg.includes('pas une confirmation de course') && mails().length === before + 1, msg.slice(0, 80));
    capture.setFailMode('data');
    await page.goto(`${BASE}/contact/`);
    await fill(page, valid);
    await page.click('button[type=submit]');
    await page.waitForSelector('[data-form-status]:not([hidden])');
    check(`[${name}] js.transport-error-keeps-input`, ((await page.textContent('[data-form-status]')) ?? '').includes('momentanément impossible') && (await page.inputValue('#pickup')) === valid.pickup);
    capture.setFailMode('none');
    check(`[${name}] js.no-csp-violation`, csp.length === 0, csp.join(' | ').slice(0, 200));
    check(`[${name}] js.no-external-request`, external.length === 0, external.join(' ').slice(0, 200));
    await ctx.close();
    await browser.close();
  }

  // 8 — limitation de débit, journaux
  resetRate();
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) statuses.push((await post({ ...valid, phone: 'x' })).status);
  check('form.rate-limit-429-after-5', JSON.stringify(statuses) === JSON.stringify([422, 422, 422, 422, 422, 429]), statuses.join(','));
  const logs = spawnSync('docker', ['logs', 'factory-recipe-php'], { encoding: 'utf8' });
  const logText = `${logs.stdout}${logs.stderr}`;
  check('logs.no-message-body', logText.includes('[factory-form]') && !logText.includes('Saint-Rambert') && !logText.includes('camille@example.org') && !logText.includes('00 00 00 00'));

  const out = resolve('.generated', 'reports', id);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'recipe-afr.json'), `${JSON.stringify({ release: id, archiveSha256: actual, images: IMAGES, versions, browsers: values.browsers, date: new Date().toISOString(), proves: 'acceptation par une boîte SMTP de capture locale', doesNotProve: ['TLS', 'DNS / SPF / DKIM / DMARC', 'réception dans la boîte du chauffeur', 'serveur de production', 'ouverture réelle de WhatsApp'], checks: report }, null, 2)}\n`);
  console.log(`  rapport : ${join(out, 'recipe-afr.json')}`);
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  cleanup();
  await capture.close();
}
const ko = report.filter((x) => !x.ok);
console.log(`\n  ${report.length - ko.length}/${report.length} contrôles réussis${failed ? ' — RECETTE INTERROMPUE (erreur ci-dessus)' : ''}`);
process.exit(failed || ko.length ? 1 : 0);
