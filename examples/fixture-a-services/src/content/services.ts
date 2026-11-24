/**
 * Contenu des pages de détail (démonstration fictive). Aucune durée, aucun
 * prix ni résultat chiffré n'est écrit ici : une durée n'apparaît que si un
 * fait du brief la porte (`durationFact`), avec son statut.
 */
import type { Locale } from './pages.ts';

export interface ServiceContent {
  title: string;
  summary: string;
  forYou: string;
  deliverable: string;
  duration?: string;
  format: string;
  prerequisites: string;
  steps: Array<{ title: string; text: string }>;
  receive: string[];
  needs: string[];
  notThis: { text: string; other: ServiceId };
}

export type ServiceId = 'diagnostic' | 'panel' | 'appel-offres';

export const services: Array<{ id: ServiceId; slug: Record<Locale, string>; durationFact?: string; showMatrix?: boolean; content: Record<Locale, ServiceContent> }> = [
  {
    id: 'diagnostic',
    slug: { fr: 'diagnostic-achats', en: 'procurement-review' },
    durationFact: 'offer.diagnosticDuration',
    showMatrix: true,
    content: {
      fr: {
        title: 'Diagnostic des achats',
        summary: 'Savoir combien vous achetez, à qui, sous quelles conditions — et par où commencer.',
        forYou: 'Vous ne savez pas précisément combien vous achetez, ni à qui.',
        deliverable: 'Cartographie des dépenses et plan d’action priorisé',
        format: 'Une réunion de lancement, un échange intermédiaire, une restitution',
        prerequisites: 'Un export comptable des factures fournisseurs',
        steps: [
          { title: 'Cadrage', text: 'Nous fixons ensemble le périmètre : sites, entités, période étudiée, interlocuteurs.' },
          { title: 'Collecte', text: 'Vous transmettez un export comptable. Nous n’installons aucun outil chez vous.' },
          { title: 'Regroupement', text: 'Chaque dépense est rattachée à une famille d’achats et à un fournisseur ; les doublons et fournisseurs multiples apparaissent.' },
          { title: 'Lecture', text: 'Nous croisons le poids de chaque famille avec la difficulté à la changer : contrats, dépendances, exigences techniques.' },
          { title: 'Restitution', text: 'Une réunion, un document, des priorités. Vous décidez de la suite, avec ou sans nous.' },
        ],
        receive: ['La cartographie des dépenses par famille et par fournisseur', 'La matrice de priorisation (exemple fictif ci-dessous)', 'Un plan d’action ordonné, avec ce qui relève de vos équipes'],
        needs: ['Un export des factures fournisseurs', 'Un interlocuteur disponible pour répondre aux questions de rattachement', 'La liste des contrats en cours, s’il en existe une'],
        notThis: { text: 'Vous savez déjà quel achat renégocier ?', other: 'appel-offres' },
      },
      en: {
        title: 'Procurement review',
        summary: 'Know how much you buy, from whom, on what terms — and where to start.',
        forYou: 'You do not know precisely how much you buy, or from whom.',
        deliverable: 'Spend map and prioritised action plan',
        format: 'A kick-off meeting, an interim check-in, a debrief',
        prerequisites: 'An accounting export of supplier invoices',
        steps: [
          { title: 'Scoping', text: 'Together we set the scope: sites, entities, period covered, contacts.' },
          { title: 'Data collection', text: 'You send an accounting export. We install nothing on your systems.' },
          { title: 'Grouping', text: 'Each expense is assigned to a spend category and a supplier; duplicates and overlapping suppliers become visible.' },
          { title: 'Reading', text: 'We cross the weight of each category with how hard it is to change: contracts, dependencies, technical constraints.' },
          { title: 'Debrief', text: 'One meeting, one document, clear priorities. You decide what happens next, with or without us.' },
        ],
        receive: ['The spend map by category and supplier', 'The prioritisation matrix (fictional example below)', 'An ordered action plan, including what your teams can handle'],
        needs: ['An export of supplier invoices', 'One contact available to answer categorisation questions', 'The list of current contracts, if one exists'],
        notThis: { text: 'Already know which purchase to renegotiate?', other: 'appel-offres' },
      },
    },
  },
  {
    id: 'panel',
    slug: { fr: 'panel-fournisseurs', en: 'supplier-base' },
    content: {
      fr: {
        title: 'Structuration du panel fournisseurs',
        summary: 'Moins de fournisseurs, mieux choisis, avec des règles que vos équipes peuvent appliquer seules.',
        forYou: 'Trop de fournisseurs, peu de contrats, des dépendances non mesurées.',
        deliverable: 'Panel cible, règles de référencement, contrats cadres à négocier',
        duration: 'Fixée après le diagnostic',
        format: 'Ateliers avec les équipes qui commandent',
        prerequisites: 'Un diagnostic, le nôtre ou un équivalent',
        steps: [
          { title: 'Familles prioritaires', text: 'Nous partons des familles identifiées par le diagnostic, pas de tout le périmètre à la fois.' },
          { title: 'Panel cible', text: 'Pour chaque famille : combien de fournisseurs garder, lesquels, et pourquoi.' },
          { title: 'Règles', text: 'Qui peut référencer un fournisseur, sur quels critères, avec quelle validation.' },
          { title: 'Contrats cadres', text: 'La liste des contrats à négocier en priorité, avec leurs points d’attention.' },
        ],
        receive: ['Le panel cible par famille', 'Les règles de référencement rédigées pour vos équipes', 'La liste priorisée des contrats cadres'],
        needs: ['Les résultats d’un diagnostic', 'Les personnes qui passent les commandes, pour les ateliers'],
        notThis: { text: 'Vous ne savez pas encore où part votre argent ?', other: 'diagnostic' },
      },
      en: {
        title: 'Supplier base structuring',
        summary: 'Fewer, better-chosen suppliers, with rules your teams can apply on their own.',
        forYou: 'Too many suppliers, few contracts, unmeasured dependencies.',
        deliverable: 'Target supplier base, onboarding rules, framework contracts to negotiate',
        duration: 'Set after the review',
        format: 'Workshops with the people who place orders',
        prerequisites: 'A procurement review, ours or an equivalent',
        steps: [
          { title: 'Priority categories', text: 'We start from the categories identified in the review, not the whole scope at once.' },
          { title: 'Target base', text: 'For each category: how many suppliers to keep, which ones, and why.' },
          { title: 'Rules', text: 'Who may onboard a supplier, on what criteria, with which approval.' },
          { title: 'Framework contracts', text: 'The list of contracts to negotiate first, with their points of attention.' },
        ],
        receive: ['The target supplier base per category', 'Onboarding rules written for your teams', 'The prioritised list of framework contracts'],
        needs: ['The results of a procurement review', 'The people who place orders, for the workshops'],
        notThis: { text: 'Do not know yet where your money goes?', other: 'diagnostic' },
      },
    },
  },
  {
    id: 'appel-offres',
    slug: { fr: 'appel-d-offres', en: 'tender-management' },
    content: {
      fr: {
        title: 'Conduite d’appel d’offres',
        summary: 'Un achat important, attribué sur des critères écrits à l’avance et comparables.',
        forYou: 'Un achat important à renégocier ou à attribuer pour la première fois.',
        deliverable: 'Cahier des charges, consultation, grille de comparaison, recommandation',
        duration: 'Selon le calendrier de l’achat',
        format: 'Accompagnement de bout en bout, décision chez vous',
        prerequisites: 'Un besoin identifié et un décideur désigné',
        steps: [
          { title: 'Besoin', text: 'Nous écrivons le cahier des charges avec les utilisateurs, avant de parler aux fournisseurs.' },
          { title: 'Critères', text: 'La grille de comparaison est fixée avant la consultation, pas après réception des offres.' },
          { title: 'Consultation', text: 'Nous identifions les fournisseurs à consulter et gérons les échanges.' },
          { title: 'Recommandation', text: 'Offres comparées sur la grille, recommandation argumentée. La décision vous appartient.' },
        ],
        receive: ['Le cahier des charges', 'La grille de comparaison', 'La recommandation argumentée'],
        needs: ['Un décideur désigné', 'Les utilisateurs de l’achat, pour écrire le besoin'],
        notThis: { text: 'Le problème concerne beaucoup de fournisseurs à la fois ?', other: 'panel' },
      },
      en: {
        title: 'Tender management',
        summary: 'A major purchase awarded on criteria written in advance and comparable.',
        forYou: 'A major purchase to renegotiate or award for the first time.',
        deliverable: 'Specification, consultation, comparison grid, recommendation',
        duration: 'Depends on the purchase timeline',
        format: 'End-to-end support, decision stays with you',
        prerequisites: 'An identified need and a named decision-maker',
        steps: [
          { title: 'Need', text: 'We write the specification with the users, before talking to suppliers.' },
          { title: 'Criteria', text: 'The comparison grid is set before the consultation, not after offers arrive.' },
          { title: 'Consultation', text: 'We identify the suppliers to consult and handle the exchanges.' },
          { title: 'Recommendation', text: 'Offers compared on the grid, argued recommendation. The decision is yours.' },
        ],
        receive: ['The specification', 'The comparison grid', 'The argued recommendation'],
        needs: ['A named decision-maker', 'The users of the purchase, to write the need'],
        notThis: { text: 'The problem spans many suppliers at once?', other: 'panel' },
      },
    },
  },
];

