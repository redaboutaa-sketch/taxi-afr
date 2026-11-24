# Premium Website Factory

Template de production de sites vitrines et B2B statiques (Astro), avec moteur actualisable, brief progressif et contrôles bloquants.

> **État : usine 0.2.0.** Contrats et brief progressif, formulaire PHP (contrat partagé JS/PHP, date/heure/nombre et règles entre champs), release auditée et empreintée, profil `vps-nginx` recetté en conteneurs, bascule/rollback, mise à jour de l'usine, publication attestée. Non implémentés : profils `apache-shared` et `vps-proxy`, SBOM, agrégat `qa`, redirections par chemin. Voir `docs/audit-remediation.md` et `docs/quality-report.md`.

## Démarrage (commandes vérifiées le 2026-11-24, Node 26.13.1 / npm 11.20.0)

```bash
npm ci
```

```bash
FACTORY_SITE_DIR=examples/fixture-a-services npm run factory:validate -- --mode preview
```

```bash
FACTORY_SITE_DIR=examples/fixture-a-services npm run dev
```

Puis ouvrir `/prototypes/planche/`. Pour créer votre propre site à partir d'un brief (guide : `docs/nouveau-site.md`) :

```bash
npm run factory:init -- --brief chemin/vers/brief.yaml
```

Voir `AGENTS.md` pour toutes les commandes et les invariants, `engine/contracts/brief.schema.json` pour le schéma du brief (utilisable par l'éditeur via `$schema`).

## Structure
- `engine/` — moteur : contrats (`contracts/`), configuration (`config/`), intégration Astro (`astro/`), outils de design (`design/`), CLI (`cli/`), tests.
- `examples/fixture-a-services/` — démo fictive « Ostral Conseil » (FR/EN, example.com).
- `docs/` — audit, remédiation, ADR, rapports.

## Limites connues
- Captures et tests navigateur exécutés avec le Chromium 158 de l'environnement (`PW_CHROMIUM_PATH`), révision différente de celle attendue par Playwright 1.65.1.
- CI (`.github/workflows/ci.yml`) écrite mais pas encore exécutée sur GitHub.
