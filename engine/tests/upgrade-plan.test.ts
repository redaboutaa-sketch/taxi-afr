/** Plan de mise à jour à trois versions : chaque cas, y compris le conflit. */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isManaged, type Manifest } from '../upgrade/manifest.ts';
import { planUpgrade } from '../upgrade/plan.ts';

const h = (s: string) => createHash('sha256').update(s).digest('hex');
const m = (v: string, files: Record<string, string>): Manifest => ({ factoryVersion: v, schemaVersion: 1, managed: Object.fromEntries(Object.entries(files).map(([k, c]) => [k, h(c)])) });

describe('planUpgrade', () => {
  const root = mkdtempSync(join(tmpdir(), 'plan-'));
  mkdirSync(join(root, 'engine'), { recursive: true });
  const local: Record<string, string> = {
    'engine/same.ts': 'a',          // amont inchangé, local intact → rien
    'engine/upd.ts': 'old',         // local intact, amont modifié → update
    'engine/del.ts': 'gone',        // local intact, supprimé en amont → delete
    'engine/conflict.ts': 'local',  // local modifié ET amont modifié → conflict
    'engine/mine.ts': 'local-edit', // local modifié, amont inchangé → conservé
    'engine/done.ts': 'new',        // local déjà égal à la nouvelle version
  };
  for (const [p, c] of Object.entries(local)) writeFileSync(join(root, p), c);
  const oldM = m('0.1.0', { 'engine/same.ts': 'a', 'engine/upd.ts': 'old', 'engine/del.ts': 'gone', 'engine/conflict.ts': 'base', 'engine/mine.ts': 'base', 'engine/done.ts': 'base' });
  const newM = m('0.2.0', { 'engine/same.ts': 'a', 'engine/upd.ts': 'new', 'engine/conflict.ts': 'upstream', 'engine/mine.ts': 'base', 'engine/done.ts': 'new', 'engine/added.ts': 'x' });
  const plan = Object.fromEntries(planUpgrade(root, oldM, newM).map((e) => [e.path, e.action]));

  it('classe chaque fichier', () => {
    expect(plan).toEqual({
      'engine/added.ts': 'add',
      'engine/conflict.ts': 'conflict',
      'engine/del.ts': 'delete',
      'engine/done.ts': 'up-to-date',
      'engine/mine.ts': 'local-only-change',
      'engine/upd.ts': 'update',
    });
  });
  it('refuse un manifeste qui revendiquerait un fichier du site', () => {
    expect(() => planUpgrade(root, oldM, m('0.2.0', { 'site/brief/brief.yaml': 'x' }))).toThrow(/chemin client/);
  });
  it('site/, secrets et fichiers locaux ne sont jamais gérés', () => {
    for (const p of ['site/brief/brief.yaml', 'site/src/pages/index.astro', '.env', 'engine/.env.local', 'app/config.local.php']) expect(isManaged(p), p).toBe(false);
    for (const p of ['engine/cli/main.ts', '.github/workflows/ci.yml', 'package.json']) expect(isManaged(p), p).toBe(true);
  });
});
