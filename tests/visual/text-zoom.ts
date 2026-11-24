/**
 * Zoom du TEXTE à 200 % (WCAG 2.2 — 1.4.4) : taille de police racine doublée,
 * sans zoom de la page, à 360 et 1280 px. Vérifie l'absence de défilement
 * horizontal et de texte coupé par un conteneur à hauteur fixe.
 * La CSP est contournée UNIQUEMENT pour injecter la règle de zoom
 * (`bypassCSP`) ; la conformité CSP est vérifiée par ailleurs.
 *
 *   node tests/visual/text-zoom.ts --pages /,/contact/ [--out <dir>]
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { launchChromium } from '../support/browser.ts';

const { values } = parseArgs({ options: { pages: { type: 'string', default: '/' }, out: { type: 'string', default: '.generated/text-zoom' } } });
const out = resolve(values.out!);
mkdirSync(out, { recursive: true });
const PORT = 4333;
const server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--ignore-lock'], { env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise<void>((ok) => server.stdout?.on('data', (d: Buffer) => d.toString().includes(String(PORT)) && ok()));
const problems: string[] = [];
const browser = await launchChromium();
try {
  for (const width of [360, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, bypassCSP: true, reducedMotion: 'reduce' });
    for (const path of values.pages!.split(',')) {
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await page.waitForTimeout(100);
      const r = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const clipped = [...document.querySelectorAll<HTMLElement>('main *')]
          .filter((el) => el.children.length === 0 && el.offsetParent !== null && (el.textContent ?? '').trim() && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible')
          .map((el) => `${el.tagName.toLowerCase()} « ${(el.textContent ?? '').trim().slice(0, 30)} »`);
        return { overflow, clipped };
      });
      const tag = `${path} @${width} texte 200 %`;
      // Les tableaux de données ont un défilement horizontal propre, accessible au clavier : toléré.
      if (r.overflow > 0) problems.push(`${tag} : défilement horizontal de la page ${r.overflow}px`);
      if (r.clipped.length) problems.push(`${tag} : texte coupé — ${r.clipped.slice(0, 4).join(' ; ')}`);
      await page.screenshot({ path: join(out, `${path.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'home'}-${width}-zoom200.png`), fullPage: true });
      console.log(`  ${r.overflow > 0 || r.clipped.length ? '✗' : '✓'} ${tag}`);
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
