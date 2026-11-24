/**
 * Captures des prototypes de direction sur l'artefact construit (`dist/`),
 * servi par `astro preview` : la CSP en balise meta produite par Astro est
 * donc active. Échoue si une violation CSP ou une erreur console apparaît,
 * ou si une police déclarée n'est pas chargée.
 *
 *   FACTORY_SITE_DIR=examples/fixture-a-services npm run build
 *   FACTORY_SITE_DIR=examples/fixture-a-services npm run shots:prototype
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launchChromium } from '../support/browser.ts';

const site = resolve(process.env.FACTORY_SITE_DIR ?? 'site');
const out = join(site, 'design', 'captures');
const PORT = 4329;
const pages = [
  ['direction-a', '--font-newsreader'],
  ['direction-b', '--font-plex-condensed'],
  ['planche', '--font-newsreader'],
] as const;
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

const server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--ignore-lock'], {
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise<void>((ok, ko) => {
  const t = setTimeout(() => ko(new Error('astro preview ne répond pas')), 30_000);
  server.stdout?.on('data', (d: Buffer) => {
    if (d.toString().includes(String(PORT))) {
      clearTimeout(t);
      ok();
    }
  });
});

const problems: string[] = [];
await mkdir(out, { recursive: true });
const browser = await launchChromium();
try {
  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    for (const [name] of pages) {
      const page = await ctx.newPage();
      page.on('console', (m) => {
        if ((m.type() === 'error' && !/Failed to load resource/.test(m.text())) || /Content Security Policy/i.test(m.text())) problems.push(`${name}/${vp.name} console : ${m.text()}`);
      });
      page.on('response', (r) => {
        if (r.status() >= 400) problems.push(`${name}/${vp.name} HTTP ${r.status()} : ${new URL(r.url()).pathname}`);
      });
      page.on('pageerror', (e) => problems.push(`${name}/${vp.name} erreur : ${e.message}`));
      await page.goto(`http://127.0.0.1:${PORT}/prototypes/${name}/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const families = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
      if (families.length === 0) problems.push(`${name}/${vp.name} : aucune police chargée`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) problems.push(`${name}/${vp.name} : défilement horizontal de ${overflow}px`);
      await page.screenshot({ path: join(out, `${name}-${vp.name}.png`), fullPage: true });
      console.log(`  ✓ ${name} ${vp.name} — polices chargées : ${[...new Set(families)].join(', ') || 'aucune'}`);
      await page.close();
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (problems.length) {
  console.error(problems.map((p) => `  ✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`  captures écrites dans ${out}`);
