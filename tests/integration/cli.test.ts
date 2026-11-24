/** CLI réelle : init non destructif, validate avec code de sortie. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const WORK = join(ROOT, '.generated', 'cli-tests');
const cli = (args: string[], site: string) =>
  spawnSync(process.execPath, ['engine/cli/main.ts', ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, FACTORY_SITE_DIR: site } });

afterAll(() => rmSync(WORK, { recursive: true, force: true }));

describe('factory:init', () => {
  it('crée un site depuis un brief, puis refuse de l’écraser', () => {
    const site = join(WORK, 'new-site');
    rmSync(site, { recursive: true, force: true });
    const first = cli(['init', '--brief', 'examples/fixture-a-services/brief/brief.yaml'], site);
    expect(first.status, first.stderr).toBe(0);
    expect(existsSync(join(site, 'brief', 'brief.yaml'))).toBe(true);
    expect(existsSync(join(site, 'src', 'pages', 'index.astro'))).toBe(true);
    const second = cli(['init', '--example', 'fixture-a-services'], site);
    expect(second.status).toBe(1);
    expect(second.stderr).toContain('ne remplace jamais');
  });
  it('refuse un brief invalide sans rien créer', () => {
    mkdirSync(WORK, { recursive: true });
    const bad = join(WORK, 'bad.yaml');
    writeFileSync(bad, 'schemaVersion: 1\nmode: draft\n');
    const site = join(WORK, 'never');
    const r = cli(['init', '--brief', bad], site);
    expect(r.status).toBe(1);
    expect(existsSync(site)).toBe(false);
  });
});

describe('factory:validate', () => {
  it('code 0 en preview, 1 en release pour la fixture A', () => {
    expect(cli(['validate', '--mode', 'preview'], 'examples/fixture-a-services').status).toBe(0);
    const r = cli(['validate', '--mode', 'release'], 'examples/fixture-a-services');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('gate.g2');
  });
});
