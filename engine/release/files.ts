import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Liste triée des fichiers ; refuse liens symboliques et fichiers spéciaux. */
export function walkFiles(dir: string): string[] {
  const out: string[] = [];
  const go = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(d, e.name);
      if (e.isDirectory()) go(p);
      else if (e.isFile()) out.push(relative(dir, p).split('\\').join('/'));
      else throw new Error(`type de fichier refusé dans la release : ${p}`);
    }
  };
  go(dir);
  return out;
}

