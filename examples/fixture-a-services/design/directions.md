# Directions artistiques — décision en attente (porte G2)

Deux pistes, même contenu (`design/prototypes/_content.ts`). Consultables en preview : `/prototypes/planche/`, `/prototypes/direction-a/`, `/prototypes/direction-b/`. Captures (Chromium 158, 390 et 1440 px, @2x, CSP active) : `design/captures/`.

| | A — Registre | B — Plan d'atelier |
|---|---|---|
| Intention | Document de cabinet annoté ; posé, textuel | Fiche technique ; direct, dense |
| Composition | 12 colonnes, marge de notes « § », asymétrie ; sommaire « Registre des prestations » dans le premier écran | En-tête ardoise sur trame visible ; fiche « 01 / Diagnostic » à droite du titre ; bandes 3/9 |
| Densité | Aérée | Dense |
| Typographie | Newsreader (optique variable) + Public Sans | IBM Plex Sans Condensed + IBM Plex Mono |
| Offre | Registre comparatif aligné en sous-grille | Trois modules à bordures partagées, lignes de spécification |
| Méthode | Frise à filets, numérotation romaine en italique | Schéma de flux numéroté (vertical sur mobile) |
| CTA | Bouton rouge de correction + lien texte ; clôture sur fond encre | Bande jaune signal pleine largeur, bouton ardoise |
| Images | Aucune | Aucune |
| Risque | Peut paraître austère ; dépend de la qualité des textes | Codes « industriels » attendus ; titres en capitales longs en allemand/anglais à surveiller |

Contrastes des associations employées : calculés au build depuis `design/directions/*.css`, visibles sur la planche ; toutes les associations de texte et de focus dépassent les seuils WCAG (filets et trame décoratifs exclus).

**Décision** : à prendre par le propriétaire. Le brief garde `design.selectedDirection: null` tant qu'elle n'est pas prise ; une release est refusée dans cet état (`gate.g2`).
