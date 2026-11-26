# Plan de migration des URL

> **2026-11-26 : le nouveau site sera publié sur `www.afr-taxi.com`.** L'ancien propriétaire conserve `afr-taxi.fr` : aucune redirection 301 de l'ancien site n'est possible et son ancienneté dans Google est perdue. Les chemins ci-dessous restent identiques sur le nouveau domaine (si l'ancien propriétaire accepte un jour de rediriger, la correspondance est directe). Leviers qui restent : mettre l'adresse du nouveau site dans la fiche Google Business Profile, demander à l'ancien propriétaire de retirer le nom « AFR TAXI » ou de rediriger, déclarer `www.afr-taxi.com` dans Google Search Console à la mise en ligne.

Inventaire de départ : routes listées dans le brief de mission. Le site actuel n'a pas pu être exploré depuis la session (hôte hors réseau autorisé) : **l'inventaire complet (actualités, avis, autres pages) reste à faire** avant publication, idéalement avec la Search Console.

| Ancienne URL | Nouvelle page | Traitement | État |
|---|---|---|---|
| `/` | `/` | conservée | fait |
| `/taxi-prive` | `/taxi-prive/` | conservée (servie aussi sans barre finale ; canonique avec barre) | fait, recette `route /taxi-prive` |
| `/transfert-gare-aeroport` | `/transfert-gare-aeroport/` | conservée | fait |
| `/a-propos` | `/a-propos/` | conservée | fait |
| `/contact` | `/contact/` (`#demande`) | conservée, demande structurée | fait |
| `/assistance` | `/assistance/` | **page d'orientation** vers les deux services séparés (pas de redirection arbitraire) | fait |
| — | `/transport-medical/` | nouvelle, conditionnelle à la confirmation du conventionnement | provisoire |
| — | `/assistance-deplacement/` | nouvelle, conditionnelle | provisoire |
| `/mentions-legales` | `/mentions-legales/` | conservée, contenu issu des faits | valeurs à confirmer |
| `/vie-privee` | `/vie-privee/` | conservée, traitements réels | durée de conservation à fixer |
| `/privacy` | `/privacy/` | page informative `noindex` → `/vie-privee/` | **301 souhaitable** : le générateur nginx du moteur ne gère pas encore de redirection par chemin (évolution d'usine à prévoir) |
| actualités, avis, autres | ? | à inventorier ; aucune suppression sans destination | à faire |

Règles : une seule redirection vers la bonne destination, aucune boucle, aucune redirection générale vers `/`, vraie 404 (vérifiée en recette). Pas de pages par commune.
