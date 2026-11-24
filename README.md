# Premium Website Factory

Template de production de sites vitrines et B2B statiques (Astro), avec moteur actualisable, brief progressif et contrôles bloquants.

> **État : incrément 1 sur 6.** Socle (contrats, configuration, CLI init/validate/doctor/schema, intégration Astro) et prototypes de direction de la démo. Le formulaire PHP, la release, les profils d'hébergement et la mise à jour du moteur ne sont pas encore implémentés : voir `docs/audit-remediation.md`.

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

Puis ouvrir `/prototypes/planche/`. Pour créer votre propre site à partir d'un brief :

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
