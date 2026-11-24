# ADR 0003 — Release et profils d'hébergement

Statut : accepté pour `vps-nginx` (incrément 2) · 2026-11-24

## Release
Ordre imposé par `engine/release/index.ts` : valider → `astro build` → endpoint + `composer install --no-dev --prefer-dist` + configurations non secrètes → **audit** (`engine/qa/release.ts`) → empreintes (`SHA256SUMS`), `release.json`, archive tar.gz déterministe (`--sort=name --mtime=@0`, `gzip -n`). Rien n'est ajouté après l'audit. Identité = site + cible + 12 premiers caractères de l'empreinte du contenu ; deux assemblages des mêmes entrées donnent la même identité (testé).

Écart d'environnement consigné : quand l'archive « dist » de Composer est inaccessible (cas de la session de développement : 403 sur api.github.com et codeload), Composer se replie sur un clone git ; les dossiers `.git` sont retirés et `release.json` porte `tools.vendorSource: "source-fallback"`. En CI, l'archive dist est attendue (`"dist"`). Les deux contenus diffèrent (fichiers exclus de l'archive dist) : les identités de release ne sont comparables qu'à mode d'installation égal.

## Profil vps-nginx
Générateur pur `engine/generators/nginx.ts` : en-têtes répétés dans chaque `location` (piège `add_header`), seul l'endpoint exécute du PHP, `.php` et fichiers cachés → 404, cache immuable sur `/_astro/`, `X-Robots-Tag` en preview, redirections 301 des domaines secondaires en production. Pool PHP-FPM généré (`clear_env`, variables nommées, téléversements désactivés).

| Capacité | vps-nginx | apache-shared | vps-proxy |
|---|---|---|---|
| Config générée | oui | à faire | à faire |
| Testée (`nginx -t` + recette conteneurs) | oui, HTTP local | non | non |
| TLS | gabarit généré, **non testé** | — | terminé par le proxy |
| Bascule atomique / rollback | `engine/deploy/factory-deploy.sh` : renommage atomique du lien `current`, retour automatique si santé KO ; **testé en conteneurs** (`qa:deploy`) | — (pas de bascule atomique par FTP) | même outil, rechargement du proxy existant à adapter |
| Vérifié en production | **non** | non | non |
