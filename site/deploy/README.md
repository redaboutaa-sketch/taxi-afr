# Préversion complète sur le VPS (pages + envoi d'e-mails par Gmail)

Architecture : Traefik (existant, `/opt/traefik`) → `afr-taxi-nginx` (configuration générée par le moteur) → `afr-taxi-php` (PHP-FPM 8.4, endpoint du formulaire) → `smtp.gmail.com:465` avec le compte `afr.taxi26@gmail.com`.
Adresse : `https://76-13-44-177.sslip.io/`, protégée par mot de passe (Traefik), `noindex`.

Testé dans des conteneurs (2026-11-26) : pages servies, en-têtes de sécurité, PHP exécuté, demande validée, sans identifiants → `transport_not_configured` (aucune connexion à Gmail), compteur anti-abus par visiteur derrière le proxy. **Non testé : un envoi réel par Gmail.**

## Une seule fois

1. **Mot de passe d'application Gmail** : sur le compte afr.taxi26@gmail.com, activer la validation en 2 étapes, puis créer un mot de passe d'application (Compte Google → Sécurité → Mots de passe des applications). Noter les 16 caractères, sans espaces.
2. **Outils de build sur le VPS** : `apt-get install -y composer` (Composer installe PHPMailer dans la release).
3. **Dossier de service** :
   ```
   mkdir -p /opt/afr-taxi-site && cd /opt/afr-taxi-site
   cp /opt/taxi-afr/site/deploy/docker-compose.preview.yml docker-compose.yml
   cp /opt/taxi-afr/site/deploy/realip.conf .
   ```
4. **Secrets SMTP** (jamais dans Git) :
   ```
   printf 'AFR_SMTP_USER=afr.taxi26@gmail.com\nAFR_SMTP_PASSWORD=%s\n' 'MOTDEPASSEAPPLICATION' > smtp.env && chmod 600 smtp.env
   ```
5. **Mot de passe de la préversion** (réutilise l'utilisateur `client`) :
   ```
   printf "AFR_BASIC_AUTH='%s'\n" "$(htpasswd -nb client 'MOTDEPASSECLIENT')" > .env && chmod 600 .env
   ```
6. **Arrêter l'ancienne préversion statique** (même adresse) : `cd /opt/afr-taxi-preview && docker compose down`.

## À chaque mise à jour

```
cd /opt/taxi-afr && git pull && export PATH=/opt/node26/bin:$PATH
npm run release -- --profile vps-nginx --profile-json site/deploy/preview-traefik.json
sh site/deploy/deploy-preview.sh "$(ls -t .generated/releases/afr-taxi-preview-*.tar.gz | head -1)"
```

Le script vérifie l'empreinte de l'archive et de chaque fichier, bascule `/srv/afr-taxi/current`, puis recrée les deux conteneurs. Retour arrière : relancer le script avec l'archive précédente.

## Vérifier

- `docker logs afr-taxi-php 2>&1 | grep factory-form | tail` : `outcome=accepted` après un envoi (le contenu des demandes n'est jamais journalisé).
- Un envoi depuis le formulaire doit arriver dans la boîte afr.taxi26@gmail.com. `outcome=transport_error` : identifiants refusés par Google (mot de passe d'application, validation en 2 étapes).

## Mise en production sur afr-taxi.com (plus tard, sur autorisation explicite)

DNS chez Hostinger (zone `afr-taxi.com`) :
- `A  @  76.13.44.177` (remplace `2.57.91.91`, la page par défaut d'Hostinger) ;
- `CNAME  www  afr-taxi.com` (déjà en place) ;
- supprimer tout enregistrement `AAAA` sur `@` ou `www` qui ne pointerait pas vers ce VPS.

Faire ce changement DNS ne publie rien tant qu'aucun conteneur ne répond à ces noms (Traefik renvoie 404).

Bloquants avant la release de production (`npm run factory:validate -- --mode release`) : mentions légales (siège, SIRET, TVA, hébergeur, médiateur), durée de conservation, approbation du rendu, responsable de revue, `mode: release`, puis autorisation de publication. La production utilisera `--target production` (indexable, sitemap, redirection `afr-taxi.com` → `www.afr-taxi.com` générée par le moteur) avec les règles Traefik `Host(`www.afr-taxi.com`) || Host(`afr-taxi.com`)`, sans mot de passe.
