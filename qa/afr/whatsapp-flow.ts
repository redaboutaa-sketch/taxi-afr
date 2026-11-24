/**
 * Parcours WhatsApp dans un navigateur (accueil et contact), sur une copie
 * temporaire du site construite à part. Numéro : fait contact.whatsapp du
 * brief. AUCUN message n'est envoyé : le lien wa.me n'est jamais suivi.
 *
 *   PW_CHROMIUM_PATH=… node qa/afr/whatsapp-flow.ts
 */
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { launchChromium } from '../../tests/support/browser.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const work = mkdtempSync(join(tmpdir(), 'afr-wa-'));
const site = join(ROOT, '.generated', `wa-site-${process.pid}`);
cpSync(join(ROOT, 'site'), site, { recursive: true });
const out = join(work, 'dist');
const env = { ...process.env, FACTORY_SITE_DIR: site, FACTORY_OUT_DIR: out, ASTRO_TELEMETRY_DISABLED: '1' };
const b = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], { cwd: ROOT, env, encoding: 'utf8' });
if (b.status !== 0) throw new Error(b.stdout + b.stderr);

const results: Array<[string, boolean, string?]> = [];
const check = (n: string, ok: boolean, d = '') => (results.push([n, ok, d]), console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`));
const PORT = 4398;
const srv = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--ignore-lock'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise<void>((ok) => srv.stdout?.on('data', (d: Buffer) => d.toString().includes(String(PORT)) && ok()));
const browser = await launchChromium();
try {
  const html = readFileSync(join(out, 'contact', 'index.html'), 'utf8');
  check('html.no-prefilled-link-in-initial-html', !/wa\.me\/[0-9]+\?text=/.test(html));
  check('html.noscript-generic-link', html.includes('https://wa.me/33659855704"'));
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const posts: string[] = [];
  const external: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
    if (!r.url().startsWith(`http://127.0.0.1:${PORT}`)) external.push(r.url());
  });
  await page.goto(`http://127.0.0.1:${PORT}/`);
  check('home.form-in-hero', await page.isVisible('.hero [data-request-form]') && await page.isVisible('.hero [data-whatsapp]'));
  check('home.photo-lcp-eager', (await page.getAttribute('.hero-photo', 'loading')) === 'eager');
  await page.goto(`http://127.0.0.1:${PORT}/contact/`);
  check('js.whatsapp-button-visible', await page.isVisible('[data-whatsapp]'));
  await page.click('[data-whatsapp]');
  check('js.validation-before-whatsapp', await page.isVisible('[data-form-summary]') && !(await page.isVisible('[data-recap]')));
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 5 * 86_400_000));
  const v: Record<string, string> = { name: 'Zoé Test', phone: '+33 6 39 98 00 01', pickup: 'Gare de Saint-Rambert-d’Albon', dropoff: "L'aéroport \"T1\"", date: d, time: '09:30', passengers: '2' };
  for (const [k, x] of Object.entries(v)) await page.fill(`#${k}`, x);
  await page.click('[data-whatsapp]');
  await page.waitForSelector('[data-recap]:not([hidden])');
  const href = (await page.getAttribute('[data-recap-open]', 'href')) ?? '';
  const text = new URL(href).searchParams.get('text') ?? '';
  check('js.recap-shown-and-focused', await page.evaluate(() => document.activeElement?.hasAttribute('data-recap') ?? false));
  check('link.official-format', href.startsWith('https://wa.me/33659855704?text='), href.slice(0, 50));
  check('link.encoding-roundtrip', text.includes("Destination : L'aéroport \"T1\"") && text.includes('Départ : Gare de Saint-Rambert-d’Albon') && text.includes('\n'));
  check('link.minimized', text.split('\n').length <= 8 && text.includes('Voyageurs : 2') && text.includes('Téléphone : +33 6 39 98 00 01'));
  check('js.no-server-request-on-whatsapp', posts.length === 0 && external.length === 0, [...posts, ...external].join(' '));
  check('js.no-success-claimed', await page.isHidden('[data-form-status]') && !(await page.textContent('main'))?.match(/demande (envoyée|transmise)|course (réservée|confirmée)/i));
  await page.click('[data-recap-copy]');
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  check('js.copy-recap', clip === text, (await page.textContent('[data-recap-copy-status]')) ?? '');
  await page.fill('#time', '10:00');
  check('js.edit-invalidates-recap', (await page.isHidden('[data-recap]')) && (await page.getAttribute('[data-recap-open]', 'href')) === '#demande');
  check('js.input-kept-in-page', (await page.inputValue('#pickup')) === v.pickup);
  const stored = await page.evaluate(() => localStorage.length + sessionStorage.length + document.cookie.length);
  check('js.nothing-persisted', stored === 0);
} finally {
  await browser.close();
  srv.kill();
  spawnSync('rm', ['-rf', site, work]);
}
const ko = results.filter((r) => !r[1]).length;
console.log(`\n  ${results.length - ko}/${results.length} contrôles réussis`);
process.exit(ko ? 1 : 0);
