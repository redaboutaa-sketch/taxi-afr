/**
 * Textes du site de démonstration (fictif), FR et EN. Propriété du site :
 * le moteur n'en connaît aucun. Les éléments `fact` renvoient aux faits du
 * brief et ne sont affichés que si la configuration résolue les projette.
 */
export type Locale = 'fr' | 'en';

export const routes = {
  home: { fr: '/', en: '/en/' },
  contact: { fr: '/contact/', en: '/en/contact/' },
} as const;

export const chrome = {
  fr: {
    demo: 'Démonstration fictive',
    demoDetail: 'Ostral Conseil n’existe pas. Ce site illustre Premium Website Factory.',
    nav: { offer: 'Offre', method: 'Méthode', contact: 'Contact' },
    other: { label: 'English', lang: 'en' },
    footer: ['Ostral Conseil — entreprise fictive de démonstration.', 'Aucune donnée de ce site ne désigne une entreprise réelle.'],
    provisional: 'à confirmer',
    skip: 'Aller au contenu',
  },
  en: {
    demo: 'Fictional demo',
    demoDetail: 'Ostral Conseil does not exist. This site illustrates Premium Website Factory.',
    nav: { offer: 'Services', method: 'Method', contact: 'Contact' },
    other: { label: 'Français', lang: 'fr' },
    footer: ['Ostral Conseil — fictional demo company.', 'Nothing on this site refers to a real company.'],
    provisional: 'to be confirmed',
    skip: 'Skip to content',
  },
} as const;

export const home = {
  fr: {
    title: 'Ostral Conseil — achats des PME industrielles (démonstration)',
    description: 'Démonstration fictive : conseil achats pour PME industrielles de 50 à 500 salariés.',
    kicker: 'Conseil achats · PME industrielles',
    h1: [{ text: 'Des achats pilotés,' }, { text: 'sans service achats.', em: true }],
    lead: 'Pour les PME industrielles de 50 à 500 salariés : voir où part l’argent, structurer les fournisseurs, conduire les appels d’offres.',
    cta: 'Décrire votre situation',
    secondary: 'Voir un exemple de livrable',
    indexTitle: 'Registre des prestations',
    offerTitle: 'Trois prestations. Une question de départ : où part votre argent ?',
    columns: ['Prestation', 'Pour vous si…', 'Vous obtenez', 'Durée'],
    services: [
      { id: 'diagnostic', title: 'Diagnostic des achats', for: 'Vous ne savez pas précisément combien vous achetez, ni à qui.', get: 'Cartographie des dépenses et plan d’action priorisé', durationFact: 'offer.diagnosticDuration' },
      { id: 'panel', title: 'Structuration du panel fournisseurs', for: 'Trop de fournisseurs, peu de contrats, des dépendances non mesurées.', get: 'Panel cible, règles de référencement, contrats cadres à négocier', duration: 'Fixée après le diagnostic' },
      { id: 'appel-offres', title: 'Conduite d’appel d’offres', for: 'Un achat important à renégocier ou à attribuer pour la première fois.', get: 'Cahier des charges, consultation, grille de comparaison, recommandation', duration: 'Selon le calendrier de l’achat' },
    ],
    exhibitTitle: 'À quoi ressemble un livrable',
    exhibitTag: 'Exemple fictif',
    exhibitText: [
      'Le diagnostic se termine par une matrice de priorisation : chaque famille d’achats est placée selon son poids dans les dépenses et la difficulté à la changer.',
      'Elle sert à décider par où commencer. Les positions ci-contre sont inventées pour l’exemple ; elles ne décrivent aucune entreprise.',
    ],
    methodTitle: 'Comment se déroule un diagnostic',
    steps: [
      { title: 'Premier échange', text: 'Vous décrivez votre activité et ce qui vous préoccupe. Nous disons si nous pouvons aider.' },
      { title: 'Collecte', text: 'Export des factures et commandes depuis votre comptabilité, sans outil à installer.' },
      { title: 'Analyse', text: 'Regroupement par famille d’achats, fournisseurs, contrats et échéances.' },
      { title: 'Restitution', text: 'Une réunion, un document, des priorités. Vous décidez de la suite.' },
    ],
    exclusionsTitle: 'Ce que nous ne faisons pas',
    exclusions: ['Pas de recrutement ni de délégation d’acheteurs à temps plein.', 'Pas de prestation pour les marchés publics côté acheteur public.'],
    closing: 'Décrivez votre situation en quelques lignes. Nous vous dirons si nous pouvons aider.',
  },
  en: {
    title: 'Ostral Conseil — procurement for industrial SMEs (demo)',
    description: 'Fictional demo: procurement consulting for industrial SMEs with 50 to 500 employees.',
    kicker: 'Procurement consulting · Industrial SMEs',
    h1: [{ text: 'Purchasing under control,' }, { text: 'without a purchasing team.', em: true }],
    lead: 'For industrial SMEs with 50 to 500 employees: see where the money goes, structure your suppliers, run your tenders.',
    cta: 'Describe your situation',
    secondary: 'See a sample deliverable',
    indexTitle: 'Register of services',
    offerTitle: 'Three services. One starting question: where does your money go?',
    columns: ['Service', 'For you if…', 'You get', 'Duration'],
    services: [
      { id: 'diagnostic', title: 'Procurement review', for: 'You do not know precisely how much you buy, or from whom.', get: 'Spend map and prioritised action plan', durationFact: 'offer.diagnosticDuration' },
      { id: 'panel', title: 'Supplier base structuring', for: 'Too many suppliers, few contracts, unmeasured dependencies.', get: 'Target supplier base, onboarding rules, framework contracts to negotiate', duration: 'Set after the review' },
      { id: 'appel-offres', title: 'Tender management', for: 'A major purchase to renegotiate or award for the first time.', get: 'Specification, consultation, comparison grid, recommendation', duration: 'Depends on the purchase timeline' },
    ],
    exhibitTitle: 'What a deliverable looks like',
    exhibitTag: 'Fictional example',
    exhibitText: [
      'The review ends with a prioritisation matrix: each spend category is placed by its weight in total spend and how hard it is to change.',
      'It is used to decide where to start. The positions shown are invented for this example; they describe no company.',
    ],
    methodTitle: 'How a review works',
    steps: [
      { title: 'First conversation', text: 'You describe your business and your concerns. We tell you whether we can help.' },
      { title: 'Data collection', text: 'Export of invoices and orders from your accounting system, nothing to install.' },
      { title: 'Analysis', text: 'Grouping by spend category, supplier, contract and renewal date.' },
      { title: 'Debrief', text: 'One meeting, one document, clear priorities. You decide what happens next.' },
    ],
    exclusionsTitle: 'What we do not do',
    exclusions: ['No recruitment or full-time buyer secondment.', 'No work for public-sector buyers on public contracts.'],
    closing: 'Describe your situation in a few lines. We will tell you whether we can help.',
  },
} as const;

