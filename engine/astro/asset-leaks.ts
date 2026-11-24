/**
 * Aucun actif non publiable dans l'artefact : ni ses octets d'origine, ni un
 * dérivé nommé d'après lui (Astro conserve le nom de base : `nom.<hash>.ext`).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import type { Registry } from '../assets/contract.ts';

async function* files(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* files(full);
    else yield full;
  }
}

const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');
const stem = (f: string) => basename(f, extname(f));

export async function assetLeaks(outDir: string, siteDir: string, registry: Registry, publishableIds: string[]): Promise<string[]> {
  const allowedStems = new Set(publishableIds.map((id) => stem(registry.assets[id]!.file)));
  const blocked = Object.entries(registry.assets)
    .filter(([id]) => !publishableIds.includes(id))
    .map(([id, a]) => ({ id, a, file: join(siteDir, 'assets', a.file) }))
    .filter((x) => existsSync(x.file))
    .map((x) => ({ ...x, sha: sha(x.file), stem: stem(x.file) }));
  if (!blocked.length) return [];
  const out: string[] = [];
  for await (const f of files(outDir)) {
    const rel = relative(outDir, f);
    const name = basename(f);
    for (const b of blocked) {
      if (!allowedStems.has(b.stem) && name.startsWith(`${b.stem}.`)) out.push(`${rel} : dérivé probable de l'actif « ${b.id} » (${b.a.status})`);
    }
    if (/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(name)) {
      const h = sha(f);
      for (const b of blocked) if (h === b.sha) out.push(`${rel} : copie exacte de l'actif « ${b.id} » (${b.a.status})`);
    }
  }
  return out;
}
