/**
 * Manifeste des fichiers GÉRÉS par l'usine (factory.manifest.json).
 *
 * Un fichier géré appartient à l'usine : il peut être remplacé par une mise à
 * jour, mais jamais silencieusement s'il a été modifié localement. Tout ce qui
 * n'est pas listé — en particulier `site/` (contenu, design, décisions du
 * client) et les secrets — n'est jamais touché par `factory:upgrade`.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMA_VERSION } from '../contracts/brief.ts';

export const MANIFEST_FILE = 'factory.manifest.json';

/** Motifs des chemins gérés (préfixes de répertoire ou fichiers exacts). */
export const MANAGED = [
  'engine/',
  'tests/',
  'examples/',
  '.github/workflows/',
  '.github/CODEOWNERS',
  'docs/adr/',
  'astro.config.ts',
  'tsconfig.json',
  'tsconfig.engine.json',
  'vitest.config.ts',
  'package.json',
  'package-lock.json',
  '.nvmrc',
  '.npmrc',
  '.gitignore',
  'AGENTS.md',
  'CLAUDE.md',
];
/** Jamais gérés, même s'ils correspondent à un motif. */
const NEVER = [/^site\//, /(^|\/)\.env/, /\.local\.php$/];

export interface Manifest {
  factoryVersion: string;
  schemaVersion: number;
  managed: Record<string, string>;
}

export const isManaged = (path: string) => !NEVER.some((r) => r.test(path)) && MANAGED.some((m) => (m.endsWith('/') ? path.startsWith(m) : path === m));
export const sha256File = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

/** Fichiers suivis par git (les fichiers ignorés — vendor, dist — ne sont jamais gérés). */
export function trackedFiles(root: string): string[] {
  return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
}

export function buildManifest(root: string): Manifest {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
  const managed: Record<string, string> = {};
  for (const f of trackedFiles(root).filter(isManaged).sort()) {
    if (existsSync(join(root, f))) managed[f] = sha256File(join(root, f));
  }
  return { factoryVersion: pkg.version, schemaVersion: SCHEMA_VERSION, managed };
}

export const renderManifest = (m: Manifest) => `${JSON.stringify(m, null, 2)}\n`;

export function readManifest(root: string): Manifest | null {
  const file = join(root, MANIFEST_FILE);
  if (!existsSync(file)) return null;
  const m = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
  if (typeof m.factoryVersion !== 'string' || typeof m.managed !== 'object') throw new Error(`${MANIFEST_FILE} invalide`);
  return m;
}
