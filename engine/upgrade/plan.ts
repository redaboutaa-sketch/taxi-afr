/**
 * Plan de mise à jour à trois versions (ancienne usine, version locale,
 * nouvelle usine) pour chaque fichier géré :
 *
 *   amont inchangé (ancien = nouveau)              → rien à faire
 *   local intact (local = ancien)                  → add / update / delete
 *   local déjà identique au nouveau                → déjà à jour
 *   local modifié ET amont modifié                 → CONFLIT (jamais écrasé)
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Manifest } from './manifest.ts';
import { sha256File } from './manifest.ts';

export type Action = 'add' | 'update' | 'delete' | 'conflict' | 'up-to-date' | 'local-only-change';

export interface PlanEntry {
  path: string;
  action: Action;
  local: string | null;
  old: string | null;
  next: string | null;
}

export function planUpgrade(root: string, oldM: Manifest, newM: Manifest): PlanEntry[] {
  const paths = [...new Set([...Object.keys(oldM.managed), ...Object.keys(newM.managed)])].sort();
  const out: PlanEntry[] = [];
  for (const path of paths) {
    if (path.startsWith('site/')) throw new Error(`chemin client dans un manifeste : ${path}`);
    const file = join(root, path);
    const local = existsSync(file) ? sha256File(file) : null;
    const old = oldM.managed[path] ?? null;
    const next = newM.managed[path] ?? null;
    let action: Action;
    if (old === next) {
      if (local === old) continue;
      action = 'local-only-change'; // modification locale, l'amont n'a pas bougé : conservée
    } else if (local === next) action = 'up-to-date';
    else if (local === old) action = next === null ? 'delete' : old === null ? 'add' : 'update';
    else action = 'conflict';
    out.push({ path, action, local, old, next });
  }
  return out;
}
