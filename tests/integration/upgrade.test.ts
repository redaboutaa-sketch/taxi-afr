/**
 * factory:upgrade de bout en bout, sur une COPIE CLIENT réelle (dépôt git) :
 * conflit détecté et jamais écrasé, source à l'empreinte erronée refusée,
 * application sur une branche dédiée, `site/` intact, retour arrière.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const WORK = join(ROOT, '.generated', 'upgrade-test');
const CLIENT = join(WORK, 'client');
const NEXT = join(WORK, 'factory-0.2.0');
const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');
const git = (cwd: string, args: string[]) => execFileSync('git', ['-c', 'user.email=test@example.com', '-c', 'user.name=test', ...args], { cwd, encoding: 'utf8' });
const cli = (args: string[]) => spawnSync(process.execPath, ['engine/cli/main.ts', ...args], { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, FACTORY_SITE_DIR: 'site' } });

function snapshot(dest: string) {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const f of files) {
    if (!existsSync(join(ROOT, f))) continue;
    mkdirSync(join(dest, f, '..'), { recursive: true });
    cpSync(join(ROOT, f), join(dest, f));
  }
  symlinkSync(join(ROOT, 'node_modules'), join(dest, 'node_modules'));
  git(dest, ['init', '-q', '-b', 'main']);
}

let nextManifestSha = '';
beforeAll(() => {
  rmSync(WORK, { recursive: true, force: true });
  // Copie client (usine 0.1.0) avec son propre site.
  snapshot(CLIENT);
  execFileSync(process.execPath, ['engine/cli/main.ts', 'manifest'], { cwd: CLIENT });
  execFileSync(process.execPath, ['engine/cli/main.ts', 'init', '--example', 'fixture-a-services'], { cwd: CLIENT, env: { ...process.env, FACTORY_SITE_DIR: 'site' } });
  git(CLIENT, ['add', '-A']);
  git(CLIENT, ['commit', '-qm', 'client 0.1.0']);
  // Usine 0.2.0 simulée : une modification, un ajout, une suppression.
  snapshot(NEXT);
  appendFileSync(join(NEXT, 'engine', 'cli', 'doctor.ts'), '\n// 0.2.0 : diagnostic enrichi\n');
  writeFileSync(join(NEXT, 'engine', 'feature-x.ts'), 'export const featureX = true;\n');
  rmSync(join(NEXT, 'tests', 'prototype', 'capture.ts'));
  const pkg = JSON.parse(readFileSync(join(NEXT, 'package.json'), 'utf8'));
  writeFileSync(join(NEXT, 'package.json'), `${JSON.stringify({ ...pkg, version: '0.2.0' }, null, 2)}\n`);
  git(NEXT, ['add', '-A']);
  execFileSync(process.execPath, ['engine/cli/main.ts', 'manifest'], { cwd: NEXT });
  nextManifestSha = sha(join(NEXT, 'factory.manifest.json'));
  execFileSync('tar', ['-czf', join(WORK, 'factory-0.2.0.tar.gz'), '-C', NEXT, '--exclude=node_modules', '--exclude=.git', '.']);
}, 120_000);
afterAll(() => rmSync(WORK, { recursive: true, force: true }));

describe('factory:upgrade sur une copie client', () => {
  it('modification locale d’un fichier aussi modifié en amont → conflit, rien n’est écrit', () => {
    appendFileSync(join(CLIENT, 'engine', 'cli', 'doctor.ts'), '\n// modification locale du client\n');
    git(CLIENT, ['commit', '-qam', 'modif locale']);
    const dry = cli(['upgrade', '--to', '0.2.0', '--from', NEXT, '--sha256', nextManifestSha, '--dry-run']);
    expect(dry.status).toBe(1);
    expect(dry.stdout).toMatch(/CONFLIT[\s\S]*engine\/cli\/doctor\.ts/);
    expect(dry.stdout).toMatch(/ajout[\s\S]*engine\/feature-x\.ts/);
    expect(dry.stdout).toMatch(/suppression[\s\S]*tests\/prototype\/capture\.ts/);
    expect(existsSync(join(CLIENT, '.generated', 'upgrade', 'conflicts', 'engine', 'cli', 'doctor.ts.factory-new'))).toBe(true);
    const apply = cli(['upgrade', '--to', '0.2.0', '--from', NEXT, '--sha256', nextManifestSha, '--apply']);
    expect(apply.status).toBe(1);
    expect(apply.stderr).toContain('conflit');
    expect(git(CLIENT, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()).toBe('main');
    expect(existsSync(join(CLIENT, 'engine', 'feature-x.ts'))).toBe(false);
  });

  it('source à l’empreinte erronée, ou de version différente, refusée', () => {
    const bad = cli(['upgrade', '--to', '0.2.0', '--from', NEXT, '--sha256', 'f'.repeat(64), '--dry-run']);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('empreinte');
    const wrongVersion = cli(['upgrade', '--to', '0.3.0', '--from', NEXT, '--sha256', nextManifestSha, '--dry-run']);
    expect(wrongVersion.status).toBe(1);
    const archive = join(WORK, 'factory-0.2.0.tar.gz');
    expect(cli(['upgrade', '--to', '0.2.0', '--from', archive, '--sha256', '0'.repeat(64), '--dry-run']).status).toBe(1);
    const viaArchive = cli(['upgrade', '--to', '0.2.0', '--from', archive, '--sha256', sha(archive), '--dry-run']);
    expect(viaArchive.stdout).toContain('engine/feature-x.ts');
  });

  it('après résolution : application sur une branche, site/ intact, puis retour arrière', () => {
    git(CLIENT, ['revert', '--no-edit', 'HEAD']);
    const siteBefore = git(CLIENT, ['ls-files', '-s', 'site']);
    const apply = cli(['upgrade', '--to', '0.2.0', '--from', NEXT, '--sha256', nextManifestSha, '--apply']);
    expect(apply.status, apply.stderr).toBe(0);
    expect(git(CLIENT, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()).toBe('factory-upgrade/0.2.0');
    expect(existsSync(join(CLIENT, 'engine', 'feature-x.ts'))).toBe(true);
    expect(existsSync(join(CLIENT, 'tests', 'prototype', 'capture.ts'))).toBe(false);
    expect(readFileSync(join(CLIENT, 'engine', 'cli', 'doctor.ts'), 'utf8')).toContain('0.2.0 : diagnostic enrichi');
    expect(JSON.parse(readFileSync(join(CLIENT, 'factory.manifest.json'), 'utf8')).factoryVersion).toBe('0.2.0');
    git(CLIENT, ['add', '-A']);
    expect(git(CLIENT, ['ls-files', '-s', 'site'])).toBe(siteBefore);
    // Le moteur mis à jour fonctionne encore avec le site du client.
    expect(cli(['validate', '--mode', 'preview']).status).toBe(0);
    // Retour arrière documenté : tout revient à l'état 0.1.0.
    git(CLIENT, ['reset', '-q', '--hard']);
    git(CLIENT, ['switch', '-q', 'main']);
    git(CLIENT, ['branch', '-D', 'factory-upgrade/0.2.0']);
    expect(existsSync(join(CLIENT, 'engine', 'feature-x.ts'))).toBe(false);
    expect(existsSync(join(CLIENT, 'tests', 'prototype', 'capture.ts'))).toBe(true);
    expect(JSON.parse(readFileSync(join(CLIENT, 'factory.manifest.json'), 'utf8')).factoryVersion).toBe('0.1.0');
  });
});
