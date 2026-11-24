/**
 * Le VRAI chemin de build : `astro build` appelé directement, sans le
 * wrapper npm. Prouve que la validation du brief et le contrôle de fuite ne
 * se contournent pas (écarts E1/E2/E12 de l'audit).
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

const ROOT = resolve(import.meta.dirname, '../..');
const WORK = join(ROOT, '.generated', 'test-sites');
const FIXTURE = join(ROOT, 'examples', 'fixture-a-services');

function site(name: string, edit?: (brief: Record<string, any>) => void, extraPage?: [string, string]) {
  const dir = join(WORK, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  cpSync(FIXTURE, dir, { recursive: true, filter: (src) => !src.includes(`${'design'}/captures`) });
  if (edit) {
    const file = join(dir, 'brief', 'brief.yaml');
    const brief = parse(readFileSync(file, 'utf8'));
    edit(brief);
    writeFileSync(file, stringify(brief));
  }
  if (extraPage) writeFileSync(join(dir, 'src', 'pages', extraPage[0]), extraPage[1]);
  return dir;
}

function astroBuild(dir: string, target: 'preview' | 'production') {
  const out = join(dir, '..', `${dir.split('/').pop()}-dist`);
  const r = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FACTORY_SITE_DIR: dir, FACTORY_TARGET: target, FACTORY_OUT_DIR: out, ASTRO_TELEMETRY_DISABLED: '1' },
  });
  return { code: r.status, log: `${r.stdout}\n${r.stderr}`, out };
}

const releaseReady = (b: Record<string, any>) => {
  b.mode = 'release';
  for (const f of Object.values(b.facts as Record<string, any>)) {
    if (f.publication === 'public' && f.status !== 'confirmed') {
      f.status = 'confirmed';
      f.value ??= 'valeur de test';
      f.sourceRefs = ['test'];
    }
  }
  b.design.selectedDirection = { id: 'a', decidedBy: 'test', decidedOn: '2026-11-24' };
  b.design.renderApproval = { approvedBy: 'test', approvedOn: '2026-11-24', scope: 'test' };
  b.delivery.reviewer = 'test';
};

afterAll(() => rmSync(WORK, { recursive: true, force: true }));

describe('astro build direct', () => {
  it('construit la fixture A en preview, prototypes compris, sans fuite', () => {
    const r = astroBuild(site('ok-preview'), 'preview');
    expect(r.code, r.log).toBe(0);
    expect(existsSync(join(r.out, 'prototypes', 'planche', 'index.html'))).toBe(true);
    expect(readFileSync(join(r.out, 'index.html'), 'utf8')).toContain('noindex, nofollow');
  });

  it('refuse un brief invalide (redirection en boucle)', () => {
    const r = astroBuild(site('bad-loop', (b) => (b.network.redirectDomains = ['www.example.com'])), 'preview');
    expect(r.code).not.toBe(0);
    expect(r.log).toContain('network.redirect-loop');
  });

  it('refuse une cible production pour un brief qui n’est pas en release', () => {
    const r = astroBuild(site('bad-prod'), 'production');
    expect(r.code).not.toBe(0);
    expect(r.log).toContain('mode.declared-below-requested');
  });

  it('cible production : prototypes exclus, page indexable, faits proposés absents', () => {
    const r = astroBuild(site('ok-prod', releaseReady), 'production');
    expect(r.code, r.log).toBe(0);
    expect(existsSync(join(r.out, 'prototypes'))).toBe(false);
    expect(readFileSync(join(r.out, 'index.html'), 'utf8')).toContain('index, follow');
  });

  it('échoue si une donnée withheld est recopiée en dur dans du JSON-LD', () => {
    const leak = `---\n---\n<html lang="fr"><head><script type="application/ld+json" is:inline>{"@type":"Offer","price":"Tarif journalier interne de démonstration 1150 EUR HT"}</script></head><body>x</body></html>\n`;
    const r = astroBuild(site('leak', undefined, ['fuite.astro', leak]), 'preview');
    expect(r.code).not.toBe(0);
    expect(r.log).toContain('offer.pricing');
  });

  it('échoue si l’adresse interne du destinataire apparaît dans un script', () => {
    const leak = `---\n---\n<html lang="fr"><body><script>console.log('demandes@example.com')</script></body></html>\n`;
    const r = astroBuild(site('leak-js', undefined, ['fuite-js.astro', leak]), 'preview');
    expect(r.code).not.toBe(0);
    expect(r.log).toContain('email.recipient');
  });

  it('production : sitemap sans pages noindex, robots.txt d’exploration', () => {
    const r = astroBuild(site('crawl-prod', releaseReady), 'production');
    expect(r.code, r.log).toBe(0);
    const sitemap = readFileSync(join(r.out, 'sitemap.xml'), 'utf8');
    expect(sitemap).toContain('<loc>https://www.example.com/</loc>');
    expect(sitemap).toContain('<loc>https://www.example.com/prestations/diagnostic-achats/</loc>');
    expect(sitemap).not.toContain('/contact/envoye/');
    expect(sitemap).not.toContain('/prototypes/');
    expect(readFileSync(join(r.out, 'robots.txt'), 'utf8')).toContain('Sitemap: https://www.example.com/sitemap.xml');
  });

  it('un fait autorisé seulement en html, recopié dans une balise meta : échec', () => {
    const page = `---\n---\n<html lang="fr"><head><meta name="description" content="Écrire à contact@example.com" /></head><body><p>contact@example.com</p></body></html>\n`;
    const r = astroBuild(site('surface-meta', (b) => (b.facts['contact.email'].surfaces = ['html']), ['meta-fuite.astro', page]), 'preview');
    expect(r.code).not.toBe(0);
    expect(r.log).toContain('interdit en meta');
  });

  it('une page qui demande un actif non approuvé : échec du build', () => {
    const page = `---\nimport { asset } from 'virtual:factory/assets';\nconst a = asset('partage-defaut');\n---\n<img src={a.src.src} alt="" />\n`;
    const r = astroBuild(site('asset-candidate', undefined, ['actif.astro', page]), 'preview');
    expect(r.code).not.toBe(0);
    expect(r.log).toContain('non publiable');
  });

  it('image déposée hors registre dans public/ : échec du build', () => {
    const dir = site('asset-stray');
    mkdirSync(join(dir, 'public'), { recursive: true });
    cpSync(join(FIXTURE, 'assets', 'files', 'partage-defaut.png'), join(dir, 'public', 'image.png'));
    const r = astroBuild(dir, 'preview');
    expect(r.code).not.toBe(0);
    expect(r.log).toContain('Images hors registre');
  });

  it('actif approuvé (décision du test) : og:image émise ; non approuvé : ni balise ni fichier', () => {
    const before = astroBuild(site('og-candidate'), 'preview');
    expect(before.code, before.log).toBe(0);
    expect(readFileSync(join(before.out, 'index.html'), 'utf8')).not.toContain('og:image');
    const dir = site('og-approved');
    const reg = join(dir, 'assets', 'registry.yaml');
    writeFileSync(reg, readFileSync(reg, 'utf8').replace('status: candidate\n    decision: null', "status: approved\n    decision: { by: test d'intégration, on: '2026-11-24' }"));
    const after = astroBuild(dir, 'preview');
    expect(after.code, after.log).toBe(0);
    expect(readFileSync(join(after.out, 'index.html'), 'utf8')).toMatch(/og:image" content="http:\/\/localhost:4321\/_astro\/partage-defaut\.[^"]+\.(png|webp)"/);
  });
});
