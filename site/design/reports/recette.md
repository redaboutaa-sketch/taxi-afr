# Recette AFR TAXI — résultats observés (2026-11-24)

Environnement : conteneur Linux de la session, Node 26.13.1, PHP CLI 8.3.6, Docker 29.9.3 (nginx 1.30.8 + PHP-FPM 8.4.28, images épinglées), **Chromium 158 hors révision Playwright** (`PW_CHROMIUM_PATH`). Firefox et WebKit : non exécutés ici. Usine 0.2.0. Release `afr-taxi-preview-7b1c8a709baf` (direction B « Bandeau »), rejouée après le choix de piste.

| Contrôle | Commande | Résultat |
|---|---|---|
| Brief preview / release | `npm run factory:validate -- --mode preview` / `--mode release` | valide / **refusé, 33 points** (attendu : faits non confirmés, capture, approbation du rendu, relecteur) |
| Tests usine (dont parité date-heure JS/PHP) | `npm test` | 14 fichiers, 122 tests |
| Tests du site (brouillon WhatsApp) | `npx vitest run --config site/vitest.config.ts` | 6/6 |
| Types | `FACTORY_SITE_DIR=examples/fixture-a-services npm run check` (commande de la CI) | 0 erreur, 138 fichiers (dont `site/`) |
| Types, site actif = `site/` | `npm run check` | 0 erreur dans `site/` et `engine/` ; **5 erreurs dans `examples/fixture-a-services`** : les types `cssVariable` des polices sont générés depuis le site actif — limite de l'usine |
| Release + audit + empreintes | `npm run release -- --profile vps-nginx --profile-json tests/recipe/profile.json` ; `npm run qa:release` | 28 contrôles, 0 bloquant ; 249 fichiers conformes |
| Recette nginx + PHP-FPM | `node qa/afr/recipe.ts --release <dir>` | **60/60** (rapport : `recette-local.json`) |
| Parcours WhatsApp (numéro fictif de test, copie temporaire) | `node qa/afr/whatsapp-flow.ts` | 14/14 |
| Revue outillée 360/390/768/1440 | `node tests/visual/review.ts --pages …` (13 pages, rendu B) | 0 problème après corrections (cibles de liens isolés, débordements) |
| Texte 200 % | `node tests/visual/text-zoom.ts --pages …` | 0 débordement après corrections |
| Lighthouse 13.6.0 mobile, médiane de 3, release servie par nginx | `npm run qa:perf -- --release <dir> --runs 3 --pages /,/contact/,/transport-medical/,/contact/envoyee/` | budgets respectés : perf 100 et a11y 100 à l'accueil, CLS 0, TBT 0 ms ; accueil 58,7 Ko dont 47,9 Ko de polices (`lighthouse-local.json`) |

Couverture des cas AFR TAXI (recette 60/60) : lien `tel:` sans JS ; anciennes routes avec et sans barre finale + canonicals ; vraie 404 ; surfaces internes non servies ; aucune adresse interne ni identité non confirmée servie ; aucun champ médical ; mention « ne vaut pas confirmation » ; date passée, date impossible, heure ambiguë (changement d'heure), injection d'en-tête, champ inattendu, 20 Ko, origine étrangère, panne SMTP → rejetés sans envoi ; demande valide acceptée par la capture (destinataire, From, Reply-To, trajet lisible, « Horaire interprété … Europe/Paris ») ; e-mail facultatif ; parcours sans JS vers des pages de résultat honnêtes ; aucune donnée de formulaire dans l'URL ; avec JS : message « acceptée par notre serveur d'envoi… pas une confirmation de course », saisie conservée en panne, aucune violation CSP, aucune requête externe ; limitation de débit ; journaux sans contenu de demande.

## Non couvert / externe (`pending_external`)
Réception réelle par le chauffeur, SMTP réel, SPF/DKIM/DMARC, TLS, DNS, hébergement cible, ouverture réelle de WhatsApp (téléphone et Web), Firefox/WebKit, lecteur d'écran, revue humaine du design, relecture juridique, inventaire complet des anciennes URL, performance terrain.
