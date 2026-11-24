# Rapport de qualité de conception — fixture A (Ostral, démonstration fictive)

Évaluation motivée de l'agent. **Le choix de la piste A est enregistré (2026-11-24) ; l'approbation du rendu final ne l'est pas** (`design.renderApproval: null`).

États : à corriger · prêt pour revue · validé par le propriétaire.

## Revue du 2026-11-24 — incrément 3 : gabarit de détail
Pages : `/prestations/{diagnostic-achats,panel-fournisseurs,appel-d-offres}/` et `/en/services/{procurement-review,supplier-base,tender-management}/`. Captures : `design/captures/site/prestations_*`, `en_services_*`, `prestations_appel-d-offres-360-zoom200.png`.

| Point | Constat |
|---|---|
| Composition propre | Fil d'Ariane ; titre + chapeau + CTA ; **fiche** latérale (pour qui, livrable, durée, format, prérequis) ; déroulé en registre à trois colonnes au desktop ; « ce que vous recevez / ce dont nous avons besoin » ; exemple de livrable (diagnostic seulement) ; **orientation** vers une autre prestation si ce n'est pas la bonne ; autres prestations. Pas une copie de l'accueil. |
| Faits | Durée du diagnostic = fait `proposed`, signalé « à confirmer », absent en anglais (pas de traduction inventée) ; JSON-LD `Service` + `BreadcrumbList` avec le nom légal uniquement parce qu'il est public et confirmé. |
| Typographie | Espaces fines insécables avant ? : ; ! en français (le « ? » ne passe plus seul à la ligne). |
| Texte agrandi 200 % | 3 défauts corrigés : grille à 11 gouttières en rem (112 px de débordement à 360), adresse e-mail insécable, mots longs (« recommandation ») — césure activée. |
| Lecture | Paragraphe « Vos données » du contact remonté de 14 à 16 px. |
| État | **Prêt pour revue** — approbation du rendu toujours en attente du propriétaire. |

## Revue du 2026-11-24 — site A affiné
Captures : `examples/fixture-a-services/design/captures/site/` (sélection versionnée) ; mesures : `review.json` (Chromium 158 de l'environnement, hors révision Playwright ; 360, 390, 768, 1440 px ; @2x ; mouvement réduit ; CSP meta active).

| Demande du propriétaire | Réalisation | Preuve |
|---|---|---|
| Raccourcir l'accroche, coupures mobiles | « Des achats pilotés, / *sans service achats.* » : deux lignes imposées par blocs, identiques de 360 à 1440 px | `home-360.png`, `home-390.png`, `home-1440.png` |
| Rythme entre sections | Trois régimes au lieu d'un : ouverture très aérée ; registre sur papier ; bande `paper-deep` pour l'aperçu de livrable ; sections courtes (méthode, exclusions) ; clôture sur encre | `home-1440.png` |
| Lecture et cibles à 360/390 | Texte courant 16 px min., petit texte remonté à 14 px min. ; navigation, sommaire, boutons, champs ≥ 44×44 px ; autres liens ≥ 24 px (2.5.8) ; aucun débordement horizontal | `review.json` (0 problème) |
| Aperçu de livrable fictif | Matrice de priorisation en SVG (deux géométries : large et mobile), données inventées sans montant, étiquette « exemple fictif », tableau de données équivalent dans un `<details>` | `home-390.png`, `home-1440.png` |

| Dimension | État | Commentaire |
|---|---|---|
| Clarté | Prêt pour revue | Cible, offre et suite lisibles dans le premier écran. |
| Identité | Prêt pour revue | Repères « § », registre en sous-grille, italique rouge, matrice : reconnaissable sans logo. |
| Typographie | Prêt pour revue | Coupures maîtrisées ; anglais testé à 390 px ; allemand non concerné (FR/EN). |
| Composition | Prêt pour revue | Rythme varié ; registre aligné en sous-grille au desktop. |
| Médias | Prêt pour revue | Aucune photo (aucun actif autorisé) ; SVG original à données fictives. |
| Usage | Prêt pour revue | Formulaire avec et sans JS, résumé d'erreurs focalisé, `aria-invalid`, double envoi bloqué ; recette 44/44 (Chromium). Firefox/WebKit : CI. Zoom texte 200 % : non testé. |
| Crédibilité | Prêt pour revue | Faits `proposed` signalés « à confirmer » ; durée non traduite en anglais plutôt qu'inventée (« — »). |
| Finition | À corriger (mineur) | Libellés de la matrice proches de la médiane sur mobile (halo ajouté) ; pastille « à confirmer » passe à la ligne dans le registre desktop ; canonical de la page 404 retiré. |

## Défauts trouvés et corrigés pendant cette revue
1. Matrice illisible à 360 px (SVG réduit) → géométrie compacte dédiée, texte ≥ 11 px à l'échelle d'origine (≈ 15 px rendus).
2. Petit texte à 13 px → 14 px minimum (`--step--1`).
3. Formulaire collé au chapeau → espacement.
4. Fichier caché `public/.gitkeep` servi → retiré ; l'audit de release le bloque désormais.

## Historique
- Incrément 1 : revue des prototypes A et B (grille A corrigée, clôture réalignée).
