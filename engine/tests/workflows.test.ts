/**
 * Garde-fous des workflows GitHub Actions, vérifiés sur les fichiers :
 * actions épinglées par SHA, droits minimaux, déclencheurs, environnement
 * protégé pour la publication, pas d'interpolation d'entrées dans les scripts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const DIR = resolve(import.meta.dirname, '../../.github/workflows');
const load = (f: string) => ({ text: readFileSync(join(DIR, f), 'utf8'), wf: parse(readFileSync(join(DIR, f), 'utf8')) as Record<string, any> });
const steps = (wf: Record<string, any>) => Object.values(wf.jobs as Record<string, any>).flatMap((j) => (j.steps ?? []) as Array<Record<string, any>>);

describe.each(readdirSync(DIR).filter((f) => f.endsWith('.yml')))('%s', (file) => {
  const { wf } = load(file);
  it('toute action tierce est épinglée par SHA complet', () => {
    const bad = steps(wf).map((s) => s.uses).filter((u): u is string => Boolean(u) && !/@[0-9a-f]{40}$/.test(u));
    expect(bad).toEqual([]);
  });
  it('droits par défaut en lecture ou nuls', () => {
    expect([{ contents: 'read' }, {}]).toContainEqual(wf.permissions);
  });
  it('aucun continue-on-error, aucun pull_request_target', () => {
    expect(JSON.stringify(wf)).not.toContain('continue-on-error');
    expect(Object.keys(wf.on)).not.toContain('pull_request_target');
  });
  it('aucune expression ${{ … }} interpolée dans un script (injection)', () => {
    const bad = steps(wf).filter((s) => typeof s.run === 'string' && s.run.includes('${{'));
    expect(bad.map((s) => s.name ?? s.run.slice(0, 40))).toEqual([]);
  });
});

describe('release.yml', () => {
  const { wf } = load('release.yml');
  it('déclenchement manuel uniquement', () => {
    expect(Object.keys(wf.on)).toEqual(['workflow_dispatch']);
  });
  it('build : lecture + jeton OIDC + attestation ; aucune écriture du contenu', () => {
    expect(wf.jobs.build.permissions).toEqual({ contents: 'read', 'id-token': 'write', attestations: 'write' });
    expect(steps({ jobs: { build: wf.jobs.build } }).some((s) => String(s.uses).startsWith('actions/attest-build-provenance@'))).toBe(true);
  });
  it('publication : après le build, dans l’environnement protégé, vérifie l’attestation avant de créer un brouillon', () => {
    const p = wf.jobs.publish;
    expect(p.needs).toBe('build');
    expect(p.environment).toBe('release');
    expect(p.permissions).toEqual({ contents: 'write', attestations: 'read' });
    const runs = (p.steps as Array<Record<string, any>>).map((s) => String(s.run ?? ''));
    const verifyAt = runs.findIndex((r) => r.includes('gh attestation verify'));
    const createAt = runs.findIndex((r) => r.includes('gh release create'));
    expect(verifyAt).toBeGreaterThanOrEqual(0);
    expect(createAt).toBeGreaterThan(verifyAt);
    expect(runs[createAt]).toContain('--draft');
    expect(runs[verifyAt]).toContain('--signer-workflow');
  });
});

describe('ci.yml', () => {
  const { wf } = load('ci.yml');
  it('validation seulement : lecture, aucun secret, aucune publication', () => {
    expect(wf.permissions).toEqual({ contents: 'read' });
    const text = load('ci.yml').text;
    expect(text).not.toMatch(/secrets\.|gh release|attest-build-provenance/);
  });
});
