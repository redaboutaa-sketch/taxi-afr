/**
 * factory:assets scan  — observe chaque fichier et écrit le volet `observed`
 *                        (empreinte, format, dimensions, métadonnées) ;
 *                        ne touche à aucune décision ni à aucun droit.
 * factory:assets check — applique les règles du registre pour un mode.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseDocument } from 'yaml';
import { MODES, type Mode } from '../contracts/brief.ts';
import { formatIssues } from '../contracts/issues.ts';
import { loadBrief, siteDir } from '../config/load.ts';
import { checkAssets, loadRegistry, observe, publishable, registryPath } from '../assets/index.ts';

export async function assetsCmd(sub: string | undefined, opts: { mode?: string }): Promise<number> {
  const dir = siteDir();
  const file = registryPath(dir);
  if (!existsSync(file)) {
    console.log(`  aucun registre (${relative(process.cwd(), file)}) : aucun actif déclaré`);
    return 0;
  }
  if (sub === 'scan') {
    const registry = loadRegistry(dir);
    const doc = parseDocument(readFileSync(file, 'utf8'));
    for (const [id, a] of Object.entries(registry.assets)) {
      const path = join(dir, 'assets', a.file);
      if (!existsSync(path)) {
        console.log(`  ! ${id} : fichier absent (${a.file})`);
        continue;
      }
      const o = observe(path);
      const changed = a.observed && a.observed.sha256 !== o.sha256;
      doc.setIn(['assets', id, 'observed'], doc.createNode(o));
      console.log(`  ${changed ? '!' : '✓'} ${id} : ${o.format} ${o.width ?? '?'}×${o.height ?? '?'} ${o.bytes} o, alpha ${o.alpha ?? '?'}, exif ${o.metadata.exif}, xmp ${o.metadata.xmp}, marqueur C2PA ${o.metadata.c2paMarker}${o.metadata.digitalSourceType ? `, digitalSourceType ${o.metadata.digitalSourceType}` : ''}${changed ? ' — FICHIER MODIFIÉ depuis le scan précédent : revue à refaire' : ''}`);
    }
    writeFileSync(file, doc.toString());
    console.log('  Observation seulement : aucune signature vérifiée, aucun droit ni décision modifié.');
    return 0;
  }
  if (sub === 'check') {
    const mode = (opts.mode ?? 'preview') as Mode;
    if (!MODES.includes(mode)) return console.error('--mode draft|preview|release'), 2;
    const loaded = await loadBrief(dir, 'draft');
    if (!loaded.brief) return console.error(formatIssues(loaded.issues)), 1;
    const registry = loadRegistry(dir);
    const issues = checkAssets(registry, dir, loaded.brief, mode);
    const ok = publishable(registry, issues);
    for (const [id, a] of Object.entries(registry.assets)) console.log(`  ${ok.includes(id) ? '✓ publiable' : `· ${a.status}`.padEnd(12)}  ${id}`);
    const blocking = issues.filter((i) => registry.assets[i.path.split('.')[1] ?? '']?.status === 'approved');
    if (issues.length) console.log(formatIssues(issues));
    return blocking.length ? 1 : 0;
  }
  console.error('Usage : npm run factory:assets -- scan | check [--mode preview]');
  return 2;
}
