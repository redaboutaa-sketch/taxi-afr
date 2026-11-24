/**
 * Création d'un site. Non destructif par construction : si le répertoire du
 * site existe déjà (même vide), on refuse et on explique. Le site est
 * assemblé dans un répertoire temporaire voisin puis renommé, pour ne jamais
 * laisser un site à moitié copié.
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatIssues } from '../contracts/issues.ts';
import { briefPath, parseBrief, siteDir } from '../config/load.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const STARTER = join(ROOT, 'engine', 'starter');

export async function init(opts: { brief?: string; example?: string }): Promise<number> {
  if (Boolean(opts.brief) === Boolean(opts.example)) {
    console.error('Indiquer exactement une source : --brief <chemin> ou --example <nom>.');
    return 2;
  }
  const target = siteDir();
  const where = relative(process.cwd(), target) || '.';
  if (existsSync(target)) {
    console.error(
      `✗ ${where}/ existe déjà : init ne remplace jamais un site.\n` +
        '  Pour repartir de zéro, archiver ou supprimer ce répertoire vous-même après vérification,\n' +
        '  ou initialiser ailleurs avec FACTORY_SITE_DIR=<autre répertoire>.',
    );
    return 1;
  }

  let source: string;
  let briefText: string;
  if (opts.example) {
    if (!/^[a-z0-9-]+$/.test(opts.example)) {
      console.error('Nom d’exemple invalide.');
      return 2;
    }
    source = join(ROOT, 'examples', opts.example);
    if (!existsSync(briefPath(source))) {
      console.error(`✗ exemple introuvable : examples/${opts.example}/brief/brief.yaml`);
      return 1;
    }
    briefText = await readFile(briefPath(source), 'utf8');
  } else {
    source = STARTER;
    briefText = await readFile(resolve(opts.brief as string), 'utf8').catch(() => '');
    if (!briefText) {
      console.error(`✗ brief illisible : ${opts.brief}`);
      return 1;
    }
  }

  const parsed = parseBrief(briefText, 'draft');
  if (!parsed.ok) {
    console.error(`✗ brief refusé avant création du site :${formatIssues(parsed.issues)}\n`);
    return 1;
  }

  const tmp = `${target}.init-${process.pid}`;
  await rm(tmp, { recursive: true, force: true });
  try {
    await mkdir(dirname(target), { recursive: true });
    await cp(source, tmp, { recursive: true, errorOnExist: true, force: false });
    await mkdir(join(tmp, 'brief'), { recursive: true });
    await writeFile(briefPath(tmp), briefText, { flag: opts.example ? 'w' : 'wx' });
    await rename(tmp, target);
  } catch (e) {
    await rm(tmp, { recursive: true, force: true });
    throw e;
  }
  console.log(`✓ site créé dans ${where}/ depuis ${opts.example ? `examples/${opts.example}` : 'le squelette du moteur'}`);
  console.log('  Suite : npm run factory:validate -- --mode preview, puis npm run dev');
  return 0;
}
