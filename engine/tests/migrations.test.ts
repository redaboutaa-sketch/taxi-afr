/** Migrations du brief : chaîne, refus, et détection d'un brief périmé. */
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { parseBrief } from '../config/load.ts';
import { MIGRATIONS, migrateBrief, type Migration } from '../migrations/brief.ts';

/** Registre de démonstration (tests uniquement) : 1 → 2 → 3. */
const registry: Migration[] = [
  { from: 1, to: 2, describe: 'identity.brand → identity.brandName', migrate: (r) => {
    const identity = r.identity as Record<string, unknown>;
    const { brand, ...rest } = identity;
    return { ...r, schemaVersion: 2, identity: { ...rest, brandName: brand } };
  } },
  { from: 2, to: 3, describe: 'ajout de delivery.channel', migrate: (r) => ({ ...r, schemaVersion: 3, delivery: { ...(r.delivery as object), channel: 'email' } }) },
];

describe('migrateBrief', () => {
  it('applique la chaîne dans l’ordre et ne modifie pas l’entrée', () => {
    const input = { schemaVersion: 1, identity: { brand: 'X', fictional: true }, delivery: {} };
    const { raw, applied } = migrateBrief(input, 3, registry);
    expect(applied.map((m) => `${m.from}→${m.to}`)).toEqual(['1→2', '2→3']);
    expect(raw).toEqual({ schemaVersion: 3, identity: { brandName: 'X', fictional: true }, delivery: { channel: 'email' } });
    expect(input.identity.brand).toBe('X');
  });
  it('est sans effet au schéma courant', () => {
    expect(migrateBrief({ schemaVersion: 3 }, 3, registry).applied).toEqual([]);
  });
  it('refuse une étape manquante', () => {
    expect(() => migrateBrief({ schemaVersion: 1 }, 3, [registry[1]!])).toThrow(/aucune migration de la version 1/);
  });
  it('refuse un brief plus récent que l’usine', () => {
    expect(() => migrateBrief({ schemaVersion: 4 }, 3, registry)).toThrow(/plus récente/);
  });
  it('refuse une migration qui oublie schemaVersion', () => {
    const broken: Migration[] = [{ from: 1, to: 2, describe: 'cassée', migrate: (r) => ({ ...r }) }];
    expect(() => migrateBrief({ schemaVersion: 1 }, 2, broken)).toThrow(/n'a pas mis à jour schemaVersion/);
  });
  it('registre réel : aucune migration publiée tant que le schéma est en v1', () => {
    expect(MIGRATIONS).toEqual([]);
  });
  it('un brief au schéma antérieur est refusé avec l’action « migrer »', () => {
    const r = parseBrief(stringify({ schemaVersion: 0, mode: 'draft' }), 'draft');
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.rule)).toEqual(['schema.outdated']);
  });
});
