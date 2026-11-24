# ADR 0001 — Chaîne d'outils et versions

Statut : accepté (incrément 1) · 2026-11-24

## Décision
| Composant | Version | Raison / vérification |
|---|---|---|
| Node.js | **26.13.1** (`.nvmrc`), 24.22.3+ accepté | 26 = Active LTS (2026-10-28 → 2029-04-30), 24 = Maintenance LTS → 2028-04-30 (calendrier officiel nodejs/Release). Patchs publiés le 2026-11-10, marqués `security: true` dans `nodejs.org/dist/index.json`. Binaire 26.13.1 téléchargé depuis nodejs.org, SHA-256 contrôlé contre `SHASUMS256.txt` (intégrité ; la signature GPG n'a pas été vérifiée). |
| npm | 11.20.0 (`packageManager`) | Livré avec Node 26.13.1. |
| astro | 7.4.13 | `engines.node >=22.23.4`. Fonts API et CSP natives stables depuis la v6 (types `astro/dist/types/public/config.d.ts`). |
| typescript | 6.0.3 | `@astrojs/check@0.9.12` exige `^5 \|\| ^6` ; TS 7 (`latest`) écarté. |
| @astrojs/check | 0.9.12 | — |
| zod | 4.6.7 | `z.toJSONSchema` génère le JSON Schema du brief (une seule définition). |
| yaml | 2.9.1 | Parseur du brief (`uniqueKeys` actif). |
| vitest | 5.1.1 | `engines` : `^22.12 \|\| ^24 \|\| >=26`. |
| @playwright/test | 1.65.1 | Attend Chromium révision 1255 ; l'environnement de cette session fournit la 1243 (Chrome 158) — utilisée via `PW_CHROMIUM_PATH`, signalée dans la sortie. |
| Polices | @fontsource(-variable) 5.3.0 | OFL-1.1, fichiers servis localement via le fournisseur `local` de l'API Fonts d'Astro. |

Installation conjointe vérifiée : `npm install` sans `--force` ni `--legacy-peer-deps`, 0 vulnérabilité signalée par `npm audit` le 2026-11-24.

## Chargement du moteur TypeScript
Le moteur est en TypeScript **effaçable** (`erasableSyntaxOnly`) : la CLI s'exécute avec la suppression de types native de Node (`node engine/cli/main.ts`), sans chargeur tiers ; `astro.config.ts` et le moteur sont chargés par Vite. Contrainte : pas d'`enum`, de `namespace` ni de propriétés de paramètres ; imports avec extension `.ts`.

## Conséquences
- `engine-strict=true` : une installation sous une version de Node non supportée échoue.
- PHP 8.4 / PHPMailer / Composer : décidés pour l'incrément 2, non installés à ce jour (PHP CLI local : 8.3.6, insuffisant pour le profil).
