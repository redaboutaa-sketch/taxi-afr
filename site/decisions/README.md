# Décisions du site AFR TAXI

| Date | Décision | Par | Porte |
|---|---|---|---|
| 2026-11-24 | Site français seul en V1 (EN/AR non générés) | brief de mission | — |
| 2026-11-24 | Deux canaux de demande : e-mail par le serveur, ou brouillon WhatsApp envoyé par le visiteur ; appel direct partout | brief de mission | — |
| 2026-11-24 | Profil `vps-nginx` retenu **pour la preview et la recette locale seulement** : seul profil implémenté ; la cible réelle n'est pas constatée | agent (technique) | — |
| 2026-11-24 | Rendu provisoire en piste A « Ivoire » en attendant le choix | agent (provisoire) | — |
| 2026-11-24 | **Piste B « Bandeau » retenue** ; piste A et prototypes retirés | propriétaire du dépôt (message) | G2 — choix |
| 2026-11-24 | Photo du véhicule réel devant la gare en page d’accueil (actif `taxi-gare`, approuvé sur instruction) ; rendu proche de la maquette : photo, texte à gauche, demande à droite | propriétaire du dépôt (message) | — |
| 2026-11-24 | WhatsApp actif : +33 6 59 85 57 04, accord du chauffeur déclaré ; canal principal de la demande, e-mail en second | propriétaire du dépôt (message) | — |
| 2026-11-24 | Demande simplifiée : nom, téléphone, départ, destination, date, heure (+ voyageurs facultatif) ; e-mail, n° de train/vol et précisions retirés | propriétaire du dépôt (message) | — |
| 2026-11-25 | Animations au chargement, au défilement et au survol (CSS seul) | propriétaire du dépôt (message) | — |
| 2026-11-25 | Illustrations générées autorisées (`allowGeneratedIllustrations: true`) et 4 illustrations de services approuvées, mention « Illustration » visible | propriétaire du dépôt (accord écrit) | — |
| 2026-11-25 | Les 14 faits « proposés » passent « confirmés » (« Tout est ok ») ; mentions « à confirmer » retirées | propriétaire du dépôt (message) | — |
| 2026-11-25 | Numéro WhatsApp corrigé : +33 6 14 33 93 41 (même numéro que l'appel) | propriétaire du dépôt (message) | — |
| 2026-11-26 | Envoi des demandes par SMTP Gmail (afr.taxi26@gmail.com, mot de passe d'application) ; préversion complète nginx + PHP-FPM derrière Traefik (`site/deploy/`) | propriétaire du dépôt (option A) | — |
| 2026-11-26 | Domaine de publication : `afr-taxi.com` (www canonique, apex redirigé) ; `afr-taxi.fr` reste à l'ancien propriétaire | propriétaire du dépôt (message) | — |
| 2026-11-26 | Avis clients : section renvoyant vers la fiche Google (lien fourni), sans widget tiers ni note recopiée ; extraits possibles plus tard dans `site/src/content/reviews.ts` après vérification | propriétaire du dépôt (message) | — |
| 2026-11-26 | Note Google affichée : 4,9/5 sur 37 avis, relevé de novembre 2026 (à mettre à jour quand elle change) | propriétaire du dépôt (message) | — |
| 2026-11-26 | **Autorisation de publication sur www.afr-taxi.com** (« J'autorise la publication sur www.afr-taxi.com »). En attente des mentions légales, de la durée de conservation, de l'approbation du rendu et d'un envoi Gmail réussi : la release de production reste refusée par le moteur d'ici là. | propriétaire du dépôt (message) | publication |
| 2026-11-26 | **Rendu final approuvé** (« J'approuve le rendu ») ; responsable de revue : Reda Boutaa | Reda Boutaa | G2 — rendu |
| 2026-11-26 | Faits facultatifs inconnus (secteur, destinations, véhicule) non affichés (publication interne) | agent, annoncé au propriétaire | — |
| 2026-11-26 | Mentions légales : responsable de publication, forme juridique et adresse du siège rendus publics | propriétaire du dépôt (message) | — |
| 2026-11-26 | Mentions légales complétées : SIRET 881 553 051 00015 et siège 6 rue Camille Claudel, 26240 Saint-Vallier (repris des mentions de www.afr-taxi.fr, sur instruction) ; TVA non applicable (art. 293 B, déclaration du propriétaire — l'ancien site affichait un n° de TVA FR46 881 553 051, écart signalé) ; médiateur CM2C ; conservation 12 mois | propriétaire du dépôt (messages) | — |
| 2026-11-26 | Brief passé en `mode: release` ; autorisation de publication inscrite (empreinte des pages autorisées) | Reda Boutaa | publication |
| 2026-11-27 | Envoi des demandes par Brevo (`smtp-relay.brevo.com:587`, expéditeur contact@afr-taxi.com, domaine authentifié par DKIM/DMARC), livraison sur afr.taxi26@gmail.com ; remplace Gmail + mot de passe d'application (trop complexe pour le client) | propriétaire du dépôt (message) | — |
| 2026-11-27 | Carte « Demander un trajet » semi-transparente (ordinateur) ; **publication de la version `713d7d5c…0781` autorisée** (« J'autorise la publication de la version 713d7d5c sur www.afr-taxi.com ») | Reda Boutaa | publication |
| 2026-11-27 | **Site publié sur www.afr-taxi.com** (version `713d7d5c…0781`, release de production construite et déployée sur le VPS par le propriétaire ; mise en ligne constatée par lui, non observée depuis la session de l'agent) | Reda Boutaa | publication |
| 2026-11-27 | Carte de demande de l'accueil compacte ; **publication de la version `7484b277…0bd1` autorisée** (« J'autorise la publication de la version 7484b277 sur www.afr-taxi.com ») | Reda Boutaa | publication |

Autres documents : [confirmations.md](confirmations.md) (ce que le client doit confirmer), [migration.md](migration.md) (URL et redirections), [deploiement.md](deploiement.md) (préparation, non exécutée).
