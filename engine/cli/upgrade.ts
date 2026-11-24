/**
 * factory:manifest, factory:upgrade, factory:migrate.
 *
 * Une mise à jour ne télécharge ni n'exécute rien : la source est un
 * répertoire ou une archive DÉJÀ présente localement, dont l'empreinte est
 * fournie par un canal de confiance (--sha256). Elle est préparée sur une
 * branche git dédiée, sous forme de diff à relire, sans jamais toucher `site/`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import { SCHEMA_VERSION } from '../contracts/brief.ts';
import { briefPath, siteDir } from '../config/load.ts';
import { MIGRATIONS, migrateBrief } from '../migrations/brief.ts';
import { buildManifest, MANIFEST_FILE, readManifest, renderManifest, sha256File, type Manifest } from '../upgrade/manifest.ts';
import { planUpgrade, type PlanEntry } from '../upgrade/plan.ts';

const ROOT = process.cwd();

export async function manifestCmd(opts: { check: boolean }): Promise<number> {
  const next = renderManifest(buildManifest(ROOT));
  const file = join(ROOT, MANIFEST_FILE);
  if (opts.check) {
    const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (current !== next) {
      console.error(`✗ ${MANIFEST_FILE} ne correspond plus aux fichiers gérés. Régénérer : npm run factory:manifest`);
      return 1;
    }
    console.log(`✓ ${MANIFEST_FILE} à jour (${Object.keys(JSON.parse(next).managed).length} fichiers gérés)`);
    return 0;
  }
  writeFileSync(file, next);
  console.log(`✓ ${MANIFEST_FILE} écrit`);
  return 0;
}

const git = (args: string[]) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });

/** Charge la source de mise à jour et vérifie son identité et son intégrité. */
function loadSource(from: string, sha: string | undefined): { dir: string; manifest: Manifest; cleanup: () => void } {
  if (!sha || !/^[a-f0-9]{64}$/.test(sha)) throw new Error('--sha256 <64 hex> requis : empreinte de l’archive, ou du factory.manifest.json pour un répertoire, transmise par un canal de confiance');
  const src = resolve(from);
  let dir = src;
  let cleanup: () => void = () => undefined;
  if (src.endsWith('.tar.gz')) {
    if (sha256File(src) !== sha) throw new Error('empreinte de l’archive de mise à jour différente de l’empreinte attendue — refus');
    if (/(^|\n)(\/|.*(^|\/)\.\.(\/|$))/.test(execFileSync('tar', ['-tzf', src], { encoding: 'utf8' }))) throw new Error('chemin dangereux dans l’archive');
    dir = mkdtempSync(join(tmpdir(), 'factory-upgrade-'));
    execFileSync('tar', ['-xzf', src, '-C', dir, '--no-same-owner']);
    cleanup = () => rmSync(dir, { recursive: true, force: true });
  } else if (sha256File(join(src, MANIFEST_FILE)) !== sha) {
    throw new Error('empreinte du factory.manifest.json source différente de l’empreinte attendue — refus');
  }
  const manifest = readManifest(dir);
  if (!manifest) throw new Error('source sans factory.manifest.json');
  const bad = Object.entries(manifest.managed).filter(([p, h]) => !existsSync(join(dir, p)) || sha256File(join(dir, p)) !== h);
  if (bad.length) throw new Error(`source incohérente avec son manifeste : ${bad.slice(0, 5).map(([p]) => p).join(', ')}`);
  return { dir, manifest, cleanup };
}

function printPlan(plan: PlanEntry[], from: string, to: string) {
  const by = (a: PlanEntry['action']) => plan.filter((e) => e.action === a);
  console.log(`\n  Mise à jour de l’usine ${from} → ${to}`);
  for (const [a, label] of [['add', 'ajout'], ['update', 'mise à jour'], ['delete', 'suppression'], ['conflict', 'CONFLIT'], ['local-only-change', 'modif. locale conservée'], ['up-to-date', 'déjà à jour']] as const) {
    const list = by(a);
    if (!list.length) continue;
    console.log(`  ${label} (${list.length})`);
    for (const e of list.slice(0, 40)) console.log(`    ${a === 'conflict' ? '✗' : '·'} ${e.path}`);
    if (list.length > 40) console.log(`    … ${list.length - 40} de plus`);
  }
}

