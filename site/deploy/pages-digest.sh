#!/bin/sh
# Empreinte des pages d'une release (dossier public/, endpoint api/ exclu) :
# doit être égale à delivery.publicationAuthorization.scopeDigest du brief.
# Usage : sh site/deploy/pages-digest.sh <release>/public
set -eu
cd "$1"
find . -type f ! -path './api/*' | LC_ALL=C sort | sed 's#^\./##' | while read -r f; do
  printf '%s  %s\n' "$(sha256sum "$f" | cut -d' ' -f1)" "$f"
done | sha256sum | cut -d' ' -f1
