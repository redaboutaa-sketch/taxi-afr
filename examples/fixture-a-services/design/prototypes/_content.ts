/**
 * Contenu représentatif commun aux deux prototypes (FR).
 * Fictif. Les éléments marqués `provisional` correspondent à des faits
 * `proposed` du brief : ils sont signalés à l'écran en preview et ne
 * deviennent jamais des faits client par leur présence ici.
 */
export const nav = ['Offre', 'Méthode', 'À propos', 'Contact'];

export const hero = {
  kicker: 'Conseil achats · PME industrielles',
  title: 'Reprendre la main sur vos achats, sans créer de service achats.',
  lead:
    'Nous aidons les PME industrielles de 50 à 500 salariés à voir où part leur argent, à structurer leurs fournisseurs et à conduire leurs appels d’offres.',
  cta: 'Décrire votre situation',
  secondary: 'Voir le contenu d’un diagnostic',
};

export const services = [
  {
    id: 'diagnostic',
    n: '01',
    title: 'Diagnostic des achats',
    for: 'Vous ne savez pas précisément combien vous achetez, ni à qui.',
    get: 'Cartographie des dépenses et plan d’action priorisé',
    duration: 'Restitué en 15 jours ouvrés',
    provisional: true,
  },
  {
    id: 'panel',
    n: '02',
    title: 'Structuration du panel fournisseurs',
    for: 'Trop de fournisseurs, peu de contrats, des dépendances non mesurées.',
    get: 'Panel cible, règles de référencement, contrats cadres à négocier',
    duration: 'Durée fixée après diagnostic',
    provisional: false,
  },
  {
    id: 'appel-offres',
    n: '03',
    title: 'Conduite d’appel d’offres',
    for: 'Un achat important à renégocier ou à attribuer pour la première fois.',
    get: 'Cahier des charges, consultation, grille de comparaison, recommandation',
    duration: 'Selon le calendrier de l’achat',
    provisional: false,
  },
] as const;

export const steps = [
  { title: 'Premier échange', text: 'Vous décrivez votre activité et ce qui vous inquiète. Nous disons si nous pouvons aider.' },
  { title: 'Collecte', text: 'Extraction des factures et commandes depuis votre comptabilité, sans outil à installer.' },
  { title: 'Analyse', text: 'Regroupement par famille d’achats, fournisseurs, contrats et échéances.' },
  { title: 'Restitution', text: 'Une réunion, un document, des priorités. Vous décidez de la suite.' },
];

export const exclusions = [
  'Pas de recrutement ni de délégation d’acheteurs à temps plein.',
  'Pas de prestation pour les marchés publics côté acheteur public.',
];

export const demoNotice = 'Démonstration fictive — Ostral Conseil n’existe pas.';