/** Données INVENTÉES de l'aperçu de livrable : positions relatives (0–100), aucun montant. */
export const matrix = {
  fr: {
    title: 'Matrice de priorisation — exemple fictif',
    desc: 'Six familles d’achats inventées, placées selon leur poids dans les dépenses (horizontal) et la difficulté à les changer (vertical).',
    x: 'Poids dans les dépenses',
    y: 'Difficulté à changer',
    quadrants: { tl: 'Laisser en l’état', tr: 'Sécuriser', bl: 'Simplifier', br: 'Négocier en priorité' },
    caption: 'Données inventées pour illustrer le livrable. Aucun résultat client.',
    tableSummary: 'Voir les données de l’exemple',
    head: ['Famille d’achats (fictive)', 'Poids', 'Difficulté', 'Lecture'],
    level: (v: number) => (v >= 66 ? 'élevé' : v >= 33 ? 'moyen' : 'faible'),
  },
  en: {
    title: 'Prioritisation matrix — fictional example',
    desc: 'Six invented spend categories, placed by weight in total spend (horizontal) and difficulty to change (vertical).',
    x: 'Weight in spend',
    y: 'Difficulty to change',
    quadrants: { tl: 'Leave as is', tr: 'Secure', bl: 'Simplify', br: 'Negotiate first' },
    caption: 'Invented data to illustrate the deliverable. No client result.',
    tableSummary: 'Show the example data',
    head: ['Spend category (fictional)', 'Weight', 'Difficulty', 'Reading'],
    level: (v: number) => (v >= 66 ? 'high' : v >= 33 ? 'medium' : 'low'),
  },
  points: [
    { fr: 'Matières premières', en: 'Raw materials', x: 82, y: 74 },
    { fr: 'Transport', en: 'Freight', x: 64, y: 30 },
    { fr: 'Emballages', en: 'Packaging', x: 46, y: 22 },
    { fr: 'Maintenance', en: 'Maintenance', x: 30, y: 62 },
    { fr: 'Informatique', en: 'IT services', x: 22, y: 44 },
    { fr: 'Fournitures', en: 'Supplies', x: 10, y: 12 },
  ],
} as const;
