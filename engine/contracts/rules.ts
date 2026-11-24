/**
 * Règles conditionnelles au mode et aux fonctionnalités activées.
 *
 * `draft`   : structure valide, inconnues permises.
 * `preview` : périmètre revu ; libellés complets ; contenus provisoires signalés.
 * `release` : tous les faits publics confirmés, fonctions activées complètes.
 *
 * Une règle ne s'applique qu'à ce qui est activé : pas de SMTP exigé si le
 * formulaire est désactivé, pas de n° de TVA exigé s'il est déclaré
 * `not_applicable` avec justification.
 */
import { normalizeHost, normalizeOrigin, isReservedHost } from '../config/network.ts';
import { type Brief, type Mode, MODES } from './brief.ts';
import { type Issue, type Phase, issue } from './issues.ts';

/** Faits juridiques requis pour toute release, quel que soit le pays (le pays ajoute ses propres règles). */
export const RELEASE_REQUIRED_FACTS = [
  'legal.name',
  'legal.form',
  'legal.address',
  'legal.publisher',
  'legal.hostingProvider',
  'legal.registration',
  'legal.vatId',
] as const;

const rank = (m: Mode) => MODES.indexOf(m);

export function checkRules(brief: Brief, mode: Mode): Issue[] {
  const out: Issue[] = [];
  const at = (phase: Phase) => (path: string, rule: string, message: string, action: string, value?: unknown) =>
    out.push(issue(path, rule, phase, message, action, value));
  const always = at('draft');
  const preview = at('preview');
  const release = at('release');
  const wants = (m: Mode) => rank(mode) >= rank(m);

  // ── Maturité déclarée ───────────────────────────────────────────────────
  if (rank(brief.mode) < rank(mode)) {
    at(mode)(
      'mode',
      'mode.declared-below-requested',
      `le brief est déclaré « ${brief.mode} » mais la validation « ${mode} » est demandée`,
      `Compléter le brief puis passer mode: ${mode} — ce changement est une décision, pas une correction automatique.`,
      brief.mode,
    );
  }

  // ── Réseau ──────────────────────────────────────────────────────────────
  const canon = normalizeOrigin(brief.network.canonicalOrigin);
  if (!canon.ok) {
    always('network.canonicalOrigin', 'network.origin', canon.reason, 'Indiquer une origine https://domaine sans chemin.', brief.network.canonicalOrigin);
  }
  const seen = new Set<string>();
  brief.network.redirectDomains.forEach((d, i) => {
    const h = normalizeHost(d);
    const path = `network.redirectDomains[${i}]`;
    if (!h.ok) return always(path, 'network.host', h.reason, 'Indiquer un nom de domaine seul, sans schéma ni joker.', d);
    if (canon.ok && h.host === canon.host) {
      always(path, 'network.redirect-loop', 'ce domaine est l’origine canonique : la redirection bouclerait', 'Le retirer de redirectDomains.', d);
    }
    if (seen.has(h.host)) always(path, 'network.duplicate', 'domaine en double', 'Supprimer le doublon.', d);
    seen.add(h.host);
  });
  if (brief.network.previewOrigin !== null) {
    const p = normalizeOrigin(brief.network.previewOrigin, { allowPort: true, allowLocalHttp: true });
    if (!p.ok) {
      always('network.previewOrigin', 'network.origin', p.reason, 'Indiquer une origine explicite ou null.', brief.network.previewOrigin);
    } else if ((canon.ok && p.host === canon.host) || seen.has(p.host)) {
      always('network.previewOrigin', 'network.preview-conflict', 'la preview partage un hôte de production ou de redirection', 'Utiliser un hôte distinct, non indexable.', brief.network.previewOrigin);
    }
  }
  if (canon.ok) {
    if (brief.identity.fictional && !isReservedHost(canon.host)) {
      always('network.canonicalOrigin', 'identity.fictional-domain', 'une identité fictive doit utiliser un domaine réservé (example.com, .test…)', 'Remplacer par un domaine réservé.', canon.host);
    }
    if (!brief.identity.fictional && isReservedHost(canon.host)) {
      release('network.canonicalOrigin', 'network.reserved-domain', 'domaine réservé pour un site réel', 'Indiquer le domaine de production du client.', canon.host);
    }
  }

  // ── Langues ─────────────────────────────────────────────────────────────
  const locales = brief.i18n.locales;
  if (new Set(locales).size !== locales.length) always('i18n.locales', 'i18n.duplicate', 'langue en double', 'Supprimer le doublon.', locales);
  if (!locales.includes(brief.i18n.defaultLocale)) {
    always('i18n.defaultLocale', 'i18n.default-missing', 'la langue principale ne figure pas dans locales', 'L’ajouter à i18n.locales.', brief.i18n.defaultLocale);
  }
  const checkLocalized = (path: string, value: Record<string, string>) => {
    for (const k of Object.keys(value)) {
      if (!locales.includes(k)) always(path, 'i18n.unknown-locale', `langue « ${k} » absente de i18n.locales`, 'Retirer la traduction ou déclarer la langue.', k);
    }
    if (wants('preview')) {
      for (const l of locales) {
        if (!value[l]) preview(path, 'i18n.missing-label', `libellé manquant en « ${l} »`, 'Fournir la traduction (un libellé d’action ne peut pas être omis).');
      }
    }
  };
  checkLocalized('market.primaryCta.label', brief.market.primaryCta.label);
  brief.offer.categories.forEach((c, i) => checkLocalized(`offer.categories[${i}].label`, c.label));

  // ── Faits ───────────────────────────────────────────────────────────────
  for (const [key, f] of Object.entries(brief.facts)) {
    const path = `facts.${key}`;
    if (f.status === 'not_applicable' && !f.justification) {
      always(path, 'fact.na-justification', 'not_applicable sans justification', 'Expliquer pourquoi ce fait ne s’applique pas (ex. entreprise non assujettie).');
    }
    if (f.status === 'confirmed' && f.sourceRefs.length === 0) {
      always(path, 'fact.confirmed-without-source', 'fait confirmé sans référence de source', 'Ajouter la référence de la confirmation client (sans copier de document privé).');
    }
    if ((f.status === 'unknown' || f.status === 'not_applicable') && f.value !== null) {
      always(path, 'fact.value-without-status', `valeur présente alors que le statut est « ${f.status} »`, 'Mettre le statut à proposed/confirmed, ou retirer la valeur.');
    }
    if ((f.status === 'proposed' || f.status === 'confirmed') && f.value === null) {
      always(path, 'fact.status-without-value', `statut « ${f.status} » sans valeur`, 'Renseigner la valeur ou repasser en unknown.');
    }
    if (f.publication !== 'public' && f.surfaces) {
      always(path, 'fact.surfaces-not-public', 'surfaces déclarées pour un fait non public', 'Retirer surfaces ou rendre le fait public.');
    }
    if (wants('release') && f.publication === 'public' && f.status !== 'confirmed') {
      release(path, 'fact.public-unconfirmed', `fait destiné à la publication mais « ${f.status} »`, 'Obtenir la confirmation du client, ou passer publication à internal/withheld.');
    }
  }
  const ref = (path: string, key: string | undefined) => {
    if (key !== undefined && !(key in brief.facts)) {
      always(path, 'fact.missing-ref', `référence au fait « ${key} » inexistant`, 'Déclarer le fait dans facts (même en statut unknown).', key);
    }
  };
  ref('email.publicContactFact', brief.email.publicContactFact);
  ref('offer.pricingFact', brief.offer.pricingFact);
  ref('offer.availabilityFact', brief.offer.availabilityFact);
  brief.market.differentiationFacts.forEach((k, i) => ref(`market.differentiationFacts[${i}]`, k));
  brief.privacy.processing.forEach((p, i) => ref(`privacy.processing[${i}].retentionFact`, p.retentionFact));

  if (wants('release')) {
    for (const key of RELEASE_REQUIRED_FACTS) {
      const f = brief.facts[key];
      if (!f) {
        release(`facts.${key}`, 'fact.required', 'fait juridique requis absent', 'Déclarer le fait ; s’il ne s’applique pas, statut not_applicable avec justification.');
      } else if (f.status !== 'confirmed' && f.status !== 'not_applicable') {
        release(`facts.${key}`, 'fact.required-unconfirmed', `fait juridique requis « ${f.status} »`, 'Obtenir la confirmation ou une justification not_applicable.');
      }
    }
  }

  // ── CTA, formulaire, e-mail ─────────────────────────────────────────────
  const cta = brief.market.primaryCta;
  if (cta.kind === 'contact-form' && !brief.form.enabled) {
    always('market.primaryCta.kind', 'cta.form-disabled', 'le CTA principal mène à un formulaire désactivé', 'Activer form.enabled ou choisir un autre type de CTA.', cta.kind);
  }
  if (cta.kind === 'url') {
    if (!cta.target || !/^(\/[^\s]*|https:\/\/[^\s]+)$/.test(cta.target)) {
      always('market.primaryCta.target', 'cta.target', 'cible absente ou invalide pour un CTA de type url', 'Indiquer un chemin du site (/…) ou une URL https.', cta.target);
    }
  } else if (cta.target !== undefined) {
    always('market.primaryCta.target', 'cta.target-unused', 'cible fournie pour un CTA qui n’en utilise pas', 'Retirer target.');
  }
  if ((cta.kind === 'email' || cta.kind === 'phone') && wants('preview')) {
    const k = cta.kind === 'email' ? brief.email.publicContactFact : 'contact.phone';
    if (!k || !brief.facts[k]) preview('market.primaryCta', 'cta.contact-fact', 'CTA de contact sans fait de coordonnée associé', 'Déclarer la coordonnée dans facts.');
  }

  const e = brief.email;
  if (e.sendingDomain !== undefined) {
    const sd = normalizeHost(e.sendingDomain);
    if (!sd.ok) always('email.sendingDomain', 'email.sending-domain', sd.reason, 'Indiquer le domaine d’envoi couvert par SPF/DKIM.', e.sendingDomain);
    else if (e.from) {
      const fromDomain = e.from.split('@')[1]?.toLowerCase() ?? '';
      if (fromDomain !== sd.host && !fromDomain.endsWith(`.${sd.host}`)) {
        always('email.from', 'email.from-alignment', 'le From n’appartient pas au domaine d’envoi déclaré (alignement DMARC impossible)', 'Choisir un From du domaine d’envoi, ou corriger sendingDomain.', e.from);
      }
    }
  }
  if (e.transport === 'smtp' && !e.smtp) always('email.smtp', 'email.smtp-missing', 'transport smtp sans paramètres', 'Renseigner email.smtp (secrets par références env:).');
  if (e.transport !== 'smtp' && e.smtp) always('email.smtp', 'email.smtp-unused', 'paramètres SMTP pour un transport non smtp', 'Retirer email.smtp ou choisir transport: smtp.');

  if (brief.form.enabled && wants('release')) {
    for (const k of ['recipient', 'from', 'sendingDomain'] as const) {
      if (!e[k]) release(`email.${k}`, 'email.required', `${k} requis quand le formulaire est activé`, 'Renseigner explicitement — jamais déduit du domaine web.');
    }
    if (e.transport === 'none') release('email.transport', 'email.transport-none', 'formulaire activé sans transport', 'Choisir smtp (ou capture pour une démonstration fictive).');
    if (e.transport === 'capture' && !brief.identity.fictional) {
      release('email.transport', 'email.capture-in-release', 'transport de capture locale pour un site réel', 'Configurer le transport SMTP authentifié.');
    }
    if (!brief.privacy.processing.length) {
      release('privacy.processing', 'privacy.form-processing', 'formulaire activé sans traitement déclaré', 'Décrire finalité, destinataires et durée de conservation.');
    }
  }

  // ── Livraison ───────────────────────────────────────────────────────────
  if (brief.design.renderApproval && !brief.design.selectedDirection) {
    always('design.renderApproval', 'gate.g2-order', 'rendu approuvé sans direction choisie', 'Enregistrer d’abord le choix de direction.');
  }
  if (wants('release')) {
    if (!brief.design.selectedDirection) release('design.selectedDirection', 'gate.g2', 'aucune direction artistique choisie', 'Faire choisir une piste par le propriétaire (porte G2).');
    else if (!brief.design.renderApproval) release('design.renderApproval', 'gate.g2-render', 'direction choisie mais rendu final non approuvé', 'Faire approuver le rendu par le propriétaire après revue des captures (porte G2).');
    if (!brief.delivery.reviewer) release('delivery.reviewer', 'delivery.reviewer', 'aucun responsable de revue', 'Désigner la personne qui valide.');
  }
  return out;
}

/**
 * Prêt pour la production réelle : au-delà de `release`. Les vérifications
 * externes (DNS, réception, hébergement) restent `pending_external` tant
 * qu'elles ne sont pas observées — elles ne sont pas simulées ici.
 */
export function checkProductionReadiness(brief: Brief): Issue[] {
  const out: Issue[] = [];
  if (brief.identity.fictional) {
    out.push(issue('identity.fictional', 'production.fictional', 'production', 'identité de démonstration : jamais publiable comme vrai client', 'Utiliser un brief client réel.'));
  }
  if (!brief.delivery.publicationAuthorization) {
    out.push(issue('delivery.publicationAuthorization', 'production.authorization', 'production', 'aucune autorisation de publication', 'Obtenir l’autorisation du propriétaire pour cette version et cette cible.'));
  }
  return out;
}
