#!/bin/sh
# Premium Website Factory — installation, bascule atomique et retour arrière
# d'une release SUR LE SERVEUR. Shell POSIX (busybox suffit) : aucun Node requis.
#
# Disposition (FACTORY_ROOT, ex. /srv/<site>) :
#   releases/<id>/     releases installées, jamais modifiées après installation
#   current -> releases/<id>   lien basculé par renommage atomique (mv -T)
#   var/               état durable (compteur de débit…), partagé entre releases
#   deploy.log         journal : date, action, release, précédente, résultat
#
# Commandes :
#   install  --archive <f.tar.gz> --sha256 <hex> [--activate] [--health <url>] [--reload <cmd>]
#   activate --id <id> [--health <url>] [--reload <cmd>]
#   rollback [--health <url>] [--reload <cmd>]
#   list
#   prune --keep <n>
#
# Intégrité vs authenticité : l'empreinte attendue (--sha256) doit venir d'un
# canal de confiance DISTINCT de celui de l'archive (ex. notes de release
# signées, attestation vérifiée, message de l'opérateur). Une empreinte
# téléchargée à côté de l'archive ne prouve rien si la source est compromise.
set -eu

ROOT="${FACTORY_ROOT:?FACTORY_ROOT requis (ex. /srv/mon-site)}"
REL="$ROOT/releases"
LOG="$ROOT/deploy.log"
LOCK="$ROOT/.deploy.lock"

die() { printf 'factory-deploy: %s\n' "$*" >&2; exit 1; }
say() { printf '  %s\n' "$*"; }
log() { printf '%s\t%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$3" "$4" >> "$LOG"; }
valid_id() { printf '%s' "$1" | grep -Eq '^[a-z0-9][a-z0-9-]{2,80}$'; }
current_id() { [ -L "$ROOT/current" ] && basename "$(readlink "$ROOT/current")" || true; }

switch_to() { # bascule atomique : nouveau lien puis renommage par-dessus l'ancien
  ln -sfn "releases/$1" "$ROOT/current.next"
  mv -T "$ROOT/current.next" "$ROOT/current"
}

reload() {
  [ -n "${RELOAD:-}" ] || return 0
  sh -c "$RELOAD" || return 1
}

healthy() {
  [ -n "${HEALTH:-}" ] || return 0
  i=0
  while [ "$i" -lt 10 ]; do
    if wget -q -O /dev/null -T 5 "$HEALTH" 2>/dev/null; then return 0; fi
    i=$((i + 1)); sleep 1
  done
  return 1
}

# Active <id> ; en cas d'échec du rechargement ou du contrôle de santé, revient
# automatiquement à la release précédente et sort en erreur.
activate() {
  id="$1"
  valid_id "$id" || die "identifiant refusé : $id"
  [ -f "$REL/$id/release.json" ] || die "release absente : $id"
  prev="$(current_id)"
  switch_to "$id"
  if reload && healthy; then
    log activate "$id" "${prev:-none}" ok
    say "✓ active : $id (précédente : ${prev:-aucune})"
    return 0
  fi
  if [ -n "$prev" ]; then
    switch_to "$prev"
    reload || true
    log activate "$id" "$prev" "failed-rolled-back"
    die "échec du rechargement ou du contrôle de santé pour $id — retour automatique à $prev"
  fi
  log activate "$id" none failed
  die "échec pour $id et aucune release précédente"
}

cmd="${1:-}"; [ $# -gt 0 ] && shift
ARCHIVE=""; SHA=""; ID=""; KEEP=""; ACTIVATE=0; HEALTH=""; RELOAD=""
while [ $# -gt 0 ]; do
  case "$1" in
    --archive) ARCHIVE="$2"; shift 2 ;;
    --sha256) SHA="$2"; shift 2 ;;
    --id) ID="$2"; shift 2 ;;
    --keep) KEEP="$2"; shift 2 ;;
    --activate) ACTIVATE=1; shift ;;
    --health) HEALTH="$2"; shift 2 ;;
    --reload) RELOAD="$2"; shift 2 ;;
    *) die "option inconnue : $1" ;;
  esac
done