export const servicePath = (id: ServiceId, locale: Locale) => {
  const s = services.find((x) => x.id === id)!;
  return locale === 'fr' ? `/prestations/${s.slug.fr}/` : `/en/services/${s.slug.en}/`;
};

export const detailLabels = {
  fr: {
    home: 'Accueil', services: 'Prestations', breadcrumb: 'Fil d’Ariane', sheet: 'Fiche', forYou: 'Pour vous si…', deliverable: 'Livrable', duration: 'Durée', format: 'Format', prerequisites: 'Prérequis',
    steps: 'Déroulé', receive: 'Ce que vous recevez', needs: 'Ce dont nous avons besoin', notThis: 'Ce n’est pas la bonne prestation ?', see: 'Voir', others: 'Les autres prestations', cta: 'Décrire votre situation', ctaText: 'Quelques lignes suffisent pour savoir si cette prestation vous correspond.',
  },
  en: {
    home: 'Home', services: 'Services', breadcrumb: 'Breadcrumb', sheet: 'Summary', forYou: 'For you if…', deliverable: 'Deliverable', duration: 'Duration', format: 'Format', prerequisites: 'Prerequisites',
    steps: 'How it works', receive: 'What you receive', needs: 'What we need from you', notThis: 'Not the right service?', see: 'See', others: 'Other services', cta: 'Describe your situation', ctaText: 'A few lines are enough to know whether this service fits.',
  },
} as const;
