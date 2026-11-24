# Maintenance d'un site dérivé : mise à jour de l'usine

Les copies du template ne reçoivent pas les corrections automatiquement. `factory:upgrade` les applique **fichier par fichier**, d'après `factory.manifest.json` (version de l'usine, version du schéma, empreinte de chaque fichier géré).

## Fichiers gérés
`engine/`, `tests/`, `examples/`, `.github/workflows/`, `.github/CODEOWNERS`, `docs/adr/`, configurations racine (`astro.config.ts`, `tsconfig*.json`, `vitest.config.ts`, `package.json`, `package-lock.json`, `.nvmrc`, `.npmrc`, `.gitignore`), `AGENTS.md`, `CLAUDE.md`. **Jamais** : `site/` (contenu, design, décisions), `.env*`, `*.local.php`.

## Procédure
1. Obtenir la nouvelle version de l'usine (répertoire ou archive) et son empreinte par un canal de confiance (archive : empreinte de l'archive ; répertoire : empreinte de son `factory.manifest.json`). Aucune URL n'est téléchargée ni exécutée par l'outil.
2. Simuler :
   ```
   npm run factory:upgrade -- --to 0.2.0 --from ../factory-0.2.0.tar.gz --sha256 <hex> --dry-run
   ```
   Pour chaque fichier : ajout, mise à jour, suppression, déjà à jour, modification locale conservée (l'amont n'a pas changé), ou **conflit** (modifié localement ET en amont). Plan : `.generated/upgrade/plan.json` ; versions proposées des fichiers en conflit : `.generated/upgrade/conflicts/`.
3. Résoudre les conflits (fusion manuelle, ou restauration de la version de l'usine), commiter, relancer la simulation.
4. Appliquer (dépôt git propre exigé) :
   ```
   npm run factory:upgrade -- --to 0.2.0 --from ../factory-0.2.0.tar.gz --sha256 <hex> --apply
   ```
   Les changements sont posés **non commités** sur la branche `factory-upgrade/<version>` : relire `git diff --stat <branche précédente>`, puis `npm ci && npm run check && npm test`, et migrer le brief si annoncé (`npm run factory:migrate -- --apply`, sauvegarde `brief.yaml.v<N>.bak` conservée ; les commentaires YAML ne sont pas conservés).
5. Annuler : `git add -A && git reset --hard && git switch <branche précédente> && git branch -D factory-upgrade/<version>`.

## Dans le dépôt-template
`npm run factory:manifest` régénère le manifeste ; la CI vérifie qu'il est à jour (`manifest --check`) uniquement en présence du marqueur `.factory-template`. Une copie client supprime ce marqueur.

## Vérifié
`tests/integration/upgrade.test.ts` : copie client réelle, usine 0.2.0 simulée (modification, ajout, suppression), conflit détecté et jamais écrasé, empreinte et version erronées refusées, application sur branche, `site/` inchangé, validation du site avec le moteur mis à jour, retour arrière. `engine/tests/migrations.test.ts` : chaîne de migrations (registre de test 1→2→3), refus d'étape manquante, de brief trop récent, de migration oubliant `schemaVersion`, détection d'un brief périmé.
