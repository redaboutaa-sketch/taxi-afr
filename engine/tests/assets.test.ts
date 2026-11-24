/** Registre d'actifs : règles d'approbation, conflits, observation, module virtuel. */
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBrief } from '../config/load.ts';
import { checkAssets, loadRegistry, observe, publishable, virtualAssetsModule, type AssetRecord, type Registry } from '../assets/index.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const B = join(ROOT, 'examples', 'fixture-b-catalog');
const brief = (() => {
  const r = parseBrief(readFileSync(join(B, 'brief', 'brief.yaml'), 'utf8'), 'preview');
  if (!r.brief) throw new Error('brief B');
  return r.brief;
})();
const base = loadRegistry(B);
const rules = (reg: Registry, dir = B, b = brief) => checkAssets(reg, dir, b, 'preview').map((i) => `${i.path.split('.')[1]}:${i.rule}`);
const withAsset = (id: string, patch: Partial<AssetRecord>): Registry => ({ ...base, assets: { ...base.assets, [id]: { ...base.assets[id]!, ...patch } } });

describe('registre de la fixture B', () => {
  it('trois schémas publiables ; le benchmark et le cas en conflit ne le sont pas', () => {
    const issues = checkAssets(base, B, brief, 'preview');
    expect(publishable(base, issues).sort()).toEqual(['schema-ecrou', 'schema-rondelle', 'schema-vis']);
    expect(rules(base)).toEqual(['photo-atelier:asset.conflict']);
  });
});

describe('refus d’approbation', () => {
  it('conflit déclaration / observation : approbation impossible', () => {
    const r = withAsset('photo-atelier', { status: 'approved', rights: { status: 'granted', scope: 'x', evidenceRef: 'ref', restrictions: [], expires: null }, decision: { by: 'test', on: '2026-11-24' } });
    expect(rules(r)).toContain('photo-atelier:asset.conflict');
    expect(publishable(r, checkAssets(r, B, brief, 'preview'))).not.toContain('photo-atelier');
  });
  it('image générée montrant un produit : refusée', () => {
    const r = withAsset('schema-vis', { declared: { source: 'ai-generated', author: null, statement: null, date: null } });
    expect(rules(r)).toEqual(expect.arrayContaining(['schema-vis:asset.generated-misleading', 'schema-vis:asset.generated-not-allowed']));
  });
  it('illustration générée sans objet réel : refusée si le brief ne l’autorise pas, admise sinon', () => {
    const r = withAsset('schema-vis', { depicts: 'none', kind: 'illustration', declared: { source: 'ai-generated', author: null, statement: null, date: null } });
    expect(rules(r)).toContain('schema-vis:asset.generated-not-allowed');
    const allowing = { ...brief, design: { ...brief.design, allowGeneratedIllustrations: true } };
    expect(rules(r, B, allowing).filter((x) => x.startsWith('schema-vis'))).toEqual([]);
  });
  it('approuvé sans décision, sans droits, ou sans preuve de droits', () => {
    expect(rules(withAsset('schema-vis', { decision: null }))).toContain('schema-vis:asset.no-decision');
    expect(rules(withAsset('schema-vis', { rights: { status: 'unknown', scope: null, evidenceRef: null, restrictions: [], expires: null } }))).toContain('schema-vis:asset.rights');
    expect(rules(withAsset('schema-vis', { rights: { status: 'granted', scope: 'x', evidenceRef: null, restrictions: [], expires: null } }))).toContain('schema-vis:asset.rights-evidence');
    expect(rules(withAsset('schema-vis', { rights: { status: 'granted', scope: 'x', evidenceRef: 'r', restrictions: [], expires: '2020-01-01' } }))).toContain('schema-vis:asset.rights-expired');
  });
  it('actif de benchmark jamais approuvable', () => {
    const r = withAsset('capture-benchmark', { status: 'approved', decision: { by: 't', on: '2026-11-24' }, rights: { status: 'granted', scope: 'x', evidenceRef: 'r', restrictions: [], expires: null } });
    expect(rules(r)).toContain('capture-benchmark:asset.benchmark');
  });
  it('texte alternatif manquant dans une langue (preview)', () => {
    expect(rules(withAsset('schema-vis', { alt: { en: 'x', de: 'y' } }))).toContain('schema-vis:asset.alt-missing');
  });
  it('fichier modifié après le scan : la décision ne vaut plus', () => {
    const dir = mkdtempSync(join(tmpdir(), 'assets-'));
    mkdirSync(join(dir, 'assets', 'files'), { recursive: true });
    copyFileSync(join(B, 'assets', 'files', 'bolt.svg'), join(dir, 'assets', 'files', 'bolt.svg'));
    expect(rules(base, dir).filter((x) => x.startsWith('schema-vis'))).toEqual([]);
    writeFileSync(join(dir, 'assets', 'files', 'bolt.svg'), readFileSync(join(B, 'assets', 'files', 'bolt.svg'), 'utf8').replace('</svg>', '<circle r="1"/></svg>'));
    expect(rules(base, dir)).toContain('schema-vis:asset.changed');
  });
});

describe('observation et module virtuel', () => {
  it('lit format, dimensions, alpha et métadonnées sans conclure au-delà', () => {
    const png = observe(join(B, 'assets', 'files', 'tests', 'atelier-declare-photo.png'));
    expect([png.format, png.width, png.height, png.alpha, png.metadata.xmp, png.metadata.digitalSourceType]).toEqual(['png', 80, 48, true, true, 'trainedAlgorithmicMedia']);
    const svg = observe(join(B, 'assets', 'files', 'nut.svg'));
    expect([svg.format, svg.width, svg.height, svg.metadata.c2paMarker]).toEqual(['svg', 160, 120, false]);
  });
  it('le module virtuel n’importe que les actifs publiables et n’expose ni droits ni preuves', () => {
    const code = virtualAssetsModule(B, base, ['schema-vis']);
    expect(code).toContain('bolt.svg');
    expect(code).not.toContain('benchmark-capture');
    expect(code).not.toContain('atelier-declare-photo');
    expect(code).not.toMatch(/rights|evidence|declared|données de test/);
  });
});
