/**
 * Release de RECETTE : copie temporaire du site dont la section e-mail est
 * remplacée par un transport de CAPTURE locale (identités .test). La vraie
 * configuration (Gmail) n'est jamais utilisée en recette : aucun e-mail réel.
 *
 *   node qa/afr/capture-release.ts   → affiche le répertoire de la release
 */
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assembleRelease } from '../../engine/release/index.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const copy = join(ROOT, '.generated', 'afr-capture-site');
rmSync(copy, { recursive: true, force: true });
cpSync(join(ROOT, 'site'), copy, { recursive: true });
const briefFile = join(copy, 'brief', 'brief.yaml');
const brief = readFileSync(briefFile, 'utf8');
const section = /\nemail:\n[\s\S]*?\n(?=form:)/;
if (!section.test(brief)) throw new Error('section email introuvable dans le brief');
writeFileSync(
  briefFile,
  brief.replace(
    section,
    `\nemail:\n  publicContactFact: contact.email\n  recipient: chauffeur@recette.afr-taxi.test\n  from: demandes@recette.afr-taxi.test\n  sendingDomain: recette.afr-taxi.test\n  replyTo: submitter\n  transport: capture\n\n`,
  ),
);
const profile = JSON.parse(readFileSync(join(ROOT, 'tests', 'recipe', 'profile.json'), 'utf8'));
const r = await assembleRelease({ siteDir: copy, target: 'preview', outBase: join(ROOT, '.generated', 'releases-capture'), profile, log: () => {} });
console.log(r.dir);
