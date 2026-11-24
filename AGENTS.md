# Règles communes aux agents — Premium Website Factory

Ce fichier est la source unique des invariants. `CLAUDE.md` l'importe ; ne pas dupliquer ces règles ailleurs.

## Ce qu'est ce dépôt
Un template : `engine/` (moteur générique, mis à jour par l'usine) + un site client (`site/`, ou `examples/<fixture>` via `FACTORY_SITE_DIR`).

## Commandes réelles (vérifiées)
| Commande | Effet |
|---|---|
| `npm ci` | installation verrouillée (Node 26.13.1 de référence, 24.22.3+ supporté) |
| `npm run factory:init -- --example <nom>` ou `-- --brief <chemin>` | crée `site/` ; refuse d'écraser un site existant |
| `npm run factory:validate -- --mode draft\|preview\|release [--production]` | valide le brief, erreurs groupées |
| `npm run factory:doctor` | diagnostic d'environnement, sans afficher de secret |
| `npm run factory:schema [-- --check]` | régénère/vérifie `engine/contracts/brief.schema.json` |
| `npm run dev` / `npm run build` | Astro ; la validation du brief s'exécute aussi sur `astro build` direct |
| `npm run check` | schéma à jour + `astro check` + `tsc` du moteur |
| `npm test` | Vitest : contrats, rejets, frontières, builds réels |
| `npm run shots:prototype` | captures des prototypes sous la CSP de l'artefact (après `npm run build`) |
| `npm run release -- --profile vps-nginx [--target preview\|production] [--profile-json <f>]` | assemble pages + endpoint + vendor + configs, audite, empreintes, archive. **Ne déploie rien.** |
| `npm run qa:release -- --release <dir>` | vérifie SHA256SUMS et ré-audite une release |
| `npm run qa:recipe -- --release <dir> [--browsers chromium,firefox,webkit]` | recette locale : nginx + PHP-FPM 8.4 en conteneurs, SMTP de capture, parcours navigateur |
| `npm run qa:perf -- --release <dir> [--runs 3] [--pages /,/contact/]` | Lighthouse 13 (mobile, médiane de 3) sur la release servie par nginx ; budgets perf ≥ 95, JS ≤ 60 Ko, accueil ≤ 1 Mo |
| `node tests/visual/review.ts --pages …` / `node tests/visual/text-zoom.ts --pages …` | revue outillée (360/390/768/1440) ; texte agrandi à 200 % (après `npm run build`) |

| `npm run qa:deploy` | recette de bascule : install, bascule sous trafic, rollback, refus d'intégrité, retour automatique (conteneurs) |
| `npm run factory:assets -- scan` / `-- check [--mode m]` | observe les fichiers du registre d'actifs (écrit `observed`) / applique ses règles |
| `npm run factory:manifest [-- --check]` | (re)génère `factory.manifest.json` (fichiers gérés) |
| `npm run factory:upgrade -- --to <v> --from <dir\|archive> --sha256 <hex> [--dry-run\|--apply]` | mise à jour de l'usine sur une branche dédiée ; conflits jamais écrasés ; `site/` jamais touché |
| `npm run factory:migrate [-- --apply]` | migre le brief vers le schéma courant (sauvegarde conservée) |
| `.github/workflows/release.yml` (manuel) | build audité + **attestation de provenance** de l'archive, puis brouillon de release dans l'environnement protégé `release`. Ne déploie rien. |
| `npm run release:verify -- --archive <f.tar.gz> --repo <o/r>` | vérifie l'attestation (gh) ; n'affiche l'empreinte à transmettre au serveur que si elle est vérifiée |
| `engine/deploy/factory-deploy.sh` (serveur) | install / activate / rollback / list / prune — voir `docs/deploiement.md` |

Pas encore implémentées : `qa` (agrégat), `qa:remote`, profils `apache-shared` et `vps-proxy`, SBOM. Ne pas les présenter comme disponibles.

Variables non secrètes : `FACTORY_SITE_DIR`, `FACTORY_TARGET` (`preview` par défaut, `production` exige un brief `release`), `FACTORY_OUT_DIR`, `FACTORY_PREVIEW_ORIGIN`, `PW_CHROMIUM_PATH`, `FACTORY_REQUIRE_PHP` (CI : PHP/Composer obligatoires), `FACTORY_PARITY_PHP_IMAGE`.

## Invariants
1. `engine/` n'importe jamais `site/` ni `examples/` ; un site n'importe que `@engine/<module>` et les modules `virtual:factory/config`, `virtual:factory/form`, `virtual:factory/assets` (test : `engine/tests/boundaries.test.ts`).
2. Le brief ne contient aucun secret : seulement des références `env:NOM`. Le schéma est strict.
3. Les pages ne lisent que la configuration résolue (`virtual:factory/config`) : faits projetés selon `publication`, jamais d'adresse interne.
4. Un fait `proposed` n'est jamais promu `confirmed` par un agent. Statut et publication sont des décisions humaines.
5. Le domaine web ne détermine ni l'expéditeur, ni le destinataire, ni la preview.
6. Pas de `unsafe-inline` / `unsafe-eval` en CSP ; navigation MPA (pas de `<ClientRouter />`, incompatible avec la CSP native d'Astro).
7. Aucun actif sans droits établis ; aucune image produit générée ou retouchée de façon trompeuse. Les images passent par `<site>/assets/registry.yaml` ; une approbation (`status: approved`, `decision`) est une décision humaine, jamais prise par un agent.
8. Aucune réussite déclarée sans sortie de commande observée ; les vérifications externes restent `pending_external`.
9. Publication réelle : uniquement sur autorisation explicite pour cette cible et cette version.

## Frontières de modification
- Agent travaillant pour un client : modifier `site/` (contenu, design, pages). Ne pas modifier `engine/` pour un besoin d'un seul client.
- Évolution de l'usine : `engine/`, `.github/`, `docs/`, avec tests de rejet associés.

## Décisions
Décisions propres au site : `<site>/decisions/`. Décisions d'architecture de l'usine : `docs/adr/`.
