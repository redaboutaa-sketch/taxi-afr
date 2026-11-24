/**
 * Chargement et validation du brief. Point d'entrée UNIQUE emprunté par la
 * CLI, l'intégration Astro et les tests : aucun chemin de build ne lit le
 * brief autrement.
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse as parseYaml, YAMLParseError } from 'yaml';
import { Brief, SCHEMA_VERSION, type Mode } from '../contracts/brief.ts';
import { type Issue, fromZod, issue } from '../contracts/issues.ts';
import { checkRules } from '../contracts/rules.ts';

export const DEFAULT_SITE_DIR = 'site';

/** Répertoire du site : `FACTORY_SITE_DIR` (relatif à la racine) ou `site/`. */
export function siteDir(root: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): string {
  return resolve(root, env.FACTORY_SITE_DIR?.trim() || DEFAULT_SITE_DIR);
}

export const briefPath = (dir: string) => join(dir, 'brief', 'brief.yaml');

export type LoadResult = { ok: true; brief: Brief; issues: [] } | { ok: false; brief?: Brief; issues: Issue[] };

export function parseBrief(text: string, mode: Mode): LoadResult {
  let raw: unknown;
  try {
    raw = parseYaml(text, { prettyErrors: true, uniqueKeys: true });
  } catch (e) {
    const msg = e instanceof YAMLParseError ? e.message.split('\n')[0] ?? e.message : String(e);
    return { ok: false, issues: [issue('(fichier)', 'yaml.syntax', 'structure', msg, 'Corriger la syntaxe YAML.')] };
  }
  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version === 'number' && version < SCHEMA_VERSION) {
    return { ok: false, issues: [issue('schemaVersion', 'schema.outdated', 'structure', `brief au schéma ${version}, l’usine attend ${SCHEMA_VERSION}`, 'Migrer : npm run factory:migrate -- --apply (sauvegarde conservée).', version)] };
  }
  const parsed = Brief.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: fromZod(parsed.error, raw) };
  const issues = checkRules(parsed.data, mode);
  return issues.length ? { ok: false, brief: parsed.data, issues } : { ok: true, brief: parsed.data, issues: [] };
}

export async function loadBrief(dir: string, mode: Mode): Promise<LoadResult> {
  let text: string;
  try {
    text = await readFile(briefPath(dir), 'utf8');
  } catch {
    return {
      ok: false,
      issues: [
        issue(
          briefPath(dir),
          'site.missing',
          'structure',
          'brief introuvable',
          'Créer le site : npm run factory:init -- --brief <chemin> (ou --example fixture-a-services), ou définir FACTORY_SITE_DIR.',
        ),
      ],
    };
  }
  return parseBrief(text, mode);
}
