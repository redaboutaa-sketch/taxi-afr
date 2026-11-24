/**
 * Migrations du brief, d'une version de schéma à la suivante. Chaque étape
 * est une fonction pure testée ; la chaîne est appliquée dans l'ordre.
 * Version actuelle : 1 — aucune migration publiée à ce jour (la liste est vide).
 */
import { SCHEMA_VERSION } from '../contracts/brief.ts';

export type RawBrief = Record<string, unknown>;

export interface Migration {
  from: number;
  to: number;
  describe: string;
  migrate(raw: RawBrief): RawBrief;
}

export const MIGRATIONS: Migration[] = [];

export function migrateBrief(raw: RawBrief, target: number = SCHEMA_VERSION, registry: Migration[] = MIGRATIONS): { raw: RawBrief; applied: Migration[] } {
  const declared = raw.schemaVersion;
  if (typeof declared !== 'number' || !Number.isInteger(declared)) throw new Error('schemaVersion absent ou non entier');
  let current: number = declared;
  if (current > target) throw new Error(`brief en version ${current}, plus récente que l'usine (${target}) : mettre à jour l'usine d'abord`);
  const applied: Migration[] = [];
  let data = structuredClone(raw);
  while (current < target) {
    const step = registry.find((m) => m.from === current);
    if (!step || step.to !== current + 1) throw new Error(`aucune migration de la version ${current} vers ${current + 1}`);
    data = step.migrate(structuredClone(data));
    if (data.schemaVersion !== step.to) throw new Error(`la migration ${step.from}→${step.to} n'a pas mis à jour schemaVersion`);
    applied.push(step);
    current = step.to;
  }
  return { raw: data, applied };
}
