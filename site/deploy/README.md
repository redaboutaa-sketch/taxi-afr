# Site AFR TAXI sur le VPS (pages + envoi d'e-mails)

## Envoi des e-mails : Brevo (depuis le 2026-11-27)
Expéditeur `contact@afr-taxi.com` via `smtp-relay.brevo.com:587` (STARTTLS) ; les demandes arrivent directement sur `afr.taxi26@gmail.com`. Mise en place, une seule fois, par le propriétaire (le client n'a rien à faire) :
1. Compte Brevo (offre gratuite : 300 e-mails/jour). **Expéditeurs, domaines et IP dédiées → Domaines → Ajouter `afr-taxi.com` → Authentifier.**
2. Chez Hostinger (DNS de afr-taxi.com), ajouter **exactement** les enregistrements affichés par Brevo (code de vérification TXT, DKIM, DMARC), puis cliquer sur « Vérifier » dans Brevo.
3. **Expéditeurs → Ajouter** `contact@afr-taxi.com` (nom : AFR TAXI).
4. **SMTP et API → onglet SMTP → Générer une clé SMTP.** Noter le **login SMTP** affiché (forme `xxxx@smtp-brevo.com`) et la **clé** (affichée une seule fois).
5. Sur le VPS (remplacer les deux valeurs ; rien n'est versionné) :
   ```
   printf 'AFR_SMTP_USER=%s\nAFR_SMTP_PASSWORD=%s\n' 'LOGIN_SMTP_BREVO' 'CLE_SMTP_BREVO' > /opt/afr-taxi-prod/smtp.env && chmod 600 /opt/afr-taxi-prod/smtp.env
   cd /opt/afr-taxi-prod && docker compose up -d --force-recreate php
   ```
Redirection de `contact@afr-taxi.com` vers la boîte Gmail (pour les réponses écrites à cette adresse) : à configurer chez Hostinger (transfert d'e-mail), indépendamment du site.

---
Historique — préversion complète (Gmail, abandonné le 2026-11-27 au profit de Brevo) :

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
- Un envoi depuis le formulaire doit arriver dans la boîte afr.taxi26@gmail.com. `outcome=transport_error` : identifiants refusés (login/clé SMTP Brevo) ou domaine non authentifié chez Brevo.

## Mise en production sur www.afr-taxi.com

DNS (fait le 2026-11-26) : `A @ 76.13.44.177`, `CNAME www afr-taxi.com`.

Release de production réelle testée en conteneurs (2026-11-26, `afr-taxi-production-acbd5a4ce46c`) : audit 31/31, empreintes 312 fichiers, `www.afr-taxi.com/` 200 sans noindex, `afr-taxi.com/taxi-prive/` → 301 `https://www.afr-taxi.com/taxi-prive/`, sitemap 200, formulaire sans identifiants → `transport_not_configured`, empreinte des pages = scopeDigest. Chaîne testée auparavant sur une copie (valeurs légales fictives, 2026-11-26) : brief `release` valide, release `production` assemblée, audit 31/31, redirection `afr-taxi.com` → `https://www.afr-taxi.com` (nginx généré), robots/sitemap/canonicals en `www.afr-taxi.com`, origine du formulaire `https://www.afr-taxi.com`.

Une fois le brief complet (`npm run factory:validate -- --mode release` sans erreur) et l'autorisation de publication donnée :
```
mkdir -p /opt/afr-taxi-prod && cd /opt/afr-taxi-prod
cp /opt/taxi-afr/site/deploy/docker-compose.production.yml docker-compose.yml
cp /opt/taxi-afr/site/deploy/realip.conf .
cp /opt/afr-taxi-site/smtp.env . && chmod 600 smtp.env      # mêmes identifiants Gmail
cd /opt/taxi-afr && export PATH=/opt/node26/bin:$PATH && git pull
npm run release -- --profile vps-nginx --target production --profile-json site/deploy/production-traefik.json
npm run qa:release -- --release "$(ls -dt .generated/releases/afr-taxi-production-*/ | head -1)"
sh site/deploy/pages-digest.sh "$(ls -dt .generated/releases/afr-taxi-production-*/ | head -1)"public   # doit afficher le scopeDigest du brief
AFR_ROOT=/srv/afr-taxi-prod AFR_APP=/opt/afr-taxi-prod sh site/deploy/deploy-preview.sh "$(ls -t .generated/releases/afr-taxi-production-*.tar.gz | head -1)"
```
Vérifier ensuite : `https://www.afr-taxi.com/` (200), `https://afr-taxi.com/` (301 vers www), un envoi du formulaire reçu sur afr.taxi26@gmail.com. Retour arrière : relancer le script avec l'archive précédente, ou `cd /opt/afr-taxi-prod && docker compose down` (Traefik renvoie alors 404).
Après mise en ligne : adresse du site dans la fiche Google Business Profile, déclaration dans Google Search Console (sitemap `https://www.afr-taxi.com/sitemap.xml`), arrêt de la préversion.
