# Préparation du déploiement (non exécuté)

Rien n'a été publié, ni le DNS ni le site actuel modifiés. Procédure générique : `docs/deploiement.md` (outil `engine/deploy/factory-deploy.sh` : installation vérifiée par empreinte, bascule atomique, retour automatique, rollback).

Avant toute mise en production :
1. Constater l'hébergement réel. Le profil `vps-nginx` (nginx + PHP-FPM 8.4) est le seul implémenté et recetté en conteneurs ; un mutualisé Apache ou un VPS derrière proxy **n'est pas couvert**.
2. Obtenir les confirmations de `confirmations.md` (faits, SMTP, mentions légales, direction), passer le brief en `mode: release`, `transport: smtp`.
3. `npm run release -- --profile vps-nginx --target production [--profile-json <profil serveur>]`, puis `npm run qa:release -- --release <dir>`.
4. Recette sur l'hébergement cible : envoi réel vers une boîte de **test autorisée** (pas celle du chauffeur sans accord), SPF/DKIM/DMARC, TLS, en-têtes.
5. WhatsApp : ouverture du lien sur téléphone et WhatsApp Web avec le compte autorisé du chauffeur.
6. Autorisation de publication explicite (cible + version) ; bascule ; rollback prêt (`factory-deploy rollback`).
