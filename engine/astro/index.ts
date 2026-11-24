/**
 * Intégration Astro de l'usine — interface publique pour `astro.config.ts`.
 *
 * Pourquoi ici et pas seulement dans `npm run build` : un appel direct à
 * `astro build` (ou `astro dev`, `astro preview`) traverse TOUJOURS cette
 * intégration. La validation du brief y est donc impossible à contourner par
 * le chemin de build (écarts E1/E2 de l'audit).
 */
import { existsSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { AstroIntegration, AstroUserConfig } from 'astro';
import type { Brief, Mode } from '../contracts/brief.ts';
import { formatIssues } from '../contracts/issues.ts';
import { checkRules } from '../contracts/rules.ts';
import { loadBrief, siteDir as resolveSiteDir } from '../config/load.ts';
import { type ResolvedConfig, type Target, resolveConfig } from '../config/resolve.ts';
import { findLeaks } from './leaks.ts';
import { loadFormContract, serverContract, type FormContract } from '../form/index.ts';
import { checkFormContract, FORM_ENDPOINT } from '../form/rules.ts';
import { checkAssets, loadRegistry, publishable, virtualAssetsModule, type Registry } from '../assets/index.ts';
import { assetLeaks } from './asset-leaks.ts';
import { writeCrawlFiles } from './crawl.ts';

const VIRTUAL_ID = 'virtual:factory/config';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;
const FORM_VIRTUAL_ID = 'virtual:factory/form';
const RESOLVED_FORM_ID = `\0${FORM_VIRTUAL_ID}`;
const ASSETS_VIRTUAL_ID = 'virtual:factory/assets';
const RESOLVED_ASSETS_ID = `\0${ASSETS_VIRTUAL_ID}`;
const IMAGE_EXT = /\.(png|jpe?g|webp|avif|gif|svg|ico)$/i;

export class FactoryValidationError extends Error {}

export function targetFromEnv(env: NodeJS.ProcessEnv = process.env): Target {
  const t = env.FACTORY_TARGET?.trim() || 'preview';
  if (t !== 'preview' && t !== 'production') throw new FactoryValidationError(`FACTORY_TARGET inconnu : ${t} (preview | production)`);
  return t;
}

/** Mode de validation exigé par une commande Astro et une cible. */
export function modeFor(command: 'dev' | 'build' | 'preview' | 'sync', target: Target): Mode {
  if (command === 'dev' || command === 'sync') return 'draft';
  return target === 'production' ? 'release' : 'preview';
}

function factoryIntegration(dir: string, brief: Brief, config: ResolvedConfig, form: FormContract | null, registry: Registry): AstroIntegration {
  let publishableIds: string[] = [];
  return {
    name: 'premium-website-factory',
    hooks: {
      'astro:config:setup': ({ command, injectRoute, updateConfig, logger }) => {
        const mode = modeFor(command, config.target);
        const issues = [...checkRules(brief, mode), ...checkFormContract(brief, form)].filter(
          (i) => i.phase !== 'preview' || mode !== 'draft',
        );
        if (issues.length) {
          throw new FactoryValidationError(
            `Brief refusé pour « ${command} » (mode ${mode}, cible ${config.target}) :${formatIssues(issues)}\n`,
          );
        }
        logger.info(`brief valide — mode ${mode}, cible ${config.target}, origine ${config.origin}`);

        // Registre d'actifs : une anomalie sur un actif APPROUVÉ bloque ; sur un
        // candidat, elle est signalée (il n'est de toute façon pas publiable).
        const assetIssues = checkAssets(registry, dir, brief, mode);
        const blocking = assetIssues.filter((i) => registry.assets[i.path.split('.')[1] ?? '']?.status === 'approved');
        if (blocking.length) throw new FactoryValidationError(`Registre d'actifs refusé :${formatIssues(blocking)}\n`);
        for (const i of assetIssues.filter((x) => !blocking.includes(x))) logger.warn(`actif non publiable — ${i.path} : ${i.message}`);
        publishableIds = publishable(registry, assetIssues);
        logger.info(`actifs publiables : ${publishableIds.length} / ${Object.keys(registry.assets).length}`);
        // Les images passent par le registre : aucune image déposée directement dans public/.
        const pub = join(dir, 'public');
        const strays = existsSync(pub) ? readdirSync(pub, { recursive: true }).map(String).filter((f) => IMAGE_EXT.test(f)) : [];
        if (strays.length) throw new FactoryValidationError(`Images hors registre dans ${relative(process.cwd(), pub)}/ : ${strays.join(', ')} — les déclarer dans assets/registry.yaml.`);

        // Prototypes de direction : jamais dans un artefact de production.
        const protoDir = join(dir, 'design', 'prototypes');
        if (config.target !== 'production' && existsSync(protoDir)) {
          for (const file of readdirSync(protoDir).filter((f) => f.endsWith('.astro'))) {
            const name = basename(file, '.astro');
            injectRoute({ pattern: `/prototypes/${name}`, entrypoint: join(protoDir, file), prerender: true });
          }
          logger.info('prototypes de direction exposés sous /prototypes/ (hors production)');
        }

        updateConfig({
          vite: {
            plugins: [
              {
                name: 'factory:virtual-config',
                resolveId: (id: string) =>
                  id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : id === FORM_VIRTUAL_ID ? RESOLVED_FORM_ID : id === ASSETS_VIRTUAL_ID ? RESOLVED_ASSETS_ID : undefined,
                load: (id: string) => {
                  if (id === RESOLVED_VIRTUAL_ID) return `export default ${JSON.stringify(config)};`;
                  if (id === RESOLVED_FORM_ID) {
                    // Contrat public : libellés, règles, pages de résultat. Aucune adresse.
                    const value = form ? { endpoint: FORM_ENDPOINT, contract: form, server: serverContract(form) } : null;
                    return `export default ${JSON.stringify(value)};`;
                  }
                  if (id === RESOLVED_ASSETS_ID) return virtualAssetsModule(dir, registry, publishableIds);
                  return undefined;
                },
              },
            ],
          },
        });
      },
      'astro:build:done': async ({ dir: outDir, logger }) => {
        const crawl = await writeCrawlFiles(fileURLToPath(outDir), config);
        logger.info(`robots.txt (${config.indexable ? 'exploration autorisée' : 'Disallow: /'})${crawl.sitemap ? `, sitemap.xml (${crawl.sitemap} URL)` : ', pas de sitemap (preview)'}`);
        const leaked = await assetLeaks(fileURLToPath(outDir), dir, registry, publishableIds);
        if (leaked.length) throw new FactoryValidationError(`Actif non publiable dans l'artefact :\n${leaked.map((l) => `  ✗ ${l}`).join('\n')}`);
        const leaks = await findLeaks(fileURLToPath(outDir), brief, config);
        if (leaks.length) {
          throw new FactoryValidationError(
            `Donnée non publiable trouvée dans l'artefact :\n${leaks.map((l) => `  ✗ ${l}`).join('\n')}`,
          );
        }
        logger.info('aucune donnée interne ou retenue dans l’artefact');
        if (form) {
          const out = fileURLToPath(outDir);
          const missing = Object.values(form.results)
            .flatMap((r) => [r.accepted, r.invalid, r.unavailable])
            .filter((p) => !existsSync(join(out, p, 'index.html')));
          if (missing.length) throw new FactoryValidationError(`Pages de résultat du formulaire absentes : ${missing.join(', ')}`);
          logger.info('pages de résultat du formulaire présentes (parcours sans JavaScript)');
        }
      },
    },
  };
}

/** Polices déclarées par le site (`<site>/design/fonts.ts`), facultatif. */
async function siteFonts(dir: string): Promise<AstroUserConfig['fonts']> {
  const file = join(dir, 'design', 'fonts.ts');
  if (!existsSync(file)) return undefined;
  const mod = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as { fonts?: AstroUserConfig['fonts'] };
  return mod.fonts;
}

/**
 * Configuration Astro complète pour le site courant.
 * La structure du brief est vérifiée ici (mode draft) ; le mode exigé par la
 * commande est vérifié dans le hook `astro:config:setup`.
 */
export async function factoryConfig(root: string = process.cwd()): Promise<AstroUserConfig> {
  const dir = resolveSiteDir(root);
  const target = targetFromEnv();
  const loaded = await loadBrief(dir, 'draft');
  if (!loaded.ok || !loaded.brief) {
    throw new FactoryValidationError(`Brief invalide (${relative(root, dir) || '.'}) :${formatIssues(loaded.issues)}\n`);
  }
  // Origine de preview locale (non secrète) : utilisée seulement si le brief n'en déclare pas.
  const config = resolveConfig(loaded.brief, { target, localPreviewOrigin: process.env.FACTORY_PREVIEW_ORIGIN?.trim() || undefined });
  const rel = (p: string) => `./${relative(root, join(dir, p)).split('\\').join('/')}`;
  return {
    root,
    srcDir: rel('src'),
    publicDir: rel('public'),
    outDir: process.env.FACTORY_OUT_DIR?.trim() || './dist',
    site: config.origin,
    trailingSlash: 'always',
    build: { format: 'directory' },
    devToolbar: { enabled: false },
    // Shiki émet des styles inline incompatibles avec la CSP par hashes.
    markdown: { syntaxHighlight: false },
    fonts: await siteFonts(dir),
    security: {
      // CSP native : hashes des scripts/styles émis par Astro. Incompatible
      // avec <ClientRouter /> d'après la documentation : la navigation reste MPA.
      csp: {
        directives: [
          "default-src 'self'",
          "img-src 'self' data:",
          "font-src 'self'",
          "connect-src 'self'",
          "form-action 'self'",
          "base-uri 'self'",
          "object-src 'none'",
        ],
      },
    },
    integrations: [factoryIntegration(dir, loaded.brief, config, loadFormContract(dir), loadRegistry(dir))],
  };
}

export type { ResolvedConfig } from '../config/resolve.ts';
export { factFor } from '../config/resolve.ts';
