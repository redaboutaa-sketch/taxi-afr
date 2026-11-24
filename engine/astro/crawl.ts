/**
 * robots.txt et sitemap.xml, GÉRÉS par le moteur d'après l'artefact construit.
 *  - production : exploration autorisée ; sitemap = pages dont la balise
 *    robots autorise l'indexation, à leur URL canonique ;
 *  - preview : `Disallow: /`, pas de sitemap. Rappel : Disallow n'empêche ni
 *    l'accès ni toujours l'indexation d'une URL connue ; une preview
 *    confidentielle exige une authentification (en-tête X-Robots-Tag en plus).
 */
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ResolvedConfig } from '../config/resolve.ts';

async function* html(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* html(full);
    else if (e.name.endsWith('.html')) yield full;
  }
}

export async function writeCrawlFiles(outDir: string, config: ResolvedConfig): Promise<{ sitemap: number }> {
  for (const f of ['robots.txt', 'sitemap.xml', 'sitemap-index.xml']) {
    if (existsSync(join(outDir, f))) throw new Error(`${f} est généré par le moteur : le retirer du site (public/ ou pages).`);
  }
  if (!config.indexable) {
    await writeFile(join(outDir, 'robots.txt'), '# Prévisualisation : non indexable (voir aussi X-Robots-Tag).\n# Disallow ne protège pas un contenu confidentiel : exiger une authentification.\nUser-agent: *\nDisallow: /\n');
    return { sitemap: 0 };
  }
  const urls: string[] = [];
  for await (const file of html(outDir)) {
    const text = await readFile(file, 'utf8');
    const robots = /<meta name="robots" content="([^"]*)"/.exec(text)?.[1] ?? '';
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(text)?.[1];
    if (!canonical || /noindex/.test(robots) || !/\bindex\b/.test(robots)) continue;
    if (!canonical.startsWith(`${config.origin}/`)) throw new Error(`canonical hors de l'origine ${config.origin} : ${canonical}`);
    urls.push(canonical);
  }
  const unique = [...new Set(urls)].sort();
  await writeFile(join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  await writeFile(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${config.origin}/sitemap.xml\n`);
  return { sitemap: unique.length };
}
