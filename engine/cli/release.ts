import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { formatIssues } from '../contracts/issues.ts';
import { loadBrief, siteDir } from '../config/load.ts';
import { resolveConfig, type Target } from '../config/resolve.ts';
import { loadFormContract } from '../form/index.ts';
import { auditRelease } from '../qa/release.ts';
import { assembleRelease, checksums, type ProfileOptions } from '../release/index.ts';

const DEFAULT_OUT = '.generated/releases';

export async function release(opts: { profile?: string; target?: string; out?: string; profileJson?: string }): Promise<number> {
  if (opts.profile !== 'vps-nginx') {
    console.error('--profile attendu : vps-nginx (seul profil implémenté ; apache-shared et vps-proxy à venir)');
    return 2;
  }
  const target = (opts.target ?? 'preview') as Target;
  if (target !== 'preview' && target !== 'production') {
    console.error('--target attendu : preview | production');
    return 2;
  }
  const overrides = opts.profileJson ? (JSON.parse(readFileSync(resolve(opts.profileJson), 'utf8')) as Partial<ProfileOptions>) : {};
  try {
    const r = await assembleRelease({ siteDir: siteDir(), target, outBase: resolve(opts.out ?? DEFAULT_OUT), profile: overrides });
    const warn = r.audit.filter((a) => !a.ok);
    console.log(`✓ release ${r.id}`);
    console.log(`  répertoire : ${relative(process.cwd(), r.dir)}`);
    console.log(`  archive    : ${relative(process.cwd(), r.archive)} (+ .sha256)`);
    console.log(`  audit      : ${r.audit.length} contrôles, ${warn.length} avertissement(s)${warn.map((w) => `\n    ! ${w.id} — ${w.detail}`).join('')}`);
    console.log('  Rien n’a été déployé. Recette locale : npm run qa:recipe -- --release <répertoire>');
    return 0;
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    return 1;
  }
}

/** Ré-audit d'une release existante + vérification de ses empreintes. */
export async function qaRelease(opts: { release?: string }): Promise<number> {
  if (!opts.release) {
    console.error('--release <répertoire> requis');
    return 2;
  }
  const dir = resolve(opts.release);
  if (!existsSync(join(dir, 'release.json')) || !existsSync(join(dir, 'SHA256SUMS'))) {
    console.error('✗ release.json ou SHA256SUMS absent : ce n’est pas une release assemblée');
    return 1;
  }
  const manifest = JSON.parse(readFileSync(join(dir, 'release.json'), 'utf8')) as { id: string; siteId: string; target: Target; origin?: string };
  const sums = readFileSync(join(dir, 'SHA256SUMS'), 'utf8');
  const actual = checksums(dir, ['SHA256SUMS']);
  if (sums !== actual) {
    console.error('✗ empreintes divergentes : la release a été modifiée après assemblage');
    return 1;
  }
  console.log(`✓ empreintes conformes (${sums.trim().split('\n').length} fichiers)`);
  const loaded = await loadBrief(siteDir(), manifest.target === 'production' ? 'release' : 'preview');
  if (!loaded.ok || !loaded.brief) {
    console.error(`✗ brief du site invalide :${formatIssues(loaded.issues)}`);
    return 1;
  }
  if (loaded.brief.site.id !== manifest.siteId) {
    console.error(`✗ la release concerne « ${manifest.siteId} », le site courant est « ${loaded.brief.site.id} »`);
    return 1;
  }
  const rows = await auditRelease(dir, {
    brief: loaded.brief,
    config: resolveConfig(loaded.brief, { target: manifest.target, localPreviewOrigin: manifest.origin }),
    form: loadFormContract(siteDir()),
    target: manifest.target,
  });
  for (const r of rows.filter((x) => !x.ok)) console.log(`  ${r.severity === 'block' ? '✗' : '!'} ${r.id} — ${r.detail}`);
  const blocking = rows.filter((r) => !r.ok && r.severity === 'block').length;
  console.log(`${blocking ? '✗' : '✓'} audit ${manifest.id} : ${rows.length} contrôles, ${blocking} bloquant(s)`);
  return blocking ? 1 : 0;
}
