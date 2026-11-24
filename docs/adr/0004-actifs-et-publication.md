# ADR 0004 — Registre d'actifs et publication des faits par surface

Statut : accepté (incrément 4) · 2026-11-24

## Registre d'actifs (`<site>/assets/registry.yaml`, contrat `engine/assets/contract.ts`)
Quatre volets séparés : **déclaré** (source, auteur, déclaration du fournisseur), **observé** (écrit par `factory:assets scan` : empreinte SHA-256, format par octets magiques, dimensions, alpha, présence EXIF/XMP, marqueur C2PA, `digitalSourceType` IPTC lu tel quel), **signature** (`not_checked` tant qu'aucun outil ne l'a vérifiée — aucun n'est intégré aujourd'hui), **droits** (statut, portée, référence de preuve PRIVÉE, restrictions, expiration).

Un actif n'est publiable que s'il est `approved` ET : fichier présent et inchangé depuis le scan ; décision humaine enregistrée ; droits `granted` avec référence de preuve, ou `not_required` justifié ; pas de conflit déclaration/observation ; pas d'actif de benchmark ; pas d'image générée montrant un produit, un lieu, une personne ou un résultat ; illustration générée seulement si `design.allowGeneratedIllustrations`. Transformations admises : uniquement non génératives.

Les pages n'accèdent aux images que par `virtual:factory/assets`, qui n'**importe** que les actifs publiables : un fichier non approuvé n'est jamais émis. `asset(id)` lève si l'actif est inconnu ou non publiable (le build échoue). Aucune donnée de droits ni de provenance n'est exposée aux pages. Les images déposées directement dans `<site>/public/` sont refusées. Après le build, `assetLeaks` vérifie qu'aucune copie exacte ni dérivé nommé d'un actif non publiable n'est dans l'artefact.

Limites : l'observation constate la présence de métadonnées, elle ne prouve ni l'origine, ni la véracité, ni les droits ; une absence de métadonnées ne prouve rien. La recherche de dérivés par nom suppose la convention de nommage d'Astro (`nom.<hash>.ext`).

## Publication des faits par surface
`findLeaks` contrôle chaque fait projeté sur cinq surfaces : texte des pages, `<title>`/`<meta content>` (description, OpenGraph), JSON-LD, scripts (inline et `.js`), sitemap. Un fait non projeté (interne, retenu, non confirmé en production) est recherché dans tout l'artefact.

## robots.txt et sitemap.xml
Générés par le moteur (`engine/astro/crawl.ts`) ; un fichier fourni par le site est refusé. Preview : `Disallow: /`, aucun sitemap (rappel : ce n'est pas une protection d'accès). Production : exploration autorisée, sitemap des pages dont la balise robots autorise l'indexation, à leur URL canonique (les pages de résultat et la 404 du site de démonstration sont `noindex`).
