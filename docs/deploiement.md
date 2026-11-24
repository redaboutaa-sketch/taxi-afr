# Déploiement : installation, bascule, retour arrière (profil vps-nginx)

Outil serveur : `engine/deploy/factory-deploy.sh` (shell POSIX ; busybox suffit, aucun Node requis). À copier **une fois** sur le serveur, par exemple en `/usr/local/bin/factory-deploy`, puis à mettre à jour avec l'usine.

> Rien ici n'a été exécuté sur un serveur réel. La procédure est exercée par `npm run qa:deploy` dans des conteneurs (nginx 1.30.8, PHP-FPM 8.4.28), voir `docs/quality-report.md`. Constater l'existant avant toute modification d'un vrai serveur (ports, proxy, versions, TLS, racines, droits, emplacement des secrets) et ne remplacer aucun service existant.

## Disposition
```
/srv/<site>/
  releases/<id>/        octets de l'archive auditée, en lecture seule
  current -> releases/<id>
  var/                  état durable (compteur de débit) — accessible en écriture par PHP-FPM
  deploy.log            journal des installations, activations, refus, retours arrière
```
nginx : `/etc/nginx/conf.d/<site>.conf` → lien vers `/srv/<site>/current/config/nginx/site.conf` (la configuration suit la release active). PHP-FPM : pool `config/php-fpm/pool.conf` (variables de secrets **nommées** ; leurs valeurs viennent de l'unité systemd ou du conteneur, jamais de la release).

## Étapes
1. **Construire et auditer** (poste ou CI) : `npm run release -- --profile vps-nginx --target production`, puis `npm run qa:release -- --release <dir>`.
2. **Vérifier la provenance, puis transmettre l'empreinte** : pour une release produite par `.github/workflows/release.yml`, `npm run release:verify -- --archive <id>.tar.gz --repo <propriétaire/dépôt>` (gh authentifié requis sur le poste de l’opérateur, avec accès réseau à `api.github.com`, `tuf-repo-cdn.sigstore.dev`, `tuf-repo.github.com` et `tmaproduction.blob.core.windows.net` ; sinon la commande échoue fermée) n'affiche l'empreinte que si l'attestation est vérifiée et porte sur ces octets. Sans attestation, l'empreinte doit venir d'un canal de confiance distinct de l'archive. Une empreinte téléchargée à côté de l'archive ne prouve pas son authenticité.
3. **Installer et activer** (sur le serveur) :
   ```
   FACTORY_ROOT=/srv/<site> factory-deploy install --archive <id>.tar.gz --sha256 <hex> --activate \
     --health https://<hôte>/ --reload 'nginx -t && systemctl reload nginx'
   ```
   L'archive est refusée si l'empreinte diffère, si elle contient un chemin absolu, remontant, un lien ou un fichier spécial, ou si un fichier ne correspond pas à `SHA256SUMS`. La bascule est un renommage atomique du lien `current`. Si le rechargement ou le contrôle de santé échoue, **retour automatique** à la release précédente.
4. **Retour arrière** : `FACTORY_ROOT=/srv/<site> factory-deploy rollback --health … --reload …` (dernière activation réussie d'une autre release).
5. **Inventaire / purge** : `factory-deploy list`, `factory-deploy prune --keep 3` (la release courante est toujours conservée).

## Points de conception vérifiés
- nginx passe `$realpath_root` à PHP : après bascule, PHP exécute la nouvelle release sans redémarrage malgré son cache de chemins (vérifié en recette avec un contrat de formulaire différent entre v1 et v2).
- Bascule sous trafic : aucune réponse en erreur observée en recette. Après `nginx -s reload`, les anciens workers ferment leurs connexions keep-alive inactives : un client qui réutilise une telle connexion doit rejouer la requête (les navigateurs le font).
- Une modification du pool PHP-FPM (nouveaux noms de variables) exige un rechargement de PHP-FPM, non automatisé par l'outil.

## Limites
- Mutualisé Apache sans accès shell : non couvert (profil `apache-shared` à faire ; pas de bascule atomique possible par FTP).
- TLS, DNS, HSTS : à vérifier sur la cible réelle ; non testés ici.
- Publication réelle : uniquement sur autorisation explicite pour la cible et la version.