export async function upgradeCmd(opts: { to?: string; from?: string; sha256?: string; apply: boolean }): Promise<number> {
  if (!opts.to || !opts.from) {
    console.error('Usage : npm run factory:upgrade -- --to <version> --from <répertoire|archive.tar.gz> --sha256 <hex> [--dry-run | --apply]');
    return 2;
  }
  const local = readManifest(ROOT);
  if (!local) {
    console.error(`✗ ${MANIFEST_FILE} absent : impossible de savoir quels fichiers appartiennent à l’usine`);
    return 1;
  }
  let source: ReturnType<typeof loadSource>;
  try {
    source = loadSource(opts.from, opts.sha256);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    return 1;
  }
  try {
    if (source.manifest.factoryVersion !== opts.to) {
      console.error(`✗ la source est en version ${source.manifest.factoryVersion}, pas ${opts.to}`);
      return 1;
    }
    const plan = planUpgrade(ROOT, local, source.manifest);
    printPlan(plan, local.factoryVersion, opts.to);
    const conflicts = plan.filter((e) => e.action === 'conflict');
    const site = siteDir();
    const siteBrief = existsSync(briefPath(site)) ? (parse(readFileSync(briefPath(site), 'utf8')) as { schemaVersion?: number }) : null;
    if (siteBrief && typeof siteBrief.schemaVersion === 'number' && siteBrief.schemaVersion < source.manifest.schemaVersion) {
      console.log(`  migration du brief : schéma ${siteBrief.schemaVersion} → ${source.manifest.schemaVersion} (factory:migrate, après application)`);
    }
    const out = join(ROOT, '.generated', 'upgrade');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'plan.json'), `${JSON.stringify({ from: local.factoryVersion, to: opts.to, plan }, null, 2)}\n`);
    for (const c of conflicts) {
      const dest = join(out, 'conflicts', `${c.path}.factory-new`);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(join(source.dir, c.path), dest);
    }
    if (conflicts.length) console.log(`  versions proposées des fichiers en conflit : ${relative(ROOT, join(out, 'conflicts'))}/ (à fusionner à la main)`);
    console.log(`  plan détaillé : ${relative(ROOT, join(out, 'plan.json'))}`);

    if (!opts.apply) {
      console.log('\n  Simulation (--dry-run) : aucun fichier modifié.');
      return conflicts.length ? 1 : 0;
    }
    if (conflicts.length) {
      console.error(`\n✗ ${conflicts.length} conflit(s) : application refusée. Fusionner, ou restaurer la version de l’usine, puis relancer.`);
      return 1;
    }
    if (git(['rev-parse', '--is-inside-work-tree']).status !== 0 || git(['status', '--porcelain']).stdout.trim()) {
      console.error('✗ application refusée : dépôt git propre requis (commiter ou mettre de côté les modifications)');
      return 1;
    }
    const previous = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
    const branch = `factory-upgrade/${opts.to}`;
    if (git(['switch', '-c', branch]).status !== 0) {
      console.error(`✗ impossible de créer la branche ${branch}`);
      return 1;
    }
    for (const e of plan) {
      const dest = join(ROOT, e.path);
      if (e.action === 'add' || e.action === 'update') {
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(join(source.dir, e.path), dest);
      } else if (e.action === 'delete') rmSync(dest, { force: true });
    }
    copyFileSync(join(source.dir, MANIFEST_FILE), join(ROOT, MANIFEST_FILE));
    console.log(`\n✓ mise à jour appliquée sur la branche ${branch} (non commitée, à relire)`);
    console.log(`  Relire : git diff --stat ${previous}   puis : npm ci && npm run check && npm test`);
    console.log(`  Migrer le brief si annoncé : npm run factory:migrate`);
    // Séquence exercée par tests/integration/upgrade.test.ts (le dépôt était propre avant application).
    console.log(`  Annuler : git add -A && git reset --hard && git switch ${previous} && git branch -D ${branch}`);
    return 0;
  } finally {
    source.cleanup();
  }
}

export async function migrateCmd(opts: { apply: boolean }): Promise<number> {
  const file = briefPath(siteDir());
  if (!existsSync(file)) {
    console.error(`✗ brief introuvable : ${file}`);
    return 1;
  }
  const raw = parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  try {
    const { raw: next, applied } = migrateBrief(raw, SCHEMA_VERSION, MIGRATIONS);
    if (!applied.length) {
      console.log(`✓ brief déjà au schéma ${SCHEMA_VERSION}`);
      return 0;
    }
    for (const m of applied) console.log(`  · ${m.from} → ${m.to} : ${m.describe}`);
    if (!opts.apply) {
      console.log('  Simulation : relancer avec --apply pour écrire (une copie de sauvegarde sera conservée).');
      return 0;
    }
    copyFileSync(file, `${file}.v${raw.schemaVersion}.bak`);
    writeFileSync(file, stringify(next));
    console.log(`✓ brief migré (sauvegarde : ${relative(ROOT, `${file}.v${raw.schemaVersion}.bak`)}) — les commentaires YAML ne sont pas conservés`);
    return 0;
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    return 1;
  }
}
