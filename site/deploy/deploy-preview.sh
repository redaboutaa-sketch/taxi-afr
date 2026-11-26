#!/bin/sh
# Installe une release AFR TAXI dans /srv/afr-taxi et (re)démarre la préversion.
# Usage (root, sur le VPS) : sh site/deploy/deploy-preview.sh .generated/releases/<id>.tar.gz
# Vérifie l'empreinte de l'archive et chaque fichier (SHA256SUMS) avant de basculer.
set -eu
ARCHIVE="$1"
ROOT=/srv/afr-taxi
APP=/opt/afr-taxi-site
ID=$(basename "$ARCHIVE" .tar.gz)

( cd "$(dirname "$ARCHIVE")" && sha256sum -c "$ID.tar.gz.sha256" )
mkdir -p "$ROOT/releases" "$ROOT/var"
chown 82:82 "$ROOT/var" && chmod 700 "$ROOT/var"   # www-data de l'image php alpine
if [ ! -d "$ROOT/releases/$ID" ]; then
  tar -xzf "$ARCHIVE" -C "$ROOT/releases"
fi
( cd "$ROOT/releases/$ID" && sha256sum -c --quiet SHA256SUMS )
ln -sfn "releases/$ID" "$ROOT/current.tmp" && mv -T "$ROOT/current.tmp" "$ROOT/current"
echo "release active : $ID"

# Les configurations nginx/PHP sont montées depuis la release courante : redémarrage.
cd "$APP" && docker compose up -d --force-recreate
docker compose ps
