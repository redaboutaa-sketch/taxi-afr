# Créer un site client avec l'usine

Commandes vérifiées le 2026-11-24 (usine 0.2.0, Node 26.13.1). Un dépôt par client ; les exemples restent des fixtures fictives.

1. **Copie client** du template, puis `npm ci`. Supprimer `.factory-template` dans la copie client (la CI cesse alors d'exiger que `factory.manifest.json` corresponde aux fichiers locaux).
2. **Brief** : écrire `brief.yaml` (schéma `engine/contracts/brief.schema.json`), en `mode: draft` ou `preview`. Faits inconnus : `value: null, status: unknown`. Faits repris d'une source non relue : `proposed`. Jamais `confirmed` sans décision du client.
3. **Initialiser** : `npm run factory:init -- --brief <chemin>` (crée `site/` depuis `engine/starter`, refuse d'écraser).
4. **Valider** : `npm run factory:validate -- --mode preview` ; `--mode release` liste ce qui bloque la publication.
5. **Formulaire** (facultatif) : `site/content/form.yaml`, contrat `engine/form/contract.ts`. Types : `text`, `email`, `tel`, `textarea`, `select`, `date`, `time`, `integer` ; règles entre champs `rules:` (ex. `datetime-future` avec fuseau IANA explicite, ADR 0006). Au moins un champ `email` ou `tel` obligatoire. Pages de résultat sans JavaScript obligatoires.
6. **Pages** : `site/src/` (Astro). Importer seulement `@engine/<module>` et `virtual:factory/{config,form,assets}`. Afficher les faits via la configuration résolue (`config.facts`, `provisional` en preview).
7. **Directions** : prototypes dans `site/design/prototypes/*.astro` (servis sous `/prototypes/` hors production) ; choix et approbation = décisions humaines (`design.selectedDirection`, `design.renderApproval`).
8. **Actifs** : `site/assets/registry.yaml` ; `npm run factory:assets -- scan` puis `-- check`.
9. **Vérifier** : `npm run build`, `npm test`, `node tests/visual/review.ts --pages …`, `node tests/visual/text-zoom.ts --pages …`.
10. **Release locale** : `npm run release -- --profile vps-nginx --profile-json tests/recipe/profile.json`, `npm run qa:release -- --release <dir>`, `npm run qa:perf -- --release <dir>`. `npm run qa:recipe` exerce le formulaire de la fixture A ; un site client écrit sa propre recette à partir de `tests/recipe/nginx-php.ts`.

Limites connues : `npm run check` type les polices (`<Font cssVariable>`) depuis le site **actif** — les exemples peuvent échouer quand `site/` est actif ; la CI type avec `FACTORY_SITE_DIR=examples/fixture-a-services`. Pas de redirection par chemin dans le générateur nginx. Profils `apache-shared` / `vps-proxy`, SBOM, agrégat `qa` : non implémentés.
