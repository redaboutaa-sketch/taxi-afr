/**
 * Frontière moteur/site : engine/ n'importe jamais un site ni un exemple ;
 * un site n'importe le moteur que par ses interfaces publiques
 * (`@engine/<module>` → engine/<module>/index.ts) ou le module virtuel.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === 'node_modules' || n === 'captures') return [];
    return statSync(p).isDirectory() ? files(p) : /\.(ts|mjs|astro)$/.test(n) ? [p] : [];
  });
const imports = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? m[2] ?? '');

describe('frontières d’import', () => {
  it('engine/ ne dépend d’aucun site', () => {
    const bad = files(join(ROOT, 'engine')).flatMap((f) =>
      imports(f).filter((i) => /(^|\/)(site|examples)\//.test(i)).map((i) => `${relative(ROOT, f)} → ${i}`),
    );
    expect(bad).toEqual([]);
  });
  it('les sites n’importent que les interfaces publiques du moteur', () => {
    const sites = [join(ROOT, 'examples'), join(ROOT, 'site')].filter((d) => {
      try {
        return statSync(d).isDirectory();
      } catch {
        return false;
      }
    });
    const bad = sites.flatMap(files).flatMap((f) =>
      imports(f)
        .filter((i) => (i.includes('engine/') && !i.startsWith('@engine/')) || (i.startsWith('@engine/') && i.split('/').length > 2))
        .map((i) => `${relative(ROOT, f)} → ${i}`),
    );
    expect(bad).toEqual([]);
  });
  it('le contrôle détecte bien un import interne (test du test)', () => {
    const sample = "import { x } from '../../engine/config/load.ts';";
    expect([...sample.matchAll(/from\s*['"]([^'"]+)['"]/g)].map((m) => m[1]).some((i) => i?.includes('engine/'))).toBe(true);
  });
});
