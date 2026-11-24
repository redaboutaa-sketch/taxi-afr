/**
 * Cohérence entre le brief et le contrat de formulaire du site.
 */
import type { Brief } from '../contracts/brief.ts';
import { type Issue, issue } from '../contracts/issues.ts';
import type { FormContract } from './contract.ts';

/** Chemin public de l'endpoint, identique pour tous les sites et profils. */
export const FORM_ENDPOINT = '/api/contact.php';

export function checkFormContract(brief: Brief, contract: FormContract | null): Issue[] {
  const out: Issue[] = [];
  if (brief.form.enabled && !contract) {
    out.push(issue('form.enabled', 'form.contract-missing', 'draft', 'formulaire activé sans content/form.yaml', 'Créer le contrat de formulaire du site.'));
  }
  if (!brief.form.enabled && contract) {
    out.push(issue('form.enabled', 'form.contract-unused', 'draft', 'content/form.yaml présent alors que le formulaire est désactivé', 'Activer form.enabled ou retirer le contrat.'));
  }
  if (!contract) return out;
  for (const l of brief.i18n.locales) {
    if (!contract.results[l]) out.push(issue(`content/form.yaml results.${l}`, 'form.results-locale', 'draft', `pages de résultat absentes pour « ${l} »`, 'Déclarer accepted/invalid/unavailable pour chaque langue.'));
    if (!contract.subject[l]) out.push(issue(`content/form.yaml subject.${l}`, 'form.subject-locale', 'draft', `objet absent pour « ${l} »`, 'Déclarer l’objet du message pour chaque langue.'));
    for (const f of contract.fields) {
      if (!f.label[l]) out.push(issue(`content/form.yaml fields.${f.name}.label.${l}`, 'form.label-locale', 'preview', `libellé absent pour « ${l} »`, 'Traduire le libellé.'));
    }
  }
  if (!contract.fields.some((f) => f.kind === 'email' && f.required)) {
    out.push(issue('content/form.yaml fields', 'form.reply-address', 'draft', 'aucun champ e-mail obligatoire : impossible de répondre (Reply-To)', 'Ajouter un champ email requis.'));
  }
  return out;
}
