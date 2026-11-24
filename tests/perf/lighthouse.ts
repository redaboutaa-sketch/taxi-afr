/**
 * MESURES DE LABORATOIRE (Lighthouse) sur une release servie par nginx avec
 * sa configuration générée (compression, cache, en-têtes) — pas sur un
 * serveur de développement.
 *
 *   node tests/perf/lighthouse.ts --release .generated/releases/<id> [--runs 3] [--pages /,/contact/]
 *
 * Protocole fixe : préréglage mobile par défaut de Lighthouse (émulation
 * d'appareil mobile, réseau et CPU bridés par simulation), N exécutions par
 * page, médiane retenue (exécution de score de performance médian).
 * Budgets de l'usine (choix, pas normes) : performance ≥ 95 ; JS chargé
 * ≤ 60 Ko transférés par page ; total transféré ≤ 1 Mo sur l'accueil.
 * Un score de laboratoire ne dit RIEN de l'INP ou du LCP terrain.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { IMAGES } from '../recipe/images.ts';

const { values } = parseArgs({ options: { release: { type: 'string' }, runs: { type: 'string', default: '3' }, pages: { type: 'string', default: '/,/prestations/diagnostic-achats/,/contact/,/en/' } } });
if (!values.release) throw new Error('--release <répertoire> requis');
const releaseDir = resolve(values.release);
const id = basename(releaseDir);
const archive = `${releaseDir}.tar.gz`;
const RUNS = Number(values.runs);
const BUDGET = { performance: 0.95, jsBytes: 60 * 1024, homeBytes: 1024 * 1024 };
const BASE = 'http://127.0.0.1:8088';

const expected = readFileSync(`${archive}.sha256`, 'utf8').split(' ')[0];
if (createHash('sha256').update(readFileSync(archive)).digest('hex') !== expected) throw new Error('empreinte de l’archive invalide');
const work = resolve('.generated', 'perf', id);
rmSync(work, { recursive: true, force: true });
const siteRoot = join(work, 'site');
mkdirSync(join(siteRoot, 'releases'), { recursive: true });
execFileSync('tar', ['-xzf', archive, '-C', join(siteRoot, 'releases')]);
symlinkSync(`releases/${id}`, join(siteRoot, 'current'));
const conf = join(siteRoot, 'releases', id, 'config', 'nginx', 'site.conf');
spawnSync('docker', ['rm', '-f', 'factory-perf-nginx'], { stdio: 'ignore' });
execFileSync('docker', ['run', '-d', '--name', 'factory-perf-nginx', '--network', 'host', '-v', `${conf}:/etc/nginx/conf.d/default.conf:ro`, '-v', `${siteRoot}:/srv/site:ro`, IMAGES.nginx]);

const chromePath = existsSync(chromium.executablePath()) ? chromium.executablePath() : process.env.PW_CHROMIUM_PATH;
if (!chromePath) throw new Error('Chromium introuvable (révision Playwright ou PW_CHROMIUM_PATH)');
const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });

interface Run { score: Record<string, number>; metrics: Record<string, number>; bytes: { total: number; script: number; inlineScript?: number; font: number; image: number; stylesheet: number; document: number }; failedA11y: string[] }
const results: Array<{ page: string; runs: Run[]; median: Run }> = [];
const problems: string[] = [];
let version = '';
try {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`${BASE}/`)).ok) break; } catch { /* démarrage */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  for (const page of values.pages!.split(',')) {
    const runs: Run[] = [];
    for (let i = 0; i < RUNS; i++) {
      const r = await lighthouse(`${BASE}${page}`, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] });
      if (!r) throw new Error('Lighthouse sans résultat');
      const lhr = r.lhr;
      version = `Lighthouse ${lhr.lighthouseVersion} · ${lhr.environment.hostUserAgent.match(/(HeadlessChrome|Chrome)\/[\d.]+/)?.[0] ?? '?'} · ${lhr.configSettings.formFactor}, throttling ${lhr.configSettings.throttlingMethod}`;
      const items = (lhr.audits['resource-summary']?.details as unknown as { items: Array<{ resourceType: string; transferSize: number }> }).items;
      const size = (t: string) => items.find((x) => x.resourceType === t)?.transferSize ?? 0;
      const metric = (k: string) => Math.round((lhr.audits[k]?.numericValue ?? NaN) * 1000) / 1000;
      runs.push({
        score: Object.fromEntries(Object.entries(lhr.categories).map(([k, c]) => [k, c.score ?? 0])),
        metrics: { fcpMs: metric('first-contentful-paint'), lcpMs: metric('largest-contentful-paint'), tbtMs: metric('total-blocking-time'), cls: metric('cumulative-layout-shift'), siMs: metric('speed-index') },
        bytes: { total: size('total'), script: size('script'), font: size('font'), image: size('image'), stylesheet: size('stylesheet'), document: size('document') },
        failedA11y: Object.values(lhr.audits).filter((a) => lhr.categories.accessibility?.auditRefs.some((ref) => ref.id === a.id && ref.weight > 0) && a.score !== null && a.score < 1).map((a) => a.id),
      });
    }
    // JS intégré au HTML par Astro (petits modules) : compté dans « document » par Lighthouse.
    // On l'ajoute au budget JS, en octets non compressés (majorant).
    const html = await (await fetch(`${BASE}${page}`)).text();
    const inlineJs = [...html.matchAll(/<script(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].reduce((n, m) => n + Buffer.byteLength(m[1] ?? ''), 0);
    for (const r of runs) r.bytes.inlineScript = inlineJs;
    const sorted = [...runs].sort((a, b) => (a.score.performance ?? 0) - (b.score.performance ?? 0));
    const median = sorted[Math.floor(sorted.length / 2)]!;
    results.push({ page, runs, median });
    const m = median;
    console.log(`  ${page}  perf ${Math.round((m.score.performance ?? 0) * 100)} · a11y ${Math.round((m.score.accessibility ?? 0) * 100)} · LCP ${Math.round(m.metrics.lcpMs!)} ms · TBT ${Math.round(m.metrics.tbtMs!)} ms · CLS ${m.metrics.cls} · JS ${(m.bytes.script / 1024).toFixed(1)} Ko + inline ${((m.bytes.inlineScript ?? 0) / 1024).toFixed(1)} Ko · total ${(m.bytes.total / 1024).toFixed(1)} Ko`);
    if ((m.score.performance ?? 0) < BUDGET.performance) problems.push(`${page} : performance ${m.score.performance} < ${BUDGET.performance}`);
    const js = m.bytes.script + (m.bytes.inlineScript ?? 0);
    if (js > BUDGET.jsBytes) problems.push(`${page} : JS ${js} o > ${BUDGET.jsBytes} o`);
    if (page === '/' && m.bytes.total > BUDGET.homeBytes) problems.push(`accueil : ${m.bytes.total} o > ${BUDGET.homeBytes} o`);
    if (m.failedA11y.length) problems.push(`${page} : audits d’accessibilité automatisés en échec — ${m.failedA11y.join(', ')}`);
  }
} finally {
  await chrome.kill();
  spawnSync('docker', ['rm', '-f', 'factory-perf-nginx'], { stdio: 'ignore' });
}
console.log(`  ${version} · ${RUNS} exécution(s) par page, médiane`);
const out = resolve('.generated', 'reports', id);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'lighthouse.json'), `${JSON.stringify({ release: id, protocol: { version, runsPerPage: RUNS, median: 'exécution de score de performance médian', server: `nginx (${IMAGES.nginx}), configuration générée de la release`, budgets: BUDGET }, notes: ['Preview locale en HTTP et noindex : les audits HTTPS (bonnes pratiques) et indexabilité (SEO) échouent par construction, ils ne sont pas des budgets.', 'Laboratoire uniquement : aucune donnée terrain (INP, LCP p75).'], results, problems }, null, 2)}\n`);
console.log(`  rapport : ${join(out, 'lighthouse.json')}`);
if (problems.length) {
  console.error(problems.map((p) => `  ✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log('  ✓ budgets respectés');
