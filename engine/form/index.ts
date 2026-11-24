/**
 * Interface publique « formulaire » : contrat, validation, chargement.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { FormContract } from './contract.ts';

export * from './contract.ts';

export const formContractPath = (siteDir: string) => join(siteDir, 'content', 'form.yaml');

/** Contrat du site, ou `null` si le site n'a pas de formulaire. Lève si le fichier est invalide. */
export function loadFormContract(siteDir: string): FormContract | null {
  const file = formContractPath(siteDir);
  if (!existsSync(file)) return null;
  const parsed = FormContract.safeParse(parse(readFileSync(file, 'utf8')));
  if (!parsed.success) {
    throw new Error(`content/form.yaml invalide : ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(' ; ')}`);
  }
  return parsed.data;
}