mkdir -p "$REL" "$ROOT/var"
exec 9>"$LOCK"
flock -n 9 || die "un autre déploiement est en cours"

case "$cmd" in
  install)
    [ -f "$ARCHIVE" ] || die "--archive introuvable"
    printf '%s' "$SHA" | grep -Eq '^[a-f0-9]{64}$' || die "--sha256 <64 hex> requis (canal de confiance)"
    actual="$(sha256sum "$ARCHIVE" | cut -d' ' -f1)"
    [ "$actual" = "$SHA" ] || { log install "?" "$(current_id)" "sha-mismatch"; die "empreinte de l'archive différente de l'empreinte attendue — refus"; }
    # Aucune entrée absolue, remontante, ni lien : l'archive ne sort pas de releases/.
    if tar -tzf "$ARCHIVE" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then die "chemin dangereux dans l'archive"; fi
    if tar -tvzf "$ARCHIVE" | grep -Eq '^[lhcbp]'; then die "lien ou fichier spécial dans l'archive"; fi
    top="$(tar -tzf "$ARCHIVE" | cut -d/ -f1 | sort -u)"
    [ "$(printf '%s\n' "$top" | wc -l)" -eq 1 ] || die "l'archive doit contenir un seul répertoire racine"
    valid_id "$top" || die "identifiant de release refusé : $top"
    if [ -d "$REL/$top" ]; then
      say "release déjà installée : $top"
    else
      tmp="$REL/.incoming-$$"
      rm -rf "$tmp"; mkdir -p "$tmp"
      tar -xzf "$ARCHIVE" -C "$tmp"
      (cd "$tmp/$top" && sha256sum -c SHA256SUMS >/dev/null 2>&1) || { rm -rf "$tmp"; die "fichiers non conformes à SHA256SUMS"; }
      grep -q "\"id\": \"$top\"" "$tmp/$top/release.json" || { rm -rf "$tmp"; die "release.json ne correspond pas au répertoire"; }
      mv "$tmp/$top" "$REL/$top"
      rmdir "$tmp"
      chmod -R a-w "$REL/$top"
      log install "$top" "$(current_id)" ok
      say "✓ installée : $top"
    fi
    [ "$ACTIVATE" -eq 1 ] && activate "$top"
    ;;
  activate)
    activate "$ID"
    ;;
  rollback)
    cur="$(current_id)"
    [ -n "$cur" ] || die "aucune release active"
    # Dernière activation RÉUSSIE d'une autre release que la courante.
    prev="$(awk -F'\t' -v cur="$cur" '$2=="activate" && $5=="ok" && $3!=cur {p=$3} END{print p}' "$LOG" 2>/dev/null || true)"
    [ -n "$prev" ] && [ -d "$REL/$prev" ] || die "aucune release précédente disponible"
    activate "$prev"
    log rollback "$prev" "$cur" ok
    ;;
  list)
    cur="$(current_id)"
    for d in "$REL"/*/; do
      [ -d "$d" ] || continue
      id="$(basename "$d")"
      [ "$id" = "$cur" ] && printf '* %s\n' "$id" || printf '  %s\n' "$id"
    done
    ;;
  prune)
    printf '%s' "$KEEP" | grep -Eq '^[0-9]+$' && [ "$KEEP" -ge 2 ] || die "--keep <n ≥ 2> requis (courante + précédente)"
    cur="$(current_id)"
    # Les plus récemment installées d'abord (journal), courante toujours conservée.
    keep="$(awk -F'\t' '$2=="install" && $5=="ok" {a[NR]=$3} END{for(i=NR;i>0;i--) if(a[i]) print a[i]}' "$LOG")"
    keep="$(printf '%s\n%s\n' "$cur" "$keep" | awk 'NF && !s[$0]++' | head -n "$KEEP")"
    for d in "$REL"/*/; do
      id="$(basename "$d")"
      printf '%s\n' "$keep" | grep -qx "$id" && continue
      chmod -R u+w "$d" && rm -rf "$d"
      log prune "$id" "$cur" ok
      say "supprimée : $id"
    done
    ;;
  *)
    die "commande attendue : install | activate | rollback | list | prune"
    ;;
esac
