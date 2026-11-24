/**
 * release:verify avec un `gh` SIMULÉ (aucun appel réseau) : l'empreinte n'est
 * fournie que si l'attestation est vérifiée ET porte sur ces octets.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const work = mkdtempSync(join(tmpdir(), 'verify-'));
const archive = join(work, 'site-production-abc123.tar.gz');
writeFileSync(archive, 'contenu de test');
const sha = createHash('sha256').update(readFileSync(archive)).digest('hex');

function fakeGh(behaviour: 'ok' | 'mismatch' | 'fail'): string {
  const bin = join(work, behaviour);
  mkdirSync(bin, { recursive: true });
  const digest = behaviour === 'mismatch' ? '0'.repeat(64) : sha;
  // Chemin absolu : le PATH du test est réduit à ce répertoire (le vrai gh doit rester introuvable).
  const log = `echo "$@" > ${JSON.stringify(join(bin, 'args'))}`;
  const script = behaviour === 'fail'
    ? `#!/bin/sh\n${log}\necho "verification failed: no matching attestation" >&2\nexit 1\n`
    : `#!/bin/sh\n${log}\necho '[{"verificationResult":{"statement":{"subject":[{"name":"x.tar.gz","digest":{"sha256":"${digest}"}}]}}}]'\n`;
  writeFileSync(join(bin, 'gh'), script);
  chmodSync(join(bin, 'gh'), 0o755);
  return bin;
}
const run = (pathDir: string) =>
  spawnSync(process.execPath, ['engine/cli/main.ts', 'release-verify', '--archive', archive, '--repo', 'proprietaire/depot'], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, PATH: `${pathDir}:${dirname(process.execPath)}` },
  });

describe('release:verify', () => {
  it('attestation vérifiée et portant sur l’archive → empreinte fournie', () => {
    const bin = fakeGh('ok');
    const r = run(bin);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain(sha);
    expect(readFileSync(join(bin, 'args'), 'utf8')).toContain('--signer-workflow proprietaire/depot/.github/workflows/release.yml');
  });
  it('attestation d’une autre archive → refus, aucune empreinte', () => {
    const r = run(fakeGh('mismatch'));
    expect(r.status).toBe(1);
    expect(r.stdout).not.toContain(sha);
  });
  it('vérification en échec → refus', () => {
    const r = run(fakeGh('fail'));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('NON vérifiée');
  });
  it('gh absent → refus explicite', () => {
    const empty = join(work, 'empty');
    mkdirSync(empty, { recursive: true });
    const r = run(empty);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('introuvable');
  });
});
