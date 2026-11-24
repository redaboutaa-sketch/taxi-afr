# AFR TAXI — deux pistes de direction

Prototypes navigateur (hors production, `noindex`) : `/prototypes/piste-a/` et `/prototypes/piste-b/` en preview (`npm run dev` ou release preview). Captures : `captures/prototypes-piste-{a,b}-{390,1440}.png`.

Les deux pistes partagent le contenu, les parcours et l'accessibilité ; elles diffèrent par la composition, la densité, la typographie et le traitement des services. **Choisir une piste est une décision du client** (porte G2, `design.selectedDirection` du brief), distincte de l'approbation du rendu final.

| | A « Ivoire » — recommandée | B « Bandeau » |
|---|---|---|
| Intention | Professionnel local, soigneux, rassurant | Mobilité contemporaine, plus graphique |
| Origine | Brief de mission (piste A) | Maquette d'accueil transmise le 2026-11-24, corrigée |
| Fond / texte | Blanc chaud `#fbf8f1`, ardoise `#1c2733` | Graphite `#15191f` en tête et hero, blanc cassé ensuite |
| Accent | Ambre `#e3a62a`, réservé aux repères (numéro, étapes, soulignés) | Jaune taxi `#f5c518` sur actions et repères ; bleu franc pour « Demander » |
| Typographie | Public Sans seule, titres 800, casse normale | Titres IBM Plex Sans Condensed en capitales, texte Public Sans |
| Hero | Titre + panneau « Un trajet à prévoir ? » sur fond clair | Bandeau sombre pleine largeur + carte de demande blanche |
| Services | Liste numérotée éditoriale, pleine largeur | Cartes à pastille, grille adaptative |
| Bandeau de repères | Fin, sur fond blanc | Sombre, comme la maquette |

## Ce qui a été retiré de la maquette (piste B)
- Logo « L'Assurance Maladie » et badge « Taxi conventionné CPAM » : marque d'un organisme public et conventionnement **non confirmés** ; le service est décrit sur sa page, sans logo.
- « Votre taxi disponible 24h/24 et 7j/7 » en titre : fait `business.hours` seulement `proposed`, affiché comme repère « à confirmer », pas comme promesse.
- Photos (gare, véhicule, avion, chauffeur) : aucune n'est autorisée ni d'origine établie ; plusieurs semblent générées. Aucune photo n'est publiée tant que le client n'a pas fourni les originaux (registre d'actifs vide).
- Formulaire complet dans le hero envoyant « via WhatsApp » : une seule saisie, sur `/contact/#demande`, avec choix e-mail **ou** WhatsApp ; l'accueil y renvoie (pas de second parcours).
- « Paiement CB, espèces », « Sécurité et fiabilité », « Toutes destinations » : non confirmés, retirés.

## Revue qualitative (agent, avant validation humaine)
Clarté : appel et demande visibles au premier écran sur mobile et bureau ; services séparés (médical ≠ incident). Identité : wordmark typographique **provisoire** (logo original non fourni). Typographie : 1–2 familles locales sous licence OFL, tailles fluides. Composition : rythme hero → services → étapes → chauffeur → réponses → contact. Médias : aucun, faute d'actifs autorisés — c'est le principal manque visuel. Usage : barre d'action mobile qui disparaît pendant la saisie ; formulaire groupé en deux blocs. Crédibilité : chaque fait non confirmé porte « à confirmer ». Finition : focus visibles, cibles ≥ 44 px pour les actions, aucun débordement de 360 à 1440 px ni à 200 % de texte.
Cette revue n'est pas une validation : elle attend la décision du client.
