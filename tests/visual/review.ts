/**
 * Revue visuelle outillée d'un site construit (`dist/` ou FACTORY_OUT_DIR),
 * servi par `astro preview` (CSP meta active). Pour chaque page et largeur :
 * capture pleine page, débordement horizontal, violations CSP / erreurs,
 * polices chargées, cibles tactiles, taille du texte courant.
 *
 *   node tests/visual/review.ts --pages /,/contact/,/en/ [--out <dir>]
 *
 * Cibles tactiles : 44×44 px pour les actions principales (boutons, navigation,
 * contrôles de formulaire, sommaire, <summary>) — choix ergonomique de l'usine ;
 * 24 px minimum pour les autres liens hors texte courant (WCAG 2.2 — 2.5.8).
 * Les liens insérés dans une phrase sont exemptés, comme le permet 2.5.8.
 * Ces mesures ne remplacent pas la revue humaine des captures.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { launchChromium } from '../support/browser.ts';

const { values } = parseArgs({ options: { pages: { type: 'string' }, out: { type: 'string' }, port: { type: 'string' } } });
const pages = (values.pages ?? '/').split(',');
const site = resolve(process.env.FACTORY_SITE_DIR ?? 'site');
const out = resolve(values.out ?? join(site, 'design', 'captures', 'site'));
const PORT = Number(values.port ?? 4331);
const viewports = [
  { name: '360', width: 360, height: 780 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
];

const server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--ignore-lock'], {
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise<void>((ok, ko) => {
  const t = setTimeout(() => ko(new Error('astro preview ne répond pas')), 30_000);
  server.stdout?.on('data', (d: Buffer) => d.toString().includes(String(PORT)) && (clearTimeout(t), ok()));
});

mkdirSync(out, { recursive: true });
const problems: string[] = [];
const report: unknown[] = [];
const browser = await launchChromium();
try {
  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    for (const path of pages) {
      const page = await ctx.newPage();
      const tag = `${path} @${vp.name}`;
      page.on('console', (m) => {
        if (/Content Security Policy/i.test(m.text()) || (m.type() === 'error' && !/Failed to load resource/.test(m.text()))) problems.push(`${tag} console : ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push(`${tag} erreur JS : ${e.message}`));
      page.on('response', (r) => {
        const u = new URL(r.url());
        if (r.status() >= 400 && u.pathname !== '/favicon.ico') problems.push(`${tag} HTTP ${r.status()} ${u.pathname}`);
      });
      await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const primary = 'button, .button, .nav a, .index a, summary, input:not([type=hidden]), select, textarea, .wordmark';
        const small: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('a, button, input:not([type=hidden]), select, textarea, summary')) {
          if (el.closest('[aria-hidden="true"], .trap, .visually-hidden') || el.offsetParent === null) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          const inSentence = el.tagName === 'A' && el.parentElement?.tagName === 'P' && (el.parentElement.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 15;
          const min = el.matches(primary) ? 44 : inSentence ? 0 : 24;
          if (r.height < min - 0.5 || (el.matches(primary) && r.width < min - 0.5)) small.push(`${el.tagName.toLowerCase()} « ${(el.textContent ?? el.getAttribute('name') ?? '').trim().slice(0, 30)} » ${Math.round(r.width)}×${Math.round(r.height)} (min ${min})`);
        }
        // Texte courant = le paragraphe le plus long de <main> (pas un libellé ni un fil d'Ariane).
        const paras = [...document.querySelectorAll<HTMLElement>('main p, main li')].filter((e) => e.offsetParent !== null);
        const longest = paras.sort((a, b) => (b.textContent ?? '').length - (a.textContent ?? '').length)[0] ?? document.body;
        const body = parseFloat(getComputedStyle(longest).fontSize);
        const fonts = [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/-[0-9a-f]+$/, '')))];
        return { overflow, small, body, fonts };
      });
      if (m.overflow > 0) problems.push(`${tag} : défilement horizontal ${m.overflow}px`);
      if (m.small.length) problems.push(`${tag} : cibles trop petites — ${m.small.join(' ; ')}`);
      if (m.body < 16) problems.push(`${tag} : texte courant ${m.body}px (< 16px)`);
      const file = `${path.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'home'}-${vp.name}.png`;
      await page.screenshot({ path: join(out, file), fullPage: true });
      report.push({ page: path, viewport: vp.name, ...m, capture: file });
      console.log(`  ✓ ${tag} — texte ${m.body}px, polices : ${m.fonts.join(', ')}`);
      await page.close();
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
writeFileSync(join(out, 'review.json'), `${JSON.stringify({ browser: 'chromium (voir sortie)', date: new Date().toISOString(), report, problems }, null, 2)}\n`);
if (problems.length) {
  console.error(problems.map((p) => `  ✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`  captures et rapport : ${out}`);
