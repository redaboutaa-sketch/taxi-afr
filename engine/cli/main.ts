#!/usr/bin/env node
/**
 * CLI publique de l'usine. Exécutée directement par Node (suppression des
 * types natifs) : le moteur n'emploie que de la syntaxe TypeScript effaçable
 * (`erasableSyntaxOnly` dans tsconfig), sans enum ni namespace.
 */
import { parseArgs } from 'node:util';
import { assetsCmd } from './assets.ts';
import { doctor } from './doctor.ts';
import { init } from './init.ts';
import { qaRelease, release } from './release.ts';
import { manifestCmd, migrateCmd, upgradeCmd } from './upgrade.ts';
import { schema } from './schema.ts';
import { verifyCmd } from './verify.ts';
import { validate } from './validate.ts';

const HELP = `Premium Website Factory — commandes

  init      --brief <chemin> | --example <nom>   crée site/ (refuse d'écraser un site existant)
  validate  --mode draft|preview|release [--production]   valide le brief du site courant
  doctor                                          vérifie l'environnement, sans afficher de secret
  schema    [--check]                             génère (ou vérifie) le JSON Schema du brief
  release   --profile vps-nginx [--target preview|production] [--out <dir>] [--profile-json <fichier>]
            assemble, audite et archive une release (ne déploie rien)
  qa-release --release <répertoire>               vérifie empreintes et ré-audite une release
  assets    scan | check [--mode m]              observe les fichiers du registre d'actifs / applique ses règles
  release-verify --archive <f.tar.gz> --repo <o/r>  vérifie l'attestation de provenance (gh) avant déploiement
  manifest  [--check]                             (re)génère factory.manifest.json (fichiers gérés par l'usine)
  upgrade   --to <v> --from <dir|archive> --sha256 <hex> [--dry-run|--apply]
            met à jour les fichiers gérés sur une branche dédiée ; conflits jamais écrasés
  migrate   [--apply]                             migre le brief du site vers le schéma courant

Variables : FACTORY_SITE_DIR (répertoire du site, défaut site/), FACTORY_TARGET (preview|production).
Utilisation via npm : npm run factory:validate -- --mode release`;

const [command, ...rawRest] = process.argv.slice(2);
// Sous-commande positionnelle éventuelle (ex. `assets scan`).
const sub = rawRest[0] && !rawRest[0].startsWith('-') ? rawRest[0] : undefined;
const rest = sub ? rawRest.slice(1) : rawRest;

const { values } = parseArgs({
  args: rest,
  options: {
    brief: { type: 'string' },
    example: { type: 'string' },
    mode: { type: 'string' },
    production: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
    profile: { type: 'string' },
    target: { type: 'string' },
    out: { type: 'string' },
    'profile-json': { type: 'string' },
    release: { type: 'string' },
    to: { type: 'string' },
    from: { type: 'string' },
    sha256: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    archive: { type: 'string' },
    repo: { type: 'string' },
    apply: { type: 'boolean', default: false },
  },
  strict: true,
});

async function main(): Promise<number> {
  if (!command || values.help || command === 'help') {
    console.log(HELP);
    return command ? 0 : 2;
  }
  switch (command) {
    case 'init':
      return init({ brief: values.brief, example: values.example });
    case 'validate':
      return validate({ mode: values.mode, production: values.production });
    case 'doctor':
      return doctor();
    case 'release':
      return release({ profile: values.profile, target: values.target, out: values.out, profileJson: values['profile-json'] });
    case 'qa-release':
      return qaRelease({ release: values.release });
    case 'assets':
      return assetsCmd(sub, { mode: values.mode });
    case 'release-verify':
      return verifyCmd({ archive: values.archive, repo: values.repo });
    case 'manifest':
      return manifestCmd({ check: values.check });
    case 'upgrade':
      if (values.apply && values['dry-run']) {
        console.error('--apply et --dry-run sont exclusifs');
        return 2;
      }
      return upgradeCmd({ to: values.to, from: values.from, sha256: values.sha256, apply: values.apply });
    case 'migrate':
      return migrateCmd({ apply: values.apply });
    case 'schema':
      return schema({ check: values.check });
    default:
      console.error(`Commande inconnue : ${command}\n\n${HELP}`);
      return 2;
  }
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
