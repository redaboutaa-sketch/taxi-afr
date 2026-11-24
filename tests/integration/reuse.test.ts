/**
 * Réutilisabilité : la fixture B (catalogue, EN/DE/NL, sans formulaire) se
 * construit avec le MÊME moteur, et rien d'une fixture ne fuit dans l'autre.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = join(ROOT, '.generated', 'reuse');
const build = (site: string, out: string) =>
  spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FACTORY_SITE_DIR: `examples/${site}`, FACTORY_OUT_DIR: out, FACTORY_TARGET: 'preview', ASTRO_TELEMETRY_DISABLED: '1' },
  });
const allText = (dir: string): string =>
  readdirSync(dir).map((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? allText(p) : /\.(html|js|css|xml|txt|json)$/.test(n) ? readFileSync(p, 'utf8') : '';
  }).join('\n');

let a = '';
let b = '';
beforeAll(() => {
  for (const [site, dir] of [['fixture-a-services', 'a'], ['fixture-b-catalog', 'b']] as const) {
    const r = build(site, join(OUT, dir));
    if (r.status !== 0) throw new Error(`${site} : ${r.stdout}\n${r.stderr}`);
  }
  a = allText(join(OUT, 'a'));
  b = allText(join(OUT, 'b'));
});
afterAll(() => rmSync(OUT, { recursive: true, force: true }));

describe('fixture B avec le même moteur', () => {
  it('aucun identifiant de A ni du client de référence dans B', () => {
    for (const needle of ['Ostral', 'www.example.com', 'demandes@example.com', 'formulaire@', 'Registre', 'Newsreader', 'ivan', 'arsenov', 'Arsenov']) {
      expect(b.includes(needle), needle).toBe(false);
    }
  });
  it('aucun identifiant de B dans A', () => {
    for (const needle of ['Halvard', 'example.org', 'sales@example.org']) expect(a.includes(needle), needle).toBe(false);
  });
  it('pas de formulaire ni d’endpoint quand le brief le désactive', () => {
    expect(existsSync(join(OUT, 'b', 'api'))).toBe(false);
    expect(b.includes('/api/contact.php')).toBe(false);
  });
  it('actifs de B : schémas approuvés émis ; benchmark exclu et photo en conflit absents', () => {
    const files = readdirSync(join(OUT, 'b', '_astro'));
    for (const stem of ['bolt', 'nut', 'washer']) expect(files.some((f) => f.startsWith(`${stem}.`)), stem).toBe(true);
    expect(files.some((f) => /benchmark-capture|atelier-declare-photo/.test(f))).toBe(false);
    expect(b).not.toMatch(/benchmark-capture|atelier-declare-photo|Fournisseur fictif|données de test/);
  });
  it('fait withheld de B absent de l’artefact', () => {
    expect(b.includes('twelve percent')).toBe(false);
  });
  it('alternates uniquement vers les traductions existantes', () => {
    const notes = readFileSync(join(OUT, 'b', 'technical-notes', 'index.html'), 'utf8');
    expect(notes.match(/rel="alternate" hreflang="(en|de|nl)"/g)).toEqual(['rel="alternate" hreflang="en"']);
    const de = readFileSync(join(OUT, 'b', 'de', 'sortiment', 'index.html'), 'utf8');
    for (const l of ['en', 'de', 'nl']) expect(de).toContain(`hreflang="${l}"`);
    expect(de).toContain('<link rel="canonical" href="http://localhost:4321/de/sortiment/"');
  });
});
