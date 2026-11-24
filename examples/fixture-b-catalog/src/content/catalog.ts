/** Catalogue FICTIF : références inventées, aucune disponibilité ni prix affichés. */
export type Locale = 'en' | 'de' | 'nl';
export const locales: Locale[] = ['en', 'de', 'nl'];

export const paths = {
  home: { en: '/', de: '/de/', nl: '/nl/' },
  range: { en: '/range/', de: '/de/sortiment/', nl: '/nl/assortiment/' },
  /** Note technique disponible en anglais seulement : jamais présentée comme traduite. */
  notes: { en: '/technical-notes/' },
} as const;

export const items = [
  { ref: 'HB-A2-M8', cat: 'bolts', material: 'A2 stainless', sizes: 'M6–M12', standard: 'ISO 4017' },
  { ref: 'HB-A4-M10', cat: 'bolts', material: 'A4 stainless', sizes: 'M8–M16', standard: 'ISO 4014' },
  { ref: 'HN-A2-M8', cat: 'nuts', material: 'A2 stainless', sizes: 'M4–M20', standard: 'ISO 4032' },
  { ref: 'HN-A4-NYL', cat: 'nuts', material: 'A4 stainless, nylon insert', sizes: 'M5–M16', standard: 'ISO 10511' },
  { ref: 'HW-A2-FL', cat: 'washers', material: 'A2 stainless', sizes: '4–24 mm', standard: 'ISO 7089' },
] as const;

export const t = {
  en: {
    lang: 'English',
    demo: 'Fictional fixture — Halvard Fixings does not exist.',
    homeTitle: 'Stainless fasteners for plant maintenance',
    homeLead: 'A short, searchable range of stainless bolts, nuts and washers. Ask for a quote by email; we answer with availability and price.',
    rangeTitle: 'Range',
    rangeLead: 'Reference list. Availability and prices are given in the quote, never on this page.',
    head: ['Reference', 'Category', 'Material', 'Sizes', 'Standard'],
    cats: { bolts: 'Bolts', nuts: 'Nuts', washers: 'Washers' },
    notes: 'Technical notes (English only)',
    notesTitle: 'Technical notes: choosing A2 or A4',
    notesBody: 'A4 grades contain molybdenum and are usually preferred near salt or chlorinated water. This note is illustrative and not engineering advice.',
    notFound: 'Page not found',
    back: 'Back to the range',
  },
  de: {
    lang: 'Deutsch',
    demo: 'Fiktive Testinstanz — Halvard Fixings existiert nicht.',
    homeTitle: 'Edelstahl-Verbindungselemente für die Instandhaltung',
    homeLead: 'Ein kurzes, durchsuchbares Sortiment an Schrauben, Muttern und Scheiben aus Edelstahl. Angebot per E-Mail anfragen; wir antworten mit Verfügbarkeit und Preis.',
    rangeTitle: 'Sortiment',
    rangeLead: 'Referenzliste. Verfügbarkeit und Preise stehen im Angebot, nie auf dieser Seite.',
    head: ['Referenz', 'Kategorie', 'Werkstoff', 'Größen', 'Norm'],
    cats: { bolts: 'Schrauben', nuts: 'Muttern', washers: 'Unterlegscheiben' },
    notes: 'Technische Hinweise (nur auf Englisch)',
    notesTitle: '',
    notesBody: '',
    notFound: 'Seite nicht gefunden',
    back: 'Zum Sortiment',
  },
  nl: {
    lang: 'Nederlands',
    demo: 'Fictieve testopstelling — Halvard Fixings bestaat niet.',
    homeTitle: 'Roestvaststalen bevestigingsmiddelen voor onderhoud',
    homeLead: 'Een kort, doorzoekbaar assortiment roestvaststalen bouten, moeren en sluitringen. Vraag een offerte per e-mail; wij antwoorden met beschikbaarheid en prijs.',
    rangeTitle: 'Assortiment',
    rangeLead: 'Referentielijst. Beschikbaarheid en prijzen staan in de offerte, nooit op deze pagina.',
    head: ['Referentie', 'Categorie', 'Materiaal', 'Maten', 'Norm'],
    cats: { bolts: 'Bouten', nuts: 'Moeren', washers: 'Sluitringen' },
    notes: 'Technische notities (alleen Engels)',
    notesTitle: '',
    notesBody: '',
    notFound: 'Pagina niet gevonden',
    back: 'Naar het assortiment',
  },
} as const;
