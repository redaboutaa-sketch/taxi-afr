# Capacités web employées

Mise à jour à chaque fonctionnalité adoptée. « Testé » = observé dans le navigateur de recette, avec la version indiquée.

| Fonctionnalité | Problème résolu | Statut | Cibles / repli | CSP / performance | Tests réalisés |
|---|---|---|---|---|---|
| `clamp()` (échelles typo/espaces) | Échelle fluide sans paliers | Stable | Valeurs min lisibles ; zoom texte à tester | Aucun impact | Prototypes A/B rendus à 390 et 1440 px, Chromium 158 |
| CSS Grid + `subgrid` | Registre de prestations aligné colonne par colonne (piste A) | Stable (Baseline 2023) | Sans subgrid : chaque ligne garde le même gabarit de colonnes ; mobile : empilement | Aucun | Desktop 1440 px, Chromium 158 |
| `@layer` | Ordre de cascade explicite | Stable | — | Aucun | idem |
| `text-wrap: balance` | Titres équilibrés | Stable | Repli : retour à la ligne normal | Aucun | idem |
| API Fonts d'Astro, fichiers locaux | Polices auto-hébergées, `@font-face` + préchargement ciblé | Stable (Astro 6+) | Fallbacks déclarés | `<style>` émis hashé par la CSP native : aucune violation observée | Polices chargées vérifiées via `document.fonts` |
| CSP native d'Astro (meta, hashes) | Politique stricte sans `unsafe-inline` | Stable (Astro 6+) | — | Incompatible avec `<ClientRouter />` (doc Astro) : navigation MPA ; balise meta sans `frame-ancestors` → en-tête HTTP requis (incr. 2) | 6 captures sans violation |
| `hyphens: auto` + `overflow-wrap: break-word` | Mots longs à 200 % de texte, colonnes étroites | Stable | Repli : coupure sans tiret | Aucun | Texte agrandi 200 %, 9 pages × 2 largeurs, Chromium 158 |
| `<details>` + tableau dans une région défilante (`tabindex=0`) | Données de la matrice accessibles sans élargir la page | Stable | Contenu lisible ouvert ou fermé | Aucun | Revue et texte 200 % |
| Espace fine insécable (U+202F) | Ponctuation haute française non orpheline | Stable (Unicode) | Police : glyphe présent dans le sous-ensemble latin | Aucun | Vérifié dans le HTML produit |
| Préchargement ciblé des polices (2 fichiers) | Éviter le décalage au chargement de la police du texte | Stable (API Fonts Astro) | `font-display: swap` + fallbacks | CLS 0,141 → 0 sur la page de résultat | Lighthouse 13.6.0, médiane de 3 |

Envisagées, non adoptées à ce stade : container queries, `<dialog>`/Popover (menu mobile), transitions de documents entre pages, Speculation Rules. Chacune sera ajoutée ici avec son repli et ses tests si elle est retenue.
