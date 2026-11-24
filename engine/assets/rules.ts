/**
 * Règles du registre d'actifs. Un actif n'atteint une page que s'il est
 * `approved` ET que tout ce qui suit est vrai — sinon le build échoue :
 *  - fichier présent, scanné, et inchangé depuis le scan (empreinte) ;
 *  - décision humaine enregistrée ;
 *  - droits `granted` (avec référence de preuve) ou `not_required` (justifié) ;
 *  - aucun conflit entre déclaration et observation ;
 *  - aucune image générée présentée comme réelle ; aucun actif de benchmark.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Brief, Mode } from '../contracts/brief.ts';
import { type Issue, issue } from '../contracts/issues.ts';
import type { AssetRecord, Registry } from './contract.ts';
import { observe } from './observe.ts';

const GENERATED_IPTC = /trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia/i;

/** Conflits entre ce qui est déclaré et ce qui est observé (approbation bloquée). */
export function conflicts(a: AssetRecord): string[] {
  const out: string[] = [];
  const dst = a.observed?.metadata.digitalSourceType ?? null;
  if (dst && GENERATED_IPTC.test(dst) && a.declared.source !== 'ai-generated') {
    out.push(`le fichier porte digitalSourceType « ${dst} » (contenu généré) alors que la source déclarée est « ${a.declared.source} »`);
  }
  if (a.declared.source === 'ai-generated' && a.kind === 'photo') {
    out.push('image générée déclarée comme photographie');
  }
  return out;
}

export function checkAssets(registry: Registry, siteDir: string, brief: Brief, mode: Mode, today: string = new Date().toISOString().slice(0, 10)): Issue[] {
  const out: Issue[] = [];
  const wants = (m: Mode) => ['draft', 'preview', 'release'].indexOf(mode) >= ['draft', 'preview', 'release'].indexOf(m);
  for (const [id, a] of Object.entries(registry.assets)) {
    const p = `assets.${id}`;
    const add = (rule: string, message: string, action: string, phase: 'draft' | 'preview' | 'release' = 'draft') => out.push(issue(p, rule, phase, message, action));
    const file = join(siteDir, 'assets', a.file);
    const present = existsSync(file);
    if (a.status === 'excluded' || a.status === 'rejected') continue; // conservés pour mémoire, jamais publiés

    if (!present) { add('asset.missing', `fichier absent : ${a.file}`, 'Fournir le fichier ou passer le statut à excluded.'); continue; }
    if (!a.observed) add('asset.not-scanned', 'fichier jamais observé', 'Lancer npm run factory:assets -- scan.');
    else if (observe(file).sha256 !== a.observed.sha256) add('asset.changed', 'le fichier a changé depuis le dernier scan (empreinte différente)', 'Relancer le scan et refaire la revue : une décision porte sur des octets précis.');

    if (a.declared.source === 'benchmark') add('asset.benchmark', 'actif de benchmark : jamais publiable', 'Passer à excluded ; ne pas l’utiliser dans une release.');
    if (a.declared.source === 'ai-generated') {
      if (a.depicts !== 'none') add('asset.generated-misleading', `image générée présentée comme montrant « ${a.depicts} »`, 'Interdit : une image générée ne montre ni produit, ni lieu, ni personne, ni résultat réels.');
      if (!brief.design.allowGeneratedIllustrations) add('asset.generated-not-allowed', 'le brief n’autorise pas les illustrations générées', 'Décision du propriétaire requise (design.allowGeneratedIllustrations).');
    }
    for (const c of conflicts(a)) add('asset.conflict', c, 'Consigner le conflit et le résoudre avec le fournisseur ; approbation impossible d’ici là.');

    if (!a.decorative) {
      for (const l of brief.i18n.locales) {
        if (!a.alt[l]?.trim()) add('asset.alt-missing', `texte alternatif absent en « ${l} »`, 'Rédiger le texte alternatif, ou déclarer l’image décorative.', 'preview');
      }
    }
    if (a.status !== 'approved') continue;
    if (!a.decision) add('asset.no-decision', 'approuvé sans décision humaine enregistrée', 'Renseigner decision (personne, date).');
    if (a.rights.status === 'granted' && !a.rights.evidenceRef) add('asset.rights-evidence', 'droits accordés sans référence de preuve', 'Renseigner rights.evidenceRef (référence privée).');
    if (a.rights.status === 'not_required' && !a.rights.scope) add('asset.rights-justification', 'droits « non requis » sans justification', 'Expliquer dans rights.scope (ex. œuvre originale de l’équipe).');
    if (!['granted', 'not_required'].includes(a.rights.status)) add('asset.rights', `droits « ${a.rights.status} »`, 'Obtenir l’autorisation écrite avant approbation.');
    if (a.rights.expires && a.rights.expires < today) add('asset.rights-expired', `droits expirés le ${a.rights.expires}`, 'Renouveler ou retirer l’actif.');
    if (a.signature.c2pa === 'invalid') add('asset.signature-invalid', 'signature C2PA invalide', 'Résoudre avant approbation.');
  }
  return out.filter((i) => i.phase !== 'preview' || wants('preview'));
}

/** Actifs publiables : approuvés ET sans aucune anomalie. */
export function publishable(registry: Registry, issues: Issue[]): string[] {
  const bad = new Set(issues.map((i) => i.path.split('.')[1]));
  return Object.entries(registry.assets).filter(([id, a]) => a.status === 'approved' && !bad.has(id)).map(([id]) => id);
}
