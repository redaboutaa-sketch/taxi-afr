/**
 * JSON Schema du brief, GÉNÉRÉ depuis le contrat zod. Le fichier versionné
 * sert l'éditeur (`$schema` dans brief.yaml) ; `--check` échoue s'il ne
 * correspond plus au contrat.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { Brief } from '../contracts/brief.ts';

export const SCHEMA_FILE = fileURLToPath(new URL('../contracts/brief.schema.json', import.meta.url));

export function renderSchema(): string {
  const json = z.toJSONSchema(Brief, { target: 'draft-2020-12', io: 'input' });
  return `${JSON.stringify({ ...json, title: 'Premium Website Factory — brief', $id: 'https://example.com/premium-website-factory/brief.schema.json' }, null, 2)}\n`;
}

export async function schema(opts: { check: boolean }): Promise<number> {
  const next = renderSchema();
  if (opts.check) {
    const current = await readFile(SCHEMA_FILE, 'utf8').catch(() => '');
    if (current !== next) {
      console.error('✗ engine/contracts/brief.schema.json ne correspond plus au contrat. Régénérer : npm run factory:schema');
      return 1;
    }
    console.log('✓ JSON Schema du brief à jour');
    return 0;
  }
  await writeFile(SCHEMA_FILE, next);
  console.log('✓ engine/contracts/brief.schema.json généré');
  return 0;
}
