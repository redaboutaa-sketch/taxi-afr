/**
 * Interface publique « actifs » : registre, observation, règles, et module
 * virtuel `virtual:factory/assets` qui n'expose QUE les actifs publiables.
 * Un fichier non approuvé n'est jamais importé : il ne peut donc pas être
 * émis dans l'artefact, même par erreur d'une page.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { Registry } from './contract.ts';

export * from './contract.ts';
export { observe } from './observe.ts';
export { checkAssets, conflicts, publishable } from './rules.ts';

export const registryPath = (siteDir: string) => join(siteDir, 'assets', 'registry.yaml');

export function loadRegistry(siteDir: string): Registry {
  const file = registryPath(siteDir);
  if (!existsSync(file)) return { schemaVersion: 1, assets: {} };
  const parsed = Registry.safeParse(parse(readFileSync(file, 'utf8')));
  if (!parsed.success) throw new Error(`assets/registry.yaml invalide : ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(' ; ')}`);
  return parsed.data;
}

/** Code du module virtuel : un import par actif publiable, métadonnées publiques seulement. */
export function virtualAssetsModule(siteDir: string, registry: Registry, ids: string[]): string {
  const lines: string[] = [];
  const entries: string[] = [];
  ids.forEach((id, i) => {
    const a = registry.assets[id]!;
    lines.push(`import a${i} from ${JSON.stringify(join(siteDir, 'assets', a.file))};`);
    // Aucune donnée de droits, de preuve ni de provenance n'est exposée aux pages.
    entries.push(`${JSON.stringify(id)}: { src: a${i}, alt: ${JSON.stringify(a.alt)}, decorative: ${a.decorative}, kind: ${JSON.stringify(a.kind)} }`);
  });
  return `${lines.join('\n')}\nconst assets = { ${entries.join(', ')} };
export function asset(id) {
  const a = assets[id];
  if (!a) throw new Error('Actif « ' + id + ' » inconnu ou non publiable (registre : approved, droits, scan, décision). Voir npm run factory:assets -- check.');
  return a;
}
export default assets;\n`;
}
